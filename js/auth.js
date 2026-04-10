// js/auth.js — Aadhaar + Biometric Authentication
// Depends on: config.js, supabase-js CDN (window.supabase)

// ── Supabase client (auth) ─────────────────────────────────────
const _supabaseAuth = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

// ── SHA-256 via Web Crypto API ─────────────────────────────────
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Aadhaar input auto-format (XXXX-XXXX-XXXX) ────────────────
function formatAadhaar(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 12);
  let parts = [];
  for (let i = 0; i < v.length; i += 4) parts.push(v.slice(i, i + 4));
  el.value = parts.join('-');
}

// ── Connect MetaMask for login ─────────────────────────────────
let _authWallet = null;
async function connectAuthWallet() {
  if (!window.ethereum) {
    showAuthError('⚠️ MetaMask not detected. Please install MetaMask.');
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    _authWallet = accounts[0].toLowerCase();
    const display = document.getElementById('auth-wallet-display');
    const btn     = document.getElementById('auth-mm-btn');
    if (display) display.textContent = `${_authWallet.slice(0,6)}…${_authWallet.slice(-4)}`;
    if (display) display.style.color = 'var(--accent)';
    if (btn)    { btn.textContent = '✅ Connected'; btn.style.color = 'var(--accent)'; }
  } catch (e) {
    showAuthError('🚫 MetaMask connection cancelled.');
  }
}

// ── Show auth error ────────────────────────────────────────────
function showAuthError(msg) {
  const errEl = document.getElementById('auth-error');
  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = 'flex';
    setTimeout(() => { errEl.style.display = 'none'; }, 6000);
  } else {
    alert(msg);
  }
}

// ── Biometric animation states ─────────────────────────────────
function startBiometricScan() {
  const ring  = document.querySelector('.fingerprint-ring');
  const label = document.querySelector('.fp-label');
  const icon  = document.querySelector('.fp-icon');
  if (ring)  ring.classList.add('scanning');
  if (label) label.innerHTML = 'Scanning biometric data…<br><span style="color:var(--primary);font-weight:600">Processing identity…</span>';
  if (icon)  { icon.style.animation = 'pulse 0.6s ease-in-out infinite'; }
}

function stopBiometricScan(success) {
  const ring  = document.querySelector('.fingerprint-ring');
  const label = document.querySelector('.fp-label');
  const icon  = document.querySelector('.fp-icon');
  if (ring) ring.classList.remove('scanning');
  if (icon) { icon.style.animation = 'none'; }

  if (success) {
    if (label) label.innerHTML = '✅ Identity Verified<br><span style="color:var(--accent);font-weight:600">Redirecting to dashboard…</span>';
    if (icon)  icon.textContent = '✅';
    if (ring)  ring.style.borderColor = 'var(--accent)';
  } else {
    if (label) label.innerHTML = 'Biometric Authentication<br><span style="color:var(--danger);font-weight:600">Verification failed — try again</span>';
    if (icon)  icon.textContent = '❌';
    if (ring)  { ring.style.borderColor = 'var(--danger)'; setTimeout(() => { if (icon) icon.textContent = '🖐'; if (ring) ring.style.borderColor = ''; }, 2500); }
  }
}

// ── Main auth function ─────────────────────────────────────────
async function doAuth() {
  const inp = document.getElementById('aadhaar-input');
  const raw = inp ? inp.value.replace(/-/g, '') : '';

  if (raw.length < 12) {
    showAuthError('⚠️ Please enter a valid 12-digit Aadhaar number.');
    return;
  }

  if (!_authWallet) {
    showAuthError('⚠️ Please connect your MetaMask wallet before logging in.');
    return;
  }

  const btn = document.querySelector('.auth-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'VERIFYING…'; }

  startBiometricScan();

  try {
    // Hash the Aadhaar number client-side — raw number is never sent
    const hash = await sha256(raw);

    // Minimum 2-second biometric "scan" + Supabase lookup (whichever is longer)
    const [result] = await Promise.all([
      _supabaseAuth.from('voters').select('*').eq('aadhaar_hash', hash).single(),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);

    const { data, error } = result;

    if (error || !data) {
      stopBiometricScan(false);
      showAuthError('❌ Aadhaar not registered in the system.');
      if (btn) { btn.disabled = false; btn.textContent = 'VERIFY & CONTINUE'; }
      return;
    }

    // ── Wallet check: connected wallet must match the registered wallet ──
    if (!data.wallet_address) {
      stopBiometricScan(false);
      showAuthError('❌ No wallet linked to this Aadhaar. Please re-register with your MetaMask wallet.');
      if (btn) { btn.disabled = false; btn.textContent = 'VERIFY & CONTINUE'; }
      return;
    }

    if (data.wallet_address.toLowerCase() !== _authWallet) {
      stopBiometricScan(false);
      showAuthError('❌ Wallet mismatch. The connected MetaMask account does not match the wallet registered with this Aadhaar.');
      if (btn) { btn.disabled = false; btn.textContent = 'VERIFY & CONTINUE'; }
      return;
    }

    // ── Both checks passed — grant access ──
    sessionStorage.setItem('voter', JSON.stringify(data));
    stopBiometricScan(true);
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);

  } catch (err) {
    console.error('[Auth] Error:', err);
    stopBiometricScan(false);
    showAuthError('🌐 Network error. Please check your connection and try again.');
    if (btn) { btn.disabled = false; btn.textContent = 'VERIFY & CONTINUE'; }
  }
}

// ── Populate nav bar with session voter (called on every page) ──
function populateNav(voter) {
  if (!voter) return;
  const nameEl   = document.querySelector('.nav-username');
  const avatarEl = document.querySelector('.nav-avatar');
  const initials = voter.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (nameEl)   nameEl.textContent   = voter.name.toUpperCase();
  if (avatarEl) avatarEl.textContent = initials;
}

// On every page load — if a session exists, update nav
document.addEventListener('DOMContentLoaded', () => {
  const voter = JSON.parse(sessionStorage.getItem('voter') || 'null');
  populateNav(voter);
  // If on auth page and already logged in, offer quick link (don't force redirect)
});
