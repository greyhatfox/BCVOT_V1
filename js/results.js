// js/results.js — Live Results Page
// Depends on: config.js, supabase-js CDN, ethers.js v6 CDN

const _sbResults = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

// ── Colour scheme ─────────────────────────────────────────────
const RANK_BAR = {
  1: 'linear-gradient(180deg,#ff9500,#e67300)',
  2: 'linear-gradient(180deg,#f0f0f0,#c0c0c0)',
  3: 'linear-gradient(180deg,#06d6a0,#019a72)',
  o: 'linear-gradient(180deg,#6b7280,#4b5563)'
};
const RANK_PROG = {
  1: 'linear-gradient(90deg,#ff9500,#e67300)',
  2: 'linear-gradient(90deg,#e2e8f0,#c0c0c0)',
  3: 'linear-gradient(90deg,#06d6a0,#019a72)',
  o: 'linear-gradient(90deg,#6b7280,#4b5563)'
};
const EXTRA_PROG = [
  'linear-gradient(90deg,#8b5cf6,#6d28d9)',
  'linear-gradient(90deg,#0ea5e9,#0284c7)',
  'linear-gradient(90deg,#f43f5e,#be123c)',
  'linear-gradient(90deg,#f97316,#c2410c)',
];
const MEDAL = { 1:'🥇', 2:'🥈', 3:'🥉' };
const MEDAL_COLOUR = { 1:'#ff9500', 2:'#c0c0c0', 3:'#06d6a0' };

// ── Multiple fallback Sepolia RPCs (race for fastest) ─────────
const SEPOLIA_RPCS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
  'https://rpc2.sepolia.org',
  'https://rpc.sepolia.org',
];

async function getROProvider() {
  // Prefer MetaMask (already connected, zero latency)
  if (window.ethereum) {
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      await p.getBlockNumber(); // quick liveness check
      return p;
    } catch (_) {}
  }
  // Race public RPCs — return whichever responds first within 4s
  const racePromises = SEPOLIA_RPCS.map(url =>
    new Promise(async (resolve, reject) => {
      try {
        const p = new ethers.JsonRpcProvider(url);
        await Promise.race([
          p.getBlockNumber(),
          new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 4000))
        ]);
        resolve(p);
      } catch { reject(); }
    })
  );
  return Promise.any(racePromises);
}

