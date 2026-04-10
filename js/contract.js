// js/contract.js — Blockchain interaction + Dashboard logic
// Depends on: config.js, supabase-js CDN, ethers.js v6 CDN

// ── Supabase client ────────────────────────────────────────────
const _supabaseDB = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
function getSupabase() { return _supabaseDB; }

// ── Shared utilities ───────────────────────────────────────────
function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ── etherjs v6 Contract getter ─────────────────────────────────
async function getContractWithSigner() {
  if (!window.ethereum) throw new Error('MetaMask not detected. Please install MetaMask.');
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();
  return { contract: new ethers.Contract(CONFIG.contractAddress, CONFIG.contractABI, signer), signer };
}

// ── Candidate photo map (rotate through person emojis) ─────────
const CANDIDATE_AVATARS = ['👨‍💼', '👩‍💼', '🧑‍💼', '👨‍🏫'];

// ── Guard: redirect to auth if no session ──────────────────────
function guardAuth() {
  const voter = JSON.parse(sessionStorage.getItem('voter') || 'null');
  if (!voter) { window.location.href = 'auth.html'; return null; }
  return voter;
}

// ══════════════════════════════════════════════════════════════════
//  DASHBOARD  initialisation
// ══════════════════════════════════════════════════════════════════
async function loadDashboard() {
  const voter = guardAuth();
  if (!voter) return;

  // ── Nav ──
  populateNav(voter);

  // ── Personal card ──
  const nameEl    = document.getElementById('voter-name-display');
  const subEl     = document.getElementById('voter-sub-display');
  const walletEl  = document.getElementById('wallet-address-display');
  const tokenEl   = document.getElementById('token-display');
  const badgeEl   = document.getElementById('status-badge');

  if (nameEl)   nameEl.innerHTML = `${voter.name.toUpperCase()} <span style="color:var(--accent);font-size:0.8rem">✓</span>`;
  if (subEl)    subEl.textContent  = `VERIFIED VOTER · CONSTITUENCY ${voter.constituency}`;
  const shortWallet = voter.wallet_address
    ? `${voter.wallet_address.slice(0,6)}...${voter.wallet_address.slice(-4)}`
    : '0x——';
  if (walletEl) walletEl.textContent = shortWallet;
  if (tokenEl)  tokenEl.textContent  = voter.voting_token ?? 1;

  // ── Status / voted state ──
  if (voter.has_voted) {
    if (badgeEl) { badgeEl.textContent = 'STATUS: VOTED'; badgeEl.className = 'status-badge'; badgeEl.style.cssText = 'background:rgba(160,174,192,0.12);color:var(--text3);border:1px solid var(--border)'; }
    lockBallot();
  }

  // ── Load candidates from Supabase ──
  await loadCandidates(voter);

  // ── Load recent transactions ──
  await loadVoterTransactions(voter.wallet_address, 7);

  // ── Check on-chain voted state (async, non-blocking) ──
  checkOnChainVotedState(voter).catch(console.warn);
}

// ── Load candidates from Supabase and render cards ────────────
async function loadCandidates(voter) {
  const db = getSupabase();
  const { data: candidates, error } = await db
    .from('candidates')
    .select('*')
    .eq('election_id', CONFIG.electionId)
    .eq('approved', true)
    .order('id', { ascending: true });

  const container = document.getElementById('candidates-container');
  if (!container) return;

  if (error || !candidates || candidates.length === 0) {
    container.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;text-align:center;padding:20px">No candidates found for this election.</p>';
    return;
  }

  container.innerHTML = '';
  candidates.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'candidate-card';
    card.id = `cand-${c.id}`;
    card.dataset.candidateId = c.id;
    card.innerHTML = `
      <div class="candidate-photo">${CANDIDATE_AVATARS[i % CANDIDATE_AVATARS.length]}</div>
      <div class="candidate-info">
        <div class="candidate-name">${c.name}</div>
        <div class="candidate-party">${c.party}</div>
      </div>
      <div class="candidate-symbol">${c.symbol || ''}</div>
    `;
    card.addEventListener('click', () => {
      if (voter.has_voted) return;
      selectCandidate(card, c.id);
    });
    container.appendChild(card);
  });
}

