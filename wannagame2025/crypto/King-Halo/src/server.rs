use crate::config::{RACE_DISTANCE_MAX, RACE_DISTANCE_MIN, ROUNDS_REQUIRED, TREE_DEPTH, UMA_PER_ROUND};
use crate::merkle::{build_merkle_root_and_proofs, compute_leaf, fp_to_hex, parse_fp, verify_proof};
use crate::racing::{simulate_race, RaceEntry, RaceResult, Strategy};
use crate::uma::Uma;
use halo2_proofs::halo2curves::pasta::Fp;
use rand::seq::SliceRandom;
use rand::Rng;
use std::io::{self, BufRead, BufWriter, Write};
use std::sync::Arc;
use serde::{Deserialize, Serialize};

pub fn run_server(uma_pool: Arc<Vec<Uma>>, flag: Arc<String>) -> io::Result<()> {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = stdin.lock();
    let mut writer = BufWriter::new(stdout.lock());

    writeln!(writer, "Welcome to King Halo Championship!")?;
    writeln!(
        writer,
        "Win {} rounds in a row to claim the flag.",
        ROUNDS_REQUIRED
    )?;
    writeln!(
        writer,
        "Each round: register your horse name and strategy, then defend its Merkle proof."
    )?;
    writeln!(
        writer,
        "Prove your stallion belongs to the Merkle tree after every race. Good luck!\n"
    )?;
    writer.flush()?;

    handle_session(&mut reader, &mut writer, uma_pool, flag)
}

