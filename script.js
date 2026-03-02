/**
 * SpendWise — Core Logic
 * Modular, clean, localStorage-persisted
 */

'use strict';

// ── State ──────────────────────────────────────────────────────
let transactions = [];
let activeType   = 'expense';

// Vibrant but not harsh — indigo-adjacent palette
const PALETTE = [
  '#818CF8', '#34D399', '#FB923C',
  '#60A5FA', '#F472B6', '#FBBF24',
  '#2DD4BF', '#A78BFA'
];

const EMOJI = {
  Food: '🍔', Transport: '🚗', Shopping: '🛍️', Entertainment: '🎬',
  Health: '💊', Utilities: '⚡', Education: '📚',
  Salary: '💼', Freelance: '💻', Investment: '📈', Gift: '🎁', Other: '📦'
};

// ── Init ───────────────────────────────────────────────────────
function init() {
  loadFromStorage();
  bindEvents();
  initSegIndicator();
  render();
}

// ── Segmented indicator ───────────────────────────────────────
function initSegIndicator() {
  // Position indicator under active button on load
  updateSegIndicator(activeType);
}

function updateSegIndicator(type) {
  const ind = document.getElementById('segIndicator');
  ind.classList.toggle('at-income', type === 'income');
}

// ── Events ────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('addTransactionBtn').addEventListener('click', addTransaction);
  document.getElementById('expenseBtn').addEventListener('click', () => setType('expense'));
  document.getElementById('incomeBtn').addEventListener('click', () => setType('income'));

  ['description', 'amount'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') addTransaction();
    });
  });
}

// ── Theme ─────────────────────────────────────────────────────
function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('sw_theme', next);
  renderChart();
}

