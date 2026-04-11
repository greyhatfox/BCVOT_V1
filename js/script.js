// js/script.js — Shared UI utilities (all pages)
// Real logic lives in: auth.js, contract.js, results.js

// ── Page identity ─────────────────────────────────────────────────
const _PAGE = (() => {
  const p = location.pathname.split('/').pop().replace('.html','');
  return p || 'index';
})();

// ── Public pages (no login required) ─────────────────────────────
const PUBLIC_PAGES = ['ballots', 'history', 'results', 'index', ''];

// ── Aadhaar input auto-format (XXXX-XXXX-XXXX) ───────────────────
function formatAadhaar(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 12);
  let parts = [];
  for (let i = 0; i < v.length; i += 4) parts.push(v.slice(i, i + 4));
  el.value = parts.join('-');
}

// ── Candidate card selection ──────────────────────────────────────
window.selectedCandidateId = null;

function selectCandidate(el, candidateId, onChainId) {
  document.querySelectorAll('.candidate-card').forEach(c => {
    c.classList.remove('selected');
    const chk = c.querySelector('.selected-check');
    if (chk) chk.remove();
  });
  el.classList.add('selected');
  const check = document.createElement('div');
  check.className = 'selected-check';
  check.textContent = '✓';
  el.appendChild(check);
  window.selectedCandidateId = candidateId;          // Supabase DB id  (for reference)
  window.selectedOnChainId   = onChainId ?? candidateId; // on-chain index (for castVote)
}

// ── Toast notification ────────────────────────────────────────────
function showToast(title, sub) {
  const toast   = document.getElementById('toast');
  if (!toast) return;
  const titleEl = toast.querySelector('.toast-title');
  const subEl   = toast.querySelector('.toast-sub');
  if (titleEl) titleEl.textContent = title;
  if (subEl)   subEl.textContent   = sub;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 6000);
}

// ── Logout ────────────────────────────────────────────────────────
function logout() {
  sessionStorage.removeItem('voter');
  window.location.href = 'auth.html';
}

// ── Core nav renderer ─────────────────────────────────────────────
/**
 * Rebuilds the nav links and user block to reflect auth state.
 * Works for every page that has the standard <nav> structure.
 */
function syncNav(voter) {
  const isLoggedIn = !!voter;

  // ── NAV LINKS ──────────────────────────────────────────────────
  const linksEl = document.querySelector('.nav-links');
  if (linksEl) {
    // Determine current page for active highlighting
    const cur = _PAGE;

    // Build link list: public links always shown, auth-links hidden when logged in
    const links = [
      { id: 'nav-dashboard', href: 'dashboard.html', label: 'Dashboard',    page: 'dashboard',  auth: true  },
      { id: 'nav-ballots',   href: 'ballots.html',   label: 'Ballots',      page: 'ballots',    auth: false },
      { id: 'nav-history',   href: 'history.html',   label: 'History',      page: 'history',    auth: false },
      { id: 'nav-results',   href: 'results.html',   label: 'Live Results', page: 'results',    auth: false },
      { id: 'nav-register',  href: 'register.html',  label: 'Register',     page: 'register',   auth: false, guestOnly: true },
      { id: 'nav-auth',      href: 'auth.html',      label: 'Login',        page: 'auth',       auth: false, guestOnly: true, style: 'color:rgba(255,255,255,0.5);font-size:0.8rem' },
    ];

    linksEl.innerHTML = links
      .filter(l => {
        if (l.guestOnly && isLoggedIn) return false;   // hide Login/Register when logged in
        if (l.auth && !isLoggedIn) return false;        // hide Dashboard when not logged in
        return true;
      })
      .map(l => {
        const isActive = (cur === l.page);
        const style    = l.style ? ` style="${l.style}"` : '';
        return `<a href="${l.href}" id="${l.id}"${isActive ? ' class="active"' : ''}${style}>${l.label}</a>`;
      })
      .join('\n');
  }

  // ── NAV USER BLOCK ─────────────────────────────────────────────
  const navUser = document.querySelector('.nav-user');
  if (!navUser) return;

  if (isLoggedIn) {
    const initials = voter.name
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const statusLabel = '● VERIFIED';
    const statusColor = 'var(--accent)';
    const walletShort = voter.wallet_address
      ? `${voter.wallet_address.slice(0,6)}…${voter.wallet_address.slice(-4)}`
      : '—';

    navUser.innerHTML = `
      <button class="theme-toggle" id="theme-toggle-btn" onclick="toggleTheme()" title="Switch theme" aria-label="Switch theme">
        <span class="theme-toggle-icon">☀️</span>
        <span class="theme-toggle-label">Light</span>
      </button>
      <div class="nav-dot"></div>
      <div class="nav-user-info" style="position:relative">
        <div class="nav-username" title="${walletShort}">${voter.name.toUpperCase()}</div>
        <div class="verified-badge" style="color:${statusColor}">${statusLabel}</div>
      </div>
      <div class="nav-avatar" title="${voter.name}">${initials}</div>
      <button onclick="logout()" title="Log out"
        style="background:rgba(239,35,60,0.12);border:1px solid rgba(239,35,60,0.3);color:#ef233c;
               border-radius:var(--radius-sm);padding:5px 12px;font-size:0.78rem;font-weight:700;
               font-family:'Rajdhani',sans-serif;letter-spacing:0.5px;cursor:pointer;
               transition:background 0.2s;white-space:nowrap">
        LOGOUT
      </button>`;
  } else {
    // Guest state
    navUser.innerHTML = `
      <button class="theme-toggle" id="theme-toggle-btn" onclick="toggleTheme()" title="Switch theme" aria-label="Switch theme">
        <span class="theme-toggle-icon">☀️</span>
        <span class="theme-toggle-label">Light</span>
      </button>
      <div class="nav-dot" style="background:#718096"></div>
      <div>
        <div class="nav-username">GUEST</div>
        <div class="verified-badge" style="color:#718096">● NOT LOGGED IN</div>
      </div>
      <div class="nav-avatar" style="background:linear-gradient(135deg,#4a5568,#718096)">?</div>`;
  }

  // Re-sync theme button after rebuilding nav
  if (typeof syncToggleButtons === 'function') syncToggleButtons();
}

