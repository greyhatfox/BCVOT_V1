// js/results.js — Live Results Page
// Depends on: config.js, supabase-js CDN, ethers.js v6 CDN

const _sbResults = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

// ── Rank colours ──────────────────────────────────────────────
const RANK_BAR  = { 1:'linear-gradient(180deg,#ff9500,#e67300)', 2:'linear-gradient(180deg,#f0f0f0,#c0c0c0)', 3:'linear-gradient(180deg,#06d6a0,#019a72)', o:'linear-gradient(180deg,#6b7280,#4b5563)' };
const RANK_PROG = { 1:'linear-gradient(90deg,#ff9500,#e67300)',  2:'linear-gradient(90deg,#e2e8f0,#c0c0c0)',  3:'linear-gradient(90deg,#06d6a0,#019a72)',  o:'linear-gradient(90deg,#6b7280,#4b5563)' };
const EXTRA_PROG = ['linear-gradient(90deg,#8b5cf6,#6d28d9)','linear-gradient(90deg,#0ea5e9,#0284c7)','linear-gradient(90deg,#f43f5e,#be123c)','linear-gradient(90deg,#f97316,#c2410c)'];
const MEDAL = { 1:'🥇', 2:'🥈', 3:'🥉' };

// ── RPC pool — race for fastest ───────────────────────────────
const SEPOLIA_RPCS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
  'https://rpc2.sepolia.org',
  'https://rpc.sepolia.org',
];

async function getROProvider() {
  if (window.ethereum) {
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      await p.getBlockNumber();
      return p;
    } catch (_) {}
  }
  return Promise.any(SEPOLIA_RPCS.map(url => new Promise(async (res, rej) => {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await Promise.race([p.getBlockNumber(), new Promise((_,r) => setTimeout(r, 4000))]);
      res(p);
    } catch { rej(); }
  })));
}

