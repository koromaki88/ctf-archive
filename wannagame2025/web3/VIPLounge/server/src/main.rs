//! VIP Lounge Server
//!
//! Backend service for the VIP Lounge membership system.

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

use vip_lounge::get_vault;

/// The amount of lamports in the vault that the player must drain.
const VAULT_BALANCE: u64 = 10_000_000_000; // 10 SOL

/// The initial balance for the player.
const PLAYER_BALANCE: u64 = 1_000_000_000; // 1 SOL

/// The target balance the player must reach to win.
const TARGET_BALANCE: u64 = 5_000_000_000; // 5 SOL

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let port = env::var("PORT").unwrap_or_else(|_| "31337".to_string());
    let bind_addr = format!("0.0.0.0:{}", port);

    println!("[*] VIP Lounge Challenge Server starting on {}", bind_addr);

    let listener = TcpListener::bind(&bind_addr)?;

    println!("[+] Listening for connections...");

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

/// Handles a single player connection.
///
/// # Arguments
/// * `socket` - The TCP stream for the player connection.
///
/// # Returns
/// A result indicating success or failure.
async fn handle_connection(mut socket: TcpStream) -> Result<(), Box<dyn Error>> {
    writeln!(socket, "=== Welcome to the VIP Lounge ===")?;
    writeln!(socket, "Only VIP members can withdraw from our exclusive vault.")?;
    writeln!(socket, "Can you find a way to become VIP?")?;
    writeln!(socket)?;

    // Create challenge builder
    let mut builder = match ChallengeBuilder::try_from(socket.try_clone()?) {
        Ok(b) => b,
        Err(e) => {
            writeln!(socket, "Error: Failed to initialize challenge: {}", e)?;
            return Ok(());
        }
    };

    // Load player's solution program
    let solve_pubkey = match builder.input_program() {
        Ok(pubkey) => pubkey,
        Err(e) => {
            writeln!(socket, "Error: Cannot add solve program: {}", e)?;
            return Ok(());
        }
    };

    // Load the VIP Lounge program
    let program_key = Pubkey::new_unique();
    let program_pubkey = match builder.add_program("vip_lounge.so", Some(program_key)) {
        Some(pk) => pk,
        None => {
            writeln!(socket, "Error: Failed to load challenge program")?;
            return Ok(());
        }
    };

    // Derive the vault PDA
    let (vault, _vault_bump) = get_vault(program_pubkey);

    // Add initial accounts
    // The vault is pre-funded with SOL
    builder
        .builder
        .add_account(vault, Account::new(VAULT_BALANCE, 0, &program_pubkey));

    // Build the challenge
    let mut challenge = builder.build().await;

    // Get the payer (player) account
    let player = challenge.ctx.payer.pubkey();

    // Fund the player account
    challenge
        .ctx
        .set_account(&player, &Account::new(PLAYER_BALANCE, 0, &system_program::ID).into());

    writeln!(socket)?;
    writeln!(socket, "=== Challenge Info ===")?;
    writeln!(socket, "Program ID: {}", program_pubkey)?;
    writeln!(socket, "Vault: {}", vault)?;
    writeln!(socket, "Player: {}", player)?;
    writeln!(socket, "Vault Balance: {} lamports", VAULT_BALANCE)?;
    writeln!(socket, "Your Balance: {} lamports", PLAYER_BALANCE)?;
    writeln!(socket, "Target: Reach {} lamports", TARGET_BALANCE)?;
    writeln!(socket)?;

    // Read and execute the player's instruction
    writeln!(socket, "=== Submit Your Solution ===")?;
    let ix = match challenge.read_instruction(solve_pubkey) {
        Ok(ix) => ix,
        Err(e) => {
            writeln!(socket, "Error: Failed to read instruction: {}", e)?;
            return Ok(());
        }
    };

    // Execute the instruction
    if let Err(e) = challenge.run_ix(ix).await {
        writeln!(socket, "Error: Transaction failed: {}", e)?;
        return Ok(());
    }

    // Check if the player has reached the target balance
    let final_balance = challenge
        .ctx
        .banks_client
        .get_account(player)
        .await?
        .map(|a| a.lamports)
        .unwrap_or(0);

    writeln!(socket)?;
    writeln!(socket, "=== Results ===")?;
    writeln!(socket, "Your final balance: {} lamports", final_balance)?;

    if final_balance >= TARGET_BALANCE {
        writeln!(socket)?;
        writeln!(socket, "Congratulations! You've proven yourself worthy of VIP status!")?;

        // Read flag from environment or file
        let flag = env::var("FLAG").unwrap_or_else(|_| {
            fs::read_to_string("flag.txt").unwrap_or_else(|_| "FLAG{test_flag}".to_string())
        });

        writeln!(socket, "FLAG: {}", flag.trim())?;
    } else {
        writeln!(socket, "Not enough funds. You need {} lamports to win.", TARGET_BALANCE)?;
        writeln!(socket, "Hint: VIP status is required to withdraw from the vault...")?;
    }

    Ok(())
}

