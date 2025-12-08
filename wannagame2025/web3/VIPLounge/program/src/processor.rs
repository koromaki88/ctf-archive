//! Program instruction processor for VIP Lounge.

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

use crate::{LoungeInstruction, MemberCard, MEMBER_CARD_SIZE};

/// Processes an instruction.
/// 
/// # Arguments
/// * `program` - The program ID.
/// * `accounts` - The accounts required for the instruction.
/// * `data` - The instruction data.
/// 
/// # Returns
/// A `ProgramResult` indicating success or failure.
pub fn process_instruction(
    program: &Pubkey,
    accounts: &[AccountInfo],
    mut data: &[u8],
) -> ProgramResult {
    let instruction = LoungeInstruction::deserialize(&mut data)?;

    match instruction {
        LoungeInstruction::InitVault { vault_bump } => {
            msg!("Instruction: InitVault");
            init_vault(program, accounts, vault_bump)
        }
        LoungeInstruction::RegisterMember { card_bump } => {
            msg!("Instruction: RegisterMember");
            register_member(program, accounts, card_bump)
        }
        LoungeInstruction::Withdraw { amount } => {
            msg!("Instruction: Withdraw");
            withdraw(program, accounts, amount)
        }
    }
}

/// Initializes the vault PDA.
fn init_vault(program: &Pubkey, accounts: &[AccountInfo], vault_bump: u8) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let vault = next_account_info(account_iter)?;
    let authority = next_account_info(account_iter)?;
    let _system_program = next_account_info(account_iter)?;

    // Verify vault address
    let vault_address = Pubkey::create_program_address(&[b"VAULT", &[vault_bump]], program)?;
    if *vault.key != vault_address {
        return Err(ProgramError::InvalidSeeds);
    }

    // Authority must sign
    if !authority.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    msg!("Vault initialized at: {}", vault.key);
    Ok(())
}

/// Registers a new member with a member card.
fn register_member(program: &Pubkey, accounts: &[AccountInfo], card_bump: u8) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let card = next_account_info(account_iter)?;
    let admin = next_account_info(account_iter)?;
    let member = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;

    // Admin must sign
    if !admin.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify card address
    let card_address = Pubkey::create_program_address(
        &[b"MEMBER", &member.key.to_bytes(), &[card_bump]],
        program,
    )?;
    if *card.key != card_address {
        return Err(ProgramError::InvalidSeeds);
    }

    // Card must not already exist
    if !card.data_is_empty() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Create the member card account
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(MEMBER_CARD_SIZE);

    invoke_signed(
        &system_instruction::create_account(
            admin.key,
            &card_address,
            lamports,
            MEMBER_CARD_SIZE as u64,
            program,
        ),
        &[admin.clone(), card.clone(), system_program.clone()],
        &[&[b"MEMBER", &member.key.to_bytes(), &[card_bump]]],
    )?;

    // Initialize member card data (NOT VIP by default)
    let card_data = MemberCard {
        member: *member.key,
        is_vip: false, // Regular members are not VIP
        points: 0,
    };

    card_data.serialize(&mut &mut (*card.data).borrow_mut()[..])?;

    msg!("Registered member: {}", member.key);
    Ok(())
}

/// Withdraws funds from the vault (VIP members only).
fn withdraw(program: &Pubkey, accounts: &[AccountInfo], amount: u64) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let vault = next_account_info(account_iter)?;
    let member_card = next_account_info(account_iter)?;
    let member = next_account_info(account_iter)?;

    // Member must sign
    if !member.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify vault is a PDA owned by this program
    if vault.owner != program {
        return Err(ProgramError::IllegalOwner);
    }
    
    // Deserialize the member card to check VIP status
    let card_data = MemberCard::deserialize(&mut &(*member_card.data).borrow()[..])?;

    // Verify the card belongs to this member
    if card_data.member != *member.key {
        msg!("Card does not belong to this member");
        return Err(ProgramError::InvalidAccountData);
    }

    // Check VIP status
    if !card_data.is_vip {
        msg!("Only VIP members can withdraw from the vault");
        return Err(ProgramError::InvalidAccountData);
    }

    // Check vault has enough funds
    if vault.lamports() < amount {
        msg!("Insufficient funds in vault");
        return Err(ProgramError::InsufficientFunds);
    }

    // Transfer funds from vault to member
    **vault.lamports.borrow_mut() -= amount;
    **member.lamports.borrow_mut() += amount;

    msg!("Withdrew {} lamports to {}", amount, member.key);
    Ok(())
}