fn handle_session<R: BufRead, W: Write>(
    reader: &mut R,
    writer: &mut W,
    uma_pool: Arc<Vec<Uma>>,
    flag: Arc<String>,
) -> io::Result<()> {
    let mut rng = rand::thread_rng();
    let mut consecutive_wins = 0usize;

    for round in 1..=ROUNDS_REQUIRED {
        let race_distance = rng.gen_range(RACE_DISTANCE_MIN..=RACE_DISTANCE_MAX);
        writeln!(writer, "\nRound {}/{}", round, ROUNDS_REQUIRED)?;
        write!(writer, "Register your horse name: ")?;
        writer.flush()?;
        let horse_name = read_line_trimmed(reader)?;
        if horse_name.is_empty() {
            writeln!(writer, "Name cannot be empty. Session terminated.")?;
            return Ok(());
        }

        writeln!(writer, "Choose your running strategy:")?;
        writeln!(writer, "  1) Front-runner")?;
        writeln!(writer, "  2) Pace-maker")?;
        writeln!(writer, "  3) Late charge")?;
        writeln!(writer, "  4) End spurt")?;
        write!(writer, "Strategy selection: ")?;
        writer.flush()?;
        let strategy_line = read_line_trimmed(reader)?;
        let user_strategy = match parse_strategy_choice(&strategy_line) {
            Some(strategy) => strategy,
            None => {
                writeln!(writer, "Invalid strategy choice. Session terminated.")?;
                return Ok(());
            }
        };

        if uma_pool.len() < UMA_PER_ROUND {
            writeln!(writer, "Internal error: insufficient UMA data.")?;
            return Ok(());
        }

        let round_seed: u64 = rng.r#gen();
        let selection: Vec<Uma> = uma_pool
            .choose_multiple(&mut rng, UMA_PER_ROUND)
            .cloned()
            .collect();

        let mut profiles: Vec<HorseProfile> = selection
            .into_iter()
            .map(|uma| HorseProfile {
                name: uma.name,
                strategy: uma.style,
            })
            .collect();

        let user_slot = rng.gen_range(0..UMA_PER_ROUND);
        profiles[user_slot] = HorseProfile {
            name: horse_name.clone(),
            strategy: user_strategy,
        };

        let mut entries: Vec<RaceEntry> = Vec::with_capacity(UMA_PER_ROUND);
        let mut leaves: Vec<Fp> = Vec::with_capacity(UMA_PER_ROUND);

        for (idx, profile) in profiles.iter().enumerate() {
            let stats = generate_stats(&mut rng, race_distance);
            let entry = build_entry(profile, &stats);
            let stats_array = stats.to_array();
            let leaf = compute_leaf(
                &profile.name,
                profile.strategy,
                &stats_array,
                round_seed,
                idx,
                race_distance,
            );

            entries.push(entry);
            leaves.push(leaf);
        }

        let (root, proofs) = match build_merkle_root_and_proofs(&leaves) {
            Some(data) => data,
            None => {
                writeln!(writer, "Internal error: failed to build Merkle tree.")?;
                return Ok(());
            }
        };

        let user_proof = match proofs.get(user_slot) {
            Some(path) => path.clone(),
            None => {
                writeln!(writer, "Internal error: missing proof for registered horse.")?;
                return Ok(());
            }
        };
        if user_proof.len() != TREE_DEPTH {
            writeln!(writer, "Internal error: proof depth mismatch.")?;
            return Ok(());
        }

        writeln!(writer, "Race distance: {}m", race_distance)?;
        writeln!(writer, "Merkle root: {}", fp_to_hex(&root))?;
        writeln!(writer, "Your horse occupies slot {}.", user_slot)?;
        writeln!(
            writer,
            "Index | Name                 | Strategy        | Stats [spd sta pow gut wit]"
        )?;
        for (idx, entry) in entries.iter().enumerate() {
            let marker = if idx == user_slot { "*" } else { " " };
            writeln!(
                writer,
                "{}{:>2} | {:<20} | {:<15} | [{:>6.1} {:>6.1} {:>6.1} {:>6.1} {:>6.1}]",
                marker,
                idx,
                profiles[idx].name,
                entry.strategy.get_name(),
                entry.speed,
                entry.stamina,
                entry.power,
                entry.guts,
                entry.wit
            )?;
        }

        let proof_payload = ProofPayload::from_components(
            user_slot,
            &leaves[user_slot],
            &user_proof,
        );
        writeln!(writer, "Proof JSON (share & submit later):")?;
        writeln!(writer, "{}", serde_json::to_string(&proof_payload).unwrap())?;
        writer.flush()?;

        let results: Vec<RaceResult> = simulate_race(&entries, race_distance as f64, round_seed);
        if results.is_empty() {
            writeln!(writer, "Internal error: race simulation failed.")?;
            return Ok(());
        }
        let winning_index = results[0].index;

        writeln!(writer, "Submit your proof JSON: ")?;
        writer.flush()?;
        let proof_line = read_line_trimmed(reader)?;
        let provided_payload: UserProofPayload = match serde_json::from_str(&proof_line) {
            Ok(payload) => payload,
            Err(err) => {
                writeln!(writer, "Invalid JSON: {}
Game over.", err)?;
                return Ok(());
            }
        };

        let provided_leaf = match parse_fp(&provided_payload.leaf) {
            Ok(value) => value,
            Err(err) => {
                writeln!(writer, "{}
Game over.", err)?;
                return Ok(());
            }
        };
        if provided_payload.index >= leaves.len() {
            writeln!(writer, "Invalid horse index in proof. Game over.")?;
            return Ok(());
        }

        let provided_elements: Vec<Fp> = match provided_payload
            .path_elements
            .iter()
            .map(|hex| parse_fp(hex))
            .collect::<Result<Vec<_>, _>>()
        {
            Ok(vals) => vals,
            Err(err) => {
                writeln!(writer, "{}
Game over.", err)?;
                return Ok(());
            }
        };

        let provided_indices: Vec<bool> = match provided_payload
            .path_indices
            .iter()
            .map(|bit| match bit {
                0 => Ok(false),
                1 => Ok(true),
                _ => Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "path indices must be 0 or 1",
                )),
            })
            .collect::<Result<Vec<_>, _>>()
        {
            Ok(bits) => bits,
            Err(err) => {
                writeln!(writer, "{}
Game over.", err)?;
                return Ok(());
            }
        };

        if provided_elements.len() != provided_indices.len() {
            writeln!(writer, "Proof elements and indices length mismatch. Game over.")?;
            return Ok(());
        }

        let provided_proof_result: io::Result<Vec<(bool, Fp)>> = provided_indices
            .into_iter()
            .zip(provided_elements.into_iter())
            .map(|(is_left, sibling)| {
                if leaves[provided_payload.index] != provided_leaf {
                    writeln!(
                        writer,
                        "Provided leaf does not match the claimed horse slot. Game over."
                    )?;
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        "provided leaf does not match slot",
                    ));
                }
                Ok((is_left, sibling))
            })
            .collect();

        let provided_proof: Vec<(bool, Fp)> = match provided_proof_result {
            Ok(proof) => proof,
            Err(_) => {
                return Ok(());
            }
        };

        if !verify_proof(root, provided_leaf, &provided_proof, provided_proof.len()) {
            writeln!(writer, "Invalid proof. Game over.")?;
            return Ok(());
        }

        if provided_payload.index != winning_index {
            let winner = &entries[winning_index];
            let finish = results[0].finish_time;
            writeln!(
                writer,
                "Your horse lost the race. Winner: {} ({}) at {:.3}s.",
                winner.name,
                winner.strategy.get_name(),
                finish
            )?;
            return Ok(());
        }

        consecutive_wins += 1;
        let winner = &entries[winning_index];
        let finish = results[0].finish_time;
        writeln!(
            writer,
            "Victory! Current streak: {} / {}",
            consecutive_wins,
            ROUNDS_REQUIRED
        )?;
        writeln!(
            writer,
            "Winner confirmed: {} ({}) in {:.3}s",
            winner.name,
            winner.strategy.get_name(),
            finish
        )?;

        if consecutive_wins == ROUNDS_REQUIRED {
            writeln!(writer, "Congrats! Here is your flag: {}", flag)?;
            return Ok(());
        }
    }

    Ok(())
}

