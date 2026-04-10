// js/results.js — Live Results Page
// Depends on: config.js, supabase-js CDN, ethers.js v6 CDN

const _sbResults = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

// ── Colour palette for candidates ─────────────────────────────
const BAR_COLOURS = [
  'linear-gradient(180deg,var(--primary),var(--accent2))',
  'linear-gradient(180deg,var(--accent),#0aa376)',
  'linear-gradient(180deg,#f4a261,#e76f51)',
  'linear-gradient(180deg,#a8dadc,#457b9d)'
];
const PROGRESS_COLOURS = [
  'linear-gradient(90deg,var(--primary),var(--accent))',
  'linear-gradient(90deg,var(--accent),#0aa376)',
  'linear-gradient(90deg,#f4a261,#e76f51)',
  'linear-gradient(90deg,#a8dadc,#457b9d)'
];

function fmtTs(ts) {
  if (!ts) return '—';
  const d = new Date(ts), pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ── Get a read-only ethers provider ──────────────────────────
function getROProvider() {
  if (window.ethereum) {
    try { return new ethers.BrowserProvider(window.ethereum); } catch (_) {}
  }
  return new ethers.JsonRpcProvider(CONFIG.sepoliaRpc);
}

// ── Fetch on-chain results and update chart ───────────────────
async function fetchAndRenderResults() {
  try {
    const provider = getROProvider();
    const contract = new ethers.Contract(CONFIG.contractAddress, CONFIG.contractABI, provider);
    const results  = await contract.getResults(CONFIG.electionId);

    if (!results || results.length === 0) return;

    // Convert BigInts to regular numbers
    const counts   = results.map(r => Number(r.voteCount));
    const total    = counts.reduce((a, b) => a + b, 0);

    // ── Update "Total Votes Cast" stat ──
    const tvEl = document.getElementById('total-votes');
    if (tvEl) tvEl.textContent = total.toLocaleString();

    if (total === 0) return; // No votes yet — leave bars at zero

    // ── Determine leader ──
    const maxVotes    = Math.max(...counts);
    const leaderIndex = counts.indexOf(maxVotes);
    const leaderName  = results[leaderIndex].name;
    const leaderNote  = document.getElementById('leading-note');
    if (leaderNote) leaderNote.innerHTML = `📊 <strong>${leaderName}</strong> leading in constituency 42`;

    // ── Update bar chart ──
    const chart = document.getElementById('live-chart');
    if (chart) {
      chart.innerHTML = '';
      results.forEach((c, i) => {
        const pct   = total > 0 ? Math.round((Number(c.voteCount) / total) * 100) : 0;
        const col   = document.createElement('div');
        col.className = 'bar-col';
        col.innerHTML = `
          <div class="bar-val">${pct}%</div>
          <div class="bar" style="height:${Math.max(pct, 2)}%;background:${BAR_COLOURS[i % BAR_COLOURS.length]}"></div>`;
        chart.appendChild(col);
      });

      // Bar labels
      const labelsDiv = document.getElementById('bar-labels');
      if (labelsDiv) {
        labelsDiv.innerHTML = '';
        results.forEach(c => {
          const lbl = document.createElement('div');
          lbl.className = 'bar-label';
          lbl.textContent = c.name.split(' ')[0];
          labelsDiv.appendChild(lbl);
        });
      }
    }

    // ── Update candidate breakdown ──
    const breakdown = document.getElementById('candidate-breakdown');
    if (breakdown) {
      breakdown.innerHTML = '';
      results.forEach((c, i) => {
        const pct  = total > 0 ? Math.round((Number(c.voteCount) / total) * 100) : 0;
        const item = document.createElement('div');
        item.innerHTML = `
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:4px">
            <span style="font-weight:600">${c.name}</span>
            <span style="color:var(--text3)">${pct}% · ${Number(c.voteCount).toLocaleString()} vote${Number(c.voteCount) !== 1 ? 's' : ''}</span>
          </div>
          <div style="background:var(--border);border-radius:20px;height:6px">
            <div style="background:${PROGRESS_COLOURS[i % PROGRESS_COLOURS.length]};height:100%;border-radius:20px;width:${pct}%;transition:width 0.8s ease"></div>
          </div>`;
        breakdown.appendChild(item);
      });
    }
  } catch (err) {
    console.warn('[Results] Contract read error:', err);
  }
}

// ── Fetch recent transactions from Supabase ───────────────────
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
          <span class="tx-hash">${tx.tx_hash.slice(0,10)}…</span>
        </div></td>
        <td class="tx-time">${fmtTs(tx.timestamp)}</td>
        <td><span class="status-confirmed">${tx.status}</span></td>`;
      tbody.appendChild(row);
    });

    // Update tx count stat
    const { count } = await _sbResults.from('transactions').select('*', { count: 'exact', head: true });
    const txCountEl = document.getElementById('tx-count-stat');
    if (txCountEl && count != null) txCountEl.textContent = count.toLocaleString();

  } catch (err) {
    console.warn('[Results] Supabase tx error:', err);
  }
}

// ── Full refresh (called on load + every 5s) ──────────────────
async function loadResults() {
  await Promise.all([fetchAndRenderResults(), fetchRecentTx()]);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadResults();
  // Live ticker: refresh every 5 seconds
  setInterval(loadResults, 5000);
});