function fmtTs(ts) {
  if (!ts) return '—';
  const d = new Date(ts), pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ══════════════════════════════════════════════════════════════
//  STEP 1 — Load Supabase candidates immediately (fast)
// ══════════════════════════════════════════════════════════════
async function loadCandidatesFromSupabase() {
  const { data, error } = await _sbResults
    .from('candidates')
    .select('id, name, party, symbol')
    .eq('election_id', CONFIG.electionId)
    .eq('approved', true)
    .order('id', { ascending: true });

  if (error || !data || data.length === 0) return [];
  return data.map(c => ({ ...c, voteCount: 0 }));
}

// ══════════════════════════════════════════════════════════════
//  STEP 2 — Fetch blockchain vote counts (may be slow)
// ══════════════════════════════════════════════════════════════
async function fetchOnChainCounts() {
  const provider = await getROProvider();
  const contract = new ethers.Contract(CONFIG.contractAddress, CONFIG.contractABI, provider);
  const results  = await contract.getResults(CONFIG.electionId);
  return results.map(r => Number(r.voteCount));
}

// ══════════════════════════════════════════════════════════════
//  RENDER helpers
// ══════════════════════════════════════════════════════════════
function renderChart(sorted, total) {
  const chart     = document.getElementById('live-chart');
  const labelsDiv = document.getElementById('bar-labels');
  if (!chart) return;

  const top3        = sorted.slice(0, 3);
  const rest        = sorted.slice(3);
  const othersVotes = rest.reduce((a, c) => a + c.voteCount, 0);
  const items       = [
    ...top3.map((c, i) => ({ label: c.name.split(' ')[0], votes: c.voteCount, rank: i + 1 })),
    ...(rest.length > 0 ? [{ label: 'Others', votes: othersVotes, rank: 'o' }] : [])
  ];

  chart.innerHTML = '';
  items.forEach(item => {
    const pct = total > 0 ? Math.round((item.votes / total) * 100) : 0;
    const bg  = RANK_BAR[item.rank] || RANK_BAR.o;
    const col = document.createElement('div');
    col.className = 'bar-col';
    const rankLabel = MEDAL[item.rank]
      ? `<div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);font-size:0.65rem;font-weight:700;white-space:nowrap;color:${MEDAL_COLOUR[item.rank]}">${MEDAL[item.rank]} ${['1ST','2ND','3RD'][item.rank-1]}</div>`
      : '';
    col.innerHTML = `
      <div class="bar-val">${pct}%</div>
      <div class="bar" style="height:${Math.max(pct,2)}%;background:${bg};position:relative">${rankLabel}</div>`;
    chart.appendChild(col);
  });

  if (labelsDiv) {
    labelsDiv.innerHTML = '';
    items.forEach(item => {
      const lbl = document.createElement('div');
      lbl.className = 'bar-label';
      lbl.textContent = item.label;
      if (item.rank === 'o') lbl.style.color = '#6b7280';
      labelsDiv.appendChild(lbl);
    });
  }
}

function renderBreakdown(sorted, total) {
  const breakdown = document.getElementById('candidate-breakdown');
  if (!breakdown) return;
  breakdown.innerHTML = '';

  sorted.forEach((c, i) => {
    const rank = i + 1;
    const pct  = total > 0 ? ((c.voteCount / total) * 100).toFixed(1) : '0.0';
    const bar  = RANK_PROG[rank] || EXTRA_PROG[(rank - 4) % EXTRA_PROG.length];
    const icon = MEDAL[rank]
      ? `<span style="font-size:1rem">${MEDAL[rank]}</span>`
      : `<span style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--text3);min-width:20px;text-align:center">#${rank}</span>`;

    const item = document.createElement('div');
    item.style.cssText = 'padding:10px 12px;border-radius:10px;background:var(--surface2);margin-bottom:8px';
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          ${icon}
          <div>
            <div style="font-weight:600;font-size:0.85rem;color:var(--text1)">${c.name}</div>
            <div style="font-size:0.7rem;color:var(--text3)">${c.party || ''} ${c.symbol || ''}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:0.9rem;color:var(--text1)">${c.voteCount.toLocaleString()} <span style="font-size:0.7rem;color:var(--text3)">vote${c.voteCount!==1?'s':''}</span></div>
          <div style="font-size:0.7rem;color:var(--text3)">${pct}%</div>
        </div>
      </div>
      <div style="background:var(--border);border-radius:20px;height:6px">
        <div style="background:${bar};height:100%;border-radius:20px;width:${pct}%;transition:width 0.8s ease"></div>
      </div>`;
    breakdown.appendChild(item);
  });

  // Others aggregated row
  if (sorted.length > 3) {
    const others      = sorted.slice(3);
    const oVotes      = others.reduce((a, c) => a + c.voteCount, 0);
    const oPct        = total > 0 ? ((oVotes / total) * 100).toFixed(1) : '0.0';
    const row         = document.createElement('div');
    row.style.cssText = 'padding:10px 12px;border-radius:10px;background:rgba(107,114,128,0.08);border:1px dashed rgba(107,114,128,0.25);margin-bottom:8px';
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span>🔘</span>
          <div>
            <div style="font-weight:600;font-size:0.85rem;color:#6b7280">Others</div>
            <div style="font-size:0.7rem;color:var(--text3)">${others.length} candidate${others.length!==1?'s':''} combined</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:0.9rem;color:#6b7280">${oVotes.toLocaleString()} <span style="font-size:0.7rem;color:var(--text3)">vote${oVotes!==1?'s':''}</span></div>
          <div style="font-size:0.7rem;color:var(--text3)">${oPct}%</div>
        </div>
      </div>
      <div style="background:var(--border);border-radius:20px;height:6px">
        <div style="background:${RANK_PROG.o};height:100%;border-radius:20px;width:${oPct}%;transition:width 0.8s ease"></div>
      </div>`;
    breakdown.appendChild(row);
  }
}

function applyVotesToCandidates(candidates, counts) {
  return candidates.map((c, i) => ({ ...c, voteCount: counts[i] ?? 0 }));
}

function sortAndRender(candidates) {
  const total  = candidates.reduce((a, c) => a + c.voteCount, 0);
  const sorted = [...candidates].sort((a, b) => b.voteCount - a.voteCount);

  const tvEl = document.getElementById('total-votes');
  if (tvEl) tvEl.textContent = total.toLocaleString();

  const leaderNote = document.getElementById('leading-note');
  if (leaderNote) {
    if (total === 0) {
      leaderNote.innerHTML = `📊 <strong>No votes cast yet.</strong>`;
    } else {
      leaderNote.innerHTML = `📊 <strong>${sorted[0].name}</strong> leading with ${sorted[0].voteCount.toLocaleString()} vote${sorted[0].voteCount!==1?'s':''}`;
    }
  }

  renderChart(sorted, total);
  renderBreakdown(sorted, total);
}

// ══════════════════════════════════════════════════════════════
//  MAIN — two-phase load
// ══════════════════════════════════════════════════════════════
async function fetchAndRenderResults() {
  // Phase 1: render from Supabase instantly (0 vote placeholders)
  const candidates = await loadCandidatesFromSupabase();
  if (candidates.length > 0) {
    sortAndRender(candidates);

    // Phase 2: overlay real vote counts from blockchain
    fetchOnChainCounts()
      .then(counts => {
        const updated = applyVotesToCandidates(candidates, counts);
        sortAndRender(updated);
      })
      .catch(err => console.warn('[Results] Blockchain unavailable:', err));
  } else {
    // Fallback: try getting everything from chain directly
    try {
      const counts    = await fetchOnChainCounts();
      const provider  = await getROProvider();
      const contract  = new ethers.Contract(CONFIG.contractAddress, CONFIG.contractABI, provider);
      const onChain   = await contract.getResults(CONFIG.electionId);
      const fallback  = onChain.map((r, i) => ({
        name: r.name, party: '', symbol: '', voteCount: counts[i] ?? 0
      }));
      sortAndRender(fallback);
    } catch (err) {
      console.warn('[Results] No candidates loaded:', err);
      const note = document.getElementById('leading-note');
      if (note) note.innerHTML = `⚠️ No approved candidates yet.`;
    }
  }
}

// ── Recent transactions ───────────────────────────────────────
async function fetchRecentTx() {
  try {
    const { data: txs, error } = await _sbResults
      .from('transactions')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

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
          <div class="tx-icon" style="background:${COLORS[i%COLORS.length]}">${ICONS[i%ICONS.length]}</div>
          <span class="tx-hash" style="cursor:pointer" title="${tx.tx_hash}"
                onclick="window.open('https://sepolia.etherscan.io/tx/${tx.tx_hash}','_blank')">${tx.tx_hash.slice(0,10)}…</span>
        </div></td>
        <td class="tx-time">${fmtTs(tx.timestamp)}</td>
        <td><span class="status-confirmed">${tx.status}</span></td>`;
      tbody.appendChild(row);
    });

    const { count } = await _sbResults.from('transactions').select('*', { count:'exact', head:true });
    const el = document.getElementById('tx-count-stat');
    if (el && count != null) el.textContent = count.toLocaleString();
  } catch (err) {
    console.warn('[Results] Supabase tx error:', err);
  }
}

// ── Full refresh ──────────────────────────────────────────────
async function loadResults() {
  fetchAndRenderResults(); // non-blocking two-phase
  fetchRecentTx();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadResults();
  setInterval(loadResults, 8000); // refresh every 8s
});