// ── Check on-chain hasVoted (needs MetaMask) ──────────────────
async function checkOnChainVotedState(voter) {
  if (!window.ethereum) return;
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.listAccounts();
    if (!accounts || accounts.length === 0) return;
    const address  = accounts[0].address;
    const contract = new ethers.Contract(CONFIG.contractAddress, CONFIG.contractABI, provider);
    const voted    = await contract.hasVoted(CONFIG.electionId, address);
    if (voted && !voter.has_voted) {
      // On-chain says voted but Supabase hasn't caught up — update UI
      voter.has_voted    = true;
      voter.voting_token = 0;
      sessionStorage.setItem('voter', JSON.stringify(voter));
      document.getElementById('token-display').textContent = '0';
      const b = document.getElementById('status-badge');
      if (b) { b.textContent = 'STATUS: VOTED'; b.className = 'status-badge'; b.style.cssText = 'background:rgba(160,174,192,0.12);color:var(--text3);border:1px solid var(--border)'; }
      lockBallot();
    }
  } catch (_) { /* MetaMask not connected — silently ignore */ }
}

// ── Lock ballot UI after voting ───────────────────────────────
function lockBallot() {
  const btn = document.querySelector('.cast-vote-btn');
  if (btn) { btn.disabled = true; btn.textContent = '✅ VOTE ALREADY CAST'; btn.style.opacity = '0.55'; btn.style.cursor = 'default'; }
  document.querySelectorAll('.candidate-card').forEach(c => {
    c.style.pointerEvents = 'none';
    c.style.opacity = '0.65';
  });
}