function fmtTs(ts) {
  if (!ts) return '—';
  const d = new Date(ts), pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Cache: prevents flicker on repeated refreshes ─────────────
let _cachedVoteCounts = null;  // null = not yet loaded from chain
let _cachedCandidates = [];

// ══════════════════════════════════════════════════════════════
//  DATA FETCHERS
// ══════════════════════════════════════════════════════════════
async function loadCandidatesFromSupabase() {
  const eid = getCurrentElectionId();
  const { data, error } = await _sbResults
    .from('candidates')
    .select('id, name, party, symbol')
    .eq('election_id', eid)
    .eq('approved', true)
    .order('id', { ascending: true });
  if (error || !data) return [];
  return data.map(c => ({ ...c, voteCount: 0 }));
}

async function fetchOnChainCounts() {
  const provider = await getROProvider();
  const contract = new ethers.Contract(CONFIG.contractAddress, CONFIG.contractABI, provider);
  const eid = getCurrentElectionId();
  const results  = await contract.getResults(eid);
  return results.map(r => Number(r.voteCount));
}

function applyVotes(candidates, counts) {
  return candidates.map((c, i) => ({ ...c, voteCount: counts[i] ?? 0 }));
}

// ══════════════════════════════════════════════════════════════
//  BAR CHART — Top 3 + Others bar, rank badge beside labels
// ══════════════════════════════════════════════════════════════
function renderChart(sorted, total) {
  const chart     = document.getElementById('live-chart');
  const labelsDiv = document.getElementById('bar-labels');
  if (!chart) return;

  const top3        = sorted.slice(0, 3);
  const rest        = sorted.slice(3);
  const othersVotes = rest.reduce((a, c) => a + c.voteCount, 0);
  const items = [
    ...top3.map((c, i) => ({ label: c.name.split(' ')[0], votes: c.voteCount, rank: i + 1 })),
    ...(rest.length > 0 ? [{ label: 'Others', votes: othersVotes, rank: 'o' }] : [])
  ];

  chart.innerHTML = '';
  items.forEach(item => {
    const pct = total > 0 ? Math.round((item.votes / total) * 100) : 0;
    const bg  = RANK_BAR[item.rank] || RANK_BAR.o;
    const col = document.createElement('div');
    col.className = 'bar-col';
    // Percentage text ABOVE bar only — no rank badge inside bar
    col.innerHTML = `
      <div class="bar-val">${pct}%</div>
      <div class="bar" style="height:${Math.max(pct,2)}%;background:${bg}"></div>`;
    chart.appendChild(col);
  });

  if (labelsDiv) {
    labelsDiv.innerHTML = '';
    items.forEach(item => {
      const lbl = document.createElement('div');
      lbl.className = 'bar-label';
      // Medal badge BESIDE the candidate name in the label row
      const medal  = MEDAL[item.rank] ? `${MEDAL[item.rank]} ` : '';
      lbl.textContent = medal + item.label;
      lbl.style.fontWeight = item.rank !== 'o' ? '700' : '400';
      if (item.rank === 'o') lbl.style.color = '#6b7280';
      labelsDiv.appendChild(lbl);
    });
  }
}

// ══════════════════════════════════════════════════════════════
//  CANDIDATE BREAKDOWN — every candidate, no combining
// ══════════════════════════════════════════════════════════════
function renderBreakdown(sorted, total) {
  const breakdown = document.getElementById('candidate-breakdown');
  if (!breakdown) return;
  breakdown.innerHTML = '';

  sorted.forEach((c, i) => {
    const rank = i + 1;
    const pct  = total > 0 ? ((c.voteCount / total) * 100).toFixed(1) : '0.0';
    const bar  = RANK_PROG[rank] || EXTRA_PROG[(rank - 4) % EXTRA_PROG.length];

    // Medal beside name, or rank number for 4th+
    const rankBadge = MEDAL[rank]
      ? `<span style="font-size:1rem;line-height:1">${MEDAL[rank]}</span>`
      : `<span style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:var(--text3);background:var(--border);padding:2px 6px;border-radius:4px">#${rank}</span>`;

    const item = document.createElement('div');
    item.style.cssText = 'padding:10px 12px;border-radius:10px;background:var(--surface2);margin-bottom:8px';
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
        <div style="display:flex;align-items:center;gap:8px">
          ${rankBadge}
          <div>
            <div style="font-weight:600;font-size:0.85rem;color:var(--text1)">${c.name}</div>
            <div style="font-size:0.7rem;color:var(--text3)">${c.party || ''}${c.symbol ? ' ' + c.symbol : ''}</div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:12px">
          <div style="font-weight:700;font-size:0.9rem;color:var(--text1)">${c.voteCount.toLocaleString()}<span style="font-size:0.68rem;color:var(--text3);margin-left:3px">vote${c.voteCount!==1?'s':''}</span></div>
          <div style="font-size:0.72rem;color:var(--text3)">${pct}%</div>
        </div>
      </div>
      <div style="background:var(--border);border-radius:20px;height:6px">
        <div style="background:${bar};height:100%;border-radius:20px;width:${pct}%;transition:width 0.8s ease"></div>
      </div>`;
    breakdown.appendChild(item);
  });

  if (sorted.length === 0) {
    breakdown.innerHTML = `<div style="color:var(--text3);font-size:0.8rem;text-align:center;padding:20px">No approved candidates yet.</div>`;
  }
}

// ── Apply & render ────────────────────────────────────────────
function sortAndRender(candidates) {
  const total  = candidates.reduce((a, c) => a + c.voteCount, 0);
  const sorted = [...candidates].sort((a, b) => b.voteCount - a.voteCount);

  const tvEl = document.getElementById('total-votes');
  if (tvEl) tvEl.textContent = total.toLocaleString();

  const note = document.getElementById('leading-note');
  if (note) {
    note.innerHTML = total === 0
      ? `📊 <strong>No votes cast yet.</strong>`
      : `📊 <strong>${sorted[0].name}</strong> leading with ${sorted[0].voteCount.toLocaleString()} vote${sorted[0].voteCount!==1?'s':''}`;
  }

  renderChart(sorted, total);
  renderBreakdown(sorted, total);
}

// ══════════════════════════════════════════════════════════════
//  TWO-PHASE LOAD (anti-flicker cache)
// ══════════════════════════════════════════════════════════════
async function fetchAndRenderResults() {
  const candidates = await loadCandidatesFromSupabase();

  if (candidates.length === 0) {
    const note = document.getElementById('leading-note');
    if (note && _cachedCandidates.length === 0)
      note.innerHTML = `⚠️ <strong>No approved candidates yet.</strong>`;
    return;
  }

  // Use cached vote counts to avoid flicker on re-render
  if (_cachedVoteCounts !== null) {
    // Merge cached counts with potentially updated candidate list
    const withCached = applyVotes(candidates, _cachedVoteCounts);
    sortAndRender(withCached);
  } else {
    // First ever load: show 0s while chain loads
    sortAndRender(candidates);
  }

  _cachedCandidates = candidates;

  // Fetch fresh blockchain counts — silently update, no DOM flash
  fetchOnChainCounts()
    .then(counts => {
      _cachedVoteCounts = counts;
      sortAndRender(applyVotes(candidates, counts));
    })
    .catch(err => {
      console.warn('[Results] Chain unavailable — keeping cached data:', err);
      // Do NOT clear display — keep whatever is shown
    });
}

// ── Recent transactions ───────────────────────────────────────
async function fetchRecentTx() {
  try {
    const eid = getCurrentElectionId();
    const { data: txs, error } = await _sbResults
      .from('transactions').select('*')
      .eq('election_id', eid)
      .order('timestamp', { ascending: false }).limit(10);
    if (error || !txs) return;

    const tbody = document.getElementById('results-tx-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (txs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:20px;font-size:0.8rem">No transactions recorded yet.</td></tr>`;
      return;
    }

    const COLORS = ['rgba(6,214,160,0.1)','rgba(0,180,216,0.1)','rgba(239,35,60,0.1)','rgba(255,190,11,0.1)','rgba(139,92,246,0.1)'];
    const ICONS  = ['🟢','🔵','🔴','🟡','🟣'];
    txs.forEach((tx, i) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><div style="display:flex;align-items:center;gap:7px">
          <div class="tx-icon" style="background:${COLORS[i%5]}">${ICONS[i%5]}</div>
          <span class="tx-hash" style="cursor:pointer" title="${tx.tx_hash}"
                onclick="window.open('https://sepolia.etherscan.io/tx/${tx.tx_hash}','_blank')">${tx.tx_hash.slice(0,10)}…</span>
        </div></td>
        <td class="tx-time">${fmtTs(tx.timestamp)}</td>
        <td><span class="status-confirmed">${tx.status}</span></td>`;
      tbody.appendChild(row);
    });

    const { count } = await _sbResults.from('transactions').select('*',{count:'exact',head:true}).eq('election_id', eid);
    const el = document.getElementById('tx-count-stat');
    if (el && count != null) el.textContent = count.toLocaleString();
  } catch (err) {
    console.warn('[Results] Supabase tx error:', err);
  }
}

// ── Refresh cycle ─────────────────────────────────────────────
async function loadResults() {
  fetchAndRenderResults();
  fetchRecentTx();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof injectElectionDropdown === 'function') {
    await injectElectionDropdown();
  }
  loadResults();
  setInterval(loadResults, 10000); // every 10s
});
