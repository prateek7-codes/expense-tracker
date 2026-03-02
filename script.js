/**
 * SpendWise — Expense Tracker
 * Modular vanilla JS with localStorage persistence
 */

// ===== STATE =====
let transactions = [];
let activeType = 'expense';
let chart = null;

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

const CATEGORY_EMOJI = {
  Food: '🍔', Transport: '🚗', Shopping: '🛍️', Entertainment: '🎬',
  Health: '💊', Utilities: '⚡', Education: '📚',
  Salary: '💼', Freelance: '💻', Investment: '📈', Gift: '🎁', Other: '📦'
};

// ===== INIT =====
function init() {
  loadFromStorage();
  bindEvents();
  render();
}

// ===== BIND EVENTS =====
function bindEvents() {
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('addTransactionBtn').addEventListener('click', addTransaction);
  document.getElementById('expenseBtn').addEventListener('click', () => setType('expense'));
  document.getElementById('incomeBtn').addEventListener('click', () => setType('income'));

  // Allow Enter key to submit
  ['description', 'amount'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') addTransaction();
    });
  });
}

// ===== THEME =====
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('sw_theme', newTheme);
}

function loadTheme() {
  const saved = localStorage.getItem('sw_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

// ===== TYPE TOGGLE =====
function setType(type) {
  activeType = type;
  document.getElementById('expenseBtn').classList.toggle('active', type === 'expense');
  document.getElementById('incomeBtn').classList.toggle('active', type === 'income');

  // Show/hide relevant category options
  document.getElementById('expenseOptions').style.display = type === 'expense' ? '' : 'none';
  document.getElementById('incomeOptions').style.display = type === 'income' ? '' : 'none';
  document.getElementById('category').value = '';
}

// ===== ADD TRANSACTION =====
function addTransaction() {
  const desc = document.getElementById('description').value.trim();
  const amtRaw = document.getElementById('amount').value;
  const category = document.getElementById('category').value;

  // Validate
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
    showError('catError', 'Please select a category');
    valid = false;
  }

  if (!valid) return;

  // Create transaction object
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

// ===== DELETE TRANSACTION =====
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

// ===== UPDATE TOTALS =====
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

// ===== RENDER =====
function render() {
  updateTotals();
  renderTransactions();
  renderChart();
}

// ===== RENDER TRANSACTIONS =====
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

  // Preserve any animating items (removing class)
  const removingIds = new Set(
    [...list.querySelectorAll('.removing')].map(el => el.dataset.id)
  );

  list.innerHTML = '';

  transactions.forEach(tx => {
    if (removingIds.has(tx.id)) return; // let animation finish
    const item = createTransactionEl(tx);
    list.appendChild(item);
  });
}

function createTransactionEl(tx) {
  const div = document.createElement('div');
  div.className = 'tx-item';
  div.dataset.id = tx.id;

  const emoji = CATEGORY_EMOJI[tx.category] || '📦';
  const isIncome = tx.type === 'income';

  div.innerHTML = `
    <div class="tx-icon ${isIncome ? 'income-bg' : 'expense-bg'}">${emoji}</div>
    <div class="tx-info">
      <div class="tx-desc">${escapeHtml(tx.description)}</div>
      <div class="tx-meta">${tx.category} · ${tx.date}</div>
    </div>
    <div class="tx-amount ${isIncome ? 'income-text' : 'expense-text'}">
      ${isIncome ? '+' : '-'}${formatCurrency(tx.amount)}
    </div>
    <button class="tx-delete" aria-label="Delete transaction">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/>
        <path d="M9 6V4h6v2"/>
      </svg>
    </button>
  `;

  div.querySelector('.tx-delete').addEventListener('click', () => deleteTransaction(tx.id));
  return div;
}

// ===== RENDER CHART =====
function renderChart() {
  const canvas = document.getElementById('analyticsChart');
  const chartEmpty = document.getElementById('chartEmpty');
  const legend = document.getElementById('chartLegend');

  const expenses = transactions.filter(t => t.type === 'expense');

  if (expenses.length === 0) {
    canvas.style.display = 'none';
    chartEmpty.style.display = 'flex';
    legend.innerHTML = '';
    if (chart) { chart.destroy(); chart = null; }
    return;
  }

  canvas.style.display = 'block';
  chartEmpty.style.display = 'none';

  // Aggregate by category
  const categoryMap = {};
  expenses.forEach(t => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(categoryMap);
  const data = Object.values(categoryMap);
  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  // Destroy existing chart
  if (chart) chart.destroy();

  const ctx = canvas.getContext('2d');

  // Draw custom donut chart
  chart = drawDonutChart(ctx, canvas, labels, data, colors);

  // Render legend
  const total = data.reduce((a, b) => a + b, 0);
  legend.innerHTML = labels.map((label, i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      ${label} <strong>${Math.round((data[i] / total) * 100)}%</strong>
    </div>
  `).join('');
}

// ===== CUSTOM DONUT CHART =====
function drawDonutChart(ctx, canvas, labels, data, colors) {
  const dpr = window.devicePixelRatio || 1;
  const size = 200;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(dpr, dpr);

  const cx = size / 2, cy = size / 2;
  const outerR = 85, innerR = 52;
  const total = data.reduce((a, b) => a + b, 0);
  let startAngle = -Math.PI / 2;

  ctx.clearRect(0, 0, size, size);

  data.forEach((val, i) => {
    const slice = (val / total) * Math.PI * 2;
    const endAngle = startAngle + slice;

    ctx.beginPath();
    ctx.moveTo(cx + outerR * Math.cos(startAngle), cy + outerR * Math.sin(startAngle));
    ctx.arc(cx, cy, outerR, startAngle, endAngle);
    ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();

    // Gap
    startAngle = endAngle + 0.03;
  });

  // Center text
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  ctx.fillStyle = isDark ? '#f1f5f9' : '#111827';
  ctx.font = `600 14px 'DM Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatCurrency(total), cx, cy - 6);
  ctx.fillStyle = isDark ? '#94a3b8' : '#6b7280';
  ctx.font = `500 10px 'DM Sans', sans-serif`;
  ctx.fillText('Total Spent', cx, cy + 12);

  return { destroy: () => {} }; // Minimal interface
}

// ===== STORAGE =====
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

// ===== HELPERS =====
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

// ===== KICK OFF =====
document.addEventListener('DOMContentLoaded', init);
