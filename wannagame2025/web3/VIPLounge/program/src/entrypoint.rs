//! Program entrypoint for VIP Lounge.

#![cfg(not(feature = "no-entrypoint"))]

use solana_program::{
    account_info::AccountInfo,
    entrypoint::{entrypoint, ProgramResult},
    pubkey::Pubkey,
};

entrypoint!(process_instruction);

/// The program entrypoint.
/// 
/// # Arguments
/// * `program_id` - The program ID.
/// * `accounts` - The accounts required for the instruction.
/// * `instruction_data` - The instruction data.
/// 
/// # Returns
/// A `ProgramResult` indicating success or failure.
fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    crate::processor::process_instruction(program_id, accounts, instruction_data)
}

