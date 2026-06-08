/**
 * app.js — BizTrack frontend logic with Authentication & Multi-user support.
 */

'use strict';

const API_BASE = '/api';
const FIRS = { low: 25000000, high: 100000000, rateMid: 0.20, rateTop: 0.30 };
let S = { sales: [], expenses: [], stock: [] };
let itemCount = 1;
let PROFILE = null;
let INVOICE_MODE = 'sale'; 

const getEl = id => document.getElementById(id);
const fmt = n => '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* --- AUTHENTICATION --- */
function checkAuth() {
  const user = localStorage.getItem('bt_user');
  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  const display = getEl('user-display');
  if (display) display.textContent = user;
  return user;
}

function signOut() {
  localStorage.clear();
  window.location.href = '/login.html';
}

/* --- API CORE --- */
async function fetchJson(url, options = {}) {
  const user = localStorage.getItem('bt_user');
  if (!options.headers) options.headers = {};
  options.headers['Content-Type'] = 'application/json';
  if (user) options.headers['X-User-Email'] = user;

  const res = await fetch(url, options);
  if (res.status === 401) return signOut();
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Network error');
  }
  return res.json();
}

async function loadProfile() {
  try {
    return await fetchJson(`${API_BASE}/profile`);
  } catch (err) { return null; }
}

async function loadData() {
  const data = await fetchJson(`${API_BASE}/data`);
  S.sales = Array.isArray(data.sales) ? data.sales : [];
  S.expenses = Array.isArray(data.expenses) ? data.expenses : [];
  S.stock = Array.isArray(data.stock) ? data.stock : [];
}

