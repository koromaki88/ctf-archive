use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

use crate::{
    DragonInstruction, Loot, PlayerState, ENTRY_FEE, LOOT_SIZE, LOOT_VALUE, PLAYER_STATE_SIZE,
};

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    mut data: &[u8],
) -> ProgramResult {
    let instruction = DragonInstruction::deserialize(&mut data)?;

    match instruction {
        DragonInstruction::InitDungeon { vault_bump } => {
            msg!("Instruction: InitDungeon");
            init_dungeon(program_id, accounts, vault_bump)
        }
        DragonInstruction::EnterDungeon => {
            msg!("Instruction: EnterDungeon");
            enter_dungeon(program_id, accounts)
        }
        DragonInstruction::FightMonster { seed, loot_bump } => {
            msg!("Instruction: FightMonster");
            fight_monster(program_id, accounts, seed, loot_bump)
        }
        DragonInstruction::ClaimLoot => {
            msg!("Instruction: ClaimLoot");
            claim_loot(program_id, accounts)
        }
        DragonInstruction::ExitDungeon => {
            msg!("Instruction: ExitDungeon");
            exit_dungeon(program_id, accounts)
        }
    }
}

fn init_dungeon(program_id: &Pubkey, accounts: &[AccountInfo], vault_bump: u8) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let vault = next_account_info(account_iter)?;
    let authority = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;

    if !authority.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let vault_address = Pubkey::create_program_address(&[b"VAULT", &[vault_bump]], program_id)?;
    if *vault.key != vault_address {
        return Err(ProgramError::InvalidSeeds);
    }

    // Create vault account
    if vault.data_is_empty() {
        let rent = Rent::get()?;
        let lamports = rent.minimum_balance(0); // Vault doesn't store data, just lamports
        invoke_signed(
            &system_instruction::create_account(
                authority.key,
                vault.key,
                lamports,
                0,
                program_id,
            ),
            &[authority.clone(), vault.clone(), system_program.clone()],
            &[&[b"VAULT", &[vault_bump]]],
        )?;
    }

    msg!("Dungeon initialized!");
    Ok(())
}

fn enter_dungeon(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let player_state = next_account_info(account_iter)?;
    let vault = next_account_info(account_iter)?;
    let player = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;

    if !player.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Check vault
    let (vault_addr, _) = crate::get_vault(*program_id);
    if *vault.key != vault_addr {
        return Err(ProgramError::InvalidArgument);
    }

    // Create or update player state
    let (state_addr, bump) = crate::get_player_state(*program_id, *player.key);
    if *player_state.key != state_addr {
        return Err(ProgramError::InvalidSeeds);
    }

    if player_state.data_is_empty() {
        let rent = Rent::get()?;
        let lamports = rent.minimum_balance(PLAYER_STATE_SIZE);
        invoke_signed(
            &system_instruction::create_account(
                player.key,
                player_state.key,
                lamports,
                PLAYER_STATE_SIZE as u64,
                program_id,
            ),
            &[player.clone(), player_state.clone(), system_program.clone()],
            &[&[b"PLAYER", &player.key.to_bytes(), &[bump]]],
        )?;
    }

    // Pay entry fee
    invoke(
        &system_instruction::transfer(player.key, vault.key, ENTRY_FEE),
        &[player.clone(), vault.clone()],
    )?;

    let mut state = if player_state.data_len() > 0 {
        // Try to deserialize, or default if fresh (though create_account zeros it)
         match PlayerState::deserialize(&mut &player_state.data.borrow()[..]) {
             Ok(s) => s,
             Err(_) => PlayerState { player: *player.key, hp: 100, in_dungeon: true },
         }
    } else {
        PlayerState { player: *player.key, hp: 100, in_dungeon: true }
    };
    
    state.player = *player.key;
    state.hp = 100;
    state.in_dungeon = true;

    state.serialize(&mut &mut player_state.data.borrow_mut()[..])?;

    msg!("Entered dungeon!");
    Ok(())
}

fn fight_monster(program_id: &Pubkey, accounts: &[AccountInfo], seed: u64, loot_bump: u8) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let player_state = next_account_info(account_iter)?;
    let loot = next_account_info(account_iter)?;
    let player = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;

    if !player.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify player is in dungeon
    let state = PlayerState::deserialize(&mut &player_state.data.borrow()[..])?;
    if !state.in_dungeon || state.player != *player.key {
        return Err(ProgramError::InvalidAccountData);
    }

    let (loot_addr, _bump) = crate::get_loot(*program_id, *player.key, seed);
    
    if *loot.key != loot_addr {
         return Err(ProgramError::InvalidSeeds);
    }

    if !loot.data_is_empty() {
        msg!("Error: Loot account already exists for this seed");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Create the loot account
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(LOOT_SIZE);
    invoke_signed(
        &system_instruction::create_account(
            player.key,
            loot.key,
            lamports,
            LOOT_SIZE as u64,
            program_id,
        ),
        &[player.clone(), loot.clone(), system_program.clone()],
        &[&[b"LOOT", &player.key.to_bytes(), &seed.to_le_bytes(), &[loot_bump]]],
    )?;

    // Store loot data with the seed for later validation in claim_loot
    let loot_data = Loot {
        player: *player.key,
        seed,
        value: LOOT_VALUE,
        claimed: false,
    };

    loot_data.serialize(&mut &mut loot.data.borrow_mut()[..])?;

    msg!("Monster defeated! Loot dropped.");
    Ok(())
}

fn claim_loot(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let vault = next_account_info(account_iter)?;
    let loot_account = next_account_info(account_iter)?;
    let player = next_account_info(account_iter)?;

    if !player.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Check vault
    let (vault_addr, _) = crate::get_vault(*program_id);
    if *vault.key != vault_addr {
        return Err(ProgramError::InvalidArgument);
    }

    if loot_account.owner != program_id {
        msg!("Error: Loot account not owned by program");
        return Err(ProgramError::IllegalOwner);
    }

    let loot = Loot::deserialize(&mut &loot_account.data.borrow()[..])?;

    if loot.player != *player.key {
        return Err(ProgramError::InvalidAccountData);
    }

    let (expected_loot_addr, _) = crate::get_loot(*program_id, *player.key, loot.seed);
    if *loot_account.key != expected_loot_addr {
        msg!("Error: Loot account is not a valid PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    if loot.claimed {
        return Err(ProgramError::AccountAlreadyInitialized); // Already claimed
    }

    // Pay the player
    if **vault.lamports.borrow() < loot.value {
        return Err(ProgramError::InsufficientFunds);
    }

    **vault.lamports.borrow_mut() -= loot.value;
    **player.lamports.borrow_mut() += loot.value;

    // Mark as claimed
    let mut loot_data = loot_account.data.borrow_mut();
    let mut updated_loot = loot;
    updated_loot.claimed = true;
    updated_loot.serialize(&mut &mut loot_data[..])?;

    msg!("Loot claimed! {} lamports transferred.", updated_loot.value);
    Ok(())
}

fn exit_dungeon(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let player_state = next_account_info(account_iter)?;
    let player = next_account_info(account_iter)?;

    if !player.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Close player state account and return lamports
    let curr_lamports = player_state.lamports();
    **player_state.lamports.borrow_mut() = 0;
    **player.lamports.borrow_mut() += curr_lamports;
    
    player_state.data.borrow_mut().fill(0);
    
    msg!("Left dungeon.");
    Ok(())
}

