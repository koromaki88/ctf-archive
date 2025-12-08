use halo2_poseidon::poseidon::primitives::{ConstantLength, Hash, P128Pow5T3 as OrchardNullifier};
use halo2_proofs::{
    circuit::Value,
    dev::MockProver,
    halo2curves::{ff::PrimeField, pasta::Fp},
};
use sha2::{Digest, Sha256};
use std::convert::TryInto;
use std::io;
use std::marker::PhantomData;

use crate::merkle_circuit::MerkleCircuit;
use crate::racing::Strategy;

pub fn compute_leaf(
    name: &str,
    strategy: Strategy,
    stats: &[u64; 5],
    round_seed: u64,
    index: usize,
    race_distance: u32,
) -> Fp {
    let mut hasher = Sha256::new();
    hasher.update(round_seed.to_be_bytes());
    hasher.update((index as u64).to_be_bytes());
    hasher.update(name.as_bytes());
    hasher.update(strategy.get_name().as_bytes());
    for stat in stats {
        hasher.update(stat.to_be_bytes());
    }
    hasher.update(race_distance.to_be_bytes());

    let digest = hasher.finalize();
    let mut repr: [u8; 32] = digest.into();
    repr[31] &= 0x0f;
    let candidate = Fp::from_repr(repr);
    if let Some(value) = Option::<Fp>::from(candidate) {
        value
    } else {
        repr[31] = 0;
        Option::<Fp>::from(Fp::from_repr(repr)).unwrap_or_else(|| Fp::from(0))
    }
}

pub fn build_merkle_root_and_proofs(leaves: &[Fp]) -> Option<(Fp, Vec<Vec<(bool, Fp)>>)> {
    build_root_with_proofs(leaves)
}

fn build_root_with_proofs(leaves: &[Fp]) -> Option<(Fp, Vec<Vec<(bool, Fp)>>)> {
    if leaves.is_empty() {
        return None;
    }

    let mut current: Vec<Fp> = leaves.to_vec();
    let mut node_to_leaves: Vec<Vec<usize>> = (0..leaves.len()).map(|i| vec![i]).collect();
    let mut proofs: Vec<Vec<(bool, Fp)>> = vec![Vec::new(); leaves.len()];

    while current.len() > 1 {
        let mut next_values: Vec<Fp> = Vec::with_capacity((current.len() + 1) / 2);
        let mut next_map: Vec<Vec<usize>> = Vec::with_capacity((current.len() + 1) / 2);
        let mut idx = 0;

        while idx < current.len() {
            let left_value = current[idx];
            let left_indices = node_to_leaves[idx].clone();

            if idx + 1 < current.len() {
                let right_value = current[idx + 1];
                let right_indices = node_to_leaves[idx + 1].clone();

                for &leaf_idx in &left_indices {
                    proofs[leaf_idx].push((false, right_value));
                }
                for &leaf_idx in &right_indices {
                    proofs[leaf_idx].push((true, left_value));
                }

                let mut merged_indices = left_indices;
                merged_indices.extend(right_indices);
                next_map.push(merged_indices);
                next_values.push(poseidon_merge(left_value, right_value));
                idx += 2;
            } else {
                for &leaf_idx in &left_indices {
                    proofs[leaf_idx].push((false, left_value));
                }

                next_map.push(left_indices);
                next_values.push(poseidon_merge(left_value, left_value));
                idx += 1;
            }
        }

        current = next_values;
        node_to_leaves = next_map;
    }

    current.into_iter().next().map(|root| (root, proofs))
}

pub fn verify_proof(root: Fp, leaf: Fp, proof: &[(bool, Fp)], expected_depth: usize) -> bool {
    if proof.len() != expected_depth {
        eprintln!(
            "[verify_proof] Depth mismatch: expected {}, got {}",
            expected_depth,
            proof.len()
        );
        return false;
    }

    let path_elements: Vec<Value<Fp>> = proof.iter().map(|(_, sibling)| Value::known(*sibling)).collect();
    let path_indices: Vec<Value<Fp>> = proof
        .iter()
        .map(|(is_left, _)| {
            let bit = if *is_left { Fp::from(1) } else { Fp::from(0) };
            Value::known(bit)
        })
        .collect();

    let circuit = MerkleCircuit::<OrchardNullifier, 3, 2> {
        leaf: Value::known(leaf),
        path_elements,
        path_indices,
        _spec: PhantomData,
    };

    match MockProver::run(12, &circuit, vec![vec![root]]) {
        Ok(prover) => {
            let is_valid = prover.verify().is_ok();
            is_valid
        }
        Err(err) => {
            false
        }
    }
}

pub fn fp_to_hex(value: &Fp) -> String {
    let repr = value.to_repr();
    hex::encode(repr.as_ref())
}

pub fn parse_fp(hex_str: &str) -> io::Result<Fp> {
    let bytes = hex::decode(hex_str.trim()).map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))?;
    if bytes.len() != 32 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "expected 32-byte canonical encoding",
        ));
    }
    let arr: [u8; 32] = bytes
        .try_into()
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "invalid length"))?;
    match Fp::from_repr(arr).into() {
        Some(value) => Ok(value),
        None => Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "non-canonical field element",
        )),
    }
}

fn poseidon_merge(left: Fp, right: Fp) -> Fp {
    Hash::<_, OrchardNullifier, ConstantLength<2>, 3, 2>::init().hash([left, right])
}
