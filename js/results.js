// js/results.js — Live Results Page
// Depends on: config.js, supabase-js CDN, ethers.js v6 CDN

const _sbResults = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

// ── Rank colours ──────────────────────────────────────────────
// Bar chart: Top 3 positions + Others
const RANK_COLOURS = {
  bar: {
    1: 'linear-gradient(180deg,#ff9500,#e67300)',   // 1st — Orange
    2: 'linear-gradient(180deg,#f0f0f0,#c0c0c0)',   // 2nd — White/Silver
    3: 'linear-gradient(180deg,#06d6a0,#019a72)',   // 3rd — Green
    others: 'linear-gradient(180deg,#6b7280,#4b5563)' // Others — Grey
  },
  progress: {
    1: 'linear-gradient(90deg,#ff9500,#e67300)',
    2: 'linear-gradient(90deg,#e2e8f0,#c0c0c0)',
    3: 'linear-gradient(90deg,#06d6a0,#019a72)',
    others: 'linear-gradient(90deg,#6b7280,#4b5563)'
  },
  // Individual breakdown rows cycle for positions 4+
  extra: [
    'linear-gradient(90deg,#8b5cf6,#6d28d9)',
    'linear-gradient(90deg,#0ea5e9,#0284c7)',
    'linear-gradient(90deg,#f43f5e,#be123c)',
    'linear-gradient(90deg,#f97316,#c2410c)',
    'linear-gradient(90deg,#a3e635,#65a30d)',
  ]
};

const RANK_LABELS = { 1: '🥇 1ST', 2: '🥈 2ND', 3: '🥉 3RD' };

