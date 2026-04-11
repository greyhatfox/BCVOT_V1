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
  
  // ── Inject Multiple Elections Dropdown ──
  if (typeof injectElectionDropdown === 'function') {
    await injectElectionDropdown();
  }

  // ── Update Ballot Title + Constituency Eligibility Check ──
  if (window._currentElectionData) {
    const eData = window._currentElectionData;
    const titleEl = document.getElementById('ballot-title');
    if (titleEl) {
      const constLabel = eData.constituency === 0
        ? '〈ALL CONSTITUENCIES〉'
        : `CONSTITUENCY ${eData.constituency}`;
      titleEl.innerHTML = `${eData.title.split('·')[0].trim()}
        <span style="display:inline-block;margin-left:8px;padding:2px 9px;border-radius:12px;font-size:0.65rem;font-weight:700;letter-spacing:1px;
               background:rgba(0,180,216,0.12);color:var(--primary);border:1px solid rgba(0,180,216,0.25);vertical-align:middle">${constLabel}</span>`;
    }

    // ── Constituency Eligibility ──
    // constituency === 0 means open to ALL; otherwise must match voter's
    const voterConst   = parseInt(voter.constituency);
    const electConst   = eData.constituency;
    const isEligible   = (electConst === 0) || (electConst === voterConst);
    window._isEligibleToVote = isEligible;

    if (!isEligible) {
      // Show a visible VIEW-ONLY banner inside the ballot card
      const container = document.getElementById('candidates-container');
      if (container) {
        const banner = document.createElement('div');
        banner.id = 'view-only-banner';
        banner.style.cssText = `
          background: rgba(255,190,11,0.08);
          border: 1px solid rgba(255,190,11,0.35);
          border-radius: 10px;
          padding: 12px 16px;
          margin-bottom: 14px;
          font-size: 0.8rem;
          color: #b7860a;
          line-height: 1.5;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        `;
        banner.innerHTML = `
          <span style="font-size:1.2rem;flex-shrink:0">⚠️</span>
          <div>
            <strong>View-Only Mode</strong><br>
            This election is for <strong>Constituency ${electConst}</strong>.
            You are registered in <strong>Constituency ${voterConst}</strong>.
            You can view candidates and results but <strong>cannot vote here</strong>.
          </div>
        `;
        container.insertAdjacentElement('beforebegin', banner);
      }
      // Lock the cast vote button with a clear label
      lockViewOnly();
    }

    // Disable cast vote if election is closed (regardless of eligibility)
    if (eData.status !== 'active') {
      const btn = document.querySelector('.cast-vote-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'ELECTION CLOSED';
        btn.style.opacity = '0.55';
        btn.style.cursor = 'default';
      }
    }
  }

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
  // ── Status / voted state (Per-Election) ──
  const db = getSupabase();
  const eid = getCurrentElectionId();
  if (voter.wallet_address) {
    const { data: tx } = await db.from('transactions').select('id').eq('from_address', voter.wallet_address.toLowerCase()).eq('election_id', eid);
    if (tx && tx.length > 0) {
      if (tokenEl) tokenEl.textContent = '0';
      if (badgeEl) { badgeEl.textContent = 'STATUS: VOTED'; badgeEl.className = 'status-badge'; badgeEl.style.cssText = 'background:rgba(160,174,192,0.12);color:var(--text3);border:1px solid var(--border)'; }
      window._hasVotedCurrent = true;
      lockBallot();
    } else {
      if (tokenEl) tokenEl.textContent = '1';
      window._hasVotedCurrent = false;
    }
  } else {
    if (tokenEl) tokenEl.textContent = '0';
    window._hasVotedCurrent = false;
  }

  // ── Load candidates from Supabase ──
  await loadCandidates(voter);

  // ── Load recent transactions ──
  await loadVoterTransactions(voter.wallet_address, 7);

  // ── Load available active elections for candidacy forms ──
  await loadCandidateElections();

  // ── Check on-chain voted state (async, non-blocking) ──
  checkOnChainVotedState(voter).catch(console.warn);
}

