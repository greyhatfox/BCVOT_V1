// js/config.js — Blockchain Voting System Frontend Configuration
// ⚠️ Do not expose this file publicly in a production environment

const CONFIG = {
  supabaseUrl:     "https://ffrlylhphpavowhqbiex.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmcmx5bGhwaHBhdm93aHFiaWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MDY1MjcsImV4cCI6MjA5MTM4MjUyN30.ozoyGQWs1NMGKgnKcq3OuypuhcAVexFsT5I8cD68xDM",
  contractAddress: "0x4f59A5c521855192d20277E74e22470b25D01b98",
  adminAddress:    "0x60AB3a37599319955ec20e2E6861725F148f00FC",
  // SHA-256 of the admin password "Admin@DVote2026"
  // To change: run  crypto.subtle.digest('SHA-256', new TextEncoder().encode('YourNewPassword'))
  //            then convert the ArrayBuffer to hex and paste it here.
  adminPasswordHash: "a07e9f0cc956ef75f0d9e45c5da90dcbfedad3ce5b3ecaea4ab6d0b43ebfec2a",
  electionId:      1,
  // strictWalletCheck: false → warns on wallet mismatch but doesn't block the vote.
  // Set to true once you've updated the wallet_address in Supabase to match your MetaMask.
  strictWalletCheck: false,

  // Public Sepolia RPC for read-only calls (results page, no MetaMask required)
  sepoliaRpc: "https://rpc.sepolia.org",

  // Full JSON ABI for Voting.sol (solidity 0.8.19)
  contractABI: [
    { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },

    { "anonymous": false, "inputs": [
        { "indexed": true,  "internalType": "uint256", "name": "electionId",  "type": "uint256" },
        { "indexed": true,  "internalType": "address", "name": "voter",        "type": "address"  },
        { "indexed": false, "internalType": "uint256", "name": "candidateId", "type": "uint256" },
        { "indexed": false, "internalType": "uint256", "name": "timestamp",   "type": "uint256" }
      ], "name": "VoteCast", "type": "event" },

    { "anonymous": false, "inputs": [
        { "indexed": true,  "internalType": "uint256", "name": "electionId", "type": "uint256" },
        { "indexed": false, "internalType": "string",  "name": "title",      "type": "string"  }
      ], "name": "ElectionCreated", "type": "event" },

    { "anonymous": false, "inputs": [
        { "indexed": true, "internalType": "address", "name": "voter", "type": "address" }
      ], "name": "VoterRegistered", "type": "event" },

    { "anonymous": false, "inputs": [
        { "indexed": true,  "internalType": "uint256", "name": "electionId",  "type": "uint256" },
        { "indexed": false, "internalType": "uint256", "name": "candidateId", "type": "uint256" },
        { "indexed": false, "internalType": "string",  "name": "name",        "type": "string"  }
      ], "name": "CandidateAdded", "type": "event" },

    { "inputs": [], "name": "admin",
      "outputs": [ { "internalType": "address", "name": "", "type": "address" } ],
      "stateMutability": "view", "type": "function" },

    { "inputs": [], "name": "electionCount",
      "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
      "stateMutability": "view", "type": "function" },

    { "inputs": [
        { "internalType": "uint256", "name": "", "type": "uint256" },
        { "internalType": "uint256", "name": "", "type": "uint256" }
      ], "name": "electionCandidates",
      "outputs": [
        { "internalType": "uint256", "name": "id",        "type": "uint256" },
        { "internalType": "string",  "name": "name",      "type": "string"  },
        { "internalType": "string",  "name": "party",     "type": "string"  },
        { "internalType": "uint256", "name": "voteCount", "type": "uint256" }
      ], "stateMutability": "view", "type": "function" },

    { "inputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
      "name": "elections",
      "outputs": [
        { "internalType": "uint256", "name": "id",       "type": "uint256" },
        { "internalType": "string",  "name": "title",    "type": "string"  },
        { "internalType": "bool",    "name": "isActive", "type": "bool"    },
        { "internalType": "uint256", "name": "endTime",  "type": "uint256" }
      ], "stateMutability": "view", "type": "function" },

    { "inputs": [
        { "internalType": "uint256", "name": "", "type": "uint256" },
        { "internalType": "address", "name": "", "type": "address" }
      ], "name": "hasVoted",
      "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ],
      "stateMutability": "view", "type": "function" },

    { "inputs": [ { "internalType": "address", "name": "", "type": "address" } ],
      "name": "registeredVoters",
      "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ],
      "stateMutability": "view", "type": "function" },

    { "inputs": [ { "internalType": "uint256", "name": "electionId", "type": "uint256" } ],
      "name": "getResults",
      "outputs": [ {
        "components": [
          { "internalType": "uint256", "name": "id",        "type": "uint256" },
          { "internalType": "string",  "name": "name",      "type": "string"  },
          { "internalType": "string",  "name": "party",     "type": "string"  },
          { "internalType": "uint256", "name": "voteCount", "type": "uint256" }
        ],
        "internalType": "struct Voting.Candidate[]", "name": "", "type": "tuple[]"
      }],
      "stateMutability": "view", "type": "function" },

    { "inputs": [
        { "internalType": "uint256", "name": "electionId",  "type": "uint256" },
        { "internalType": "uint256", "name": "candidateId", "type": "uint256" }
      ], "name": "castVote",
      "outputs": [], "stateMutability": "nonpayable", "type": "function" },

    { "inputs": [ { "internalType": "address", "name": "voter", "type": "address" } ],
      "name": "registerVoter",
      "outputs": [], "stateMutability": "nonpayable", "type": "function" },

    { "inputs": [],
      "name": "selfRegister",
      "outputs": [], "stateMutability": "nonpayable", "type": "function" },

    { "inputs": [
        { "internalType": "string",   "name": "title",             "type": "string"   },
        { "internalType": "uint256",  "name": "durationInSeconds", "type": "uint256"  },
        { "internalType": "string[]", "name": "names",             "type": "string[]" },
        { "internalType": "string[]", "name": "parties",           "type": "string[]" }
      ], "name": "createElection",
      "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
      "stateMutability": "nonpayable", "type": "function" },

    { "inputs": [ { "internalType": "uint256", "name": "electionId", "type": "uint256" } ],
      "name": "closeElection",
      "outputs": [], "stateMutability": "nonpayable", "type": "function" },

    { "inputs": [
        { "internalType": "uint256", "name": "electionId", "type": "uint256" },
        { "internalType": "string",  "name": "name",       "type": "string"  },
        { "internalType": "string",  "name": "party",      "type": "string"  }
      ], "name": "addCandidate",
      "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
      "stateMutability": "nonpayable", "type": "function" },

    { "inputs": [ { "internalType": "uint256", "name": "electionId", "type": "uint256" } ],
      "name": "getCandidateCount",
      "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
      "stateMutability": "view", "type": "function" }
  ]
};
