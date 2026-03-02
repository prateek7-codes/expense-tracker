/**
 * SpendWise — Expense Tracker
 * Modular vanilla JS with localStorage persistence
 */

// ── State ──
let transactions = [];
let activeType = 'expense';
let chart = null;

const CHART_COLORS = [
  '#525252', '#a1a1aa', '#71717a', '#d4d4d8',
  '#3f3f46', '#e4e4e7', '#18181b', '#a8a8b3'
];

const CATEGORY_EMOJI = {
  Food: '🍔', Transport: '🚗', Shopping: '🛍️', Entertainment: '🎬',
  Health: '💊', Utilities: '⚡', Education: '📚',
  Salary: '💼', Freelance: '💻', Investment: '📈', Gift: '🎁', Other: '📦'
};

// ── Init ──
function init() {
  loadFromStorage();
  bindEvents();
  render();
}

// ── Events ──
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

// ── Theme ──
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('sw_theme', newTheme);
  // Redraw chart with new theme colors
  renderChart();
}

function loadTheme() {
  const saved = localStorage.getItem('sw_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

// ── Type Toggle ──
function setType(type) {
  activeType = type;
  document.getElementById('expenseBtn').classList.toggle('active', type === 'expense');
  document.getElementById('incomeBtn').classList.toggle('active', type === 'income');
  document.getElementById('expenseOptions').style.display = type === 'expense' ? '' : 'none';
  document.getElementById('incomeOptions').style.display = type === 'income' ? '' : 'none';
  document.getElementById('category').value = '';
}

// ── Add Transaction ──
function addTransaction() {
  const desc = document.getElementById('description').value.trim();
  const amtRaw = document.getElementById('amount').value;
  const category = document.getElementById('category').value;

  let valid = true;
  clearErrors();

  if (!desc) {
    showError('descError', 'Description is required');
    valid = false;
  }

  const amount = parseFloat(amtRaw);
  if (!amtRaw || isNaN(amount) || amount <= 0) {
    showError('amtError', 'Enter a valid positive amount');
    valid = false;
  }

  if (!category) {
    showError('catError', 'Select a category');
    valid = false;
  }

  if (!valid) return;

  const transaction = {
    id: Date.now().toString(),
    description: desc,
    amount: parseFloat(amount.toFixed(2)),
    category,
    type: activeType,
    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  };

  transactions.unshift(transaction);
  saveToStorage();
  render();
  resetForm();
}

// ── Delete Transaction ──
function deleteTransaction(id) {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) {
    el.classList.add('removing');
    el.addEventListener('animationend', () => {
      transactions = transactions.filter(t => t.id !== id);
      saveToStorage();
      render();
    }, { once: true });
  }
}

// ── Update Totals ──
function updateTotals() {
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = income - expenses;

  document.getElementById('totalBalance').textContent = formatCurrency(balance);
  document.getElementById('totalIncome').textContent = formatCurrency(income);
  document.getElementById('totalExpenses').textContent = formatCurrency(expenses);
}

// ── Render ──
function render() {
  updateTotals();
  renderTransactions();
  renderChart();
}

// ── Render Transactions ──
function renderTransactions() {
  const list = document.getElementById('transactionsList');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('txCount');

  count.textContent = `${transactions.length} ${transactions.length === 1 ? 'entry' : 'entries'}`;

  if (transactions.length === 0) {
    list.innerHTML = '';
    list.appendChild(empty);
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';

  const removingIds = new Set(
    [...list.querySelectorAll('.removing')].map(el => el.dataset.id)
  );

  list.innerHTML = '';

  transactions.forEach(tx => {
    if (removingIds.has(tx.id)) return;
    list.appendChild(createTransactionEl(tx));
  });
}

function createTransactionEl(tx) {
  const div = document.createElement('div');
  const isIncome = tx.type === 'income';

  div.className = `tx-item ${isIncome ? 'income-bar' : 'expense-bar'}`;
  div.dataset.id = tx.id;

  const emoji = CATEGORY_EMOJI[tx.category] || '📦';

  div.innerHTML = `
    <div class="tx-emoji">${emoji}</div>
    <div class="tx-info">
      <div class="tx-desc">${escapeHtml(tx.description)}</div>
      <div class="tx-meta">${tx.category} · ${tx.date}</div>
    </div>
    <div class="tx-amount ${isIncome ? 'income-text' : 'expense-text'}">
      ${isIncome ? '+' : '−'}${formatCurrency(tx.amount)}
    </div>
    <button class="tx-delete" aria-label="Delete">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  div.querySelector('.tx-delete').addEventListener('click', () => deleteTransaction(tx.id));
  return div;
}

// ── Render Chart ──
function renderChart() {
  const canvas = document.getElementById('analyticsChart');
  const chartEmpty = document.getElementById('chartEmpty');
  const legend = document.getElementById('chartLegend');

  const expenses = transactions.filter(t => t.type === 'expense');

  if (expenses.length === 0) {
    canvas.style.display = 'none';
    chartEmpty.style.display = 'flex';
    legend.innerHTML = '';
    chart = null;
    return;
  }

  canvas.style.display = 'block';
  chartEmpty.style.display = 'none';

  const categoryMap = {};
  expenses.forEach(t => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(categoryMap);
  const data = Object.values(categoryMap);

  // Use colors that work in both themes
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const palette = isDark
    ? ['#f0efe8', '#8a8a80', '#c8c8c0', '#525250', '#d0d0c8', '#404040', '#b0b0a8', '#686860']
    : ['#141414', '#525252', '#8a8a8a', '#c4c4c4', '#3a3a3a', '#717171', '#a8a8a8', '#e0e0e0'];

  const colors = labels.map((_, i) => palette[i % palette.length]);

  const ctx = canvas.getContext('2d');
  chart = drawDonutChart(ctx, canvas, labels, data, colors, isDark);

  const total = data.reduce((a, b) => a + b, 0);
  legend.innerHTML = labels.map((label, i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      ${label} · ${Math.round((data[i] / total) * 100)}%
    </div>
  `).join('');
}

// ── Custom Donut Chart ──
function drawDonutChart(ctx, canvas, labels, data, colors, isDark) {
  const dpr = window.devicePixelRatio || 1;
  const size = 190;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(dpr, dpr);

  const cx = size / 2, cy = size / 2;
  const outerR = 80, innerR = 54;
  const total = data.reduce((a, b) => a + b, 0);
  let startAngle = -Math.PI / 2;

  ctx.clearRect(0, 0, size, size);

  data.forEach((val, i) => {
    const slice = (val / total) * Math.PI * 2;
    const end = startAngle + slice;

    ctx.beginPath();
    ctx.moveTo(cx + outerR * Math.cos(startAngle), cy + outerR * Math.sin(startAngle));
    ctx.arc(cx, cy, outerR, startAngle, end);
    ctx.arc(cx, cy, innerR, end, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();

    startAngle = end + 0.025; // small gap
  });

  // Center label
  const textColor = isDark ? '#f0efe8' : '#141414';
  const mutedColor = isDark ? '#8a8a80' : '#ababab';

  ctx.fillStyle = textColor;
  ctx.font = `500 13px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatCurrency(total), cx, cy - 7);

  ctx.fillStyle = mutedColor;
  ctx.font = `400 10px 'Sora', sans-serif`;
  ctx.fillText('total spent', cx, cy + 10);

  return { destroy: () => {} };
}

// ── Storage ──
function saveToStorage() {
  localStorage.setItem('sw_transactions', JSON.stringify(transactions));
}

function loadFromStorage() {
  loadTheme();
  try {
    const saved = localStorage.getItem('sw_transactions');
    transactions = saved ? JSON.parse(saved) : [];
  } catch {
    transactions = [];
  }
}

// ── Helpers ──
function formatCurrency(amount) {
  return '₹' + Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function showError(id, msg) {
  document.getElementById(id).textContent = msg;
}

function clearErrors() {
  ['descError', 'amtError', 'catError'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
}

function resetForm() {
  document.getElementById('description').value = '';
  document.getElementById('amount').value = '';
  document.getElementById('category').value = '';
  clearErrors();
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', init);
