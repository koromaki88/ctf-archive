# VIPLounge

A Solana-based CTF challenge.

## Structure
- `program/` - The Solana program (smart contract)
- `server/` - Challenge server using sol-ctf-framework
- `challenge/` - Docker configuration for local testing

## Local Setup
```bash
cd challenge
./build_artifacts.sh    # Build program and server
docker-compose up       # Start server on port 31337
```

## Goal
Connect to `nc localhost 31337` and reach 5 SOL to get the flag.
