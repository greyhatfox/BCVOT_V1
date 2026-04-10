// js/register.js — Voter & Candidate Registration
// Depends on: config.js, supabase-js CDN, script.js (for formatAadhaar, populateNav)

const _sbReg = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

// ── SHA-256 (same as auth.js) ─────────────────────────────────
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Tab switching ──────────────────────────────────────────────
function switchTab(tab) {
  ['voter', 'candidate'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('active', t === tab);
    document.getElementById(`form-${t}`).style.display = t === tab ? 'block' : 'none';
  });
  hideMessages();
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

// ══════════════════════════════════════════════════════════════════
//  VOTER REGISTRATION
// ══════════════════════════════════════════════════════════════════
async function registerVoter() {
  const name         = document.getElementById('voter-name').value.trim();
  const aadhaarRaw   = document.getElementById('voter-aadhaar').value.replace(/-/g, '');
  const constituency = parseInt(document.getElementById('voter-constituency').value);
  const wallet       = document.getElementById('wallet-input').value.trim();

  // ── Validation ──
  if (!name)                          { showRegError('⚠️ Please enter your full name.'); return; }
  if (aadhaarRaw.length !== 12)       { showRegError('⚠️ Enter a valid 12-digit Aadhaar number.'); return; }
  if (!/^\d{12}$/.test(aadhaarRaw))   { showRegError('⚠️ Aadhaar must contain exactly 12 digits.'); return; }
  if (!constituency || isNaN(constituency) || constituency < 1) { showRegError('⚠️ Enter a valid constituency number.'); return; }

  const btn = document.getElementById('voter-submit-btn');
  btn.disabled = true; btn.textContent = 'REGISTERING…';
  hideMessages();

  try {
    const hash = await sha256(aadhaarRaw);

    // ── Check duplicate Aadhaar ──
    const { data: existing } = await _sbReg.from('voters').select('id').eq('aadhaar_hash', hash).maybeSingle();
    if (existing) {
      showRegError('❌ This Aadhaar number is already registered. Please <a href="auth.html" style="color:var(--primary)">log in</a> instead.');
      return;
    }

    // ── Build insert payload ──
    const payload = {
      aadhaar_hash:  hash,
      name,
      constituency,
      has_voted:     false,
      voting_token:  1
    };
    if (wallet && /^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      payload.wallet_address = wallet.toLowerCase();
    }

    const { error } = await _sbReg.from('voters').insert(payload);
    if (error) throw error;

    // ── Register wallet on-chain via selfRegister() ──
    if (wallet && /^0x[0-9a-fA-F]{40}$/.test(wallet) && window.ethereum) {
      try {
        btn.textContent = 'REGISTERING ON BLOCKCHAIN…';
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer   = await provider.getSigner();
        const contract = new ethers.Contract(CONFIG.contractAddress, CONFIG.contractABI, signer);

        // Check if already registered on-chain (e.g. re-registration attempt)
        const alreadyRegistered = await contract.registeredVoters(await signer.getAddress());
        if (!alreadyRegistered) {
          const tx = await contract.selfRegister();
          btn.textContent = 'CONFIRMING ON BLOCKCHAIN…';
          await tx.wait();
        }
      } catch (chainErr) {
        // Non-fatal: voter is saved in Supabase; warn but don't block
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

    showRegSuccess(
      `✅ <strong>Registration successful!</strong> Welcome, ${name}.<br>
       <span style="font-size:0.8rem;opacity:0.8">Your wallet is registered on-chain. Redirecting to login…</span>`,
      'auth.html'
    );

    // Clear fields
    ['voter-name','voter-aadhaar','voter-constituency','wallet-input'].forEach(id => {
      document.getElementById(id).value = '';
    });

  } catch (err) {
    console.error('[Register Voter]', err);
    if (err.code === '23505') {
      showRegError('❌ This wallet address is already linked to another voter.');
    } else {
      showRegError('Registration failed: ' + (err.message || 'Unknown error'));
    }
  } finally {
    btn.disabled = false; btn.textContent = 'REGISTER AS VOTER';
  }
}

// ══════════════════════════════════════════════════════════════════
//  CANDIDATE REGISTRATION
// ══════════════════════════════════════════════════════════════════
async function registerCandidate() {
  const name       = document.getElementById('cand-name').value.trim();
  const party      = document.getElementById('cand-party').value.trim();
  const symbol     = document.getElementById('cand-symbol').value.trim() || '🏛️';
  const electionId = parseInt(document.getElementById('cand-election').value);
  const manifesto  = document.getElementById('cand-manifesto').value.trim();

  if (!name)       { showRegError('⚠️ Please enter your full name.'); return; }
  if (!party)      { showRegError('⚠️ Please enter your party name.'); return; }
  if (!electionId) { showRegError('⚠️ Please select an election to contest.'); return; }

  const btn = document.getElementById('cand-submit-btn');
  btn.disabled = true; btn.textContent = 'SUBMITTING APPLICATION…';
  hideMessages();

  try {
    const { error } = await _sbReg.from('candidates').insert({
      name,
      party,
      symbol,
      election_id: electionId,
      approved:    false   // Requires admin approval
    });
    if (error) throw error;

    showRegSuccess(
      `✅ <strong>Application submitted!</strong><br>
       <span style="font-size:0.8rem;opacity:0.8">
         ${name} (${party} ${symbol}) — Application is <strong>PENDING ADMIN APPROVAL</strong>.<br>
         You will appear on the ballot once approved.
       </span>`
    );

    ['cand-name','cand-party','cand-symbol','cand-manifesto'].forEach(id => {
      document.getElementById(id).value = '';
    });

  } catch (err) {
    console.error('[Register Candidate]', err);
    showRegError('Submission failed: ' + (err.message || 'Unknown error'));
  } finally {
    btn.disabled = false; btn.textContent = 'APPLY AS CANDIDATE';
  }
}

// ── Load elections into candidate dropdown ─────────────────────
async function loadElectionsForDropdown() {
  const { data: elections, error } = await _sbReg
    .from('elections')
    .select('id, title, status')
    .order('id', { ascending: true });

  const sel = document.getElementById('cand-election');
  if (error || !elections || elections.length === 0) {
    sel.innerHTML = '<option value="">No elections available</option>';
    return;
  }
  sel.innerHTML = `<option value="">Select election to contest…</option>` +
    elections.map(e => {
      const label   = e.title.split('·')[0].trim();
      const closed  = e.status === 'closed';
      return `<option value="${e.id}" ${closed ? 'disabled' : ''}>${label}${closed ? ' (CLOSED)' : ''}</option>`;
    }).join('');
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadElectionsForDropdown();
  const voter = JSON.parse(sessionStorage.getItem('voter') || 'null');
  if (voter) populateNav(voter);
});