// ── Load voter's transactions from Supabase ───────────────────
let txOffset = 0;
async function loadVoterTransactions(walletAddress, limit) {
  if (!walletAddress || walletAddress.startsWith('0xYOUR')) return;
  const db = getSupabase();
  const { data: txs, error } = await db
    .from('transactions')
    .select('*')
    .eq('from_address', walletAddress.toLowerCase())
    .order('timestamp', { ascending: false })
    .range(txOffset, txOffset + limit - 1);

  if (error || !txs) return;
  txOffset += txs.length;

  const tbody = document.getElementById('tx-body');
  if (!tbody) return;
  if (txOffset === txs.length) tbody.innerHTML = ''; // first load — clear placeholders

  const COLORS = ['rgba(6,214,160,0.1)','rgba(0,180,216,0.1)','rgba(239,35,60,0.1)','rgba(255,190,11,0.1)','rgba(139,92,246,0.1)'];
  const ICONS  = ['🟢','🔵','🔴','🟡','🟣'];

  txs.forEach((tx, i) => {
    const ci  = i % COLORS.length;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><div style="display:flex;align-items:center;gap:7px">
        <div class="tx-icon" style="background:${COLORS[ci]}">${ICONS[ci]}</div>
        <span class="tx-hash">${tx.tx_hash.slice(0,10)}…</span>
      </div></td>
      <td class="tx-time">${formatTimestamp(tx.timestamp)}</td>
      <td><span class="status-confirmed">${tx.status}</span></td>`;
    tbody.appendChild(row);
  });
}

// Override the global loadMore() from script.js for dashboard
function loadMore() {
  const voter = JSON.parse(sessionStorage.getItem('voter') || 'null');
  if (voter) loadVoterTransactions(voter.wallet_address, 3);
}

// ══════════════════════════════════════════════════════════════════
//  CAST VOTE  (called by dashboard "CAST VOTE" button)
// ══════════════════════════════════════════════════════════════════
let _isCasting = false;

async function castVote() {
  if (_isCasting) return;

  let voter = JSON.parse(sessionStorage.getItem('voter') || 'null');
  if (!voter) { alert('Session expired. Please log in again.'); window.location.href = 'auth.html'; return; }

  if (voter.has_voted || voter.voting_token === 0) {
    alert('You have already cast your vote. Each voter gets 1 token.');
    lockBallot();
    return;
  }

  if (!window.selectedCandidateId) {
    alert('Please select a candidate before casting your vote.');
    return;
  }

  if (!window.ethereum) {
    alert('MetaMask not detected.\nPlease install the MetaMask browser extension to cast your vote on-chain.');
    return;
  }

  _isCasting = true;
  const btn = document.querySelector('.cast-vote-btn');
  const updateBtn = t => { if (btn) btn.textContent = t; };
  updateBtn('CONNECTING TO METAMASK…');
  if (btn) btn.disabled = true;

  try {
    // ── 1. Request MetaMask accounts ──
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const address  = accounts[0];

    // ── 2. Wallet address check ──
    if (voter.wallet_address && voter.wallet_address.toLowerCase() !== address.toLowerCase()) {
      if (CONFIG.strictWalletCheck) {
        alert(`❌ Wallet mismatch!\n\nRegistered wallet : ${voter.wallet_address}\nConnected wallet  : ${address}\n\nPlease connect the correct MetaMask account.`);
        _isCasting = false;
        if (btn) { btn.disabled = false; updateBtn('CAST VOTE'); }
        return;
      } else {
        console.warn('[Vote] Soft wallet check — address mismatch, continuing:', voter.wallet_address, '≠', address);
      }
    }

    // ── 3. Check on-chain hasVoted ──
    updateBtn('CHECKING ELIGIBILITY…');
    const provider    = new ethers.BrowserProvider(window.ethereum);
    const contractRO  = new ethers.Contract(CONFIG.contractAddress, CONFIG.contractABI, provider);
    const onChainVoted = await contractRO.hasVoted(CONFIG.electionId, address);
    if (onChainVoted) {
      alert('Your wallet has already voted in this election on-chain.');
      updateVotedState(voter);
      _isCasting = false;
      return;
    }

    // ── 4. Sign and broadcast transaction ──
    updateBtn('AWAITING SIGNATURE…');
    const signer   = await provider.getSigner();
    const contract = new ethers.Contract(CONFIG.contractAddress, CONFIG.contractABI, signer);
    const tx       = await contract.castVote(CONFIG.electionId, window.selectedCandidateId);

    updateBtn('CONFIRMING ON BLOCKCHAIN…');
    const receipt = await tx.wait();

    // ── 5. Log to Supabase transactions ──
    const db = getSupabase();
    await db.from('transactions').insert({
      tx_hash:      receipt.hash,
      block_number: receipt.blockNumber.toString(),
      from_address: address.toLowerCase(),
      election_id:  CONFIG.electionId,
      status:       'CONFIRMED'
    });

    // ── 6. Update voter record in Supabase ──
    await db.from('voters').update({ has_voted: true, voting_token: 0 }).eq('id', voter.id);

    // ── 7. Update sessionStorage ──
    voter.has_voted    = true;
    voter.voting_token = 0;
    sessionStorage.setItem('voter', JSON.stringify(voter));

    // ── 8. Update UI ──
    updateVotedState(voter);
    document.getElementById('token-display').textContent = '0';

    const tbody = document.getElementById('tx-body');
    if (tbody) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><div style="display:flex;align-items:center;gap:7px">
          <div class="tx-icon" style="background:rgba(6,214,160,0.15)">🟢</div>
          <span class="tx-hash">${receipt.hash.slice(0,10)}…</span>
        </div></td>
        <td class="tx-time">Just now</td>
        <td><span class="status-confirmed">CONFIRMED</span></td>`;
      tbody.prepend(row);
    }

    // ── 9. Toast ──
    showToast('✅ VOTING SUCCESSFUL!', `Transaction: ${receipt.hash.slice(0,18)}…`);

  } catch (err) {
    console.error('[Vote] Error:', err);
    let msg = 'Transaction failed. Please try again.';
    if (err.code === 4001 || err.code === 'ACTION_REJECTED')        msg = '🚫 Transaction cancelled by user.';
    else if (err.message?.includes('Already voted'))                 msg = '⚠️ You have already voted on this election.';
    else if (err.message?.includes('Not registered'))                msg = '⚠️ Your wallet is not registered with the contract. Ask admin to call registerVoter().';
    else if (err.message?.includes('Election not active'))           msg = '⚠️ This election is no longer active.';
    else if (err.message?.includes('Election ended'))                msg = '⚠️ The voting period for this election has ended.';
    else if (err.message?.includes('insufficient funds'))            msg = '⚠️ Insufficient ETH for gas fees. Please top up your Sepolia wallet.';
    alert(msg);
    if (btn) { btn.disabled = false; updateBtn('CAST VOTE'); }
  } finally {
    _isCasting = false;
  }
}

function updateVotedState(voter) {
  lockBallot();
  const badgeEl = document.getElementById('status-badge');
  if (badgeEl) { badgeEl.textContent = 'STATUS: VOTED'; badgeEl.className = 'status-badge'; badgeEl.style.cssText = 'background:rgba(160,174,192,0.12);color:var(--text3);border:1px solid var(--border)'; }
}

// ── Auto-init on DOMContentLoaded ────────────────────────────
document.addEventListener('DOMContentLoaded', loadDashboard);