function fmtTs(ts) {
  if (!ts) return '—';
  const d = new Date(ts), pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getROProvider() {
  if (window.ethereum) {
    try { return new ethers.BrowserProvider(window.ethereum); } catch (_) {}
  }
  return new ethers.JsonRpcProvider(CONFIG.sepoliaRpc);
}

// ══════════════════════════════════════════════════════════════
//  FETCH ON-CHAIN RESULTS — merge with Supabase candidates list
// ══════════════════════════════════════════════════════════════
async function fetchAndRenderResults() {
  try {
    // 1. Get all approved candidates from Supabase (source of truth for full list)
    const { data: sbCandidates } = await _sbResults
      .from('candidates')
      .select('id, name, party, symbol')
      .eq('election_id', CONFIG.electionId)
      .eq('approved', true)
      .order('id', { ascending: true });

    // 2. Get on-chain vote counts
    const provider = getROProvider();
    const contract = new ethers.Contract(CONFIG.contractAddress, CONFIG.contractABI, provider);
    const onChain  = await contract.getResults(CONFIG.electionId);

    // 3. Merge: map on-chain results by position (1-indexed)
    //    Supabase candidates are ordered by id = insertion order = on-chain index
    const candidates = (sbCandidates || []).map((sb, i) => ({
      name:      sb.name,
      party:     sb.party,
      symbol:    sb.symbol || '🏛️',
      voteCount: onChain[i] ? Number(onChain[i].voteCount) : 0
    }));

    // If no candidates in Supabase yet, fall back to raw on-chain data
    const displayList = candidates.length > 0
      ? candidates
      : (onChain || []).map(r => ({ name: r.name, party: '', symbol: '', voteCount: Number(r.voteCount) }));

    if (displayList.length === 0) return;

    const total = displayList.reduce((a, c) => a + c.voteCount, 0);

    // Update total votes
    const tvEl = document.getElementById('total-votes');
    if (tvEl) tvEl.textContent = total.toLocaleString();

    // 4. Sort by votes descending for ranking
    const sorted = [...displayList].sort((a, b) => b.voteCount - a.voteCount);

    // Leader note
    const leaderNote = document.getElementById('leading-note');
    if (leaderNote) {
      if (total === 0) {
        leaderNote.innerHTML = `📊 <strong>No votes cast yet.</strong>`;
      } else {
        leaderNote.innerHTML = `📊 <strong>${sorted[0].name}</strong> leading with ${sorted[0].voteCount} vote${sorted[0].voteCount !== 1 ? 's' : ''}`;
      }
    }

    // ── 5. Bar chart: Top 3 + Others ────────────────────────
    renderBarChart(sorted, total);

    // ── 6. Candidate breakdown: ALL candidates ───────────────
    renderBreakdown(sorted, total);

  } catch (err) {
    console.warn('[Results] Contract read error:', err);
  }
}

// ── Bar chart: Top 3 individually + "Others" grouped ─────────
function renderBarChart(sorted, total) {
  const chart     = document.getElementById('live-chart');
  const labelsDiv = document.getElementById('bar-labels');
  if (!chart) return;

  // Build display items: top 3 + Others
  const top3   = sorted.slice(0, 3);
  const rest   = sorted.slice(3);
  const othersVotes = rest.reduce((a, c) => a + c.voteCount, 0);

  const chartItems = [
    ...top3.map((c, i) => ({ label: c.name.split(' ')[0], votes: c.voteCount, rank: i + 1 })),
    ...(rest.length > 0 ? [{ label: 'Others', votes: othersVotes, rank: 'others' }] : [])
  ];

  chart.innerHTML = '';
  chartItems.forEach(item => {
    const pct = total > 0 ? Math.round((item.votes / total) * 100) : 0;
    const col = document.createElement('div');
    col.className = 'bar-col';
    const bg = RANK_COLOURS.bar[item.rank] || RANK_COLOURS.bar.others;
    col.innerHTML = `
      <div class="bar-val">${pct}%</div>
      <div class="bar" style="height:${Math.max(pct, 2)}%;background:${bg};position:relative">
        ${item.rank <= 3 ? `<div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:0.6rem;font-weight:700;white-space:nowrap;color:${item.rank===1?'#ff9500':item.rank===2?'#c0c0c0':'#06d6a0'}">${RANK_LABELS[item.rank]}</div>` : ''}
      </div>`;
    chart.appendChild(col);
  });

  if (labelsDiv) {
    labelsDiv.innerHTML = '';
    chartItems.forEach(item => {
      const lbl = document.createElement('div');
      lbl.className = 'bar-label';
      lbl.textContent = item.label;
      if (item.rank === 'others') lbl.style.color = '#6b7280';
      labelsDiv.appendChild(lbl);
    });
  }
}

// ── Candidate breakdown: every candidate + Others row ─────────
function renderBreakdown(sorted, total) {
  const breakdown = document.getElementById('candidate-breakdown');
  if (!breakdown) return;
  breakdown.innerHTML = '';

  // All individual candidates
  sorted.forEach((c, i) => {
    const rank = i + 1;
    const pct  = total > 0 ? ((c.voteCount / total) * 100).toFixed(1) : '0.0';
    const bar  = rank <= 3
      ? RANK_COLOURS.progress[rank]
      : RANK_COLOURS.extra[(rank - 4) % RANK_COLOURS.extra.length];

    const medalIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `<span style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--text3)">#${rank}</span>`;

    const item = document.createElement('div');
    item.style.cssText = 'padding:10px 12px;border-radius:10px;background:var(--surface2);margin-bottom:8px';
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:1rem">${medalIcon}</span>
          <div>
            <div style="font-weight:600;font-size:0.85rem;color:var(--text1)">${c.name}</div>
            <div style="font-size:0.7rem;color:var(--text3)">${c.party || ''} ${c.symbol || ''}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:0.9rem;color:var(--text1)">${c.voteCount.toLocaleString()} <span style="font-size:0.7rem;color:var(--text3)">vote${c.voteCount !== 1 ? 's' : ''}</span></div>
          <div style="font-size:0.7rem;color:var(--text3)">${pct}%</div>
        </div>
      </div>
      <div style="background:var(--border);border-radius:20px;height:6px">
        <div style="background:${bar};height:100%;border-radius:20px;width:${pct}%;transition:width 0.8s ease"></div>
      </div>`;
    breakdown.appendChild(item);
  });

  // Others row (aggregated) — only if 4+ candidates
  if (sorted.length > 3) {
    const others      = sorted.slice(3);
    const othersVotes = others.reduce((a, c) => a + c.voteCount, 0);
    const othersPct   = total > 0 ? ((othersVotes / total) * 100).toFixed(1) : '0.0';

    const othersRow = document.createElement('div');
    othersRow.style.cssText = 'padding:10px 12px;border-radius:10px;background:rgba(107,114,128,0.08);border:1px dashed rgba(107,114,128,0.25);margin-bottom:8px';
    othersRow.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:1rem">🔘</span>
          <div>
            <div style="font-weight:600;font-size:0.85rem;color:#6b7280">Others</div>
            <div style="font-size:0.7rem;color:var(--text3)">${others.length} candidate${others.length !== 1 ? 's' : ''} combined</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:0.9rem;color:#6b7280">${othersVotes.toLocaleString()} <span style="font-size:0.7rem;color:var(--text3)">vote${othersVotes !== 1 ? 's' : ''}</span></div>
          <div style="font-size:0.7rem;color:var(--text3)">${othersPct}%</div>
        </div>
      </div>
      <div style="background:var(--border);border-radius:20px;height:6px">
        <div style="background:${RANK_COLOURS.progress.others};height:100%;border-radius:20px;width:${othersPct}%;transition:width 0.8s ease"></div>
      </div>`;
    breakdown.appendChild(othersRow);
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

    const COLORS = ['rgba(6,214,160,0.1)','rgba(0,180,216,0.1)','rgba(239,35,60,0.1)','rgba(255,190,11,0.1)','rgba(139,92,246,0.1)'];
    const ICONS  = ['🟢','🔵','🔴','🟡','🟣'];

    if (txs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:20px;font-size:0.8rem">No transactions recorded yet.</td></tr>`;
      return;
    }

    txs.forEach((tx, i) => {
      const ci  = i % COLORS.length;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><div style="display:flex;align-items:center;gap:7px">
          <div class="tx-icon" style="background:${COLORS[ci]}">${ICONS[ci]}</div>
          <span class="tx-hash" style="cursor:pointer" title="${tx.tx_hash}"
                onclick="window.open('https://sepolia.etherscan.io/tx/${tx.tx_hash}','_blank')">${tx.tx_hash.slice(0,10)}…</span>
        </div></td>
        <td class="tx-time">${fmtTs(tx.timestamp)}</td>
        <td><span class="status-confirmed">${tx.status}</span></td>`;
      tbody.appendChild(row);
    });

    const { count } = await _sbResults.from('transactions').select('*', { count: 'exact', head: true });
    const txCountEl = document.getElementById('tx-count-stat');
    if (txCountEl && count != null) txCountEl.textContent = count.toLocaleString();

  } catch (err) {
    console.warn('[Results] Supabase tx error:', err);
  }
}

// ── Full refresh ──────────────────────────────────────────────
async function loadResults() {
  await Promise.all([fetchAndRenderResults(), fetchRecentTx()]);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadResults();
  setInterval(loadResults, 5000); // refresh every 5s
});
