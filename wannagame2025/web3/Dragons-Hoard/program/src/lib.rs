use borsh::{BorshDeserialize, BorshSerialize, to_vec};
use solana_program::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    system_program,
};
use std::mem::size_of;

pub mod processor;

#[cfg(not(feature = "no-entrypoint"))]
mod entrypoint;

/// Instructions supported by the Dragon's Hoard program.
#[derive(BorshDeserialize, BorshSerialize, Debug)]
pub enum DragonInstruction {
    /// Initialize the dungeon with a vault.
    /// Accounts:
    /// 0. `[writable]` Vault PDA
    /// 1. `[signer]` Authority
    InitDungeon { vault_bump: u8 },

    /// Enter the dungeon (stake SOL).
    /// Accounts:
    /// 0. `[writable]` Player State PDA
    /// 1. `[writable]` Vault PDA
    /// 2. `[signer]` Player
    /// 3. `[]` System Program
    EnterDungeon,

    /// Fight a monster and earn loot.
    /// Accounts:
    /// 0. `[writable]` Player State PDA
    /// 1. `[writable]` Loot PDA
    /// 2. `[signer]` Player
    /// 3. `[]` System Program
    FightMonster { seed: u64, loot_bump: u8 },

    /// Claim loot earnings.
    /// Accounts:
    /// 0. `[writable]` Vault PDA
    /// 1. `[writable]` Loot PDA
    /// 2. `[writable, signer]` Player
    ClaimLoot,

    /// Leave the dungeon.
    /// Accounts:
    /// 0. `[writable]` Player State PDA
    /// 1. `[signer]` Player
    ExitDungeon,
}

/// Global Dungeon state (not strictly used in this simplified version but good for context)
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Dungeon {
    pub authority: Pubkey,
    pub vault_bump: u8,
    pub entry_fee: u64,
}

/// Player's state in the dungeon.
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct PlayerState {
    pub player: Pubkey,
    pub hp: u16,
    pub in_dungeon: bool,
}

/// Loot account earned by fighting monsters.
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Loot {
    pub player: Pubkey,
    pub seed: u64,      // The seed used to derive this loot PDA
    pub value: u64,
    pub claimed: bool,
}

pub const PLAYER_STATE_SIZE: usize = size_of::<PlayerState>();
pub const LOOT_SIZE: usize = size_of::<Loot>();
pub const ENTRY_FEE: u64 = 1_000_000_000; // 1 SOL
pub const LOOT_VALUE: u64 = 2_000_000_000; // 2 SOL

/// Derives the vault PDA address.
pub fn get_vault(program: Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"VAULT"], &program)
}

/// Derives the player state PDA address.
pub fn get_player_state(program: Pubkey, player: Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"PLAYER", &player.to_bytes()], &program)
}

/// Derives the loot PDA address.
pub fn get_loot(program: Pubkey, player: Pubkey, seed: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"LOOT", &player.to_bytes(), &seed.to_le_bytes()], &program)
}

// Helper instruction creators for testing/client use

pub fn init_dungeon(program: Pubkey, authority: Pubkey) -> Instruction {
    let (vault, vault_bump) = get_vault(program);
    Instruction {
        program_id: program,
        accounts: vec![
            AccountMeta::new(vault, false),
            AccountMeta::new(authority, true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: to_vec(&DragonInstruction::InitDungeon { vault_bump }).unwrap(),
    }
}

pub fn enter_dungeon(program: Pubkey, player: Pubkey) -> Instruction {
    let (player_state, _) = get_player_state(program, player);
    let (vault, _) = get_vault(program);
    Instruction {
        program_id: program,
        accounts: vec![
            AccountMeta::new(player_state, false),
            AccountMeta::new(vault, false),
            AccountMeta::new(player, true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: to_vec(&DragonInstruction::EnterDungeon).unwrap(),
    }
}

pub fn fight_monster(program: Pubkey, player: Pubkey, seed: u64) -> Instruction {
    let (player_state, _) = get_player_state(program, player);
    let (loot, loot_bump) = get_loot(program, player, seed);
    Instruction {
        program_id: program,
        accounts: vec![
            AccountMeta::new(player_state, false),
            AccountMeta::new(loot, false),
            AccountMeta::new(player, true),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: to_vec(&DragonInstruction::FightMonster { seed, loot_bump }).unwrap(),
    }
}

pub fn claim_loot(program: Pubkey, player: Pubkey, loot: Pubkey) -> Instruction {
    let (vault, _) = get_vault(program);
    Instruction {
        program_id: program,
        accounts: vec![
            AccountMeta::new(vault, false),
            AccountMeta::new(loot, false),
            AccountMeta::new(player, true),
        ],
        data: to_vec(&DragonInstruction::ClaimLoot).unwrap(),
    }
}

