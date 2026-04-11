// js/register.js — Unified Voter (+ optional Candidate) Registration
// Depends on: config.js, supabase-js CDN, ethers.js CDN, script.js

const _sbReg = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

// ── SHA-256 (same as auth.js) ─────────────────────────────────
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Message helpers ────────────────────────────────────────────
function hideMessages() {
  document.getElementById('reg-error').style.display   = 'none';
  document.getElementById('reg-success').style.display = 'none';
}

function showRegError(msg) {
  const el = document.getElementById('reg-error');
  el.innerHTML = msg;
  el.style.display = 'flex';
  setTimeout(() => el.style.display = 'none', 7000);
}

function showRegSuccess(msg, redirectTo) {
  const el = document.getElementById('reg-success');
  el.innerHTML = msg;
  el.style.display = 'flex';
  if (redirectTo) setTimeout(() => window.location.href = redirectTo, 3000);
}

// ── Connect MetaMask wallet ────────────────────────────────────
async function connectMetaMask() {
  if (!window.ethereum) {
    showRegError('⚠️ MetaMask not detected. <a href="https://metamask.io" target="_blank" style="color:var(--primary)">Install MetaMask</a> to link your wallet.');
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    document.getElementById('wallet-input').value = accounts[0];
    document.getElementById('connect-mm-btn').textContent = '✅ CONNECTED';
    document.getElementById('connect-mm-btn').style.background = 'rgba(6,214,160,0.15)';
    document.getElementById('connect-mm-btn').style.color      = 'var(--accent)';
  } catch (e) {
    showRegError('🚫 MetaMask connection cancelled.');
  }
}

// ── Helper: is candidate section open? ───────────────────────
function isCandidateSectionOpen() {
  const sec = document.getElementById('cand-section');
  return sec && sec.style.display !== 'none';
}

