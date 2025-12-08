mod config;
mod merkle;
mod merkle_circuit;
mod racing;
mod server;
mod uma;

use std::{fs, io, sync::Arc};

use config::UMA_PER_ROUND;
use server::run_server;
use uma::load_umas;

fn main() -> io::Result<()> {
    let flag_value = fs::read_to_string("flag.txt")
        .ok()
        .map(|contents| contents.trim().to_owned())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "flag{FAKE_FLAG}".to_string());

    let flag = Arc::new(flag_value);

    let uma_pool = Arc::new(load_umas("src/umas.json")?);
    if uma_pool.len() < UMA_PER_ROUND {
        panic!("Not enough UMA entries in database");
    }

    run_server(uma_pool, flag)
}

