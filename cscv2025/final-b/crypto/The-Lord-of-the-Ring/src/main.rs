use openssl::symm::Cipher;
use num_bigint::{BigUint, RandBigInt};
use rand::Rng;
use sha2::{Sha256, Digest};

fn get_prime(bits: usize) -> BigUint {
    let mut rng = rand::thread_rng();
    loop {
        let candidate = rng.gen_biguint(bits as u64);
        if is_probably_prime(&candidate, 20) {
            return candidate;
        }
    }
}

fn is_probably_prime(n: &BigUint, rounds: usize) -> bool {
    use num_traits::One;

    if n < &BigUint::from(2u32) {
        return false;
    }
    if n == &BigUint::from(2u32) || n == &BigUint::from(3u32) {
        return true;
    }
    if n.bit(0) == false {
        return false;
    }

    let mut d = n - BigUint::one();
    let mut r = 0u32;
    while d.bit(0) == false {
        d >>= 1;
        r += 1;
    }

    let mut rng = rand::thread_rng();
    'witness: for _ in 0..rounds {
        let a = rng.gen_biguint_range(&BigUint::from(2u32), &(n - BigUint::from(2u32)));
        let mut x = a.modpow(&d, n);

        if x == BigUint::one() || x == n - BigUint::one() {
            continue 'witness;
        }

        for _ in 0..(r - 1) {
            x = x.modpow(&BigUint::from(2u32), n);
            if x == n - BigUint::one() {
                continue 'witness;
            }
        }
        return false;
    }
    true
}

fn encrypt(msg: &BigUint, key: &BigUint, p: &BigUint, q: &BigUint, n: &BigUint) -> BigUint {
    let m = msg;
    let mut rng = rand::thread_rng();
    let random1 = rng.gen_biguint(64);
    let random2 = rng.gen_biguint(64);

    let term1 = p * m;
    let term2_inner = m * m + m + BigUint::from(1u32);
    let term2 = q * term2_inner * random1;
    let term3 = m + p + q * random2;
    let sum = term1 + term2 + term3 + BigUint::from(1u32);

    (sum * key) % n
}

fn aes_cbc_encrypt(data: &[u8], key: &[u8], iv: &[u8]) -> Vec<u8> {
    let cipher = Cipher::aes_128_cbc();
    openssl::symm::encrypt(cipher, key, Some(iv), data).expect("encryption failure")
}

fn main() {
    let flag_vec: Vec<u8> = std::env::var("FLAG").ok().map(|s| s.into_bytes()).unwrap_or_else(|| {
        b"CSCV2025{test_flag_for_public}".to_vec()
    });
    let flag = flag_vec.as_slice();

    println!("Generating primes...");
    let p = get_prime(1024);
    let q = get_prime(1024);
    let r = get_prime(1024);
    let k = get_prime(1024);

    let n = &q * &r * &k;

    let mut rng = rand::thread_rng();
    let s = rng.gen_biguint(1024);

    let m1_bytes: Vec<u8> = if rng.gen_bool(0.5) {
        let rand32: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
        let hex: String = rand32.iter().map(|b| format!("{:02x}", b)).collect();
        hex.into_bytes()
    } else {
        let mut bytes = b"One Ring to rule them all".to_vec();
        let rand32: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
        let hex: String = rand32.iter().map(|b| format!("{:02x}", b)).collect();
        bytes.extend(hex.into_bytes());
        bytes
    };

    let m2_bytes: Vec<u8> = if rng.gen_bool(0.5) {
        let rand32: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
        let hex: String = rand32.iter().map(|b| format!("{:02x}", b)).collect();
        hex.into_bytes()
    } else {
        let mut bytes = b"One Ring to find them".to_vec();
        let rand32: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
        let hex: String = rand32.iter().map(|b| format!("{:02x}", b)).collect();
        bytes.extend(hex.into_bytes());
        bytes
    };

    let m3_bytes: Vec<u8> = if rng.gen_bool(0.5) {
        let rand32: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
        let hex: String = rand32.iter().map(|b| format!("{:02x}", b)).collect();
        hex.into_bytes()
    } else {
        let mut bytes = b"One Ring to bring them all".to_vec();
        let rand32: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
        let hex: String = rand32.iter().map(|b| format!("{:02x}", b)).collect();
        bytes.extend(hex.into_bytes());
        bytes
    };

    let m4_bytes: Vec<u8> = if rng.gen_bool(0.5) {
        let rand32: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
        let hex: String = rand32.iter().map(|b| format!("{:02x}", b)).collect();
        hex.into_bytes()
    } else {
        let mut bytes = b"and in the darkness bind them".to_vec();
        let rand32: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
        let hex: String = rand32.iter().map(|b| format!("{:02x}", b)).collect();
        bytes.extend(hex.into_bytes());
        bytes
    };

    let m1 = BigUint::from_bytes_be(&m1_bytes);
    let m2 = BigUint::from_bytes_be(&m2_bytes);
    let m3 = BigUint::from_bytes_be(&m3_bytes);
    let m4 = BigUint::from_bytes_be(&m4_bytes);

    println!("Encrypting messages...");
    let c1 = encrypt(&m1, &s, &p, &q, &n);
    let c2 = encrypt(&m2, &s, &p, &q, &n);
    let c3 = encrypt(&m3, &s, &p, &q, &n);
    let c4 = encrypt(&m4, &s, &p, &q, &n);

    println!("q = {}", q);
    println!("c1 = {}", c1);
    println!("c2 = {}", c2);
    println!("c3 = {}", c3);
    println!("c4 = {}", c4);

    let mut key_material = Vec::new();
    key_material.extend(m1.to_bytes_be());
    key_material.extend(m2.to_bytes_be());
    key_material.extend(m3.to_bytes_be());
    key_material.extend(m4.to_bytes_be());

    let mut hasher = Sha256::new();
    hasher.update(&key_material);
    let h = hasher.finalize();

    let aes_key = &h[0..16];
    let iv = &h[16..32];

    let encrypted_flag = aes_cbc_encrypt(flag, aes_key, iv);

    let hex_output: String = encrypted_flag.iter().map(|b| format!("{:02x}", b)).collect();
    println!("FLAG: {}", hex_output);
}