// ══════════════════════════════════════════════════════════════════
//  UNIFIED REGISTRATION  (voter + optional candidate)
// ══════════════════════════════════════════════════════════════════
async function registerVoter() {
  const name         = document.getElementById('voter-name').value.trim();
  const aadhaarRaw   = document.getElementById('voter-aadhaar').value.replace(/-/g, '');
  const constituency = parseInt(document.getElementById('voter-constituency').value);
  const wallet       = document.getElementById('wallet-input').value.trim();

  const applyAsCandidate = isCandidateSectionOpen();
  const party     = applyAsCandidate ? document.getElementById('cand-party').value.trim()  : '';
  const symbol    = applyAsCandidate ? document.getElementById('cand-symbol').value.trim() : '';
  const elecId    = applyAsCandidate ? parseInt(document.getElementById('cand-election').value) : null;
  const manifesto = applyAsCandidate ? document.getElementById('cand-manifesto').value.trim() : '';

  // ── Validation ──
  if (!name)                          { showRegError('⚠️ Please enter your full name.'); return; }
  if (aadhaarRaw.length !== 12)       { showRegError('⚠️ Enter a valid 12-digit Aadhaar number.'); return; }
  if (!/^\d{12}$/.test(aadhaarRaw))   { showRegError('⚠️ Aadhaar must contain exactly 12 digits.'); return; }
  if (!constituency || isNaN(constituency) || constituency < 1 || constituency > 543) {
    showRegError('⚠️ Enter a valid constituency number (1 – 543).');
    return;
  }
  if (applyAsCandidate && !party)     { showRegError('⚠️ Please enter a party name to apply as a candidate.'); return; }
  if (applyAsCandidate && !elecId)    { showRegError('⚠️ Please select an election to contest.'); return; }

  const btn = document.getElementById('voter-submit-btn');
  btn.disabled = true;
  btn.textContent = 'REGISTERING…';
  hideMessages();

  try {
    const hash = await sha256(aadhaarRaw);

    // ── Check duplicate Aadhaar ──
    const { data: existing } = await _sbReg.from('voters').select('id').eq('aadhaar_hash', hash).maybeSingle();
    if (existing) {
      showRegError('❌ This Aadhaar number is already registered. Please <a href="auth.html" style="color:var(--primary)">log in</a> instead.');
      return;
    }

    // ── Build voter payload ──
    const payload = {
      aadhaar_hash:   hash,
      aadhaar_number: aadhaarRaw,   // plain 12-digit number saved for admin/audit
      name,
      constituency,
      has_voted:     false,
      voting_token:  1
    };
    if (wallet && /^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      payload.wallet_address = wallet.toLowerCase();
    }

    const { error: voterErr } = await _sbReg.from('voters').insert(payload);
    if (voterErr) throw voterErr;

    // ── Register wallet on-chain via selfRegister() ──
    if (wallet && /^0x[0-9a-fA-F]{40}$/.test(wallet) && window.ethereum) {
      try {
        btn.textContent = 'REGISTERING ON BLOCKCHAIN…';
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer   = await provider.getSigner();
        const contract = new ethers.Contract(CONFIG.contractAddress, CONFIG.contractABI, signer);
        const alreadyRegistered = await contract.registeredVoters(await signer.getAddress());
        if (!alreadyRegistered) {
          const tx = await contract.selfRegister();
          btn.textContent = 'CONFIRMING ON BLOCKCHAIN…';
          await tx.wait();
        }
      } catch (chainErr) {
        console.warn('[Register] On-chain selfRegister failed:', chainErr);
        showRegError(
          '⚠️ Saved to database but blockchain registration failed: ' +
          (chainErr.reason || chainErr.message || 'Unknown error') +
          '<br><small>You may not be able to vote until this is resolved.</small>'
        );
        btn.disabled = false; btn.textContent = 'REGISTER AS VOTER';
        return;
      }
    }

    // ── Submit candidate application (if toggled) ──
    if (applyAsCandidate) {
      btn.textContent = 'SUBMITTING CANDIDATE APPLICATION…';

      // Eligibility check: fetch the chosen election's constituency
      const { data: elecData } = await _sbReg
        .from('elections')
        .select('constituency')
        .eq('id', elecId)
        .single();

      if (elecData && elecData.constituency !== 0 && elecData.constituency !== constituency) {
        showRegError(
          `❌ You are not eligible to contest Election #${elecId}. ` +
          `It is restricted to Constituency ${elecData.constituency}, but you are in Constituency ${constituency}.`
        );
        btn.disabled = false; btn.textContent = 'REGISTER AS VOTER';
        return;
      }

      const candPayload = {
        name,                       // same name as voter
        party,
        symbol:      symbol || '🏛️',
        election_id: elecId,
        approved:    false          // admin must approve
      };
      if (wallet && /^0x[0-9a-fA-F]{40}$/.test(wallet)) {
        candPayload.wallet_address = wallet.toLowerCase();
      }
      const { error: candErr } = await _sbReg.from('candidates').insert(candPayload);
      if (candErr) {
        console.warn('[Register] Candidate insert failed:', candErr);
        // Non-fatal: voter already saved — continue
      }
    }

    const successMsg = applyAsCandidate
      ? `✅ <strong>Registration successful!</strong> Welcome, ${name}.<br>
         <span style="font-size:0.8rem;opacity:0.8">
           Wallet registered on-chain. Candidate application submitted — <strong>pending admin approval</strong>.<br>
           Redirecting to login…
         </span>`
      : `✅ <strong>Registration successful!</strong> Welcome, ${name}.<br>
         <span style="font-size:0.8rem;opacity:0.8">Your wallet is registered on-chain. Redirecting to login…</span>`;

    showRegSuccess(successMsg, 'auth.html');

    ['voter-name','voter-aadhaar','voter-constituency','wallet-input','cand-party','cand-symbol','cand-manifesto'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

  } catch (err) {
    console.error('[Register Voter]', err);
    if (err.code === '23505') {
      showRegError('❌ This wallet address is already linked to another voter.');
    } else {
      showRegError('Registration failed: ' + (err.message || 'Unknown error'));
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'REGISTER AS VOTER';
  }
}

// ── Load elections into candidate dropdown (filtered by constituency) ──
async function loadElectionsForDropdown() {
  // Read the voter's constituency from the form
  const voterConst = parseInt(document.getElementById('voter-constituency').value);

  const sel = document.getElementById('cand-election');
  if (!sel) return;

  // Show loading state
  sel.innerHTML = '<option value="" style="background:var(--surface2);color:var(--text);">Loading eligible elections…</option>';

  const { data: elections, error } = await _sbReg
    .from('elections')
    .select('id, title, status, constituency')
    .order('id', { ascending: true });

  if (error || !elections || elections.length === 0) {
    sel.innerHTML = '<option value="" style="background:var(--surface2);color:var(--text);">No elections available</option>';
    return;
  }

  // Filter: only show ALL elections (constituency=0) or elections matching the voter's constituency
  const eligible = elections.filter(e =>
    e.constituency === 0 || (isFinite(voterConst) && e.constituency === voterConst)
  );

  if (eligible.length === 0) {
    sel.innerHTML =
      `<option value="" style="background:var(--surface2);color:var(--text);">
        No elections for Constituency ${isFinite(voterConst) ? voterConst : '?'}
      </option>`;
    return;
  }

  sel.innerHTML =
    `<option value="" style="background:var(--surface2);color:var(--text);">Select election to contest…</option>` +
    eligible.map(e => {
      const label  = e.title.split('·')[0].trim();
      const closed = e.status === 'closed';
      const tag    = e.constituency === 0 ? ' — 〈ALL〉' : ` — C-${e.constituency}`;
      return `<option value="${e.id}" ${closed ? 'disabled' : ''} style="background:var(--surface2);color:var(--text);">${label}${tag}${closed ? ' (CLOSED)' : ''}</option>`;
    }).join('');
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const voter = JSON.parse(sessionStorage.getItem('voter') || 'null');
  if (voter) populateNav(voter);
});