// ── populateNav — kept for compatibility with existing pages ───────
function populateNav(voter) {
  syncNav(voter);
}

// ── On every page load ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const voter = JSON.parse(sessionStorage.getItem('voter') || 'null');

  // Auth-guard: if the page requires login and user isn't logged in, redirect
  const isProtected = !PUBLIC_PAGES.includes(_PAGE) && _PAGE !== 'auth' && _PAGE !== 'register';
  if (isProtected && !voter) {
    window.location.href = 'auth.html';
    return;
  }

  // Auth page / register: if already logged in, bounce to dashboard
  if ((_PAGE === 'auth' || _PAGE === 'register') && voter) {
    window.location.href = 'dashboard.html';
    return;
  }

  syncNav(voter);
});

// ── Load more (stub — overridden by contract.js on dashboard) ────
function loadMore() {
  // No-op on pages that don't load contract.js
}

// ── Load elections for candidate dropdown (register page) ─────────
async function loadElectionsForDropdown() {
  const sel = document.getElementById('cand-election');
  if (!sel) return;
  try {
    const db = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    const { data } = await db.from('elections').select('id,title').eq('status','active').order('id');
    sel.innerHTML = '<option value="">Select election to contest…</option>' +
      (data || []).map(e => `<option value="${e.id}">${e.title}</option>`).join('');
  } catch(_) {}
}

// ── Global Multi-Election Helpers ─────────────────────────────────
function getCurrentElectionId() {
  return parseInt(sessionStorage.getItem('selectedElectionId')) || CONFIG.electionId || 1;
}

function goToElection(id, status) {
  sessionStorage.setItem('selectedElectionId', id);
  if (status === 'active') window.location.href = 'dashboard.html';
  else window.location.href = 'results.html';
}

async function injectElectionDropdown() {
  const container = document.getElementById('election-dropdown-container');
  if (!container) return;

  const db = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  const { data: elections } = await db.from('elections').select('id, title, status').order('id', { ascending: true });
  
  if (!elections || elections.length === 0) return;
  
  let currentId = getCurrentElectionId();
  let hasMatch = false;
  
  const select = document.createElement('select');
  select.className = 'election-select';
  select.style.cssText = "background:rgba(255,255,255,0.05);color:var(--text1);border:1px solid rgba(255,255,255,0.1);padding:6px 12px;border-radius:8px;font-family:'Rajdhani',sans-serif;font-size:0.9rem;font-weight:600;cursor:pointer;outline:none;";
  
  elections.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = `${e.title.split('·')[0].trim()} ${e.status !== 'active' ? '(Closed)' : ''}`;
    opt.style.background = '#0a0e1a';
    opt.style.color = '#fff';
    if (e.id === currentId) {
      opt.selected = true;
      hasMatch = true;
    }
    select.appendChild(opt);
  });
  
  if (!hasMatch && elections.length > 0) {
    currentId = elections[0].id;
    select.value = currentId;
    sessionStorage.setItem('selectedElectionId', currentId);
  }

  // Also expose the current election in a global variable for immediate access
  window._currentElectionData = elections.find(e => e.id === currentId);
  
  select.addEventListener('change', (e) => {
    sessionStorage.setItem('selectedElectionId', e.target.value);
    window.location.reload();
  });
  
  container.innerHTML = '';
  container.appendChild(select);
}