fn read_line_trimmed<R: BufRead>(reader: &mut R) -> io::Result<String> {
    let mut line = String::new();
    let bytes_read = reader.read_line(&mut line)?;
    if bytes_read == 0 {
        return Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            "input stream closed",
        ));
    }
    Ok(line.trim().to_string())
}

fn parse_strategy_choice(input: &str) -> Option<Strategy> {
    match input.trim().to_lowercase().as_str() {
        "1" | "front" | "front-runner" | "front runner" | "f" => Some(Strategy::Front),
        "2" | "pace" | "pace-maker" | "pace maker" | "p" => Some(Strategy::Pace),
        "3" | "late" | "late charge" | "l" => Some(Strategy::Late),
        "4" | "end" | "end spurt" | "e" => Some(Strategy::End),
        _ => None,
    }
}

fn build_entry(profile: &HorseProfile, stats: &StatBlock) -> RaceEntry {
    RaceEntry {
        name: profile.name.clone(),
        speed: stats.speed as f64,
        stamina: stats.stamina as f64,
        power: stats.power as f64,
        guts: stats.guts as f64,
        wit: stats.wit as f64,
        strategy: profile.strategy,
    }
}

fn generate_stats<R: Rng + ?Sized>(rng: &mut R, race_distance: u32) -> StatBlock {
    const MAX_STAT: u64 = 1200;

    let base_stamina = (race_distance as u64) / 3;
    let stamina_variation = rng.gen_range(150..=320);
    let stamina = (base_stamina + stamina_variation).min(MAX_STAT);

    let power = rng.gen_range(550..=1100);
    let guts = rng.gen_range(520..=1080);
    let wit = rng.gen_range(560..=1120).min(MAX_STAT);

    let mut speed = rng.gen_range(900..=MAX_STAT);
    let max_other = stamina.max(power).max(guts).max(wit);
    if speed <= max_other {
        let bonus = rng.gen_range(5..=40);
        speed = (max_other + bonus).min(MAX_STAT);
    }

    StatBlock {
        speed,
        stamina,
        power,
        guts,
        wit,
    }
}

#[derive(Clone)]
struct HorseProfile {
    name: String,
    strategy: Strategy,
}

#[derive(Clone, Copy)]
struct StatBlock {
    speed: u64,
    stamina: u64,
    power: u64,
    guts: u64,
    wit: u64,
}

impl StatBlock {
    fn to_array(self) -> [u64; 5] {
        [self.speed, self.stamina, self.power, self.guts, self.wit]
    }
}

#[derive(Serialize)]
struct ProofPayload {
    index: usize,
    leaf: String,
    path_elements: Vec<String>,
    path_indices: Vec<u8>,
}

impl ProofPayload {
    fn from_components(
        index: usize,
        leaf: &Fp,
        proof: &[(bool, Fp)],
    ) -> Self {
        let path_elements = proof.iter().map(|(_, s)| fp_to_hex(s)).collect();
        let path_indices = proof
            .iter()
            .map(|(is_left, _)| if *is_left { 1u8 } else { 0u8 })
            .collect();

        Self {
            index,
            leaf: fp_to_hex(leaf),
            path_elements,
            path_indices,
        }
    }
}

#[derive(Deserialize)]
struct UserProofPayload {
    index: usize,
    leaf: String,
    #[serde(default)]
    path_elements: Vec<String>,
    #[serde(default)]
    path_indices: Vec<u8>,
}
