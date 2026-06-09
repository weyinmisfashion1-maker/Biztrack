/**
 * app.js — BizTrack frontend logic with Supabase Integration.
 */

'use strict';

const FIRS = { low: 25000000, high: 100000000, rateMid: 0.20, rateTop: 0.30 };
let S = { sales: [], expenses: [], stock: [] };
let itemCount = 1;
let PROFILE = null;
let INVOICE_MODE = 'sale'; 

const getEl = id => document.getElementById(id);
const fmt = n => '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => 'bt-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* --- AUTHENTICATION --- */
async function checkAuth() {
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error || !session) {
      window.location.assign('/login.html');
      return null;
    }
    const display = getEl('user-display');
    if (display) display.textContent = session.user.email;
    document.body.style.opacity = '1';
    return session.user;
  } catch (e) {
    window.location.assign('/login.html');
    return null;
  }
}

async function signOut() {
  try {
    const { error } = await sb.auth.signOut();
    if (error) console.error('Sign out error:', error);
  } catch (e) {
    console.error('Sign out exception:', e);
  }
  window.location.assign('/login.html');
}

/* --- SUPABASE DATA LAYER --- */
async function loadProfile() {
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Profile load error:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Profile fetch exception:', e);
    return null;
  }
}

async function loadData() {
  try {
    const [sales, expenses, stock] = await Promise.all([
      sb.from('sales').select('*').order('date', { ascending: false }),
      sb.from('expenses').select('*').order('date', { ascending: false }),
      sb.from('stock').select('*').order('name', { ascending: true })
    ]);

    if (sales.error) console.error('Sales error', sales.error);
    if (expenses.error) console.error('Expenses error', expenses.error);
    if (stock.error) console.error('Stock error', stock.error);

    S.sales = sales.data || [];
    S.expenses = expenses.data || [];
    S.stock = stock.data || [];
  } catch (e) {
    console.error('Data load exception:', e);
  }
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
  getEl('prof-biz-name').value = PROFILE.business_name || '';
  getEl('prof-phone').value = PROFILE.phone_number || '';
  getEl('prof-loc').value = PROFILE.location || '';
  getEl('prof-bank').value = PROFILE.bank_name || '';
  getEl('prof-acc-num').value = PROFILE.account_number || '';
  getEl('prof-acc-name').value = PROFILE.account_name || '';
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
    items = items.filter(record => record.customer_name.toLowerCase().includes(searchText)
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
          <div class="li-name">${esc(record.customer_name)}</div>
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
        <div class="li-sub">${expense.date}${expense.description ? ' · ' + esc(expense.description) : ''}</div>
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
        <div style="font-size:.7rem;color:var(--muted)">Cost: ${fmt(product.cost_price)}</div>
        <div class="li-amt">${product.selling_price ? fmt(product.selling_price) : '—'}</div>
        <span class="badge b-inv">Stock</span>
      </div>
    </li>`).join('');
}

/* --- INSIGHTS --- */
function renderInsights() {
  const revenue = S.sales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const expenses = S.expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const profit = revenue - expenses;
  let taxRate = 0;
  if (revenue >= FIRS.high) taxRate = FIRS.rateTop;
  else if (revenue >= FIRS.low) taxRate = FIRS.rateMid;
  const tax = profit > 0 ? profit * taxRate : 0;

  getEl('ins-rev').textContent = fmt(revenue);
  getEl('ins-rev-sub').textContent = `${S.sales.length} sale${S.sales.length === 1 ? '' : 's'}`;
  getEl('ins-exp').textContent = fmt(expenses);
  getEl('ins-exp-sub').textContent = `${S.expenses.length} entr${S.expenses.length === 1 ? 'y' : 'ies'}`;
  getEl('ins-profit').textContent = fmt(profit);
  getEl('ins-profit-sub').textContent = profit >= 0 ? 'Positive ✓' : 'Loss ✗';
  getEl('ins-tax').textContent = fmt(tax);
  getEl('ins-tax-sub').textContent = taxRate === 0 ? 'Exempt < ₦25M' : `${taxRate * 100}% FIRS`;
}

function updateHeroStats() {
  const revenue = S.sales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const expenses = S.expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const profit = revenue - expenses;

  getEl('hm-rev').textContent = fmt(revenue);
  getEl('hm-profit').textContent = fmt(profit);
  getEl('hm-count').textContent = String(S.sales.length);
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
  sel.innerHTML = '<option value="">Choose a sale…</option>' + S.sales.map(sale => `<option value="${sale.id}">${esc(sale.date + ' — ' + sale.customer_name)}</option>`).join('');
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
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!PROFILE) PROFILE = { id: user.id };
      PROFILE.logo = base64;
      renderLogoPreview();
      const { error } = await sb.from('profiles').upsert(PROFILE);
      if (error) throw error;
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
    data = { id: 'MAN-' + uid().slice(-5).toUpperCase(), date: todayISO(), customer_name: getEl('man-cust-name')?.value || 'Valued Customer', address: getEl('man-cust-addr')?.value || '', items, deliveryFee, discount, discountAmt, subtotal, total: subtotal - discountAmt };
  }

  const view = getEl('invoice-view');
  const actions = getEl('invoice-actions');
  if (!data || (INVOICE_MODE === 'sale' && !data.id) || (INVOICE_MODE === 'manual' && data.items.length === 0)) {
    if (view) view.style.display = 'none';
    if (actions) actions.style.display = 'none';
    return;
  }

  const bizName = PROFILE?.business_name || 'My Business';
  const bizAddr = PROFILE?.location || '';
  const bizPhone = PROFILE?.phone_number || '';
  const bizAccName = PROFILE?.account_name || '';
  const bizAccNum = PROFILE?.account_number || '';
  const bizBank = PROFILE?.bank_name || '';
  const logoHtml = PROFILE?.logo ? `<img src="${PROFILE.logo}" class="inv-logo-img" alt="Logo">` : `<div class="inv-logo-placeholder">Logo</div>`;
  
  const rows = data.items.map(item => `<tr><td><strong>${esc(item.name)}</strong></td><td>${item.qty}</td><td>${fmt(item.price)}</td><td>${fmt(item.qty * item.price)}</td></tr>`).join('');

  view.innerHTML = `
    <div class="inv-header">
      <div class="inv-biz-info">${logoHtml}<div class="inv-biz-name">${esc(bizName)}</div><div class="inv-biz-details">${bizAddr ? `<div>${esc(bizAddr)}</div>` : ''}${bizPhone ? `<div>Tel: ${esc(bizPhone)}</div>` : ''}</div></div>
      <div class="inv-meta"><div class="inv-title">Invoice</div><div class="inv-ref-row"><span class="inv-ref-label">Invoice No:</span> <span>#${data.id.toString().slice(-6).toUpperCase()}</span></div><div class="inv-ref-row"><span class="inv-ref-label">Date:</span> <span>${data.date}</span></div></div>
    </div>
    <div class="inv-billing"><div class="inv-bill-box"><h4>Bill To</h4><div class="inv-bill-to-name">${esc(data.customer_name)}</div><div class="inv-bill-to-addr">${esc(data.address || '')}</div></div><div class="inv-bill-box"><h4>Status</h4><div style="font-weight:700;color:var(--gold)">DUE ON RECEIPT</div></div></div>
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
       <div style="flex:1"><h3 style="margin:0">${esc(profile.business_name)}</h3><div style="font-size:.8rem;color:var(--muted)">${esc(profile.location)}</div></div>
       <div style="text-align:right"><div style="font-size:.7rem;font-weight:700;color:var(--gold);text-transform:uppercase">Bank Account</div><div style="font-size:.9rem;font-weight:600">${esc(profile.account_number)}</div><div style="font-size:.7rem;color:var(--muted)">${esc(profile.bank_name)}</div></div>
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
    try {
      const { data: { user } } = await sb.auth.getUser();
      const payload = {
        id: user.id,
        business_name: getEl('prof-biz-name').value.trim(),
        phone_number: getEl('prof-phone').value.trim(),
        location: getEl('prof-loc').value.trim(),
        bank_name: getEl('prof-bank').value.trim(),
        account_number: getEl('prof-acc-num').value.trim(),
        account_name: getEl('prof-acc-name').value.trim(),
        logo: PROFILE?.logo || null
      };
      if (!payload.business_name) return toast('⚠️ Business Name is required');
      const { error } = await sb.from('profiles').upsert(payload);
      if (error) throw error;
      PROFILE = payload;
      renderProfileBanner(PROFILE);
      toast('✅ Business details updated!');
      switchTab('sales');
    } catch (err) { toast('⚠️ Update failed'); }
  });

  getEl('form-sale')?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const { data: { user } } = await sb.auth.getUser();
      const items = getItems();
      const payload = { 
        user_id: user.id,
        date: getEl('sale-date')?.value || todayISO(), 
        customer_name: getEl('cust-name').value.trim(), 
        contact: getEl('cust-phone').value.trim(), 
        address: getEl('cust-address')?.value || '', 
        items, 
        delivery_fee: parseFloat(getEl('sale-delivery-fee')?.value) || 0, 
        discount: parseFloat(getEl('sale-disc')?.value) || 0, 
        total: 0, 
        status: getEl('sale-status')?.value || 'Pending'
      };
      const subtotal = payload.items.reduce((s, i) => s + i.qty * i.price, 0) + payload.delivery_fee;
      const discountAmt = subtotal * payload.discount / 100;
      payload.total = subtotal - discountAmt;
      
      const { error } = await sb.from('sales').insert([payload]);
      if (error) throw error;
      await loadData(); renderAll(); event.target.reset(); resetItemRows(); toast('✅ Sale saved!'); 
    } catch (err) { toast('⚠️ Error saving sale'); }
  });

  getEl('form-expense')?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const { data: { user } } = await sb.auth.getUser();
      const payload = { 
        user_id: user.id,
        date: getEl('exp-date')?.value || todayISO(), 
        type: getEl('exp-type').value, 
        description: getEl('exp-desc').value, 
        amount: parseFloat(getEl('exp-amount').value) 
      };
      const { error } = await sb.from('expenses').insert([payload]);
      if (error) throw error;
      await loadData(); renderAll(); event.target.reset(); toast('✅ Expense saved!'); 
    } catch (err) { toast('⚠️ Error saving expense'); }
  });

  getEl('form-inventory')?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const { data: { user } } = await sb.auth.getUser();
      const payload = { 
        user_id: user.id,
        name: getEl('inv-name').value.trim(), 
        category: getEl('inv-category').value, 
        qty: parseFloat(getEl('inv-qty').value), 
        unit: getEl('inv-unit').value, 
        cost_price: parseFloat(getEl('inv-cost').value), 
        selling_price: parseFloat(getEl('inv-sell').value), 
        added: todayISO() 
      };
      const { error } = await sb.from('stock').insert([payload]);
      if (error) throw error;
      await loadData(); renderAll(); event.target.reset(); toast('✅ Stock added!'); 
    } catch (err) { toast('⚠️ Error saving inventory'); }
  });
}

async function init() {
  const user = await checkAuth();
  if (!user) return;
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

  document.querySelectorAll('.iname, .iqty, .iprice').forEach(el => el.addEventListener('input', calcTotals));
  getEl('sale-disc')?.addEventListener('input', calcTotals);
  getEl('sale-delivery-fee')?.addEventListener('input', calcTotals);
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
