// ── AADHAAR FORMAT ──
function formatAadhaar(el) {
  let v = el.value.replace(/\D/g,'').slice(0,12);
  let parts = [];
  for(let i=0;i<v.length;i+=4) parts.push(v.slice(i,i+4));
  el.value = parts.join('-');
}

// ── AUTH ──
function doAuth() {
  const inp = document.getElementById('aadhaar-input').value;
  if(inp.replace(/-/g,'').length < 12) {
    alert('Please enter a valid 12-digit Aadhaar number.');
    return;
  }
  window.location.href = 'dashboard.html';
}

// ── CANDIDATE SELECTION ──
let selectedCandidate = 0;
function selectCandidate(el, idx) {
  document.querySelectorAll('.candidate-card').forEach(c => {
    c.classList.remove('selected');
    const check = c.querySelector('.selected-check');
    if(check) check.remove();
  });
  el.classList.add('selected');
  const check = document.createElement('div');
  check.className = 'selected-check';
  check.textContent = '✓';
  el.appendChild(check);
  selectedCandidate = idx;
}

// ── CAST VOTE ──
let hasVoted = false;
const names = ['Jane Doe','John Smith','Emily Chen'];
function castVote() {
  if(hasVoted) { alert('You have already cast your vote. Each voter gets 1 token.'); return; }
  hasVoted = true;
  document.getElementById('token-display').textContent = '0';
  const txId = '0x' + Math.random().toString(16).slice(2,10) + '...' + Math.random().toString(16).slice(2,8);
  const toast = document.getElementById('toast');
  document.getElementById('toast-sub').textContent = 'Transaction ID: ' + txId;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);

  // add to tx body
  const row = document.createElement('tr');
  row.innerHTML = `<td><div style="display:flex;align-items:center;gap:7px"><div class="tx-icon" style="background:rgba(6,214,160,0.15)">🟢</div><span class="tx-hash">${txId.slice(0,8)}...</span></div></td><td class="tx-time">Just now</td><td><span class="status-confirmed">CONFIRMED</span></td>`;
  document.getElementById('tx-body').prepend(row);

  const resultBody = document.getElementById('results-tx-body');
  if(resultBody) resultBody.prepend(row.cloneNode(true));

  // update total votes
  const tv = document.getElementById('total-votes');
  if(tv) tv.textContent = (parseInt(tv.textContent.replace(/,/g,''))+1).toLocaleString();
}

// ── LOAD MORE ──
function loadMore() {
  const body = document.getElementById('tx-body');
  const icons = ['🟢','🔵','🔴','🟡','🟣'];
  for(let i=0;i<3;i++) {
    const hash = '0x'+Math.random().toString(16).slice(2,8)+'...';
    const icon = icons[Math.floor(Math.random()*icons.length)];
    const row = document.createElement('tr');
    row.innerHTML = `<td><div style="display:flex;align-items:center;gap:7px"><div class="tx-icon" style="background:rgba(0,180,216,0.1)">${icon}</div><span class="tx-hash">${hash}</span></div></td><td class="tx-time">0x.95..06:${Math.floor(Math.random()*60).toString().padStart(2,'0')}:${Math.floor(Math.random()*60).toString().padStart(2,'0')}</td><td><span class="status-confirmed">CONFIRMED</span></td>`;
    body.appendChild(row);
  }
}

// ── LIVE VOTES TICKER ──
setInterval(() => {
  const tv = document.getElementById('total-votes');
  if(!tv) return;
  const n = parseInt(tv.textContent.replace(/,/g,''));
  tv.textContent = (n + Math.floor(Math.random()*3 + 1)).toLocaleString();
}, 3000);