function loadTheme() {
  const saved = localStorage.getItem('sw_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

// ── Type ──────────────────────────────────────────────────────
function setType(type) {
  activeType = type;
  document.getElementById('expenseBtn').classList.toggle('active', type === 'expense');
  document.getElementById('incomeBtn').classList.toggle('active', type === 'income');
  document.getElementById('expenseOptions').style.display = type === 'expense' ? '' : 'none';
  document.getElementById('incomeOptions').style.display  = type === 'income'  ? '' : 'none';
  document.getElementById('category').value = '';
  updateSegIndicator(type);
}

// ── Add Transaction ───────────────────────────────────────────
function addTransaction() {
  const desc     = document.getElementById('description').value.trim();
  const amtRaw   = document.getElementById('amount').value;
  const category = document.getElementById('category').value;

  clearErrors();
  let valid = true;

  if (!desc) {
    showError('descError', 'Please enter a description');
    shakeInput('description');
    valid = false;
  }

  const amount = parseFloat(amtRaw);
  if (!amtRaw || isNaN(amount) || amount <= 0) {
    showError('amtError', 'Enter a valid amount');
    shakeInput('amount');
    valid = false;
  }

  if (!category) {
    showError('catError', 'Select a category');
    valid = false;
  }

  if (!valid) return;

  const tx = {
    id:          Date.now().toString(),
    description: desc,
    amount:      parseFloat(amount.toFixed(2)),
    category,
    type:        activeType,
    date:        new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  };

  transactions.unshift(tx);
  saveToStorage();
  render();
  resetForm();
}

// ── Delete ────────────────────────────────────────────────────
function deleteTransaction(id) {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (!el) return;

  el.classList.add('removing');
  el.addEventListener('animationend', () => {
    transactions = transactions.filter(t => t.id !== id);
    saveToStorage();
    render();
  }, { once: true });
}

// ── Update Totals ─────────────────────────────────────────────
function updateTotals() {
  const income   = transactions.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const balance  = income - expenses;

  // Animated balance pulse
  const balEl = document.getElementById('totalBalance');
  balEl.classList.remove('pulse');
  // Force reflow then re-add
  void balEl.offsetWidth;
  balEl.classList.add('pulse');

  balEl.textContent = fmt(balance);
  document.getElementById('totalIncome').textContent   = fmt(income);
  document.getElementById('totalExpenses').textContent = fmt(expenses);
}

// ── Render ────────────────────────────────────────────────────
function render() {
  updateTotals();
  renderTransactions();
  renderChart();
}

// ── Render Transactions ───────────────────────────────────────
function renderTransactions() {
  const list  = document.getElementById('transactionsList');
  const badge = document.getElementById('txCount');

  badge.textContent = transactions.length;

  // Always rebuild cleanly
  list.innerHTML = '';

  if (transactions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-art"></div>
        <p class="empty-title">No transactions yet</p>
        <p class="empty-body">Add your first income or expense above</p>
      </div>
    `;
    return;
  }

  transactions.forEach((tx, i) => {
    const row = buildRow(tx);
    row.style.animationDelay = `${i * 0.03}s`;
    list.appendChild(row);
  });
}

// ── Render Chart ──────────────────────────────────────────────
function renderChart() {
  const canvas = document.getElementById('analyticsChart');
  const empty  = document.getElementById('chartEmpty');
  const legend = document.getElementById('chartLegend');

  if (!canvas || !legend) return;

  const expTxs = transactions.filter(t => t.type === 'expense');

  if (expTxs.length === 0) {
    canvas.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    legend.innerHTML = '';
    return;
  }

  canvas.style.display = 'block';
  if (empty) empty.style.display = 'none';

  const map = {};
  expTxs.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });

  const labels = Object.keys(map);
  const data   = labels.map(l => map[l]);
  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);
  const total  = data.reduce((a, b) => a + b, 0);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  drawDonut(canvas, data, colors, total, isDark);

  legend.innerHTML = labels.map((label, i) => `
    <div class="legend-pill">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      ${label} ${Math.round((data[i] / total) * 100)}%
    </div>
  `).join('');
}
// ── Draw Donut (animated) ─────────────────────────────────────
function drawDonut(canvas, data, colors, total, isDark) {
  const dpr  = window.devicePixelRatio || 1;
  const SIZE = 200;
  canvas.width  = SIZE * dpr;
  canvas.height = SIZE * dpr;
  canvas.style.width  = SIZE + 'px';
  canvas.style.height = SIZE + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(dpr, dpr);

  const cx = SIZE / 2, cy = SIZE / 2;
  const R = 84, r = 56;

  // Animate segments drawing in
  const duration = 600; // ms
  const start = performance.now();

  function frame(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out quint
    const eased    = 1 - Math.pow(1 - progress, 4);

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Draw background track
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.arc(cx, cy, r, Math.PI * 2, 0, true);
    ctx.closePath();
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    ctx.fill();

    // Draw animated segments
    let angle = -Math.PI / 2;
    data.forEach((val, i) => {
      const maxSweep = (val / total) * Math.PI * 2;
      const sweep    = maxSweep * eased;
      const end      = angle + sweep;

      if (sweep < 0.001) { angle += maxSweep + 0.022; return; }

      ctx.beginPath();
      ctx.arc(cx, cy, R, angle, end);
      ctx.arc(cx, cy, r, end, angle, true);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();

      angle = end + 0.022;
    });

    // Center text (fade in at the end)
    const textOpacity = Math.max(0, (eased - 0.7) / 0.3);
    const t1 = isDark ? `rgba(240,241,255,${textOpacity})` : `rgba(15,16,32,${textOpacity})`;
    const t3 = isDark ? `rgba(76,80,104,${textOpacity})`  : `rgba(168,171,190,${textOpacity})`;

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = `600 14px 'JetBrains Mono', monospace`;
    ctx.fillStyle    = t1;
    ctx.fillText(fmt(total), cx, cy - 8);

    ctx.font      = `500 10px 'Bricolage Grotesque', sans-serif`;
    ctx.fillStyle = t3;
    ctx.fillText('total spent', cx, cy + 9);

    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// ── Storage ───────────────────────────────────────────────────
function saveToStorage() {
  localStorage.setItem('sw_transactions', JSON.stringify(transactions));
}

function loadFromStorage() {
  loadTheme();
  try {
    const raw = localStorage.getItem('sw_transactions');
    transactions = raw ? JSON.parse(raw) : [];
  } catch { transactions = []; }
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(amount) {
  return '₹' + Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function shakeInput(id) {
  const el = document.getElementById(id);
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'shake 0.35s ease';
  // inject shake keyframe if needed
  if (!document.getElementById('shakeStyle')) {
    const s = document.createElement('style');
    s.id = 'shakeStyle';
    s.textContent = `
      @keyframes shake {
        0%,100%{ transform:translateX(0); }
        20%    { transform:translateX(-6px); }
        40%    { transform:translateX(6px); }
        60%    { transform:translateX(-4px); }
        80%    { transform:translateX(4px); }
      }`;
    document.head.appendChild(s);
  }
  el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
}

function showError(id, msg) { document.getElementById(id).textContent = msg; }
function clearErrors() {
  ['descError','amtError','catError'].forEach(id => showError(id,''));
}

function resetForm() {
  ['description','amount'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('category').value = '';
  clearErrors();
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
