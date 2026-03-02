/**
 * SpendWise — Core Logic
 * Clean modular vanilla JS, localStorage persistence
 */

'use strict';

// ── State ──────────────────────────────────────────────────────
let transactions = [];
let activeType   = 'expense';

// Soft pastel chart colors (match CSS --c1…--c8)
const PALETTE = [
  '#A78BFA', '#34D399', '#FB923C',
  '#60A5FA', '#F472B6', '#FACC15',
  '#2DD4BF', '#F87171'
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
  render();
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
  renderChart(); // redraw with correct text colors
}

function loadTheme() {
  const saved = localStorage.getItem('sw_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

// ── Type toggle ───────────────────────────────────────────────
function setType(type) {
  activeType = type;
  document.getElementById('expenseBtn').classList.toggle('active', type === 'expense');
  document.getElementById('incomeBtn').classList.toggle('active', type === 'income');
  document.getElementById('expenseOptions').style.display = type === 'expense' ? '' : 'none';
  document.getElementById('incomeOptions').style.display  = type === 'income'  ? '' : 'none';
  document.getElementById('category').value = '';
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
    valid = false;
  }

  const amount = parseFloat(amtRaw);
  if (!amtRaw || isNaN(amount) || amount <= 0) {
    showError('amtError', 'Enter a valid amount');
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
    date:        new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  };

  transactions.unshift(tx);
  saveToStorage();
  render();
  resetForm();
}

// ── Delete Transaction ────────────────────────────────────────
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
  const income   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance  = income - expenses;

  document.getElementById('totalBalance').textContent  = fmt(balance);
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
  const list   = document.getElementById('transactionsList');
  const empty  = document.getElementById('emptyState');
  const badge  = document.getElementById('txCount');

  badge.textContent = transactions.length;

  if (transactions.length === 0) {
    list.innerHTML = '';
    list.appendChild(empty);
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';

  // Keep any currently-animating rows intact
  const animating = new Set([...list.querySelectorAll('.removing')].map(el => el.dataset.id));
  list.innerHTML = '';

  transactions.forEach(tx => {
    if (animating.has(tx.id)) return;
    list.appendChild(buildRow(tx));
  });
}

function buildRow(tx) {
  const isIncome = tx.type === 'income';
  const row      = document.createElement('div');
  row.className  = 'tx-row';
  row.dataset.id = tx.id;

  row.innerHTML = `
    <div class="tx-bar ${isIncome ? 'tx-bar--income' : 'tx-bar--expense'}"></div>
    <div class="tx-emoji" role="img" aria-label="${tx.category}">${EMOJI[tx.category] || '📦'}</div>
    <div class="tx-info">
      <div class="tx-desc">${esc(tx.description)}</div>
      <div class="tx-meta">${tx.category} &middot; ${tx.date}</div>
    </div>
    <div class="tx-amount ${isIncome ? 'tx-amount--income' : 'tx-amount--expense'}">
      ${isIncome ? '+' : '−'}${fmt(tx.amount)}
    </div>
    <button class="tx-delete" aria-label="Delete transaction">
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M2 2l10 10M12 2 2 12"/>
      </svg>
    </button>
  `;

  row.querySelector('.tx-delete').addEventListener('click', e => {
    e.stopPropagation();
    deleteTransaction(tx.id);
  });

  return row;
}

// ── Render Chart ──────────────────────────────────────────────
function renderChart() {
  const canvas  = document.getElementById('analyticsChart');
  const empty   = document.getElementById('chartEmpty');
  const legend  = document.getElementById('chartLegend');

  const expTxs  = transactions.filter(t => t.type === 'expense');

  if (expTxs.length === 0) {
    canvas.style.display = 'none';
    empty.style.display  = 'flex';
    legend.innerHTML     = '';
    return;
  }

  canvas.style.display = 'block';
  empty.style.display  = 'none';

  // Aggregate by category
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

// ── Draw Donut ────────────────────────────────────────────────
function drawDonut(canvas, data, colors, total, isDark) {
  const dpr  = window.devicePixelRatio || 1;
  const SIZE = 200;
  canvas.width  = SIZE * dpr;
  canvas.height = SIZE * dpr;
  canvas.style.width  = SIZE + 'px';
  canvas.style.height = SIZE + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, SIZE, SIZE);

  const cx = SIZE / 2, cy = SIZE / 2;
  const R  = 82, r = 54;
  let angle = -Math.PI / 2;

  // Draw segments
  data.forEach((val, i) => {
    const sweep = (val / total) * Math.PI * 2;
    const end   = angle + sweep;

    ctx.beginPath();
    ctx.arc(cx, cy, R, angle, end);
    ctx.arc(cx, cy, r, end, angle, true);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();

    angle = end + 0.022; // small crisp gap
  });

  // Center text
  const labelColor = isDark ? '#F5F5F5' : '#171717';
  const mutedColor = isDark ? '#6B6B6B' : '#A3A3A3';

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.font      = `700 14px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillStyle = labelColor;
  ctx.fillText(fmt(total), cx, cy - 8);

  ctx.font      = `500 10px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillStyle = mutedColor;
  ctx.fillText('total spent', cx, cy + 9);
}

// ── Storage ───────────────────────────────────────────────────
function saveToStorage() {
  localStorage.setItem('sw_transactions', JSON.stringify(transactions));
}

function loadFromStorage() {
  loadTheme();
  try {
    const raw    = localStorage.getItem('sw_transactions');
    transactions = raw ? JSON.parse(raw) : [];
  } catch {
    transactions = [];
  }
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(amount) {
  return '₹' + Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits:  2,
    maximumFractionDigits:  2
  });
}

function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function showError(id, msg)  { document.getElementById(id).textContent = msg; }
function clearErrors()       { ['descError', 'amtError', 'catError'].forEach(id => showError(id, '')); }

function resetForm() {
  ['description', 'amount'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('category').value = '';
  clearErrors();
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