// ── Load candidates from Supabase and render cards ────────────
async function loadCandidates(voter) {
  const db = getSupabase();
  const eid = getCurrentElectionId();
  const { data: candidates, error } = await db
    .from('candidates')
    .select('*')
    .eq('election_id', eid)
    .eq('approved', true)
    .order('onchain_id', { ascending: true });   // sort by on-chain order

  const container = document.getElementById('candidates-container');
  if (!container) return;

  if (error || !candidates || candidates.length === 0) {
    container.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;text-align:center;padding:20px">No candidates found for this election.</p>';
    return;
  }

  container.innerHTML = '';
  candidates.forEach((c, i) => {
    // onchain_id is stored when admin approves; fall back to i+1 if missing
    const onChainId = c.onchain_id ?? (i + 1);
    const card = document.createElement('div');
    card.className = 'candidate-card';
    card.id = `cand-${c.id}`;
    card.dataset.candidateId = c.id;
    card.dataset.onchainId   = onChainId;   // <-- critical: on-chain index
    card.innerHTML = `
      <div class="candidate-photo">${CANDIDATE_AVATARS[i % CANDIDATE_AVATARS.length]}</div>
      <div class="candidate-info">
        <div class="candidate-name">${c.name}</div>
        <div class="candidate-party">${c.party}</div>
      </div>
      <div class="candidate-symbol">${c.symbol || ''}</div>
    `;
    card.addEventListener('click', () => {
      if (window._hasVotedCurrent) return;
      selectCandidate(card, c.id, onChainId);   // pass both IDs
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
    const eid = getCurrentElectionId();
    const voted    = await contract.hasVoted(eid, address);
    if (voted && !window._hasVotedCurrent) {
      // On-chain says voted but Supabase tx hasn't synced — update UI
      window._hasVotedCurrent = true;
      document.getElementById('token-display').textContent = '0';
      const b = document.getElementById('status-badge');
      if (b) { b.textContent = 'STATUS: VOTED'; b.className = 'status-badge'; b.style.cssText = 'background:rgba(160,174,192,0.12);color:var(--text3);border:1px solid var(--border)'; }
      lockBallot();
    }
  } catch (_) { /* MetaMask not connected — silently ignore */ }
}

// ── Lock ballot as VIEW-ONLY (wrong constituency) ─────────────
function lockViewOnly() {
  const btn = document.querySelector('.cast-vote-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '🚧 NOT YOUR CONSTITUENCY';
    btn.style.opacity = '0.65';
    btn.style.cursor = 'not-allowed';
    btn.style.background = 'rgba(255,190,11,0.12)';
    btn.style.color = '#b7860a';
    btn.style.border = '1px solid rgba(255,190,11,0.35)';
  }
  // Make cards non-clickable but still visible (view-only)
  document.querySelectorAll('.candidate-card').forEach(c => {
    c.style.pointerEvents = 'none';
    c.style.cursor = 'default';
  });
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

  // ── HARD constituency guard ──
  if (window._isEligibleToVote === false) {
    const eData = window._currentElectionData;
    alert(
      `❌ You cannot vote in this election.\n\n` +
      `This election is for Constituency ${eData ? eData.constituency : '?'}.\n` +
      `You are registered in Constituency ${voter.constituency}.\n\n` +
      `You may view the candidates and results, but voting is restricted to eligible constituencies.`
    );
    return;
  }

  if (window._hasVotedCurrent) {
    alert('You have already cast your vote in this election.');
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
    const eid = getCurrentElectionId();
    updateBtn('CHECKING ELIGIBILITY…');
    const provider    = new ethers.BrowserProvider(window.ethereum);
    const contractRO  = new ethers.Contract(CONFIG.contractAddress, CONFIG.contractABI, provider);
    const onChainVoted = await contractRO.hasVoted(eid, address);
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

    // Use the on-chain candidate index (NOT the Supabase DB id)
    const onChainCandId = window.selectedOnChainId;
    if (!onChainCandId) {
      alert('Could not determine on-chain candidate index. Please re-select your candidate.');
      _isCasting = false;
      if (btn) { btn.disabled = false; updateBtn('CAST VOTE'); }
      return;
    }
    const tx = await contract.castVote(eid, onChainCandId);

    updateBtn('CONFIRMING ON BLOCKCHAIN…');
    const receipt = await tx.wait();

    // ── 5. Log to Supabase transactions ──
    const db = getSupabase();
    await db.from('transactions').insert({
      tx_hash:      receipt.hash,
      block_number: receipt.blockNumber.toString(),
      from_address: address.toLowerCase(),
      election_id:  eid,
      status:       'CONFIRMED'
    });

    window._hasVotedCurrent = true;

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

// ══════════════════════════════════════════════════════════════════
//  CANDIDATE APPLICATION FROM DASHBOARD
// ══════════════════════════════════════════════════════════════════
async function loadCandidateElections() {
  const sel = document.getElementById('cand-election');
  if (!sel) return;
  const db = getSupabase();

  // Get voter's constituency for filtering
  const voter = JSON.parse(sessionStorage.getItem('voter') || 'null');
  const voterConst = voter ? parseInt(voter.constituency) : null;

  const { data: elections, error } = await db
    .from('elections')
    .select('id, title, constituency')
    .eq('status','active')
    .order('id', { ascending: true });

  if (error || !elections || elections.length === 0) {
    sel.innerHTML = '<option value="" style="background:var(--surface2);color:var(--text);">No active elections available</option>';
    return;
  }

  // Filter: show ALL elections and elections matching voter's constituency
  const eligible = elections.filter(e =>
    e.constituency === 0 || (voterConst && e.constituency === voterConst)
  );

  if (eligible.length === 0) {
    sel.innerHTML = `<option value="" style="background:var(--surface2);color:var(--text);">No elections for your constituency</option>`;
    return;
  }

  sel.innerHTML = '<option value="" style="background:var(--surface2);color:var(--text);">Select active election…</option>' + 
    eligible.map(e => {
      const constTag = e.constituency === 0 ? ' — 〈ALL〉' : ` — C-${e.constituency}`;
      return `<option value="${e.id}" style="background:var(--surface2);color:var(--text);">${e.title.split('·')[0].trim()}${constTag}</option>`;
    }).join('');
}

async function applyForCandidacy() {
  const voter = JSON.parse(sessionStorage.getItem('voter') || 'null');
  if (!voter) return;

  const elecId = document.getElementById('cand-election').value;
  const party = document.getElementById('cand-party').value.trim();
  const symbol = document.getElementById('cand-symbol').value.trim();
  const msgEl = document.getElementById('cand-apply-msg');
  const btn = document.getElementById('apply-cand-btn');

  function showMsg(msg, isError=true) {
    msgEl.style.display = 'block';
    msgEl.style.background = isError ? 'rgba(239,35,60,0.1)' : 'rgba(6,214,160,0.1)';
    msgEl.style.color = isError ? '#ef233c' : '#06d6a0';
    msgEl.innerHTML = msg;
  }

  if (!elecId) { showMsg('⚠️ Please select an election.'); return; }
  if (!party) { showMsg('⚠️ Please provide a political party.'); return; }

  const db = getSupabase();
  btn.disabled = true;
  btn.textContent = 'SUBMITTING…';
  
  try {
    // Check if already applied via wallet
    const { data: existing } = await db.from('candidates')
      .select('id, approved')
      .eq('name', voter.name)
      .eq('election_id', parseInt(elecId));

    if (existing && existing.length > 0) {
      showMsg(existing[0].approved ? '⚠️ You are already an approved candidate for this election.' : '⏳ Your application is already pending admin review.');
      return;
    }

    const payload = {
      name: voter.name,
      party: party,
      symbol: symbol || '🏛️',
      election_id: parseInt(elecId),
      approved: false
    };
    if (voter.wallet_address) { payload.wallet_address = voter.wallet_address.toLowerCase(); }

    const { error } = await db.from('candidates').insert(payload);
    if (error) throw error;

    showMsg('✅ Application submitted successfully. Pending admin approval.', false);
    document.getElementById('cand-party').value = '';
    document.getElementById('cand-symbol').value = '';

  } catch (err) {
    showMsg('❌ Error submitting application: ' + (err.message || 'Unknown error'));
  } finally {
    btn.disabled = false;
    btn.textContent = 'SUBMIT APPLICATION';
  }
}

// ── Auto-init on DOMContentLoaded ────────────────────────────
document.addEventListener('DOMContentLoaded', loadDashboard);