async function postRecord(endpoint, payload) {
  return fetchJson(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function toast(message) {
  const el = getEl('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

/* --- TAB NAVIGATION --- */
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(tab => {
    const active = tab.id === 'tab-' + name;
    tab.classList.toggle('on', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('on', panel.id === 'panel-' + name));
  if (name === 'report') renderReport();
  if (name === 'invoice') populateInvoiceSel();
  if (name === 'profile') populateProfileForm();
}

function populateProfileForm() {
  if (!PROFILE) return;
  getEl('prof-biz-name').value = PROFILE.businessName || '';
  getEl('prof-phone').value = PROFILE.phoneNumber || '';
  getEl('prof-loc').value = PROFILE.location || '';
  getEl('prof-bank').value = PROFILE.bankName || '';
  getEl('prof-acc-num').value = PROFILE.accountNumber || '';
  getEl('prof-acc-name').value = PROFILE.accountName || '';
}

/* --- SALES --- */
function getItems() {
  const names = Array.from(document.querySelectorAll('.iname'));
  const qtys = Array.from(document.querySelectorAll('.iqty'));
  const prices = Array.from(document.querySelectorAll('.iprice'));
  return names.map((input, index) => ({
    name: input.value.trim(),
    qty: parseFloat(qtys[index]?.value) || 0,
    price: parseFloat(prices[index]?.value) || 0,
  })).filter(item => item.name && item.price > 0);
}

function calcTotals() {
  const items = getItems();
  const itemSubtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const deliveryFee = parseFloat(getEl('sale-delivery-fee')?.value) || 0;
  const subtotal = itemSubtotal + deliveryFee;
  const discountPct = parseFloat(getEl('sale-disc')?.value) || 0;
  const discountAmt = subtotal * discountPct / 100;
  const total = subtotal - discountAmt;
  const setText = (id, text) => {
    const el = getEl(id);
    if (el) el.textContent = text;
  };
  setText('tot-delivery', fmt(deliveryFee));
  setText('tot-sub', fmt(subtotal));
  setText('tot-disc', `- ${fmt(discountAmt)}`);
  setText('tot-total', fmt(total));
  if (getEl('panel-invoice')?.classList.contains('on')) previewInvoice();
}

function addItemRow() {
  const i = itemCount++;
  const div = document.createElement('div');
  div.className = 'item-row';
  div.innerHTML = `
    <input type="text" id="item-name-${i}" class="iname" placeholder="Item name" aria-label="Item name" oninput="calcTotals()" />
    <input type="number" id="item-qty-${i}" class="iqty" placeholder="1" aria-label="Quantity" min="1" value="1" oninput="calcTotals()" />
    <input type="number" id="item-price-${i}" class="iprice" placeholder="0.00" aria-label="Unit price ₦" min="0" step="0.01" oninput="calcTotals()" />
  `;
  getEl('items-rows')?.appendChild(div);
}

function resetItemRows() {
  const container = getEl('items-rows');
  if (!container) return;
  container.innerHTML = `
    <div class="item-row">
      <input type="text" id="item-name-0" class="iname" placeholder="Item name" aria-label="Item name" oninput="calcTotals()" />
      <input type="number" id="item-qty-0" class="iqty" placeholder="1" aria-label="Quantity" min="1" value="1" oninput="calcTotals()" />
      <input type="number" id="item-price-0" class="iprice" placeholder="0.00" aria-label="Unit price ₦" min="0" step="0.01" oninput="calcTotals()" />
    </div>
  `;
  itemCount = 1;
}

function _renderSalesList() {
  const list = getEl('list-root');
  if (!list) return;
  const searchText = (getEl('input-search')?.value || '').toLowerCase();
  const statusFilter = getEl('input-filter-status')?.value || '';
  let items = S.sales.slice();
  if (searchText) {
    items = items.filter(record => record.customerName.toLowerCase().includes(searchText)
      || record.items.some(item => item.name.toLowerCase().includes(searchText)));
  }
  if (statusFilter) items = items.filter(record => record.status === statusFilter);

  if (!items.length) {
    list.innerHTML = `<li class="empty"><div class="empty-ico">🧾</div>No matching sales found.</li>`;
    return;
  }
  list.innerHTML = items.slice(0, 20).map(record => {
    const badgeClass = record.status === 'Delivered' ? 'b-done' : record.status === 'Failed' ? 'b-fail' : 'b-pend';
    const itemsSummary = esc(record.items.map(item => `${item.name} ×${item.qty}`).join(', '));
    return `
      <li class="li">
        <div class="li-body">
          <div class="li-name">${esc(record.customerName)}</div>
          <div class="li-sub">${record.date} · ${itemsSummary}</div>
        </div>
        <div class="li-right">
          <div class="li-amt">${fmt(record.total)}</div>
          <span class="badge ${badgeClass}">${esc(record.status)}</span>
        </div>
      </li>`;
  }).join('');
}

/* --- EXPENSES --- */
function _renderExpensesList() {
  const list = getEl('exp-list');
  if (!list) return;
  if (!S.expenses.length) {
    list.innerHTML = '<li class="empty"><div class="empty-ico">💸</div>No expenses recorded yet.</li>';
    return;
  }
  list.innerHTML = S.expenses.slice(0, 20).map(expense => `
    <li class="li">
      <div class="li-body">
        <div class="li-name">${esc(expense.type)}</div>
        <div class="li-sub">${expense.date}${expense.desc ? ' · ' + esc(expense.desc) : ''}</div>
      </div>
      <div class="li-right">
        <div class="li-amt red">${fmt(expense.amount)}</div>
        <span class="badge b-exp">Expense</span>
      </div>
    </li>`).join('');
}

/* --- STOCK --- */
function _renderStockList() {
  const list = getEl('inv-list');
  if (!list) return;
  if (!S.stock.length) {
    list.innerHTML = '<li class="empty"><div class="empty-ico">📦</div>No products added yet.</li>';
    return;
  }
  list.innerHTML = S.stock.slice(0, 20).map(product => `
    <li class="li">
      <div class="li-body">
        <div class="li-name">${esc(product.name)}</div>
        <div class="li-sub">${product.category ? esc(product.category) + ' · ' : ''}Qty: ${product.qty}${product.unit ? ' ' + esc(product.unit) : ''}</div>
      </div>
      <div class="li-right">
        <div style="font-size:.7rem;color:var(--muted)">Cost: ${fmt(product.costPrice)}</div>
        <div class="li-amt">${product.sellingPrice ? fmt(product.sellingPrice) : '—'}</div>
        <span class="badge b-inv">Stock</span>
      </div>
    </li>`).join('');
}

/* --- INSIGHTS --- */
function renderInsights() {
  const revenue = S.sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
  const expenses = S.expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  const profit = revenue - expenses;
  let taxRate = 0;
  if (revenue >= FIRS.high) taxRate = FIRS.rateTop;
  else if (revenue >= FIRS.low) taxRate = FIRS.rateMid;
  const tax = profit > 0 ? profit * taxRate : 0;

  getEl('ins-rev').textContent = fmt(revenue);
  getEl('ins-rev-sub').textContent = `${S.sales.length} sales`;
  getEl('ins-exp').textContent = fmt(expenses);
  getEl('ins-exp-sub').textContent = `${S.expenses.length} entries`;
  getEl('ins-profit').textContent = fmt(profit);
  getEl('ins-tax').textContent = fmt(tax);
}

function updateHeroStats() {
  const today = todayISO();
  const todaySales = S.sales.filter(sale => sale.date === today);
  const todayExpenses = S.expenses.filter(expense => expense.date === today);
  const revenue = todaySales.reduce((sum, sale) => sum + (sale.total || 0), 0);
  const expenses = todayExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  const profit = revenue - expenses;

  getEl('hm-rev').textContent = fmt(revenue);
  getEl('hm-profit').textContent = fmt(profit);
  getEl('hm-count').textContent = String(todaySales.length);
}

function renderReport() {
  const revenue = S.sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
  const expenses = S.expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  const profit = revenue - expenses;
  let taxRate = 0;
  if (revenue >= FIRS.high) taxRate = FIRS.rateTop;
  else if (revenue >= FIRS.low) taxRate = FIRS.rateMid;

  const months = {};
  S.sales.forEach(sale => {
    const month = (sale.date || '').slice(0, 7);
    if (!months[month]) months[month] = { rev: 0, exp: 0, count: 0 };
    months[month].rev += sale.total || 0;
    months[month].count += 1;
  });
  S.expenses.forEach(exp => {
    const month = (exp.date || '').slice(0, 7);
    if (!months[month]) months[month] = { rev: 0, exp: 0, count: 0 };
    months[month].exp += parseFloat(exp.amount) || 0;
  });

  const sorted = Object.entries(months).sort(([a], [b]) => a.localeCompare(b));
  let rows = '';

  if (sorted.length) {
    rows = sorted.map(([month, data], index) => {
      const monthProfit = data.rev - data.exp;
      return `
        <tr style="background:${index % 2 ? '#fff' : 'var(--cream2)'}">
          <td style="font-weight:500">${month}</td>
          <td>${data.count}</td>
          <td style="color:var(--green)">${fmt(data.rev)}</td>
          <td style="color:var(--red)">${fmt(data.exp)}</td>
          <td style="font-weight:600;color:${monthProfit >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(monthProfit)}</td>
        </tr>`;
    }).join('');
    rows += `<tr class="tot"><td>TOTAL</td><td>${S.sales.length}</td><td>${fmt(revenue)}</td><td>${fmt(expenses)}</td><td>${fmt(profit)}</td></tr>`;
  } else {
    rows = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--muted)">No data yet.</td></tr>`;
  }

  const reportCard = getEl('report-card');
  if (reportCard) {
    reportCard.innerHTML = `
      <h2 class="card-h">Monthly Breakdown</h2>
      <div style="overflow-x:auto"><table class="rtbl"><thead><tr><th>Month</th><th>Sales</th><th>Revenue</th><th>Expenses</th><th>Profit</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
}

/* --- INVOICES --- */
function populateInvoiceSel() {
  const sel = getEl('inv-sale-sel');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">Choose a sale…</option>' + S.sales.map(sale => `<option value="${sale.id}">${esc(sale.date + ' — ' + sale.customerName)}</option>`).join('');
  sel.value = current;
  if (current) previewInvoice();
}

function toggleInvMode(mode) {
  INVOICE_MODE = mode;
  getEl('tab-inv-sale').classList.toggle('on', mode === 'sale');
  getEl('tab-inv-manual').classList.toggle('on', mode === 'manual');
  getEl('inv-mode-sale').style.display = mode === 'sale' ? 'block' : 'none';
  getEl('inv-mode-manual').style.display = mode === 'manual' ? 'block' : 'none';
  previewInvoice();
}

function addManualItemRow() {
  const div = document.createElement('div');
  div.className = 'item-row';
  div.innerHTML = `
    <input type="text" class="m-iname" placeholder="Item name" oninput="previewInvoice()" />
    <input type="number" class="m-iqty" placeholder="1" value="1" oninput="previewInvoice()" />
    <input type="number" class="m-iprice" placeholder="0.00" oninput="previewInvoice()" />
  `;
  getEl('man-items-rows')?.appendChild(div);
}

function getManualItems() {
  const names = Array.from(document.querySelectorAll('.m-iname'));
  const qtys = Array.from(document.querySelectorAll('.m-iqty'));
  const prices = Array.from(document.querySelectorAll('.m-iprice'));
  return names.map((input, index) => ({
    name: input.value.trim(),
    qty: parseFloat(qtys[index]?.value) || 0,
    price: parseFloat(prices[index]?.value) || 0,
  })).filter(item => item.name);
}

async function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    if (!PROFILE) PROFILE = {};
    PROFILE.logo = base64;
    renderLogoPreview();
    try {
      await postRecord('profile', PROFILE);
      toast('✅ Logo saved!');
      previewInvoice();
    } catch (err) { toast('⚠️ Save failed.'); }
  };
  reader.readAsDataURL(file);
}

function renderLogoPreview() {
  const wrap = getEl('logo-preview-wrap');
  if (!wrap) return;
  if (PROFILE?.logo) wrap.innerHTML = `<img src="${PROFILE.logo}" style="width:100%;height:100%;object-fit:contain" />`;
  else wrap.innerHTML = `<span style="font-size:.6rem;color:var(--muted)">No Logo</span>`;
}

async function saveInvoiceAsImage() {
  const view = getEl('invoice-view');
  if (!view) return;
  toast('⌛ Generating image...');
  try {
    const canvas = await html2canvas(view, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = `Invoice-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('✅ Saved as PNG!');
  } catch (err) { toast('⚠️ Failed.'); }
}

function previewInvoice() {
  let data = null;
  if (INVOICE_MODE === 'sale') {
    const id = getEl('inv-sale-sel')?.value;
    data = S.sales.find(s => s.id === id);
  } else {
    const items = getManualItems();
    const subtotalNoFee = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    const deliveryFee = parseFloat(getEl('man-delivery')?.value) || 0;
    const subtotal = subtotalNoFee + deliveryFee;
    const discount = parseFloat(getEl('man-discount')?.value) || 0;
    const discountAmt = subtotal * discount / 100;
    data = { id: 'MAN-' + uid().slice(-5).toUpperCase(), date: todayISO(), customerName: getEl('man-cust-name')?.value || 'Valued Customer', address: getEl('man-cust-addr')?.value || '', items, deliveryFee, discount, discountAmt, subtotal, total: subtotal - discountAmt };
  }

  const view = getEl('invoice-view');
  const actions = getEl('invoice-actions');
  if (!data || (INVOICE_MODE === 'sale' && !data.id) || (INVOICE_MODE === 'manual' && data.items.length === 0)) {
    if (view) view.style.display = 'none';
    if (actions) actions.style.display = 'none';
    return;
  }

  const bizName = PROFILE?.businessName || 'My Business';
  const bizAddr = PROFILE?.location || '';
  const bizPhone = PROFILE?.phoneNumber || '';
  const bizAccName = PROFILE?.accountName || '';
  const bizAccNum = PROFILE?.accountNumber || '';
  const bizBank = PROFILE?.bankName || '';
  const logoHtml = PROFILE?.logo ? `<img src="${PROFILE.logo}" class="inv-logo-img" alt="Logo">` : `<div class="inv-logo-placeholder">Logo</div>`;
  
  const rows = data.items.map(item => `<tr><td><strong>${esc(item.name)}</strong></td><td>${item.qty}</td><td>${fmt(item.price)}</td><td>${fmt(item.qty * item.price)}</td></tr>`).join('');

  view.innerHTML = `
    <div class="inv-header">
      <div class="inv-biz-info">${logoHtml}<div class="inv-biz-name">${esc(bizName)}</div><div class="inv-biz-details">${bizAddr ? `<div>${esc(bizAddr)}</div>` : ''}${bizPhone ? `<div>Tel: ${esc(bizPhone)}</div>` : ''}</div></div>
      <div class="inv-meta"><div class="inv-title">Invoice</div><div class="inv-ref-row"><span class="inv-ref-label">Invoice No:</span> <span>#${data.id.slice(-6).toUpperCase()}</span></div><div class="inv-ref-row"><span class="inv-ref-label">Date:</span> <span>${data.date}</span></div></div>
    </div>
    <div class="inv-billing"><div class="inv-bill-box"><h4>Bill To</h4><div class="inv-bill-to-name">${esc(data.customerName)}</div><div class="inv-bill-to-addr">${esc(data.address || '')}</div></div><div class="inv-bill-box"><h4>Status</h4><div style="font-weight:700;color:var(--gold)">DUE ON RECEIPT</div></div></div>
    <table class="inv-tbl"><thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="inv-summary-grid"><div class="inv-bank-box"><div class="inv-bank-title">Bank Transfer</div><div class="inv-bank-row"><span class="inv-bank-label">Bank:</span> <span>${esc(bizBank || '—')}</span></div><div class="inv-bank-row"><span class="inv-bank-label">Account Name:</span> <span>${esc(bizAccName || '—')}</span></div><div class="inv-bank-row"><span class="inv-bank-label">Account No:</span> <span style="font-weight:700;letter-spacing:1px">${esc(bizAccNum || '—')}</span></div></div>
    <div class="inv-totals-box"><div class="inv-tot-row"><span>Subtotal</span><span>${fmt(data.items.reduce((sum, item) => sum + item.qty * item.price, 0))}</span></div>${data.deliveryFee > 0 ? `<div class="inv-tot-row"><span>Delivery</span><span>${fmt(data.deliveryFee)}</span></div>` : ''}${data.discountAmt > 0 ? `<div class="inv-tot-row" style="color:var(--red)"><span>Discount (${data.discount}%)</span><span>-${fmt(data.discountAmt)}</span></div>` : ''}<div class="inv-tot-grand"><span>Total</span><span>${fmt(data.total)}</span></div></div></div>
    <div class="inv-footer"><p>Thank you for choosing ${esc(bizName)}!</p></div>
  `;
  view.style.display = 'block';
  if (actions) actions.style.display = 'flex';
}

function renderProfileBanner(profile) {
  const banner = getEl('profile-banner');
  if (!banner || !profile) return;
  banner.style.display = 'grid';
  banner.innerHTML = `
    <div style="display:flex;gap:1.5rem;align-items:center">
       ${profile.logo ? `<img src="${profile.logo}" style="width:60px;height:60px;border-radius:var(--r-xs);object-fit:contain;background:#fff;border:1px solid var(--border)" />` : ''}
       <div style="flex:1"><h3 style="margin:0">${esc(profile.businessName)}</h3><div style="font-size:.8rem;color:var(--muted)">${esc(profile.location)}</div></div>
       <div style="text-align:right"><div style="font-size:.7rem;font-weight:700;color:var(--gold);text-transform:uppercase">Bank Account</div><div style="font-size:.9rem;font-weight:600">${esc(profile.accountNumber)}</div><div style="font-size:.7rem;color:var(--muted)">${esc(profile.bankName)}</div></div>
    </div>`;
}

function renderAll() {
  renderInsights();
  updateHeroStats();
  _renderSalesList();
  _renderExpensesList();
  _renderStockList();
}

/* --- WIRING --- */
function wireForms() {
  getEl('form-profile')?.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = {
      businessName: getEl('prof-biz-name').value.trim(),
      phoneNumber: getEl('prof-phone').value.trim(),
      location: getEl('prof-loc').value.trim(),
      bankName: getEl('prof-bank').value.trim(),
      accountNumber: getEl('prof-acc-num').value.trim(),
      accountName: getEl('prof-acc-name').value.trim(),
      logo: PROFILE?.logo || null
    };
    if (!payload.businessName) return toast('⚠️ Business Name is required');
    try {
      await postRecord('profile', payload);
      PROFILE = payload;
      renderProfileBanner(PROFILE);
      toast('✅ Business details updated!');
      switchTab('sales');
    } catch (err) { toast('⚠️ Update failed'); }
  });

  getEl('form-sale')?.addEventListener('submit', async event => {
    event.preventDefault();
    const items = getItems();
    const payload = { id: uid(), date: getEl('sale-date')?.value || todayISO(), customerName: getEl('cust-name').value.trim(), contact: getEl('cust-phone').value.trim(), address: getEl('cust-address')?.value || '', items, deliveryFee: parseFloat(getEl('sale-delivery-fee')?.value) || 0, discount: parseFloat(getEl('sale-disc')?.value) || 0, subtotal: 0, total: 0, status: getEl('sale-status')?.value || 'Pending', createdAt: new Date().toISOString() };
    payload.subtotal = payload.items.reduce((s, i) => s + i.qty * i.price, 0) + payload.deliveryFee;
    payload.discountAmt = payload.subtotal * payload.discount / 100;
    payload.total = payload.subtotal - payload.discountAmt;
    try { await postRecord('sales', payload); await loadData(); renderAll(); event.target.reset(); resetItemRows(); toast('✅ Sale saved!'); } catch (err) { toast('⚠️ Error'); }
  });

  getEl('form-expense')?.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = { id: uid(), date: getEl('exp-date')?.value || todayISO(), type: getEl('exp-type').value, desc: getEl('exp-desc').value, amount: parseFloat(getEl('exp-amount').value), createdAt: new Date().toISOString() };
    try { await postRecord('expenses', payload); await loadData(); renderAll(); event.target.reset(); toast('✅ Expense saved!'); } catch (err) { toast('⚠️ Error'); }
  });

  getEl('form-inventory')?.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = { id: uid(), name: getEl('inv-name').value.trim(), category: getEl('inv-category').value, qty: parseFloat(getEl('inv-qty').value), unit: getEl('inv-unit').value, costPrice: parseFloat(getEl('inv-cost').value), sellingPrice: parseFloat(getEl('inv-sell').value), added: todayISO() };
    try { await postRecord('stock', payload); await loadData(); renderAll(); event.target.reset(); toast('✅ Stock added!'); } catch (err) { toast('⚠️ Error'); }
  });
}

async function init() {
  if (!checkAuth()) return;
  try {
    await loadData();
    PROFILE = await loadProfile();
  } catch (err) { toast('⚠️ Load failed.'); }
  renderProfileBanner(PROFILE);
  renderLogoPreview();
  renderAll();
  calcTotals();
  wireForms();
  getEl('input-search')?.addEventListener('input', _renderSalesList);
  getEl('input-filter-status')?.addEventListener('change', _renderSalesList);
}

document.addEventListener('DOMContentLoaded', init);

/* --- GLOBAL EXPOSURE --- */
window.switchTab = switchTab;
window.addItemRow = addItemRow;
window.calcTotals = calcTotals;
window.previewInvoice = previewInvoice;
window.handleLogoUpload = handleLogoUpload;
window.toggleInvMode = toggleInvMode;
window.addManualItemRow = addManualItemRow;
window.saveInvoiceAsImage = saveInvoiceAsImage;
window.signOut = signOut;
