use sol_ctf_framework::ChallengeBuilder;
use solana_program::system_program;
use solana_sdk::{account::Account, pubkey::Pubkey, signature::Signer};
use std::{
    env,
    error::Error,
    fs,
    io::Write,
    net::{TcpListener, TcpStream},
};

use dragons_hoard::get_vault;

const VAULT_BALANCE: u64 = 10_000_000_000; // 10 SOL
const PLAYER_BALANCE: u64 = 2_000_000_000; // 2 SOL needed for fees/staking

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let bind_addr = format!("0.0.0.0:{}", port);

    println!("[*] Dragon's Hoard Challenge Server starting on {}", bind_addr);
    let listener = TcpListener::bind(&bind_addr)?;

    loop {
        let (stream, addr) = listener.accept()?;
        println!("[*] New connection from: {}", addr);

        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream).await {
                eprintln!("[-] Handler error: {}", e);
            }
        });
    }
}

async fn handle_connection(mut socket: TcpStream) -> Result<(), Box<dyn Error>> {
    writeln!(socket, "=== Dragon's Hoard ===")?;
    writeln!(socket, "The dragon guards a vault of {} SOL.", VAULT_BALANCE / 1_000_000_000)?;
    writeln!(socket, "You have {} SOL. Can you drain the hoard?", PLAYER_BALANCE / 1_000_000_000)?;
    writeln!(socket)?;

    let mut builder = ChallengeBuilder::try_from(socket.try_clone()?)?;

    // Load player's solution program
    let solve_pubkey = match builder.input_program() {
        Ok(pk) => pk,
        Err(e) => {
            writeln!(socket, "Error loading your program: {}", e)?;
            return Ok(());
        }
    };

    // Load challenge program
    // In Docker, this will be in the working directory
    let program_key = solana_sdk::signature::Keypair::new().pubkey();
    // We try to find the .so file
    let so_path = "dragons_hoard.so";
    if !std::path::Path::new(so_path).exists() {
        writeln!(socket, "Server error: Challenge program not found at {}", so_path)?;
        return Ok(());
    }

    builder.add_program(so_path, Some(program_key));

    // Setup accounts
    let (vault, _vault_bump) = get_vault(program_key);
    
    // We add the vault account pre-initialized with lamports
    // In a real scenario, we might want to run InitDungeon, but for simplicity we pre-fund
    // Note: The program checks if vault is initialized in some paths, but mostly checks ownership/seeds
    // Our processor's check is `if *vault.key != vault_address`.
    // We should make sure the vault account exists and has lamports.
    // The processor doesn't enforce specific data in vault (it has 0 data len).
    builder.builder.add_account(
        vault,
        Account {
            lamports: VAULT_BALANCE,
            owner: program_key, // Owned by program (it's a PDA)
            executable: false,
            rent_epoch: 0,
            data: vec![],
        },
    );

    let mut challenge = builder.build().await;
    let player = challenge.ctx.payer.pubkey();

    // Set player balance
    challenge.ctx.set_account(
        &player,
        &Account {
            lamports: PLAYER_BALANCE,
            owner: system_program::ID,
            executable: false,
            rent_epoch: 0,
            data: vec![],
        }
        .into(),
    );

    writeln!(socket, "Challenge environment ready.")?;
    writeln!(socket, "Dragon's Hoard Program: {}", program_key)?;
    writeln!(socket, "Vault: {}", vault)?;
    writeln!(socket, "Your Player Key: {}", player)?;
    writeln!(socket, "Your Program: {}", solve_pubkey)?;
    writeln!(socket)?;

    // Read instruction from player to trigger their exploit
    writeln!(socket, "Waiting for your instruction...")?;
    let ix = match challenge.read_instruction(solve_pubkey) {
        Ok(ix) => ix,
        Err(e) => {
            writeln!(socket, "Error reading instruction: {}", e)?;
            return Ok(());
        }
    };

    writeln!(socket, "Executing your transaction...")?;
    if let Err(e) = challenge.run_ix(ix).await {
        writeln!(socket, "Transaction failed: {}", e)?;
        return Ok(());
    }

    // Check win condition
    let vault_acct = challenge.ctx.banks_client.get_account(vault).await?;
    let vault_lamports = vault_acct.map(|a| a.lamports).unwrap_or(0);

    writeln!(socket, "Final Vault Balance: {} SOL", vault_lamports as f64 / 1_000_000_000.0)?;

    if vault_lamports <= 1_000_000_000 {
        writeln!(socket, "Congratulations! You drained the hoard!")?;
        if let Ok(flag) = env::var("FLAG") {
             writeln!(socket, "FLAG: {}", flag)?;
        } else if let Ok(flag) = fs::read_to_string("flag.txt") {
             writeln!(socket, "FLAG: {}", flag.trim())?;
        } else {
             writeln!(socket, "FLAG: FLAG{{test_flag}}")?;
        }
    } else {
        writeln!(socket, "The dragon still guards the treasure. Try again.")?;
    }

    Ok(())
}

