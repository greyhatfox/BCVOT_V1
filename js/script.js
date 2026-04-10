// js/script.js — Shared UI utilities (all pages)
// Real logic lives in: auth.js, contract.js, results.js

// ── Aadhaar input auto-format (XXXX-XXXX-XXXX) ────────────────
// Also defined in auth.js; this copy handles pages that only load script.js
function formatAadhaar(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 12);
  let parts = [];
  for (let i = 0; i < v.length; i += 4) parts.push(v.slice(i, i + 4));
  el.value = parts.join('-');
}

// ── Candidate card selection ───────────────────────────────────
window.selectedCandidateId = null;

function selectCandidate(el, candidateId) {
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
  window.selectedCandidateId = candidateId;
}

// ── Toast notification ────────────────────────────────────────
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

// ── Populate nav from sessionStorage (stub — real impl in auth.js) ──
function populateNav(voter) {
  if (!voter) return;
  const nameEl   = document.querySelector('.nav-username');
  const avatarEl = document.querySelector('.nav-avatar');
  const initials = voter.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (nameEl)   nameEl.textContent   = voter.name.toUpperCase();
  if (avatarEl) avatarEl.textContent = initials;
}

// ── Load more (stub — overridden by contract.js on dashboard) ──
function loadMore() {
  // No-op on pages that don't load contract.js
  // contract.js overrides this for the dashboard
}

// ── On every page: sync nav from session ──────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const voter = JSON.parse(sessionStorage.getItem('voter') || 'null');
  if (voter) populateNav(voter);
});
