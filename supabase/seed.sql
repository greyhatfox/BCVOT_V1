-- ================================================================
-- SWEVOT Blockchain Voting System — Full Schema + Seed Data
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- This script is safe to re-run (uses IF NOT EXISTS + ON CONFLICT)
-- ================================================================

-- Enable pgcrypto extension (for SHA-256 hashing in SQL)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ════════════════════════════════════════════════════════════════
-- STEP 1: CREATE TABLES
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS elections (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  constituency INTEGER,
  status       TEXT DEFAULT 'active',   -- 'active' | 'closed'
  end_date     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidates (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  party       TEXT NOT NULL,
  symbol      TEXT,                     -- emoji symbol
  election_id INTEGER,
  approved    BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS voters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aadhaar_hash    TEXT UNIQUE NOT NULL,  -- SHA-256 of Aadhaar number
  name            TEXT NOT NULL,
  constituency    INTEGER NOT NULL,
  wallet_address  TEXT UNIQUE,           -- bound ETH wallet
  has_voted       BOOLEAN DEFAULT false,
  voting_token    INTEGER DEFAULT 1,     -- 1 = eligible, 0 = voted
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash      TEXT NOT NULL,
  block_number TEXT,
  from_address TEXT,
  election_id  INTEGER,
  timestamp    TIMESTAMPTZ DEFAULT now(),
  status       TEXT DEFAULT 'CONFIRMED'
);

-- ════════════════════════════════════════════════════════════════
-- STEP 2: SEED DATA
-- ════════════════════════════════════════════════════════════════

-- ── Elections ──────────────────────────────────────────────────
INSERT INTO elections (title, constituency, status, end_date)
VALUES
  ('National Election 2026 · Parliamentary Seat · Constituency 42', 42, 'active', '2026-12-31 23:59:59+00'),
  ('Municipal Election 2025 · Ward Council · District 7',           7,  'closed', '2025-12-31 23:59:59+00')
ON CONFLICT DO NOTHING;

-- ── Candidates (election_id = 1: National Election 2026) ───────
-- Order MUST match what you pass to createElection() in Remix:
--   candidateId 1 → Naman Jain
--   candidateId 2 → Anubrata
--   candidateId 3 → Ashtami
--   candidateId 4 → Tirupati

INSERT INTO candidates (name, party, symbol, election_id, approved)
VALUES
  ('Naman Jain', 'Progressive Party', '🌿', 1, true),
  ('Anubrata',   'Unity Party',       '⭐', 1, true),
  ('Ashtami',    'Independent',       '∞',  1, true),
  ('Tirupati',   'Marxist Alliance',  '💪', 1, true)
ON CONFLICT DO NOTHING;

-- ── Demo Voter: Irfan Ahmed Mohammad ──────────────────────────
-- Aadhaar 999988887777 → SHA-256 via pgcrypto
-- ⚠️  Replace wallet_address with your actual MetaMask address!
--     You can also update it later via Table Editor → voters table.

INSERT INTO voters (aadhaar_hash, name, constituency, wallet_address, has_voted, voting_token)
VALUES (
  encode(digest('999988887777', 'sha256'), 'hex'),
  'Irfan Ahmed Mohammad',
  42,
  '0xYOUR_METAMASK_WALLET_ADDRESS',   -- ← REPLACE THIS
  false,
  1
)
ON CONFLICT (aadhaar_hash) DO UPDATE
  SET name          = EXCLUDED.name,
      constituency  = EXCLUDED.constituency;

-- ════════════════════════════════════════════════════════════════
-- STEP 3: VERIFY (you should see 2 elections, 4 candidates, 1 voter)
-- ════════════════════════════════════════════════════════════════

SELECT 'elections'   AS "Table", COUNT(*) AS "Rows" FROM elections
UNION ALL
SELECT 'candidates'  AS "Table", COUNT(*) AS "Rows" FROM candidates
UNION ALL
SELECT 'voters'      AS "Table", COUNT(*) AS "Rows" FROM voters
UNION ALL
SELECT 'transactions' AS "Table", COUNT(*) AS "Rows" FROM transactions;


-- ════════════════════════════════════════════════════════════════
-- REMIX IDE SETUP (run AFTER deploying Voting.sol)
-- ════════════════════════════════════════════════════════════════
-- Contract address: 0x1EC1820D7522207b456EB0936878E32FFE28b04D
--
-- 1) createElection(
--      "National Election 2026 · Parliamentary Seat · Constituency 42",
--      31536000,
--      ["Naman Jain","Anubrata","Ashtami","Tirupati"],
--      ["Progressive Party","Unity Party","Independent","Marxist Alliance"]
--    )
--
-- 2) registerVoter("0xYOUR_METAMASK_WALLET_ADDRESS")
-- ════════════════════════════════════════════════════════════════
