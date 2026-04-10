-- ================================================================
-- SWEVOT — Full Database Reset (Clean Slate)
-- Paste into: Supabase → SQL Editor → New Query → Run
-- ⚠️ Destroys ALL existing data and rebuilds schema from scratch.
-- No seed data — the website handles all registrations.
-- ================================================================

-- ── Drop everything ────────────────────────────────────────────
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS candidates   CASCADE;
DROP TABLE IF EXISTS voters       CASCADE;
DROP TABLE IF EXISTS elections    CASCADE;

-- ── Extensions ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ================================================================
-- TABLES
-- ================================================================

-- ── elections ───────────────────────────────────────────────────
CREATE TABLE elections (
  id           SERIAL      PRIMARY KEY,
  title        TEXT        NOT NULL,
  constituency INTEGER,
  status       TEXT        NOT NULL DEFAULT 'active',  -- 'active' | 'closed'
  end_date     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── candidates ──────────────────────────────────────────────────
-- Populated entirely through the registration form + admin approval.
-- onchain_id = 1-based position returned by addCandidate() on-chain;
--              set automatically when admin approves the candidate.
CREATE TABLE candidates (
  id             SERIAL      PRIMARY KEY,
  name           TEXT        NOT NULL,
  party          TEXT        NOT NULL,
  symbol         TEXT,
  election_id    INTEGER     REFERENCES elections(id),
  approved       BOOLEAN     NOT NULL DEFAULT false,
  onchain_id     INTEGER,               -- set on admin approval (addCandidate tx)
  wallet_address TEXT,
  manifesto      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── voters ──────────────────────────────────────────────────────
-- aadhaar_hash  : SHA-256 used for login lookups (never exposed in UI)
-- aadhaar_number: plain 12-digit number stored for admin reference / audit
CREATE TABLE voters (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  aadhaar_hash   TEXT        UNIQUE NOT NULL,
  aadhaar_number TEXT        UNIQUE NOT NULL,   -- raw 12-digit Aadhaar
  name           TEXT        NOT NULL,
  constituency   INTEGER     NOT NULL,
  wallet_address TEXT        UNIQUE,
  has_voted      BOOLEAN     NOT NULL DEFAULT false,
  voting_token   INTEGER     NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── transactions ────────────────────────────────────────────────
CREATE TABLE transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash      TEXT        NOT NULL,
  block_number TEXT,
  from_address TEXT,
  election_id  INTEGER     REFERENCES elections(id),
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT        NOT NULL DEFAULT 'CONFIRMED'
);

-- ================================================================
-- INDEXES
-- ================================================================
CREATE INDEX idx_candidates_election   ON candidates(election_id, approved);
CREATE INDEX idx_candidates_onchain    ON candidates(election_id, onchain_id);
CREATE INDEX idx_voters_wallet         ON voters(wallet_address);
CREATE INDEX idx_voters_aadhaar        ON voters(aadhaar_number);
CREATE INDEX idx_transactions_from     ON transactions(from_address);
CREATE INDEX idx_transactions_election ON transactions(election_id);

-- ================================================================
-- ROW-LEVEL SECURITY
-- ================================================================
ALTER TABLE elections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE voters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Public reads
CREATE POLICY "public_read_elections"    ON elections    FOR SELECT USING (true);
CREATE POLICY "public_read_candidates"   ON candidates   FOR SELECT USING (true);
CREATE POLICY "public_read_transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "public_read_voters"       ON voters       FOR SELECT USING (true);

-- Registration / voting writes (anon key)
CREATE POLICY "public_insert_voters"       ON voters       FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_voters"       ON voters       FOR UPDATE USING (true);
CREATE POLICY "public_insert_candidates"   ON candidates   FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_candidates"   ON candidates   FOR UPDATE USING (true);
CREATE POLICY "public_insert_transactions" ON transactions FOR INSERT WITH CHECK (true);

-- ================================================================
-- SEED: Elections only (candidates + voters come from the website)
-- ================================================================
INSERT INTO elections (title, constituency, status, end_date) VALUES
  ('National Election 2026 · Parliamentary Seat · Constituency 42', 42, 'active', '2026-12-31 23:59:59+00');

-- ================================================================
-- VERIFY
-- ================================================================
SELECT 'elections'    AS "Table", COUNT(*) AS "Rows" FROM elections
UNION ALL
SELECT 'candidates'   AS "Table", COUNT(*) AS "Rows" FROM candidates
UNION ALL
SELECT 'voters'       AS "Table", COUNT(*) AS "Rows" FROM voters
UNION ALL
SELECT 'transactions' AS "Table", COUNT(*) AS "Rows" FROM transactions;
