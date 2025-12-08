//! VIP Lounge - A members-only vault program
//! 
//! This program manages a VIP membership system where verified members
//! can withdraw funds from the lounge vault.

mod entrypoint;
pub mod processor;

use borsh::{BorshDeserialize, BorshSerialize, to_vec};
use solana_program::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    system_program,
};
use std::mem::size_of;

/// Instructions supported by the VIP Lounge program.
#[derive(BorshDeserialize, BorshSerialize, Debug)]
pub enum LoungeInstruction {
    /// Initialize the vault with funds.
    /// Accounts:
    /// 0. `[writable]` Vault PDA
    /// 1. `[signer]` Authority
    InitVault { vault_bump: u8 },

    /// Register a new member (admin only).
    /// Accounts:
    /// 0. `[writable]` Member card PDA
    /// 1. `[signer]` Admin
    /// 2. `[]` Member pubkey
    RegisterMember { card_bump: u8 },

    /// Withdraw funds from the vault (VIP members only).
    /// Accounts:
    /// 0. `[writable]` Vault PDA
    /// 1. `[]` Member card (verified VIP status)
    /// 2. `[writable, signer]` Member
    Withdraw { amount: u64 },
}

/// Represents a membership card in the VIP Lounge.
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct MemberCard {
    /// The member's public key.
    pub member: Pubkey,
    /// VIP status - only VIPs can withdraw.
    pub is_vip: bool,
    /// Points accumulated (for future use).
    pub points: u64,
}

pub const MEMBER_CARD_SIZE: usize = size_of::<MemberCard>();

/// Derives the vault PDA address.
/// 
/// # Arguments
/// * `program` - The program ID.
/// 
/// # Returns
/// A tuple of (Pubkey, bump seed).
pub fn get_vault(program: Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"VAULT"], &program)
}

/// Derives the member card PDA address.
/// 
/// # Arguments
/// * `program` - The program ID.
/// * `member` - The member's public key.
/// 
/// # Returns
/// A tuple of (Pubkey, bump seed).
pub fn get_member_card(program: Pubkey, member: Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"MEMBER", &member.to_bytes()], &program)
}

/// Creates an instruction to initialize the vault.
pub fn init_vault(program: Pubkey, authority: Pubkey) -> Instruction {
    let (vault, vault_bump) = get_vault(program);
    Instruction {
        program_id: program,
        accounts: vec![
            AccountMeta::new(vault, false),
            AccountMeta::new(authority, true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: to_vec(&LoungeInstruction::InitVault { vault_bump }).unwrap(),
    }
}

/// Creates an instruction to register a new member.
pub fn register_member(program: Pubkey, admin: Pubkey, member: Pubkey) -> Instruction {
    let (card, card_bump) = get_member_card(program, member);
    Instruction {
        program_id: program,
        accounts: vec![
            AccountMeta::new(card, false),
            AccountMeta::new(admin, true),
            AccountMeta::new_readonly(member, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: to_vec(&LoungeInstruction::RegisterMember { card_bump }).unwrap(),
    }
}

/// Creates an instruction to withdraw funds from the vault.
pub fn withdraw(program: Pubkey, member: Pubkey, member_card: Pubkey, amount: u64) -> Instruction {
    let (vault, _) = get_vault(program);
    Instruction {
        program_id: program,
        accounts: vec![
            AccountMeta::new(vault, false),
            AccountMeta::new_readonly(member_card, false),
            AccountMeta::new(member, true),
        ],
        data: to_vec(&LoungeInstruction::Withdraw { amount }).unwrap(),
    }
}

