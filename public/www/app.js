/**
 * app.js — BizTrack frontend logic with Supabase Integration.
 */

'use strict';

const FIRS = { low: 25000000, high: 100000000, rateMid: 0.20, rateTop: 0.30 };
let S = { sales: [], expenses: [], stock: [], deletedSales: [] };
window.S = S;
let itemCount = 1;
let PROFILE = null;
let INVOICE_MODE = 'sale';
let SALE_EDIT_ID = null;
let EXPENSE_EDIT_ID = null;
let STOCK_EDIT_ID = null;
let IS_LOCKED = true;
let CURRENT_SALES_FILTER = 'All';
let CURRENT_SALES_SEARCH = '';
let CURRENT_SALES_PAGE = 1;
let TOTAL_SALES_PAGES = 1;
const SALES_PAGE_SIZE = 5;

// Inventory Control setting (synced to profile, default OFF)
let INVENTORY_CONTROL = {
  require_stock_before_sale: false
};


// App Preferences & Settings State
let SETTINGS = {
  currency: '₦',
  tax_rate: 0,
  invoice_terms: 'Due on Receipt',
  invoice_notes: '',
  theme: 'light'
};

// Default staff permissions (all allowed). Gets overridden from PROFILE.
let STAFF_PERMS = {
  tab_sales: true,
  tab_expense: true,
  tab_inventory: true,
  tab_invoice: true,
  tab_report: false,
  see_amounts: true,
  see_customer_contact: true,
  can_edit_sale: false,
  can_delete_sale: false,
  can_add_expense: true,
  can_add_inventory: true,
  see_dashboard_stats: false,
  can_print_report: false,
  can_print_invoice: false
};

const getEl = id => document.getElementById(id);
const fmt = n => (SETTINGS?.currency || '₦') + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => 'bt-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const getMonthName = (yyyymm) => {
  const mNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [y, m] = String(yyyymm || '').split('-');
  return (y && m) ? `${mNames[parseInt(m) - 1]} ${y}` : yyyymm;
};

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
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      localStorage.removeItem('biztrack_settings_' + user.id);
    }
    localStorage.removeItem('biztrack_expenses');
    localStorage.setItem('biztrack_locked', 'true');
    
    // Clear global state
    S = { sales: [], expenses: [], stock: [], deletedSales: [] };
    PROFILE = null;
    IS_LOCKED = true;
    INVENTORY_CONTROL = { require_stock_before_sale: false };

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
    // Load inventory control settings from localStorage
    const localInv = localStorage.getItem('biztrack_inventory_control_' + user.id);
    if (localInv) {
      try {
        INVENTORY_CONTROL = JSON.parse(localInv);
      } catch (err) {
        INVENTORY_CONTROL = { require_stock_before_sale: false };
      }
    } else {
      INVENTORY_CONTROL = { require_stock_before_sale: false };
    }
    return data;
  } catch (e) {
    console.error('Profile fetch exception:', e);
    return null;
  }
}

async function loadData() {
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    // Fetch using OR to include legacy rows where user_id is NULL
    const [sales, expenses, stock] = await Promise.all([
      sb.from('sales').select('*').or(`user_id.eq.${user.id},user_id.is.null`).order('date', { ascending: false }),
      sb.from('expenses').select('*').or(`user_id.eq.${user.id},user_id.is.null`).order('date', { ascending: false }),
      sb.from('stock').select('*').or(`user_id.eq.${user.id},user_id.is.null`).order('name', { ascending: true })
    ]);

    if (sales.error) console.error('Sales error', sales.error);
    if (expenses.error) console.error('Expenses error', expenses.error);
    if (stock.error) console.error('Stock error', stock.error);

    let allSales = sales.data || [];
    let allExpenses = expenses.data || [];
    let allStock = stock.data || [];

    // Client-side auto-migration for legacy null user_id records
    const nullSales = allSales.filter(s => !s.user_id);
    const nullExpenses = allExpenses.filter(e => !e.user_id);
    const nullStock = allStock.filter(p => !p.user_id);

    if (nullSales.length > 0 || nullExpenses.length > 0 || nullStock.length > 0) {
      console.log(`[Migration] Found legacy records with NULL user_id. Associating them with user ID: ${user.id}`);
      
      // Migrate sales
      for (const s of nullSales) {
        sb.from('sales').update({ user_id: user.id }).eq('id', s.id).then(({ error }) => {
          if (error) console.warn('[Migration] Failed to migrate sale', s.id, error);
        });
        s.user_id = user.id;
      }
      
      // Migrate expenses
      for (const e of nullExpenses) {
        sb.from('expenses').update({ user_id: user.id }).eq('id', e.id).then(({ error }) => {
          if (error) console.warn('[Migration] Failed to migrate expense', e.id, error);
        });
        e.user_id = user.id;
      }
      
      // Migrate stock
      for (const p of nullStock) {
        sb.from('stock').update({ user_id: user.id }).eq('id', p.id).then(({ error }) => {
          if (error) console.warn('[Migration] Failed to migrate stock item', p.id, error);
        });
        p.user_id = user.id;
      }
    }

    S.sales = allSales.filter(sale => !sale.is_deleted);
    S.deletedSales = allSales.filter(sale => sale.is_deleted);
    S.expenses = allExpenses;
    S.stock = allStock;
  } catch (e) {
    console.error('Data load exception:', e);
  }
}

/* --- AUDIT LOG --- */
async function addAuditLog(entry, userId) {
  try {
    if (!window.sb || !userId) return;
    const log = {
      user_id: userId,
      action: entry.action || 'unknown',
      details: JSON.stringify(entry),
      created_at: new Date().toISOString()
    };
    // Use upsert-safe insert; silent fail if table doesn't exist yet
    await sb.from('audit_log').insert([log]);
  } catch (err) {
    // Audit logging is non-critical — silently swallow errors
    console.warn('[AuditLog]', err?.message || err);
  }
}

/* --- INVENTORY CONTROL --- */
async function saveInventoryControl(enabled) {
  if (IS_LOCKED) {
    toast('⚠️  Only the Business Owner can change Inventory Control settings.');
    // Revert the toggle in the UI
    const toggle = getEl('inv-ctrl-require-stock');
    if (toggle) toggle.checked = INVENTORY_CONTROL.require_stock_before_sale;
    return;
  }
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    INVENTORY_CONTROL.require_stock_before_sale = !!enabled;

    // Save setting to localStorage
    localStorage.setItem('biztrack_inventory_control_' + user.id, JSON.stringify(INVENTORY_CONTROL));

    // Update the status badge in the UI
    _renderInventoryControlStatus();
    toast(enabled
      ? '✅ Inventory Control ON — Sales require sufficient stock.'
      : '✅ Inventory Control OFF — Sales allowed regardless of stock.');
  } catch (err) {
    console.error(err);
    toast('⚠️  Failed to save settings locally: ' + (err.message || err.details || JSON.stringify(err)));
    // Revert toggle on failure
    const toggle = getEl('inv-ctrl-require-stock');
    if (toggle) toggle.checked = INVENTORY_CONTROL.require_stock_before_sale;
  }
}

function _renderInventoryControlStatus() {
  const badge = getEl('inv-ctrl-status-badge');
  const descEl = getEl('inv-ctrl-mode-desc');
  const enabled = INVENTORY_CONTROL.require_stock_before_sale;
  if (badge) {
    badge.textContent = enabled ? 'ON' : 'OFF';
    badge.style.background = enabled ? 'var(--green, #1E6641)' : 'var(--muted)';
    badge.style.color = '#fff';
    badge.style.padding = '0.15rem 0.55rem';
    badge.style.borderRadius = '20px';
    badge.style.fontSize = '0.72rem';
    badge.style.fontWeight = '700';
    badge.style.letterSpacing = '0.05em';
  }
  if (descEl) {
    descEl.textContent = enabled
      ? 'Sales are blocked when stock is insufficient. Stock is always deducted after a sale.'
      : 'Sales proceed even with zero stock. Stock deducted when possible; custom items skipped.';
  }
  const toggle = getEl('inv-ctrl-require-stock');
  if (toggle) toggle.checked = enabled;

  // Disable toggle for staff
  if (IS_LOCKED && toggle) {
    toggle.disabled = true;
    toggle.title = 'Only the Business Owner can change this setting.';
  } else if (toggle) {
    toggle.disabled = false;
    toggle.title = '';
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
  // If in staff mode, enforce permissions
  if (IS_LOCKED && name !== 'dashboard') {
    const perms = (PROFILE && PROFILE.staff_permissions) ? { ...STAFF_PERMS, ...PROFILE.staff_permissions } : STAFF_PERMS;
    if (name === 'profile' || name === 'admin') {
      alert("Access Denied! Please unlock Admin Mode first.");
      return;
    }
    const tabMap = {
      'sales': perms.tab_sales,
      'recent-sales': perms.tab_sales,
      'expense': perms.tab_expense,
      'inventory': perms.tab_inventory,
      'invoice': perms.tab_invoice,
      'report': perms.tab_report,
      'settings': true
    };
    if (tabMap[name] === false) {
      alert("Access Denied! You do not have permission to access this feature.");
      return;
    }
  }

  // Handle standard tab activation state
  document.querySelectorAll('.tab').forEach(tab => {
    const active = tab.id === 'tab-' + name;
    tab.classList.toggle('on', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  
  document.querySelectorAll('.panel').forEach(panel => {
    panel.classList.toggle('on', panel.id === 'panel-' + name);
  });

  // Load correct contents/handlers
  if (name === 'transactions') renderLatestTransactions();
  if (name === 'report') renderReport();
  if (name === 'invoice') populateInvoiceSel();
  if (name === 'profile') populateProfileForm();
  if (name === 'settings') populateSettingsForm();
  if (name === 'admin') populateAdminCenter();

  // Scroll to top smoothly
  window.scrollTo({ top: 0, behavior: 'instant' });
  
  // Close FAB Speed-dial menu automatically on navigation
  toggleFabMenu(false);
}

function populateProfileForm() {
  if (!PROFILE) return;
  getEl('prof-biz-name').value = PROFILE.business_name || '';
  getEl('prof-phone').value = PROFILE.phone_number || '';
  getEl('prof-loc').value = PROFILE.location || '';
  getEl('prof-bank').value = PROFILE.bank_name || '';
  getEl('prof-acc-num').value = PROFILE.account_number || '';
  getEl('prof-acc-name').value = PROFILE.account_name || '';
  getEl('prof-pin').value = PROFILE.pin || '1234';
  // Populate staff permissions toggles
  const perms = PROFILE.staff_permissions || {};
  const merged = { ...STAFF_PERMS, ...perms };
  Object.keys(merged).forEach(key => {
    const el = getEl('perm-' + key);
    if (el) el.checked = !!merged[key];
  });
}

function readStaffPermsFromUI() {
  const keys = Object.keys(STAFF_PERMS);
  const result = {};
  keys.forEach(key => {
    const el = getEl('perm-' + key);
    result[key] = el ? el.checked : STAFF_PERMS[key];
  });
  return result;
}

async function saveStaffPermissions() {
  try {
    const perms = readStaffPermsFromUI();
    const { data: { user } } = await sb.auth.getUser();
    const payload = { id: user.id, staff_permissions: perms };
    const { error } = await sb.from('profiles').upsert(payload);
    if (error) throw error;
    STAFF_PERMS = perms;
    if (PROFILE) PROFILE.staff_permissions = perms;
    toast('✅ Staff permissions saved!');
  } catch (err) {
    console.error(err);
    toast('⚠️  Could not save permissions');
  }
}

/* --- SALES & INVENTORY INTEGRATION --- */
function populateStockDropdowns() {
  const stock = S.stock || [];
  const datalist = getEl('inventory-item-suggestions');
  if (datalist) {
    datalist.innerHTML = stock.map(p => {
      const price = p.selling_price || p.cost_price || 0;
      const qty = Number(p.qty) || 0;
      return `<option value="${esc(p.name)}">${qty} in stock — ${fmt(price)}</option>`;
    }).join('');
  }
}

function onItemNameInput(inputEl) {
  const row = inputEl.closest('.item-row');
  if (!row) return;

  const val = (inputEl.value || '').trim();
  const priceInput = row.querySelector('.iprice');
  const badgeEl = row.querySelector('.stock-badge-info');

  const product = (S.stock || []).find(p => p.name.toLowerCase() === val.toLowerCase());

  if (product) {
    row.dataset.stockId = product.id;
    if (priceInput && (!priceInput.value || Number(priceInput.value) === 0)) {
      priceInput.value = product.selling_price || product.cost_price || 0;
    }
    const qty = Number(product.qty) || 0;
    if (badgeEl) {
      if (qty <= 0) {
        badgeEl.innerHTML = `<span style="color:var(--red); font-weight:700; font-size:0.66rem;">⚠️  Out of Stock (0 in inventory)</span>`;
      } else if (qty <= 5) {
        badgeEl.innerHTML = `<span style="color:var(--gold); font-weight:700; font-size:0.66rem;">⚠️  Low Stock: ${qty} ${esc(product.unit || 'units')} available</span>`;
      } else {
        badgeEl.innerHTML = `<span style="color:var(--green); font-weight:600; font-size:0.66rem;">✓ In Stock: ${qty} ${esc(product.unit || 'units')} available</span>`;
      }
    }
  } else {
    row.dataset.stockId = '';
    if (badgeEl) {
      badgeEl.innerHTML = val ? `<span style="color:var(--muted); font-size:0.66rem;">✏️  Custom item (Manual entry)</span>` : '';
    }
  }
  calcTotals();
}

function getItems() {
  const rows = Array.from(document.querySelectorAll('.item-row'));
  return rows.map(row => {
    const nameInput = row.querySelector('.iname');
    const qtyInput = row.querySelector('.iqty');
    const priceInput = row.querySelector('.iprice');

    const val = (nameInput?.value || '').trim();
    const product = (S.stock || []).find(p => p.name.toLowerCase() === val.toLowerCase());
    const stockId = row.dataset.stockId || (product ? product.id : null);

    return {
      stock_id: stockId || null,
      name: val,
      qty: parseFloat(qtyInput?.value) || 0,
      price: parseFloat(priceInput?.value) || 0,
    };
  }).filter(item => item.name && item.qty > 0);
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

function buildItemRowHTML(index, item = null) {
  const nameVal = item ? esc(item.name) : '';
  const qtyVal = item ? (Number(item.qty) || 1) : 1;
  const priceVal = item ? (Number(item.price) || 0) : '';
  const stockId = item ? (item.stock_id || '') : '';

  return `
    <div class="item-row" data-stock-id="${stockId}" style="display:flex; flex-direction:column; gap:0.15rem; margin-bottom:0.25rem; padding:0.25rem 0.35rem; border:1px solid var(--border); border-radius:6px; background:#fff;">
      <div style="display:flex; gap:0.3rem; align-items:center;">
        <input type="text" id="item-name-${index}" class="iname" list="inventory-item-suggestions" placeholder="Type item name or select inventory product…" aria-label="Item name" value="${nameVal}" oninput="onItemNameInput(this)" onchange="onItemNameInput(this)" style="flex:2.2; font-size:0.75rem; padding:0.15rem 0.35rem; height:26px; border-radius:5px; border:1px solid var(--border);" />
        <input type="number" id="item-qty-${index}" class="iqty" placeholder="1" aria-label="Quantity" min="1" value="${qtyVal}" oninput="calcTotals()" style="flex:0.6; font-size:0.75rem; padding:0.15rem 0.35rem; height:26px; border-radius:5px; border:1px solid var(--border);" />
        <input type="number" id="item-price-${index}" class="iprice" placeholder="0.00" aria-label="Unit price ₦" min="0" step="0.01" value="${priceVal}" oninput="calcTotals()" style="flex:0.9; font-size:0.75rem; padding:0.15rem 0.35rem; height:26px; border-radius:5px; border:1px solid var(--border);" />
        <button type="button" class="btn-remove-item" onclick="removeItemRow(this)" title="Remove item" aria-label="Remove item" style="background:transparent; border:1px solid rgba(220,38,38,0.3); color:#dc2626; padding:0.1rem 0.35rem; font-size:0.7rem; border-radius:4px; cursor:pointer; height:24px; display:inline-flex; align-items:center; justify-content:center;">✕</button>
      </div>
      <div class="stock-badge-info" style="font-size:0.66rem; color:var(--muted); padding-left:0.15rem;"></div>
    </div>
  `;
}

function addItemRow() {
  const i = itemCount++;
  const div = document.createElement('div');
  div.innerHTML = buildItemRowHTML(i);
  getEl('items-rows')?.appendChild(div.firstElementChild);
  calcTotals();
}

function removeItemRow(btn) {
  const container = getEl('items-rows');
  if (!container) return;
  const rows = container.querySelectorAll('.item-row');
  if (rows.length > 1) {
    btn.closest('.item-row').remove();
    calcTotals();
  } else {
    resetItemRows();
  }
}

function resetItemRows() {
  const container = getEl('items-rows');
  if (!container) return;
  container.innerHTML = buildItemRowHTML(0);
  itemCount = 1;
  calcTotals();
}

function populateSaleItems(items = []) {
  const container = getEl('items-rows');
  if (!container) return;
  container.innerHTML = '';
  itemCount = 0;
  items.forEach(item => {
    const div = document.createElement('div');
    div.innerHTML = buildItemRowHTML(itemCount, item);
    const rowEl = div.firstElementChild;
    container.appendChild(rowEl);

    const nameInput = rowEl.querySelector('.iname');
    if (nameInput) {
      onItemNameInput(nameInput);
    }
    itemCount += 1;
  });
  if (!items.length) {
    resetItemRows();
  } else {
    calcTotals();
  }
}

async function checkStockValidation(items) {
  const requireStock = INVENTORY_CONTROL.require_stock_before_sale;
  const insufficientItems = [];
  const notInInventory = [];

  for (const item of items) {
    let stockItem = null;
    if (item.stock_id) {
      stockItem = (S.stock || []).find(p => String(p.id) === String(item.stock_id));
    }
    if (!stockItem && item.name) {
      stockItem = (S.stock || []).find(p => p.name.toLowerCase() === item.name.toLowerCase());
    }

    if (stockItem) {
      const avail = Number(stockItem.qty) || 0;
      const req = Number(item.qty) || 0;
      if (req > avail) {
        insufficientItems.push({
          productName: stockItem.name,
          available: avail,
          requested: req
        });
      }
    } else {
      // Item not found in inventory
      notInInventory.push(item.name);
    }
  }

  // ─€─€ STRICT MODE (ON): Block the sale if ANY item is insufficient ─€─€
  if (requireStock) {
    if (insufficientItems.length > 0) {
      const modal = getEl('stock-warning-modal');
      const msgEl = getEl('stock-warning-msg');
      const btnCancel = getEl('stock-warning-cancel-btn');
      const btnProceed = getEl('stock-warning-proceed-btn');

      const blockHtml = insufficientItems.map(w => `
        <div style="background:#FCEAEA; border-left:3px solid var(--red); padding:0.45rem 0.65rem; border-radius:6px; margin-top:0.4rem; font-size:0.82rem; color:var(--text);">
          <strong>${esc(w.productName)}</strong>: Requested <strong>${w.requested}</strong> units, only <strong style="color:var(--red);">${w.available}</strong> in stock.
        </div>
      `).join('');

      if (modal && msgEl && btnCancel && btnProceed) {
        msgEl.innerHTML = `
          <div style="background:#FCEAEA; border-left:4px solid var(--red); padding:0.6rem 0.85rem; border-radius:8px; margin-bottom:0.5rem; font-size:0.85rem; font-weight:600; color:var(--red);">
            🚫 Insufficient Stock — Sale Blocked
          </div>
          ${blockHtml}
          <p style="margin-top:0.75rem; font-size:0.8rem; color:var(--muted); line-height:1.5;">
            Insufficient stock. Please restock before completing this sale.
          </p>`;
        // Hide the proceed button since sale is blocked
        btnProceed.style.display = 'none';
        btnCancel.textContent = 'OK, Go Back';
        const cleanup = () => {
          modal.style.display = 'none';
          btnProceed.style.display = '';
          btnCancel.textContent = 'Cancel';
          btnCancel.onclick = null;
        };
        btnCancel.onclick = () => cleanup();
        modal.style.display = 'flex';
      } else {
        const wText = insufficientItems.map(w => `• "${w.productName}": Requested ${w.requested}, only ${w.available} available`).join('\n');
        alert(`🚫 Insufficient stock. Please restock before completing this sale:\n\n${wText}`);
      }
      return false; // Block the sale
    }
    // Items not in inventory are allowed even in strict mode — just proceed
    return true;
  }

  // ─€─€ PERMISSIVE MODE (OFF): Allow sales even if stock is zero/insufficient ─€─€
  if (notInInventory.length > 0) {
    toast(`ℹ️ Inventory not validated for: ${notInInventory.join(', ')}`);
  }
  return true;
}

async function deductStockForSale(items) {
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    for (const item of items) {
      let stockItem = null;
      if (item.stock_id) {
        stockItem = (S.stock || []).find(p => String(p.id) === String(item.stock_id));
      }
      if (!stockItem && item.name) {
        stockItem = (S.stock || []).find(p => p.name.toLowerCase() === item.name.toLowerCase());
      }

      if (stockItem) {
        const soldQty = Number(item.qty) || 0;
        const currentQty = Number(stockItem.qty) || 0;
        const newQty = Math.max(0, currentQty - soldQty); // Never go below 0 in permissive mode

        stockItem.qty = newQty;

        if (window.sb) {
          await sb.from('stock').update({ qty: newQty }).eq('id', stockItem.id).eq('user_id', user.id);
          // Record inventory adjustment in audit log
          await addAuditLog({
            action: 'stock_deduct',
            item_name: stockItem.name,
            stock_id: stockItem.id,
            qty_before: currentQty,
            qty_after: newQty,
            qty_sold: soldQty,
            mode: INVENTORY_CONTROL.require_stock_before_sale ? 'strict' : 'permissive'
          }, user.id);
        }
      } else if (item.name) {
        // Item not in inventory — log the skipped deduction
        if (window.sb && user) {
          await addAuditLog({
            action: 'stock_skip',
            item_name: item.name,
            qty_sold: Number(item.qty) || 0,
            note: 'Item not found in inventory, deduction skipped'
          }, user.id);
        }
      }
    }
  } catch (err) {
    console.warn('Error updating stock deduction:', err);
  }
}

function enterSaleEditMode(id) {
  const record = (S.sales || []).find(item => item.id === id) || (window.CURRENT_PAGE_ITEMS || []).find(item => item.id === id);
  if (!record) return;
  SALE_EDIT_ID = id;
  getEl('sale-date').value = record.date || todayISO();
  getEl('sale-status').value = record.status || 'Pending';
  getEl('sale-payment-status').value = record.payment_status || record.paymentStatus || 'Paid';
  getEl('cust-name').value = record.customer_name || record.customerName || '';
  getEl('cust-phone').value = record.contact || '';
  getEl('cust-address').value = record.address || '';
  getEl('sale-delivery-fee').value = record.delivery_fee || record.deliveryFee || 0;
  getEl('sale-disc').value = record.discount || 0;
  if (getEl('cust-feedback')) getEl('cust-feedback').value = record.feedback || '';

  populateSaleItems(record.items || []);
  calcTotals();

  const heading = document.querySelector('#panel-sales .card-h');
  if (heading) heading.textContent = 'Edit Recent Sale Record';
  const pageTitle = document.querySelector('#panel-sales .page-header h2');
  if (pageTitle) pageTitle.textContent = 'Edit Recent Sale';

  getEl('sale-submit-btn').textContent = 'Save';
  getEl('sale-cancel-btn').textContent = 'Cancel';
  getEl('sale-cancel-btn').style.display = 'inline-flex';
  switchTab('sales');
}

function clearSaleEditMode() {
  const wasEditing = !!SALE_EDIT_ID;
  SALE_EDIT_ID = null;
  
  const heading = document.querySelector('#panel-sales .card-h');
  if (heading) heading.textContent = 'New Sale Record';
  const pageTitle = document.querySelector('#panel-sales .page-header h2');
  if (pageTitle) pageTitle.textContent = 'Record Sale';

  getEl('sale-submit-btn').textContent = 'Save';
  getEl('sale-cancel-btn').textContent = 'Cancel';
  getEl('sale-cancel-btn').style.display = 'none';
  getEl('form-sale').reset();
  resetItemRows();
  calcTotals();
  if (wasEditing) {
    switchTab('recent-sales');
  }
}

async function deleteSale(id) {
  if (!confirm('Are you sure you want to delete this sale record?')) return;
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data, error } = await sb.from('sales').update({ is_deleted: true }).eq('id', id).eq('user_id', user.id).select();
    if (error) throw error;
    
    if (!data || data.length === 0) {
      alert("Deletion failed!\n\nThis is likely because your Supabase database doesn't have the required columns or policies for the soft-delete feature.\n\nPlease ensure you executed the database update SQL (ALTER TABLE sales ADD COLUMN is_deleted BOOLEAN DEFAULT false;).");
      return;
    }
    
    toast('✅ Sale deleted!');
    
    const modal = getEl('monthly-detail-modal');
    const wasOpen = modal && modal.style.display === 'flex';
    
    await loadData();
    renderAll();
    
    if (wasOpen) {
      const headerText = getEl('monthly-detail-content')?.querySelector('h3')?.textContent || '';
      const match = headerText.match(/Sales for (\d{4}-\d{2})/);
      if (match && match[1]) {
        const month = match[1];
        const monthSales = S.sales.filter(sale => (sale.date || '').slice(0, 7) === month);
        if (monthSales.length > 0) {
          showMonthlySalesDetail(month);
        } else {
          closeMonthlySalesDetail();
        }
      } else {
        closeMonthlySalesDetail();
      }
    }
  } catch (err) {
    console.error('Delete error:', err);
    toast('⚠️  Error deleting sale');
  }
}

function lockApp() {
  IS_LOCKED = true;
  localStorage.setItem('biztrack_locked', 'true');
  applyLockUIState();
  toast('🔒’ App locked in Staff Mode');
}

function unlockApp() {
  const pin = prompt('Enter 4-digit Owner PIN to unlock Admin Mode:');
  if (pin === null) return;
  
  const correctPin = (PROFILE && PROFILE.pin) || '1234';
  if (pin === correctPin) {
    IS_LOCKED = false;
    localStorage.setItem('biztrack_locked', 'false');
    applyLockUIState();
    toast('🔓 Admin Mode unlocked');
  } else {
    alert('Incorrect PIN! Access denied.');
  }
}

function applyLockUIState() {
  const profileTab = getEl('tab-profile');
  const unlockTab = getEl('tab-unlock-admin');
  const lockBtn = getEl('btn-staff-lock');
  const deletedSalesSection = getEl('deleted-sales-hd')?.closest('section');

  // Load saved permissions from profile if available
  const perms = (PROFILE && PROFILE.staff_permissions)
    ? { ...STAFF_PERMS, ...PROFILE.staff_permissions }
    : STAFF_PERMS;

  if (IS_LOCKED) {
    // Always hide Details tab and Deleted Sales in staff mode
    if (profileTab) profileTab.style.display = 'none';
    if (deletedSalesSection) deletedSalesSection.style.display = 'none';
    if (unlockTab) unlockTab.style.display = 'block';
    if (lockBtn) lockBtn.style.display = 'none';

    // Show landing page and dashboard Unlock buttons; hide Lock buttons
    const btnUnlock = getEl('btn-staff-unlock');
    if (btnUnlock) btnUnlock.style.display = 'block';
    
    const dashLock = getEl('dash-btn-staff-lock');
    if (dashLock) dashLock.style.display = 'none';
    const dashUnlock = getEl('dash-btn-staff-unlock');
    if (dashUnlock) dashUnlock.style.display = 'block';

    // Hide staff permissions control card in Settings panel
    const staffSettingsCard = getEl('settings-staff-card');
    if (staffSettingsCard) staffSettingsCard.style.display = 'none';

    // Apply per-tab visibility based on permissions
    const tabMap = {
      'tab-sales':     perms.tab_sales,
      'tab-recent-sales': perms.tab_sales,
      'tab-expense':   perms.tab_expense,
      'tab-inventory': perms.tab_inventory,
      'tab-invoice':   perms.tab_invoice,
      'tab-report':    perms.tab_report,
      'tab-settings':  true,
      'tab-admin':     false,
      'tab-transactions': true
    };
    Object.entries(tabMap).forEach(([id, allowed]) => {
      const el = getEl(id);
      if (el) el.style.display = allowed ? '' : 'none';
    });

    // Apply Quick Actions and FAB elements visibility based on permissions
    const qaMap = {
      'qa-sales-card':      perms.tab_sales,
      'qa-recent-sales-card': perms.tab_sales,
      'qa-expense-card':    perms.tab_expense,
      'qa-inventory-card':  perms.tab_inventory,
      'qa-invoice-card':    perms.tab_invoice,
      'qa-report-card':     perms.tab_report,
      'qa-profile-card':    false,
      'qa-settings-card':   true,
      'qa-admin-card':      false,
      'qa-transactions-card': true
    };
    Object.entries(qaMap).forEach(([id, allowed]) => {
      const el = getEl(id);
      if (el) el.style.display = allowed ? '' : 'none';
    });

    const fabMap = {
      'fab-action-sale':     perms.tab_sales,
      'fab-action-expense':   perms.tab_expense,
      'fab-action-stock':     perms.tab_inventory,
      'fab-action-invoice':   perms.tab_invoice
    };
    Object.entries(fabMap).forEach(([id, allowed]) => {
      const el = getEl(id);
      if (el) el.style.display = allowed ? 'flex' : 'none';
    });

    // Hide sale amounts if not permitted (but dashboard cards always show monthly totals)
    document.querySelectorAll('.li-amt, #hm-rev, #hm-profit, .trans-amt').forEach(el => {
      el.style.visibility = perms.see_amounts ? 'visible' : 'hidden';
    });
    // Dashboard insight cards always visible in staff mode (monthly data only)
    document.querySelectorAll('#ins-rev, #ins-exp, #ins-profit, #ins-tax').forEach(el => {
      el.style.visibility = 'visible';
    });

    // Hide the entire hero bar (Revenue/Profit/Sales count) in staff mode
    const heroMetrics = document.querySelector('.hero-metrics');
    if (heroMetrics) heroMetrics.style.display = 'none';

    // Hide customer contact info if not permitted
    document.querySelectorAll('.staff-contact-field').forEach(el => {
      el.style.display = perms.see_customer_contact ? '' : 'none';
    });

    // Dashboard panel: always show in staff mode but only monthly data
    // (renderInsights handles the data filtering)
    const insightsPanel = getEl('insights-panel');
    if (insightsPanel) insightsPanel.style.display = '';
    renderInsights();

    // If currently on a now-hidden tab, redirect to first allowed tab
    const currentTab = document.querySelector('.tab.on');
    if (currentTab && (currentTab.id === 'tab-profile' || currentTab.id === 'tab-admin' || tabMap[currentTab.id] === false)) {
      const firstAllowed = Object.entries(tabMap).find(([, v]) => v);
      switchTab(firstAllowed ? firstAllowed[0].replace('tab-', '') : 'dashboard');
    }
  } else {
    // Admin mode — show everything
    if (profileTab) profileTab.style.display = 'block';
    if (deletedSalesSection) deletedSalesSection.style.display = 'block';
    if (unlockTab) unlockTab.style.display = 'none';
    if (lockBtn) lockBtn.style.display = 'block';

    // Show landing page and dashboard Lock buttons; hide Unlock buttons
    const btnUnlock = getEl('btn-staff-unlock');
    if (btnUnlock) btnUnlock.style.display = 'none';
    
    const dashLock = getEl('dash-btn-staff-lock');
    if (dashLock) dashLock.style.display = 'block';
    const dashUnlock = getEl('dash-btn-staff-unlock');
    if (dashUnlock) dashUnlock.style.display = 'none';

    // Show staff permissions control card in Settings panel
    const staffSettingsCard = getEl('settings-staff-card');
    if (staffSettingsCard) staffSettingsCard.style.display = 'block';

    // Restore all tabs
    ['tab-sales','tab-recent-sales','tab-expense','tab-inventory','tab-invoice','tab-report','tab-settings','tab-admin','tab-transactions','tab-utilities'].forEach(id => {
      const el = getEl(id);
      if (el) el.style.display = '';
    });

    // Restore all Quick Actions and FAB buttons
    ['qa-sales-card','qa-recent-sales-card','qa-expense-card','qa-inventory-card','qa-invoice-card','qa-report-card','qa-profile-card','qa-settings-card','qa-admin-card','qa-transactions-card','qa-utilities-card'].forEach(id => {
      const el = getEl(id);
      if (el) el.style.display = '';
    });

    ['fab-action-sale','fab-action-expense','fab-action-stock','fab-action-invoice'].forEach(id => {
      const el = getEl(id);
      if (el) el.style.display = 'flex';
    });

    // Restore amount visibility
    document.querySelectorAll('.li-amt, #ins-rev, #ins-exp, #ins-profit, #ins-tax, #hm-rev, #hm-profit, .trans-amt').forEach(el => {
      el.style.visibility = 'visible';
    });

    // Restore hero bar
    const heroMetrics = document.querySelector('.hero-metrics');
    if (heroMetrics) heroMetrics.style.display = '';

    // Restore contact fields
    document.querySelectorAll('.staff-contact-field').forEach(el => {
      el.style.display = '';
    });
    
    // Restore dashboard panel (full data restored by renderInsights)
    const insightsPanel = getEl('insights-panel');
    if (insightsPanel) insightsPanel.style.display = '';
    renderInsights();
  }

  // Refresh lists to hide/show owner-only actions
  _renderDeletedSalesList();
  // Re-render sales list to respect edit/delete permissions
  _renderSalesList();
  // Re-render transaction feed to respect edit/delete permissions
  renderLatestTransactions();
  
  // Update Inventory Control toggle UI state (disabled/enabled)
  _renderInventoryControlStatus();
}

async function restoreSale(id) {
  try {
    if (IS_LOCKED) {
      alert("Unauthorized! Please unlock Admin Mode first.");
      return;
    }

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const { data, error } = await sb.from('sales').update({ is_deleted: false }).eq('id', id).eq('user_id', user.id).select();
    if (error) throw error;
    
    toast('✅ Sale restored!');
    await loadData();
    renderAll();
  } catch (err) {
    console.error('Restore error:', err);
    toast('⚠️  Error restoring sale');
  }
}

async function permanentlyDeleteSale(id) {
  try {
    if (IS_LOCKED) {
      alert("Unauthorized! Please unlock Admin Mode first.");
      return;
    }

    if (!confirm('WARNING: Are you sure you want to PERMANENTLY delete this sale record? This action cannot be undone.')) return;
    
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const { data, error } = await sb.from('sales').delete().eq('id', id).eq('user_id', user.id).select();
    if (error) throw error;
    
    toast('🗑️ Sale permanently deleted!');
    await loadData();
    renderAll();
  } catch (err) {
    console.error('Permanent delete error:', err);
    toast('⚠️  Error permanently deleting sale');
  }
}

function toggleDeletedSalesHistory() {
  const container = getEl('deleted-sales-container');
  const btn = getEl('btn-toggle-deleted-sales');
  if (!container || !btn) return;
  
  if (container.style.display === 'none') {
    container.style.display = 'block';
    btn.textContent = 'Hide History';
  } else {
    container.style.display = 'none';
    btn.textContent = 'Show History';
  }
}

function _renderDeletedSalesList() {
  const list = getEl('deleted-list-root');
  if (!list) return;
  
  if (IS_LOCKED) {
    list.innerHTML = '';
    return;
  }
  
  if (!S.deletedSales || !S.deletedSales.length) {
    list.innerHTML = '<li class="empty"><div class="empty-ico">🗑️</div>No deleted sales records.</li>';
    return;
  }

  list.innerHTML = S.deletedSales.map(record => {
    const itemsSummary = (record.items || []).map(item => `${item.name} ×${item.qty}`).join(', ');
    const badgeClass = record.status === 'Delivered' ? 'b-deliv' : record.status === 'Failed' ? 'b-fail' : 'b-pend';
    
    const actionButtons = `
      <button type="button" class="btn-ghost" style="margin-left:.75rem;color:var(--gold);border-color:rgba(201,152,42,.2)" onclick="restoreSale('${record.id}')">Restore</button>
      <button type="button" class="btn-ghost" style="margin-left:.5rem;color:var(--red);border-color:rgba(181,48,48,.2)" onclick="permanentlyDeleteSale('${record.id}')">Delete Permanently</button>
    `;

    return `
      <li class="li">
        <div class="li-body">
          <div class="li-name">${esc(record.customer_name)}</div>
          <div class="li-sub">${record.date} · ${itemsSummary} (Deleted)</div>
        </div>
        <div class="li-right">
          <div class="li-amt">${fmt(record.total)}</div>
          <span class="badge ${badgeClass}">${esc(record.status)}</span>
          ${actionButtons}
        </div>
      </li>`;
  }).join('');
}

function enterExpenseEditMode(id) {
  const record = (S.expenses || []).find(item => String(item.id) === String(id));
  if (!record) return;
  EXPENSE_EDIT_ID = id;
  getEl('exp-date').value = record.date || todayISO();
  getEl('exp-type').value = record.type || '';
  getEl('exp-desc').value = record.description || '';
  getEl('exp-amount').value = record.amount || '';
  getEl('expense-submit-btn').textContent = 'Update Expense';
  getEl('expense-cancel-btn').style.display = 'inline-flex';
  switchTab('expense');
}

function clearExpenseEditMode() {
  EXPENSE_EDIT_ID = null;
  getEl('expense-submit-btn').textContent = 'Save Expense';
  getEl('expense-cancel-btn').style.display = 'none';
  getEl('form-expense').reset();
}

function openAddProductModal() {
  if (!STOCK_EDIT_ID) {
    clearStockEditMode();
  }
  const modal = getEl('add-product-modal');
  if (modal) modal.style.display = 'flex';
}

function closeAddProductModal() {
  const modal = getEl('add-product-modal');
  if (modal) modal.style.display = 'none';
  clearStockEditMode();
}

function enterStockEditMode(id) {
  const record = (S.stock || []).find(item => String(item.id) === String(id));
  if (!record) return;
  STOCK_EDIT_ID = id;
  getEl('inv-name').value = record.name || '';
  getEl('inv-category').value = record.category || '';
  getEl('inv-qty').value = record.qty || 0;
  getEl('inv-unit').value = record.unit || '';
  getEl('inv-cost').value = record.cost_price || 0;
  getEl('inv-sell').value = record.selling_price || 0;
  
  const titleEl = getEl('add-product-modal-title');
  if (titleEl) titleEl.textContent = 'Edit Product in Inventory';
  getEl('inventory-submit-btn').textContent = 'Update Inventory';
  openAddProductModal();
}

function clearStockEditMode() {
  STOCK_EDIT_ID = null;
  const titleEl = getEl('add-product-modal-title');
  if (titleEl) titleEl.textContent = 'Add Product to Inventory';
  getEl('inventory-submit-btn').textContent = 'Add to Inventory';
  getEl('form-inventory')?.reset();
}

async function filterSales(status) {
  CURRENT_SALES_PAGE = 1;
  CURRENT_SALES_FILTER = status;
  document.querySelectorAll('#sales-filter-tabs .tab').forEach(tab => {
    tab.classList.toggle('on', tab.id === 'sf-' + status.toLowerCase());
  });
  await _renderSalesList();
}

async function markSalePaid(id) {
  try {
    toast('⏳ Marking as Paid...');
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { error } = await sb.from('sales').update({ payment_status: 'Paid' }).eq('id', id).eq('user_id', user.id);
    if (error) throw error;
    toast('✅ Marked as Paid!');
    await loadData();
    renderAll();
  } catch (err) {
    console.error(err);
    toast('⚠️  Error updating status');
  }
}

async function _renderSalesList() {
  const list = getEl('list-root');
  if (!list) return;
  const searchText = (getEl('input-search')?.value || '').trim().toLowerCase();
  CURRENT_SALES_SEARCH = searchText;

  let pageItems = [];
  let totalRecords = 0;

  // Attempt Supabase server-side range pagination first
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    let query = sb.from('sales').select('*', { count: 'exact' }).or(`user_id.eq.${user.id},user_id.is.null`).eq('is_deleted', false).order('date', { ascending: false });
    if (CURRENT_SALES_FILTER !== 'All') {
      query = query.eq('payment_status', CURRENT_SALES_FILTER);
    }
    if (searchText) {
      query = query.ilike('customer_name', `%${searchText}%`);
    }
    const from = (CURRENT_SALES_PAGE - 1) * SALES_PAGE_SIZE;
    const to = from + SALES_PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error || !data) {
      throw new Error('Supabase query failed');
    }
    pageItems = data;
    totalRecords = count !== null ? count : data.length;
  } catch (err) {
    // In-memory fallback
    let items = (S.sales || []).slice();
    if (searchText) {
      items = items.filter(record =>
        (record.customer_name && record.customer_name.toLowerCase().includes(searchText)) ||
        (record.customerName && record.customerName.toLowerCase().includes(searchText)) ||
        (record.items && record.items.some(item => item.name.toLowerCase().includes(searchText)))
      );
    }
    if (CURRENT_SALES_FILTER !== 'All') {
      items = items.filter(record => (record.payment_status || record.paymentStatus || 'Paid') === CURRENT_SALES_FILTER);
    }
    totalRecords = items.length;
    const start = (CURRENT_SALES_PAGE - 1) * SALES_PAGE_SIZE;
    pageItems = items.slice(start, start + SALES_PAGE_SIZE);
  }

  TOTAL_SALES_PAGES = Math.ceil(totalRecords / SALES_PAGE_SIZE) || 1;
  if (CURRENT_SALES_PAGE > TOTAL_SALES_PAGES) CURRENT_SALES_PAGE = TOTAL_SALES_PAGES;
  if (CURRENT_SALES_PAGE < 1) CURRENT_SALES_PAGE = 1;

  // Update Pagination Controls UI (Top and Bottom)
  document.querySelectorAll('.sales-pagination-controls').forEach(el => el.style.display = 'flex');
  document.querySelectorAll('.sales-page-info').forEach(el => el.textContent = `Page ${CURRENT_SALES_PAGE} of ${TOTAL_SALES_PAGES}`);

  const isFirst = CURRENT_SALES_PAGE <= 1;
  document.querySelectorAll('.sales-prev-btn').forEach(btn => {
    btn.disabled = isFirst;
    btn.style.opacity = isFirst ? '0.5' : '1';
    btn.style.pointerEvents = isFirst ? 'none' : 'auto';
  });

  const isLast = CURRENT_SALES_PAGE >= TOTAL_SALES_PAGES;
  document.querySelectorAll('.sales-next-btn').forEach(btn => {
    btn.disabled = isLast;
    btn.style.opacity = isLast ? '0.5' : '1';
    btn.style.pointerEvents = isLast ? 'none' : 'auto';
  });

  if (!pageItems.length) {
    list.innerHTML = `<li class="empty"><div class="empty-ico">🧾</div>No matching sales found.</li>`;
    return;
  }

  // Resolve permissions for current mode
  const perms = IS_LOCKED
    ? { ...STAFF_PERMS, ...(PROFILE?.staff_permissions || {}) }
    : { can_edit_sale: true, can_delete_sale: true, see_amounts: true, see_customer_contact: true };

  window.CURRENT_PAGE_ITEMS = pageItems;

  list.innerHTML = pageItems.map(record => {
    const custName = record.customer_name || record.customerName || 'Customer';
    const payStatus = record.payment_status || record.paymentStatus || 'Paid';
    const badgeClass = record.status === 'Delivered' ? 'b-done' : record.status === 'Failed' ? 'b-fail' : 'b-pend';
    const payBadge = payStatus === 'Pending' ? `<span class="badge" style="background:#FCEAEA;color:#B53030;margin-left:4px">Unpaid</span>` : '';
    const itemsSummary = esc((record.items || []).map(item => `${item.name} ×${item.qty}`).join(', '));
    const payBtn = payStatus === 'Pending' && perms.can_edit_sale
      ? `<button type="button" class="btn-ghost" style="margin-left:.75rem;color:var(--green);border-color:var(--green-bg)" onclick="markSalePaid('${record.id}')">Mark Paid</button>` : '';
    const editBtn = perms.can_edit_sale
      ? `<button type="button" class="btn-ghost" style="margin-left:.75rem" onclick="enterSaleEditMode('${record.id}')">Edit</button>` : '';
    const deleteBtn = perms.can_delete_sale
      ? `<button type="button" class="btn-ghost" style="margin-left:.5rem;color:var(--red);border-color:rgba(181,48,48,.2)" onclick="deleteSale('${record.id}')">Delete</button>` : '';
    const contactLine = perms.see_customer_contact
      ? `<span class="staff-contact-field"> · ${esc(record.contact || '')}</span>` : '';
    const amtDisplay = perms.see_amounts
      ? `<div class="li-amt">${fmt(record.total)}</div>` : '';

    return `
      <li class="li" style="cursor:pointer;" onclick="viewSaleDetails('${record.id}')" title="Click to view full sale details">
        <div class="li-body">
          <div class="li-name">${esc(custName)} ${payBadge}</div>
          <div class="li-sub">${record.date} · ${itemsSummary}${contactLine}</div>
        </div>
        <div class="li-right" onclick="event.stopPropagation()">
          ${amtDisplay}
          <span class="badge ${badgeClass}">${esc(record.status || 'Pending')}</span>
          ${payBtn}
          ${deleteBtn}
        </div>
      </li>`;
  }).join('');
}

function viewSaleDetails(id) {
  let record = (S.sales || []).find(item => item.id === id);
  if (!record && Array.isArray(window.CURRENT_PAGE_ITEMS)) {
    record = window.CURRENT_PAGE_ITEMS.find(item => item.id === id);
  }
  if (!record) return;

  const modal = getEl('sale-detail-modal');
  const content = getEl('sdm-content');
  const editBtn = getEl('sdm-edit-btn');
  if (!modal || !content) return;

  const custName = record.customer_name || record.customerName || 'Customer';
  const payStatus = record.payment_status || record.paymentStatus || 'Paid';
  const deliveryStatus = record.status || 'Pending';
  const badgeClass = deliveryStatus === 'Delivered' ? 'b-done' : deliveryStatus === 'Failed' ? 'b-fail' : 'b-pend';
  const payBadgeStyle = payStatus === 'Pending' 
    ? 'background:#FCEAEA;color:#B53030;' 
    : 'background:#E6F4EA;color:#137333;';

  const items = record.items || [];
  const itemsHtml = items.map(item => {
    const qty = Number(item.qty) || 1;
    const price = Number(item.price) || 0;
    const total = qty * price;
    return `
      <tr style="border-bottom:1px solid rgba(0,0,0,0.05); font-size:0.78rem;">
        <td style="padding:0.4rem 0.2rem;">${esc(item.name)}</td>
        <td style="padding:0.4rem 0.2rem; text-align:center;">${qty}</td>
        <td style="padding:0.4rem 0.2rem; text-align:right;">${fmt(price)}</td>
        <td style="padding:0.4rem 0.2rem; text-align:right; font-weight:600;">${fmt(total)}</td>
      </tr>`;
  }).join('');

  const deliveryFee = Number(record.delivery_fee || record.deliveryFee) || 0;
  const discountPct = Number(record.discount) || 0;
  const subtotal = items.reduce((sum, item) => sum + (Number(item.qty) || 1) * (Number(item.price) || 0), 0);
  const discountAmt = (subtotal + deliveryFee) * (discountPct / 100);
    content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
      <div>
        <div style="font-size:1.05rem; font-weight:700; color:var(--ink, #1e293b);">${esc(custName)}</div>
        <div style="font-size:0.75rem; color:var(--muted, #64748b); margin-top:0.15rem;">📅 Date of Sale: ${record.date || ''}</div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.25rem;">
        <span class="badge ${badgeClass}" style="font-size:0.65rem; padding:0.15rem 0.5rem;">${esc(deliveryStatus)}</span>
        <span class="badge" style="font-size:0.65rem; padding:0.15rem 0.5rem; ${payBadgeStyle}">${esc(payStatus)}</span>
      </div>
    </div>

    <div style="background:rgba(0,0,0,0.03); padding:0.65rem 0.75rem; border-radius:8px; margin-bottom:0.75rem; font-size:0.76rem; display:grid; grid-template-columns:1fr 1fr; gap:0.4rem;">
      <div><strong>📝ž Contact:</strong> ${esc(record.contact || 'N/A')}</div>
      <div><strong>📝 Address:</strong> ${esc(record.address || 'N/A')}</div>
      <div><strong>🚚 Expected Delivery:</strong> ${esc(record.expected_delivery || record.delivery || 'N/A')}</div>
      <div><strong>💼¬ Feedback:</strong> ${esc(record.feedback || 'None')}</div>
    </div>

    <div style="margin-bottom:0.75rem;">
      <div style="font-size:0.78rem; font-weight:700; margin-bottom:0.35rem; color:var(--ink, #1e293b);">Items Purchased (${items.length})</div>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="font-size:0.68rem; color:var(--muted, #64748b); border-bottom:1px solid rgba(0,0,0,0.1); text-align:left;">
            <th style="padding-bottom:0.25rem;">Item Name</th>
            <th style="padding-bottom:0.25rem; text-align:center;">Qty</th>
            <th style="padding-bottom:0.25rem; text-align:right;">Unit Price</th>
            <th style="padding-bottom:0.25rem; text-align:right;">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || '<tr><td colspan="4" style="text-align:center; padding:0.5rem; font-size:0.75rem; color:var(--muted);">No items listed</td></tr>'}
        </tbody>
      </table>
    </div>

    <div style="background:rgba(201,152,42,0.08); padding:0.6rem 0.75rem; border-radius:8px; font-size:0.78rem;">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.2rem;"><span>Subtotal:</span> <span>${fmt(subtotal)}</span></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:0.2rem;"><span>Delivery Fee:</span> <span>${fmt(deliveryFee)}</span></div>
      ${discountPct > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:0.2rem; color:var(--red);"><span style="color:var(--red);">Discount (${discountPct}%):</span> <span>- ${fmt(discountAmt)}</span></div>` : ''}
      <div style="display:flex; justify-content:space-between; font-weight:700; font-size:0.92rem; border-top:1px solid rgba(0,0,0,0.12); padding-top:0.3rem; margin-top:0.25rem;">
        <span>Total Amount:</span>
        <span style="color:var(--gold-dark, #a87a1e);">${fmt(record.total)}</span>
      </div>
    </div>
  `;

  if (editBtn) {
    editBtn.onclick = () => {
      closeSaleDetailModal();
      enterSaleEditMode(id);
    };
  }

  modal.style.display = 'flex';
}

function closeSaleDetailModal() {
  const modal = getEl('sale-detail-modal');
  if (modal) modal.style.display = 'none';
}


let IS_EXPENSES_EXPANDED = false;

function toggleExpensesAccordion(forceState) {
  const content = getEl('exp-collapsible-content');
  const chevron = getEl('exp-chevron');
  const toggleBtn = getEl('exp-collapse-toggle');
  if (!content) return;

  if (typeof forceState === 'boolean') {
    IS_EXPENSES_EXPANDED = forceState;
  } else {
    IS_EXPENSES_EXPANDED = !IS_EXPENSES_EXPANDED;
  }

  if (IS_EXPENSES_EXPANDED) {
    content.style.maxHeight = '420px';
    content.style.opacity = '1';
    content.style.overflowY = 'auto';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
  } else {
    content.style.maxHeight = '0';
    content.style.opacity = '0';
    content.style.overflowY = 'hidden';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  }
}

function _renderExpensesList() {
  const list = getEl('exp-list');
  const countBadge = getEl('exp-count-badge');
  if (countBadge) {
    countBadge.textContent = `${(S.expenses || []).length} recorded`;
  }
  if (!list) return;
  if (!S.expenses.length) {
    list.innerHTML = '<li class="empty"><div class="empty-ico">💸</div>No expenses recorded yet.</li>';
    return;
  }
  list.innerHTML = S.expenses.slice(0, 20).map(expense => `
    <li class="li exp-li-compact" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:0.35rem 0.65rem; border-radius:8px; margin-bottom:0.35rem; border:1px solid rgba(0,0,0,0.08); background:var(--bg-surface, #ffffff);" onclick="viewExpenseDetails('${expense.id}')" title="Click to view full expense details">
      <div class="li-body" style="flex:1; min-width:0; padding-right:0.5rem;">
        <div class="li-name" style="font-size:0.8rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(expense.type)}</div>
        <div class="li-sub" style="font-size:0.65rem; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${expense.date}${expense.description ? ' · ' + esc(expense.description) : ''}</div>
      </div>
      <div class="li-right" style="display:flex; align-items:center; gap:0.45rem; flex-shrink:0;">
        <div class="li-amt red" style="font-size:0.82rem; font-weight:700; color:var(--red, #B53030); margin-right:0.2rem;">${fmt(expense.amount)}</div>
        <button type="button" class="btn-ghost" style="padding:0.15rem 0.45rem; font-size:0.68rem; height:24px; border-radius:4px; border:1px solid var(--border, #DDD4BE); color:var(--text, #1C1509); background:var(--cream2, #F3EDE0);" onclick="event.stopPropagation(); enterExpenseEditMode('${expense.id}')" title="Edit Expense">Edit</button>
        <button type="button" class="btn-ghost" style="padding:0.15rem 0.45rem; font-size:0.68rem; height:24px; border-radius:4px; border:1px solid rgba(181,48,48,0.25); color:var(--red, #B53030); background:#FCEAEA;" onclick="event.stopPropagation(); deleteExpense('${expense.id}')" title="Delete Expense">Delete</button>
      </div>
    </li>`).join('');

  if (IS_EXPENSES_EXPANDED) {
    toggleExpensesAccordion(true);
  }
}

function viewExpenseDetails(id) {
  const expense = (S.expenses || []).find(item => String(item.id) === String(id));
  if (!expense) return;

  const modal = getEl('expense-detail-modal');
  const content = getEl('edm-content');
  const editBtn = getEl('edm-edit-btn');
  if (!modal || !content) return;

  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.85rem;">
      <div>
        <div style="font-size:1.1rem; font-weight:700; color:var(--ink, #141009);">${esc(expense.type || 'Expense')}</div>
        <div style="font-size:0.75rem; color:var(--muted, #7A6E58); margin-top:0.15rem;">📅 Date: ${expense.date || ''}</div>
      </div>
      <div>
        <span class="badge b-exp" style="font-size:0.7rem; padding:0.2rem 0.55rem;">Expense</span>
      </div>
    </div>

    <div style="background:rgba(181,48,48,0.06); border:1px solid rgba(181,48,48,0.15); padding:0.75rem 0.85rem; border-radius:8px; margin-bottom:0.85rem; display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:0.8rem; font-weight:600; color:var(--ink, #141009);">Amount Spent:</span>
      <span style="font-size:1.15rem; font-weight:800; color:var(--red, #B53030);">${fmt(expense.amount)}</span>
    </div>

    <div style="background:rgba(0,0,0,0.03); padding:0.75rem; border-radius:8px; font-size:0.78rem;">
      <div style="font-weight:700; color:var(--ink, #141009); margin-bottom:0.25rem;">Description / Notes:</div>
      <div style="color:var(--text, #1C1509); line-height:1.4;">${esc(expense.description || 'No description provided.')}</div>
    </div>
  `;

  const deleteBtn = getEl('edm-delete-btn');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      closeExpenseDetailModal();
      await deleteExpense(id);
    };
  }

  if (editBtn) {
    editBtn.onclick = () => {
      closeExpenseDetailModal();
      enterExpenseEditMode(id);
    };
  }

  modal.style.display = 'flex';
}

function closeExpenseDetailModal() {
  const modal = getEl('expense-detail-modal');
  if (modal) modal.style.display = 'none';
}

/* --- INVENTORY DASHBOARD & MODAL MANAGEMENT --- */
function renderInventoryDashboard() {
  const stock = S.stock || [];
  const totalProducts = stock.length;
  const totalUnits = stock.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const lowStock = stock.filter(item => (Number(item.qty) || 0) <= 5 && (Number(item.qty) || 0) > 0).length;
  const outOfStock = stock.filter(item => (Number(item.qty) || 0) <= 0).length;
  const totalValue = stock.reduce((sum, item) => {
    const price = Number(item.selling_price) || Number(item.cost_price) || 0;
    const qty = Number(item.qty) || 0;
    return sum + (price * qty);
  }, 0);

  const elProducts = getEl('inv-dash-total-products');
  const elUnits = getEl('inv-dash-total-units');
  const elLow = getEl('inv-dash-low-stock');
  const elOut = getEl('inv-dash-out-stock');
  const elValue = getEl('inv-dash-value');
  const elBadge = getEl('inv-stock-count-badge');

  if (elProducts) elProducts.textContent = String(totalProducts);
  if (elUnits) elUnits.textContent = String(totalUnits);
  if (elLow) elLow.textContent = String(lowStock);
  if (elOut) elOut.textContent = String(outOfStock);
  if (elValue) elValue.textContent = fmt(totalValue);
  if (elBadge) elBadge.textContent = String(totalProducts);
}

function openStockListModal() {
  const modal = getEl('stock-list-modal');
  if (!modal) return;
  const searchInput = getEl('stock-modal-search');
  if (searchInput) searchInput.value = '';
  _renderStockModalList();
  modal.style.display = 'flex';
}

function closeStockListModal() {
  const modal = getEl('stock-list-modal');
  if (modal) modal.style.display = 'none';
}

function filterStockModalList() {
  _renderStockModalList();
}

function _renderStockModalList() {
  const listEl = getEl('stock-modal-list');
  const summaryEl = getEl('stock-modal-summary');
  if (!listEl) return;

  const query = (getEl('stock-modal-search')?.value || '').trim().toLowerCase();
  let items = S.stock || [];

  if (query) {
    items = items.filter(p =>
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query)) ||
      (p.sku && p.sku.toLowerCase().includes(query))
    );
  }

  if (summaryEl) {
    summaryEl.textContent = `Showing ${items.length} of ${S.stock.length} products`;
  }

  if (!items.length) {
    listEl.innerHTML = '<li class="empty" style="padding:2rem 1rem;"><div class="empty-ico">📦</div>No matching inventory products found.</li>';
    return;
  }

  listEl.innerHTML = items.map(product => {
    const qty = Number(product.qty) || 0;
    let badgeClass = 'b-done';
    let badgeText = `${qty} in stock`;
    if (qty <= 0) {
      badgeClass = 'b-fail';
      badgeText = 'Out of Stock';
    } else if (qty <= 5) {
      badgeClass = 'b-pend';
      badgeText = `Low Stock: ${qty}`;
    }

    const skuDisplay = product.sku ? `<span style="font-size:0.68rem; color:var(--muted); margin-left:0.3rem;">(SKU: ${esc(product.sku)})</span>` : '';
    const unitDisplay = product.unit ? ` ${esc(product.unit)}` : '';
    const categoryDisplay = product.category ? `<span style="font-size:0.7rem; color:var(--muted);">${esc(product.category)} · </span>` : '';

    return `
      <li class="li" style="display:flex; justify-content:space-between; align-items:center; padding:0.65rem 0.85rem; border-radius:8px; margin-bottom:0.45rem; border:1px solid var(--border); background:#fff;">
        <div class="li-body" style="flex:1; min-width:0; padding-right:0.5rem;">
          <div class="li-name" style="font-size:0.88rem; font-weight:700; color:var(--text);">
            ${esc(product.name)}${skuDisplay}
          </div>
          <div class="li-sub" style="font-size:0.72rem; color:var(--muted); margin-top:0.15rem;">
            ${categoryDisplay}Cost: ${fmt(product.cost_price)} · Sell: <strong style="color:var(--gold);">${product.selling_price ? fmt(product.selling_price) : '—'}</strong>
          </div>
        </div>
        <div class="li-right" style="display:flex; flex-direction:column; align-items:flex-end; gap:0.25rem; flex-shrink:0;">
          <span class="badge ${badgeClass}">${badgeText}${unitDisplay}</span>
          <div style="display:flex; gap:0.35rem; margin-top:0.2rem;">
            <button type="button" class="btn-ghost" style="padding:0.18rem 0.5rem; font-size:0.7rem; height:24px; border-radius:4px; border:1px solid var(--border); color:var(--text); background:var(--cream2);" onclick="enterStockEditModeFromModal('${product.id}')">Edit</button>
            <button type="button" class="btn-ghost" style="padding:0.18rem 0.5rem; font-size:0.7rem; height:24px; border-radius:4px; border:1px solid rgba(181,48,48,0.3); color:var(--red); background:#FCEAEA;" onclick="deleteStockItem('${product.id}')">Delete</button>
          </div>
        </div>
      </li>`;
  }).join('');
}

function enterStockEditModeFromModal(id) {
  closeStockListModal();
  enterStockEditMode(id);
}

async function deleteStockItem(id) {
  if (IS_LOCKED) {
    const perms = (PROFILE && PROFILE.staff_permissions) ? { ...STAFF_PERMS, ...PROFILE.staff_permissions } : STAFF_PERMS;
    if (!perms.can_add_inventory) {
      alert("Access Denied! You do not have permission to delete inventory items.");
      return;
    }
  }

  const product = (S.stock || []).find(item => String(item.id) === String(id));
  const name = product ? product.name : 'this item';
  const oldQty = product ? Number(product.qty) || 0 : 0;

  if (!confirm(`Are you sure you want to delete "${name}" from inventory?`)) return;

  try {
    if (window.sb) {
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { error } = await sb.from('stock').delete().eq('id', id).eq('user_id', user.id);
        if (error && !isNaN(Number(id))) {
          await sb.from('stock').delete().eq('id', Number(id)).eq('user_id', user.id);
        }
        await addAuditLog({
          action: 'stock_manual_delete',
          item_name: name,
          stock_id: id,
          qty_before: oldQty,
          qty_after: 0,
          qty_change: -oldQty,
          note: 'Product deleted from inventory'
        }, user.id);
      }
    }
  } catch (err) {
    console.warn('Supabase stock delete error:', err);
  }

  S.stock = (S.stock || []).filter(item => String(item.id) !== String(id));

  toast('🗑️ Product deleted from inventory!');
  renderAll();
  _renderStockModalList();
}

function _renderStockList() {
  renderInventoryDashboard();
  populateStockDropdowns();
  const modal = getEl('stock-list-modal');
  if (modal && modal.style.display === 'flex') {
    _renderStockModalList();
  }
}

/* --- INSIGHTS --- */
function renderInsights() {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // In staff mode: show only current month's figures
  const salesPool = IS_LOCKED
    ? S.sales.filter(s => (s.date || '').startsWith(thisMonth))
    : S.sales;
  const expPool = IS_LOCKED
    ? S.expenses.filter(e => (e.date || '').startsWith(thisMonth))
    : S.expenses;

  const paidSales = salesPool.filter(s => (s.payment_status || 'Paid') === 'Paid');
  const revenue = paidSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const expenses = expPool.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const profit = revenue - expenses;

  const monthLabel = now.toLocaleString('default', { month: 'long' });

  getEl('ins-rev').textContent = fmt(revenue);
  getEl('ins-rev-sub').textContent = IS_LOCKED ? `${monthLabel} · ${salesPool.length} sale${salesPool.length === 1 ? '' : 's'}` : `${S.sales.length} sale${S.sales.length === 1 ? '' : 's'}`;
  getEl('ins-exp').textContent = fmt(expenses);
  getEl('ins-exp-sub').textContent = IS_LOCKED ? `${monthLabel} · ${expPool.length} entr${expPool.length === 1 ? 'y' : 'ies'}` : `${S.expenses.length} entr${S.expenses.length === 1 ? 'y' : 'ies'}`;
  getEl('ins-profit').textContent = fmt(profit);
  getEl('ins-profit-sub').textContent = profit >= 0 ? 'Positive ✓' : 'Loss ✏️—';

  // Tax card: admin only
  const taxCard = getEl('ins-tax')?.closest('article');
  if (taxCard) taxCard.style.display = IS_LOCKED ? 'none' : '';

  if (!IS_LOCKED) {
    let taxRate = 0;
    if (revenue >= FIRS.high) taxRate = FIRS.rateTop;
    else if (revenue >= FIRS.low) taxRate = FIRS.rateMid;
    const tax = profit > 0 ? profit * taxRate : 0;
    getEl('ins-tax').textContent = fmt(tax);
    getEl('ins-tax-sub').textContent = taxRate === 0 ? 'Exempt < ₦25M' : `${taxRate * 100}% FIRS`;
  }

  // Update the panel label
  const panel = getEl('insights-panel');
  if (panel) panel.setAttribute('aria-label', IS_LOCKED ? `${monthLabel} financial overview` : 'Financial overview');
}

function updateHeroStats() {
  const paidSales = S.sales.filter(s => (s.payment_status || 'Paid') === 'Paid');
  const revenue = paidSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const expenses = S.expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const profit = revenue - expenses;

  getEl('hm-rev').textContent = fmt(revenue);
  getEl('hm-profit').textContent = fmt(profit);
  getEl('hm-count').textContent = String(S.sales.length);
}

function renderReport() {
  const revenue = S.sales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const expenses = S.expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const profit = revenue - expenses;
  let taxRate = 0;
  if (revenue >= FIRS.high) taxRate = FIRS.rateTop;
  else if (revenue >= FIRS.low) taxRate = FIRS.rateMid;
  const tax = profit > 0 ? profit * taxRate : 0;

  const months = {};
  S.sales.forEach(sale => {
    const month = (sale.date || 'Unknown').slice(0, 7);
    if (!months[month]) months[month] = { rev: 0, exp: 0, count: 0 };
    months[month].rev += Number(sale.total) || 0;
    months[month].count += 1;
  });
  S.expenses.forEach(exp => {
    const month = (exp.date || 'Unknown').slice(0, 7);
    if (!months[month]) months[month] = { rev: 0, exp: 0, count: 0 };
    months[month].exp += Number(exp.amount) || 0;
  });

  const sorted = Object.entries(months).sort(([a], [b]) => a.localeCompare(b));
  let rows = '';

  if (sorted.length) {
    rows = sorted.map(([month, data], index) => {
      const monthProfit = data.rev - data.exp;
      return `
        <tr style="background:${index % 2 ? '#fff' : 'var(--cream2)'};cursor:pointer;transition:background 0.2s" 
            onclick="showMonthlySalesDetail('${month}')"
            onmouseover="this.style.background='var(--gold-soft)'"
            onmouseout="this.style.background='${index % 2 ? '#fff' : 'var(--cream2)'}'">
          <td style="font-weight:500">${getMonthName(month)}</td>
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
      <p style="font-size:0.85rem;color:var(--muted);margin-bottom:1rem;">💼¡ Click any month to see detailed sales breakdown</p>
      <div style="overflow-x:auto"><table class="rtbl"><thead><tr><th>Month</th><th>Sales</th><th>Revenue</th><th>Expenses</th><th>Profit</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  const taxCard = getEl('tax-card');
  if (taxCard) {
    taxCard.innerHTML = `
      <h2 class="card-h">Tax Estimation (FIRS)</h2>
      <div class="tax-grid">
        <div class="tg-item"><div class="tg-lbl">Annual Revenue</div><div class="tg-val gold">${fmt(revenue)}</div></div>
        <div class="tg-item"><div class="tg-lbl">Tax Rate</div><div class="tg-val purple">${taxRate * 100}%</div></div>
        <div class="tg-item"><div class="tg-lbl">Estimated Tax</div><div class="tg-val">${fmt(tax)}</div></div>
        <div class="tg-item"><div class="tg-lbl">After-Tax Profit</div><div class="tg-val">${fmt(profit - tax)}</div></div>
      </div>
      <div class="tax-note">Note: Based on Nigerian FIRS rates for SMEs. 0% if revenue < ₦25M.</div>`;
  }
}

/* --- MONTHLY BREAKDOWN DETAIL --- */
function showMonthlySalesDetail(month) {
  const modal = getEl('monthly-detail-modal');
  const contentDiv = getEl('monthly-detail-content');
  const monthSales = (S.sales || []).filter(sale => (sale.date || '').slice(0, 7) === month);
  const monthExpenses = (S.expenses || []).filter(exp => (exp.date || '').slice(0, 7) === month);

  if (!monthSales.length && !monthExpenses.length) {
    toast('No records found for ' + getMonthName(month));
    return;
  }

  // Build unique sorted list of available months for switching
  const allMonthsSet = new Set();
  (S.sales || []).forEach(s => { if (s.date && s.date.length >= 7) allMonthsSet.add(s.date.slice(0, 7)); });
  (S.expenses || []).forEach(e => { if (e.date && e.date.length >= 7) allMonthsSet.add(e.date.slice(0, 7)); });
  if (month) allMonthsSet.add(month);
  const allMonths = Array.from(allMonthsSet).sort().reverse();
  const monthOptions = allMonths.map(m => `<option value="${m}" ${m === month ? 'selected' : ''}>${getMonthName(m)}</option>`).join('');

  const bizName = PROFILE?.business_name || 'My Business';
  const totalRev = monthSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const totalExp = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const profit = totalRev - totalExp;
  const totalQtyAll = monthSales.reduce((sum, s) => sum + (s.items || []).reduce((q, item) => q + Number(item.qty || 1), 0), 0);

  const salesRows = monthSales.length ? monthSales.map((sale, i) => {
    const itemsList = (sale.items || []).map(item => `${esc(item.name)} ×${item.qty}`).join(', ');
    const totalQty = (sale.items || []).reduce((sum, item) => sum + Number(item.qty || 1), 0);
    const payBadge = (sale.payment_status || 'Paid') === 'Pending'
      ? `<span style="display:inline-block;font-size:.55rem;font-weight:700;padding:.1rem .4rem;border-radius:20px;background:#FCEAEA;color:#B53030;text-transform:uppercase;letter-spacing:.04em;margin-left:4px">Unpaid</span>`
      : '';
    return `
      <tr style="background:${i % 2 === 0 ? '#fff' : 'var(--cream2)'}">
        <td style="padding:6px 4px;border-bottom:1px solid var(--border);font-size:.7rem;color:var(--ink3)">${esc(sale.date)}</td>
        <td style="padding:6px 4px;border-bottom:1px solid var(--border);font-size:.7rem;font-weight:600;color:var(--text)">${esc(sale.customer_name)}${payBadge}</td>
        <td style="padding:6px 4px;border-bottom:1px solid var(--border);font-size:.7rem;color:var(--ink3);word-break:break-word">${esc(sale.address || '—')}</td>
        <td style="padding:6px 4px;border-bottom:1px solid var(--border);font-size:.7rem;color:var(--ink3);word-break:break-word">${esc(sale.contact || '—')}</td>
        <td style="padding:6px 4px;border-bottom:1px solid var(--border);font-size:.7rem;color:var(--ink3);word-break:break-word">${itemsList}</td>
        <td style="padding:6px 4px;border-bottom:1px solid var(--border);font-size:.7rem;text-align:center;color:var(--ink3)">${totalQty}</td>
        <td style="padding:6px 4px;border-bottom:1px solid var(--border);font-size:.75rem;font-weight:700;text-align:right;color:var(--gold);font-family:var(--ff-head)">${fmt(sale.total)}</td>
      </tr>`;
  }).join('') : `<tr><td colspan="7" style="padding:1.5rem;text-align:center;color:var(--muted);font-size:.8rem">No sales recorded for ${getMonthName(month)}</td></tr>`;

  const expensesRows = monthExpenses.length
    ? monthExpenses.map((exp, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : 'var(--cream2)'}">
        <td style="padding:6px 4px;border-bottom:1px solid var(--border);font-size:.7rem;color:var(--ink3)">${esc(exp.date)}</td>
        <td style="padding:6px 4px;border-bottom:1px solid var(--border);font-size:.7rem;font-weight:600;color:var(--text)">${esc(exp.type)}</td>
        <td colspan="4" style="padding:6px 4px;border-bottom:1px solid var(--border);font-size:.7rem;color:var(--ink3);word-break:break-word">${esc(exp.description || '—')}</td>
        <td style="padding:6px 4px;border-bottom:1px solid var(--border);font-size:.75rem;font-weight:700;text-align:right;color:var(--red);font-family:var(--ff-head)">${fmt(exp.amount)}</td>
      </tr>`).join('')
    : `<tr><td colspan="7" style="padding:1.5rem;text-align:center;color:var(--muted);font-size:.8rem">No expenses recorded for ${getMonthName(month)}</td></tr>`;

  const thStyle = `padding:6px 4px;text-align:left;font-size:.55rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--cream);background:var(--ink)`;

  const html = `
    <div style="padding:1.5rem">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap;gap:.75rem">
        <div>
          <div style="font-family:var(--ff-head);font-size:1.3rem;font-weight:700;color:var(--ink)">${esc(bizName)}</div>
          <div style="font-size:.8rem;color:var(--muted);margin-top:.15rem;display:flex;align-items:center;gap:0.4rem;">
            <span>Monthly Sales Report:</span>
            <select onchange="showMonthlySalesDetail(this.value)" style="padding:0.25rem 0.5rem; border-radius:6px; font-size:0.78rem; font-weight:700; border:1px solid var(--border); background:#fff; color:var(--ink); cursor:pointer;">
              ${monthOptions}
            </select>
          </div>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          ${(!IS_LOCKED || (PROFILE?.staff_permissions?.can_print_report ?? STAFF_PERMS.can_print_report)) ? `
          <button onclick="printMonthlySalesDetail('${month}')" style="display:inline-flex;align-items:center;gap:.35rem;background:var(--ink);color:var(--gold);border:none;border-radius:6px;padding:.45rem .9rem;font-size:.75rem;font-weight:600;cursor:pointer">🖨️ Print</button>
          <button onclick="downloadMonthlySalesAsPNG('${month}')" style="display:inline-flex;align-items:center;gap:.35rem;background:var(--gold);color:var(--ink);border:none;border-radius:6px;padding:.45rem .9rem;font-size:.75rem;font-weight:700;cursor:pointer">📥 Download PNG</button>
          ` : ''}
          <button onclick="closeMonthlySalesDetail()" style="display:inline-flex;align-items:center;background:transparent;color:var(--muted);border:1.5px solid var(--border);border-radius:6px;padding:.45rem .9rem;font-size:.75rem;font-weight:600;cursor:pointer">✕ Close</button>
        </div>
      </div>

      <!-- Summary Stat Chips for Selected Month -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.625rem;margin-bottom:1.25rem">
        <div style="background:var(--green-bg);border-radius:8px;padding:.75rem;border-left:3px solid var(--green)">
          <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:var(--green);font-weight:700">${getMonthName(month)} Revenue</div>
          <div style="font-family:var(--ff-head);font-size:1.05rem;font-weight:700;color:var(--green);margin-top:.15rem">${fmt(totalRev)}</div>
        </div>
        <div style="background:var(--red-bg);border-radius:8px;padding:.75rem;border-left:3px solid var(--red)">
          <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:var(--red);font-weight:700">${getMonthName(month)} Expenses</div>
          <div style="font-family:var(--ff-head);font-size:1.05rem;font-weight:700;color:var(--red);margin-top:.15rem">${fmt(totalExp)}</div>
        </div>
        <div style="background:${profit >= 0 ? 'var(--green-bg)' : 'var(--red-bg)'};border-radius:8px;padding:.75rem;border-left:3px solid ${profit >= 0 ? 'var(--green)' : 'var(--red)'}">
          <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:${profit >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${getMonthName(month)} Net Profit</div>
          <div style="font-family:var(--ff-head);font-size:1.05rem;font-weight:700;color:${profit >= 0 ? 'var(--green)' : 'var(--red)'};margin-top:.15rem">${fmt(profit)}</div>
        </div>
      </div>

      <!-- Sales Table for Selected Month -->
      <div style="margin-bottom:.5rem;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">Sales Records for ${getMonthName(month)} (${monthSales.length})</div>
      <div style="overflow-x:auto;border-radius:8px;border:1.5px solid var(--border);margin-bottom:1.5rem">
        <table style="width:100%;border-collapse:collapse;min-width:100%">
          <thead>
            <tr>
              <th style="${thStyle};border-radius:6px 0 0 0">Date</th>
              <th style="${thStyle}">Customer Name</th>
              <th style="${thStyle}">Address</th>
              <th style="${thStyle}">Phone</th>
              <th style="${thStyle}">Items Ordered</th>
              <th style="${thStyle};text-align:center">Qty</th>
              <th style="${thStyle};text-align:right;border-radius:0 6px 0 0">Amount (₦)</th>
            </tr>
          </thead>
          <tbody>${salesRows}</tbody>
          <tfoot>
            <tr style="background:var(--ink2)">
              <td colspan="5" style="padding:10px;font-size:.75rem;font-weight:700;color:var(--cream);text-align:right">Total Items Sold in ${getMonthName(month)}:</td>
              <td style="padding:10px;font-size:.88rem;font-weight:700;text-align:center;color:#fff;font-family:var(--ff-head)">${totalQtyAll}</td>
              <td style="padding:10px;font-size:.88rem;font-weight:700;text-align:right;color:var(--gold);font-family:var(--ff-head)">${fmt(totalRev)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Expenses Table for Selected Month -->
      <div style="margin-bottom:.5rem;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">Expense Records for ${getMonthName(month)} (${monthExpenses.length})</div>
      <div style="overflow-x:auto;border-radius:8px;border:1.5px solid var(--border)">
        <table style="width:100%;border-collapse:collapse;min-width:100%">
          <thead>
            <tr>
              <th style="${thStyle};border-radius:6px 0 0 0">Date</th>
              <th style="${thStyle}">Type</th>
              <th colspan="4" style="${thStyle}">Description</th>
              <th style="${thStyle};text-align:right;border-radius:0 6px 0 0">Amount (₦)</th>
            </tr>
          </thead>
          <tbody>${expensesRows}</tbody>
          <tfoot>
            <tr style="background:var(--ink2)">
              <td colspan="6" style="padding:10px;font-size:.82rem;font-weight:700;color:var(--cream);text-align:right">Total Expenses for ${getMonthName(month)}:</td>
              <td style="padding:10px;font-size:.95rem;font-weight:700;text-align:right;color:#ff8a8a;font-family:var(--ff-head)">${fmt(totalExp)}</td>
            </tr>
            <tr style="background:${profit >= 0 ? '#1E6641' : '#B53030'}">
              <td colspan="6" style="padding:10px;font-size:.82rem;font-weight:700;color:#fff;text-align:right">Net Profit (${getMonthName(month)}):</td>
              <td style="padding:10px;font-size:1rem;font-weight:700;text-align:right;color:#fff;font-family:var(--ff-head)">${fmt(profit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`;

  if (contentDiv) contentDiv.innerHTML = html;
  if (modal) modal.style.display = 'flex';
}

function closeMonthlySalesDetail() {
  const modal = getEl('monthly-detail-modal');
  if (modal) modal.style.display = 'none';
}

function getSpreadsheetHTML(month) {
  const monthSales = (S.sales || []).filter(sale => (sale.date || '').slice(0, 7) === month);
  const monthExpenses = (S.expenses || []).filter(exp => (exp.date || '').slice(0, 7) === month);
  if (!monthSales.length && !monthExpenses.length) return null;
  
  const totalRev = monthSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const totalExp = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const profit = totalRev - totalExp;
  const bizName = PROFILE?.business_name || 'My Business';
  
  const salesRows = monthSales.length ? monthSales.map((sale) => {
    const itemsList = (sale.items || []).map(item => `${esc(item.name)} ×${item.qty}`).join(', ');
    const totalQty = (sale.items || []).reduce((sum, item) => sum + Number(item.qty || 1), 0);
    return `
      <tr>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top;">${sale.date}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top;"><strong>${esc(sale.customer_name)}</strong></td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top;">${esc(sale.address || '—')}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top;">${esc(sale.contact || '—')}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top;">${esc(itemsList)}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: center; vertical-align: top;">${totalQty}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: right; vertical-align: top; font-weight:bold">${fmt(sale.total)}</td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="7" style="border:1px solid #000; padding:12px; text-align:center; color:#666;">No sales recorded for ${getMonthName(month)}</td></tr>`;

  const expenseRows = monthExpenses.length ? monthExpenses.map((exp) => {
    return `
      <tr>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top;">${exp.date}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top;"><strong>${esc(exp.type)}</strong></td>
        <td colspan="4" style="border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top;">${esc(exp.description || '—')}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: right; vertical-align: top; font-weight:bold; color:#B53030;">${fmt(exp.amount)}</td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="7" style="border:1px solid #000; padding:12px; text-align:center; color:#666;">No expenses recorded for ${getMonthName(month)}</td></tr>`;

  return `
    <div style="font-family: Arial, sans-serif; background: white; color: #000; font-size: 11px; padding: 20px; width: 800px; box-sizing: border-box;">
      <div style="text-align:center; border: 2px solid #000; padding: 15px; margin-bottom: 15px; background:#fafafa;">
        <h2 style="margin:0 0 5px 0; font-size:22px; text-transform:uppercase; letter-spacing:1px;">${esc(bizName)}</h2>
        <h3 style="margin:0; font-size:15px; color:#333;">Monthly Sales & Financial Report — <strong>${getMonthName(month)}</strong></h3>
      </div>

      <!-- Financial Overview for Selected Month -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px;">
        <thead>
          <tr style="background-color: #f4f4f4;">
            <th style="border: 1px solid #000; padding: 8px; text-align: center;" width="33%">${getMonthName(month)} Revenue</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: center;" width="33%">${getMonthName(month)} Expenses</th>
            <th style="border: 1px solid #000; padding: 8px; text-align: center;" width="34%">${getMonthName(month)} Net Profit</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 10px; text-align: center; font-size: 14px; font-weight: bold; color: green;">${fmt(totalRev)}</td>
            <td style="border: 1px solid #000; padding: 10px; text-align: center; font-size: 14px; font-weight: bold; color: red;">${fmt(totalExp)}</td>
            <td style="border: 1px solid #000; padding: 10px; text-align: center; font-size: 14px; font-weight: bold; color: ${profit >= 0 ? 'green' : 'red'};">${fmt(profit)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Sales Table -->
      <h4 style="margin:15px 0 5px 0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Sales Records for ${getMonthName(month)} (${monthSales.length})</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 15px;">
        <thead>
          <tr style="background-color: #f4f4f4;">
            <th style="border: 1px solid #000; padding: 6px 8px; text-align: left;" width="12%">Date</th>
            <th style="border: 1px solid #000; padding: 6px 8px; text-align: left;" width="18%">Customer Name</th>
            <th style="border: 1px solid #000; padding: 6px 8px; text-align: left;" width="20%">Address</th>
            <th style="border: 1px solid #000; padding: 6px 8px; text-align: left;" width="13%">Phone</th>
            <th style="border: 1px solid #000; padding: 6px 8px; text-align: left;" width="20%">Items Ordered</th>
            <th style="border: 1px solid #000; padding: 6px 8px; text-align: center;" width="5%">Qty</th>
            <th style="border: 1px solid #000; padding: 6px 8px; text-align: right;" width="12%">Amount (₦)</th>
          </tr>
        </thead>
        <tbody>
          ${salesRows}
        </tbody>
        <tfoot>
          <tr style="background-color: #f9f9f9;">
            <th colspan="6" style="text-align: right; font-weight: bold; padding: 8px; border: 1px solid #000;">Total Revenue (${getMonthName(month)}):</th>
            <td style="text-align: right; font-weight: bold; font-size: 11px; padding: 8px; border: 1px solid #000; color:green">${fmt(totalRev)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Expenses Table -->
      <h4 style="margin:15px 0 5px 0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Expense Records for ${getMonthName(month)} (${monthExpenses.length})</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background-color: #f4f4f4;">
            <th style="border: 1px solid #000; padding: 6px 8px; text-align: left;" width="12%">Date</th>
            <th style="border: 1px solid #000; padding: 6px 8px; text-align: left;" width="20%">Expense Type</th>
            <th colspan="4" style="border: 1px solid #000; padding: 6px 8px; text-align: left;">Description</th>
            <th style="border: 1px solid #000; padding: 6px 8px; text-align: right;" width="15%">Amount (₦)</th>
          </tr>
        </thead>
        <tbody>
          ${expenseRows}
        </tbody>
        <tfoot>
          <tr style="background-color: #f9f9f9;">
            <th colspan="6" style="text-align: right; font-weight: bold; padding: 8px; border: 1px solid #000;">Total Expenses (${getMonthName(month)}):</th>
            <td style="text-align: right; font-weight: bold; font-size: 11px; padding: 8px; border: 1px solid #000; color:red">${fmt(totalExp)}</td>
          </tr>
          <tr style="background-color: #eee;">
            <th colspan="6" style="text-align: right; font-weight: bold; padding: 8px; border: 1px solid #000;">Net Profit (${getMonthName(month)}):</th>
            <td style="text-align: right; font-weight: bold; font-size: 12px; padding: 8px; border: 1px solid #000; color:${profit >= 0 ? 'green' : 'red'};">${fmt(profit)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

async function downloadMonthlySalesAsPNG(month) {
  const tableHtml = getSpreadsheetHTML(month);
  if (!tableHtml) return toast('No records to download');
  
  try {
    toast('⏳ Preparing download...');
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.innerHTML = tableHtml;
    document.body.appendChild(container);
    
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true
    });
    
    document.body.removeChild(container);
    
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `biztrack-sales-${month}.png`;
    link.click();
    toast('✅ Downloaded as PNG!');
  } catch (err) {
    console.error('Download error:', err);
    toast('⚠️  Download failed');
  }
}

function printMonthlySalesDetail(month) {
  const tableHtml = getSpreadsheetHTML(month);
  if (!tableHtml) return toast('No records to print');
  try {
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sales Report - ${getMonthName(month)}</title>
        <style>@media print { body { padding: 0; margin: 0; } .no-print { display: none; } }</style>
      </head>
      <body style="margin:0; padding:0;">
        ${tableHtml}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
    toast('🖨️ Opened print preview');
  } catch (err) {
    console.error('Print error:', err);
    toast('⚠️  Print failed');
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
  
  const saveBtn = getEl('btn-save-manual-invoice');
  if (saveBtn) {
    saveBtn.style.display = mode === 'manual' ? 'block' : 'none';
  }
  
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
    } catch (err) { toast('⚠️  Save failed.'); }
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
    const dataUrl = canvas.toDataURL('image/png');
    
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      const { Filesystem } = Capacitor.Plugins;
      const { Share } = Capacitor.Plugins;
      const fileName = `Invoice-${Date.now()}.png`;
      const base64Data = dataUrl.split(',')[1];
      
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: 'CACHE'
      });
      
      await Share.share({
        title: 'BizTrack Invoice',
        url: savedFile.uri,
      });
      toast('✅ Ready to share!');
    } else {
      const link = document.createElement('a');
      link.download = `Invoice-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast('✅ Saved as PNG!');
    }
  } catch (err) { 
    console.error(err);
    toast('⚠️  Image Failed.'); 
  }
}

async function shareInvoicePDF() {
  const view = getEl('invoice-view');
  if (!view) return;
  toast('⌛ Generating PDF...');
  try {
    const canvas = await html2canvas(view, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let renderWidth = pdfWidth;
    let renderHeight = (imgProps.height * pdfWidth) / imgProps.width;

    if (renderHeight > pageHeight) {
      const scale = pageHeight / renderHeight;
      renderHeight = pageHeight;
      renderWidth = pdfWidth * scale;
    }
    const xOffset = (pdfWidth - renderWidth) / 2;
    pdf.addImage(imgData, 'PNG', xOffset, 0, renderWidth, renderHeight);
    
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      const { Filesystem } = Capacitor.Plugins;
      const { Share } = Capacitor.Plugins;
      const fileName = `Invoice-${Date.now()}.pdf`;
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: 'CACHE'
      });
      
      await Share.share({
        title: 'BizTrack Invoice',
        url: savedFile.uri,
      });
      toast('✅ PDF Ready!');
    } else {
      pdf.save(`Invoice-${Date.now()}.pdf`);
      toast('✅ PDF Downloaded!');
    }
  } catch (err) {
    console.error(err);
    toast('⚠️  PDF Failed.');
  }
}

async function saveManualInvoice() {
  if (INVOICE_MODE !== 'manual') return;
  const items = getManualItems();
  if (!items.length) {
    return toast('⚠️  Please add at least one item to the invoice.');
  }

  try {
    toast('⏳ Saving Invoice...');
    const { data: { user } } = await sb.auth.getUser();
    
    const subtotalNoFee = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    const deliveryFee = parseFloat(getEl('man-delivery')?.value) || 0;
    const subtotal = subtotalNoFee + deliveryFee;
    const discount = parseFloat(getEl('man-discount')?.value) || 0;
    const discountAmt = subtotal * discount / 100;
    const total = subtotal - discountAmt;
    
    const payload = {
      user_id: user.id,
      date: todayISO(),
      customer_name: getEl('man-cust-name')?.value || 'Valued Customer',
      contact: '', 
      address: getEl('man-cust-addr')?.value || '',
      items,
      delivery_fee: deliveryFee,
      discount,
      total,
      status: 'Pending',
      payment_status: 'Pending'
    };

    const { error } = await sb.from('sales').insert([payload]);
    if (error) throw error;
    
    toast('✅ Invoice saved to Pending Sales!');
    
    getEl('man-cust-name').value = '';
    getEl('man-cust-addr').value = '';
    getEl('man-delivery').value = 0;
    getEl('man-discount').value = 0;
    const rows = getEl('man-items-rows');
    if (rows) {
      rows.innerHTML = `
        <div class="item-row">
          <input type="text" class="m-iname" placeholder="Item name" oninput="previewInvoice()" />
          <input type="number" class="m-iqty" placeholder="1" value="1" oninput="previewInvoice()" />
          <input type="number" class="m-iprice" placeholder="0.00" oninput="previewInvoice()" />
        </div>
      `;
    }
    
    await loadData();
    renderAll();
    previewInvoice();
    
  } catch (err) {
    console.error('Error saving manual invoice:', err);
    toast('⚠️  Error saving invoice');
  }
}

function previewInvoice() {
  let data = null;
  let deliveryFee = 0;
  let discount = 0;
  let discountAmt = 0;
  let subtotalNoFee = 0;

  if (INVOICE_MODE === 'sale') {
    const id = getEl('inv-sale-sel')?.value;
    data = S.sales.find(s => s.id === id);
    if (data) {
      deliveryFee = parseFloat(data.delivery_fee) || 0;
      discount = parseFloat(data.discount) || 0;
      subtotalNoFee = data.items.reduce((sum, item) => sum + item.qty * item.price, 0);
      const subtotal = subtotalNoFee + deliveryFee;
      discountAmt = subtotal * discount / 100;
    }
  } else {
    const items = getManualItems();
    subtotalNoFee = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    deliveryFee = parseFloat(getEl('man-delivery')?.value) || 0;
    const subtotal = subtotalNoFee + deliveryFee;
    discount = parseFloat(getEl('man-discount')?.value) || 0;
    discountAmt = subtotal * discount / 100;
    data = { 
      id: 'MAN-' + uid().slice(-5).toUpperCase(), 
      date: todayISO(), 
      customer_name: getEl('man-cust-name')?.value || 'Valued Customer', 
      address: getEl('man-cust-addr')?.value || '', 
      items, 
      total: subtotal - discountAmt 
    };
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
  const logoHtml = PROFILE?.logo ? `<img src="${PROFILE.logo}" class="inv-logo-img" alt="Logo">` : `<div class="inv-logo-placeholder">YOURLOGO</div>`;
  const customerPhone = data.contact ? `<div><span style="color:var(--gold);font-weight:600;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px">Phone:</span> ${esc(data.contact)}</div>` : '';
  const customerAddress = data.address ? `<div><span style="color:var(--gold);font-weight:600;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px">Address:</span> ${esc(data.address)}</div>` : '';
  const userEmail = getEl('user-display')?.textContent || 'sales@biztrack.ng';

  const rows = data.items.map((item, idx) => `<tr><td style="width:8%">${idx + 1}</td><td><strong>${esc(item.name)}</strong></td><td style="width:12%">${item.qty}</td><td style="width:18%">${fmt(item.price)}</td><td style="width:20%">${fmt(item.qty * item.price)}</td></tr>`).join('');

  view.innerHTML = `
    <div class="inv-header-flex">
      <div class="inv-biz-info">
        <div class="inv-inv-to-name" style="font-family:var(--ff-head);font-size:1.4rem;font-weight:700;color:var(--ink);margin-bottom:0.25rem">${esc(bizName)}</div>
        <div class="inv-biz-details">
          ${bizAddr ? `<div><span style="color:var(--gold);font-weight:600;text-transform:uppercase;font-size:0.65rem;letter-spacing:0.5px">Address:</span> ${esc(bizAddr)}</div>` : ''}
          ${bizPhone ? `<div><span style="color:var(--gold);font-weight:600;text-transform:uppercase;font-size:0.65rem;letter-spacing:0.5px">Phone:</span> ${esc(bizPhone)}</div>` : ''}
          <div><span style="color:var(--gold);font-weight:600;text-transform:uppercase;font-size:0.65rem;letter-spacing:0.5px">Email:</span> ${esc(userEmail)}</div>
        </div>
      </div>
      <div class="inv-logo-wrap">
        ${logoHtml}
      </div>
    </div>

    <div class="inv-mid-sec">
      <div class="inv-bill-to">
        <h3>Bill To</h3>
        <div class="inv-bill-name">${esc(data.customer_name)}</div>
        <div class="inv-bill-details">
          ${customerPhone}
          ${customerAddress}
        </div>
      </div>
      <div class="inv-meta-sec">
        <div class="inv-large-title">Invoice</div>
        <div class="inv-meta-table">
          <div class="inv-meta-row"><span class="inv-meta-label">Invoice No:</span> <span class="inv-meta-val">#${data.id.toString().slice(-6).toUpperCase()}</span></div>
          <div class="inv-meta-row"><span class="inv-meta-label">Date:</span> <span class="inv-meta-val">${data.date}</span></div>
          <div class="inv-meta-row"><span class="inv-meta-label">Terms:</span> <span class="inv-meta-val" style="color:var(--gold)">Due on Receipt</span></div>
        </div>
      </div>
    </div>

    <table class="inv-tbl">
      <thead>
        <tr>
          <th style="width:8%">No.</th>
          <th>Description</th>
          <th style="width:12%;text-align:right">Qty</th>
          <th style="width:18%;text-align:right">Unit Price</th>
          <th style="width:20%;text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="inv-bottom-sec">
      <div class="inv-bank-box">
        <div class="inv-bank-title">Bank Transfer Details</div>
        <div class="inv-bank-row"><span class="inv-bank-label">Bank:</span> <span style="font-weight:600">${esc(bizBank || '—')}</span></div>
        <div class="inv-bank-row"><span class="inv-bank-label">Account Name:</span> <span style="font-weight:600">${esc(bizAccName || '—')}</span></div>
        <div class="inv-bank-row"><span class="inv-bank-label">Account No:</span> <span style="font-weight:700;color:var(--gold);letter-spacing:0.5px">${esc(bizAccNum || '—')}</span></div>
      </div>
      <div class="inv-totals-sec">
        <div class="inv-tot-row"><span>Sub Total</span><span>${fmt(subtotalNoFee)}</span></div>
        ${deliveryFee > 0 ? `<div class="inv-tot-row"><span>Delivery</span><span>${fmt(deliveryFee)}</span></div>` : ''}
        ${discountAmt > 0 ? `<div class="inv-tot-row" style="color:var(--red)"><span>Discount (${discount}%)</span><span>-${fmt(discountAmt)}</span></div>` : ''}
        <div class="inv-tot-bar"><span>Total</span><span>${fmt(data.total)}</span></div>
      </div>
    </div>

    <div class="inv-thanks-banner" style="margin-bottom:0;">
      Thank you for choosing us!
    </div>
  `;
  view.style.display = 'block';
  if (actions) {
    const canPrint = !IS_LOCKED || (PROFILE?.staff_permissions?.can_print_invoice ?? STAFF_PERMS.can_print_invoice);
    actions.style.display = canPrint ? 'flex' : 'none';
  }
  const editBtn = getEl('btn-edit-invoice');
  if (editBtn) {
    editBtn.style.display = INVOICE_MODE === 'sale' ? 'block' : 'none';
  }
}

function renderProfileBanner(profile) {
  const banner = getEl('profile-banner');
  if (!banner || !profile) return;
  banner.style.display = 'block';
  const logoHtml = profile.logo ? `<img src="${profile.logo}" style="width:32px;height:32px;border-radius:6px;object-fit:contain;background:#fff;border:1px solid var(--border);flex-shrink:0" alt="Logo"/>` : '';
  const bankAccInfo = profile.account_number ? `${esc(profile.account_number)}${profile.bank_name ? ` · ${esc(profile.bank_name)}` : ''}` : 'No Account Set';
  banner.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; padding:0.4rem 0.65rem; background:var(--cream2); border:1px solid var(--border); border-left:3px solid var(--gold); border-radius:8px; margin-bottom:0.4rem;">
       <div style="display:flex; gap:0.45rem; align-items:center; min-width:0; flex:1;">
         ${logoHtml}
         <div style="min-width:0; flex:1;">
           <h3 style="margin:0; font-size:0.82rem; font-weight:700; color:var(--text); line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(profile.business_name || 'My Business')}</h3>
           <div style="font-size:0.65rem; color:var(--muted); line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">📝 ${esc(profile.location || 'No Location Set')}</div>
         </div>
       </div>
       <div style="text-align:right; flex-shrink:0;">
         <div style="font-size:0.55rem; font-weight:800; color:var(--gold); text-transform:uppercase; letter-spacing:0.5px;">Account</div>
         <div style="font-size:0.72rem; font-weight:700; color:var(--ink);">${bankAccInfo}</div>
       </div>
    </div>`;
}

function _renderInvoiceSalesPicker() {
  const listEl = getEl('inv-sales-picker-list');
  if (!listEl) return;

  const query = (getEl('inv-sales-search')?.value || '').trim().toLowerCase();
  let sales = S.sales || [];

  if (query) {
    sales = sales.filter(s =>
      (s.customer_name && s.customer_name.toLowerCase().includes(query)) ||
      (s.contact && s.contact.toLowerCase().includes(query)) ||
      (s.date && s.date.includes(query))
    );
  }

  // Populate hidden select options so previewInvoice works seamlessly
  const selEl = getEl('inv-sale-sel');
  if (selEl) {
    selEl.innerHTML = '<option value="">Choose a sale…</option>' +
      (S.sales || []).map(s => `<option value="${s.id}">${esc(s.customer_name)} - ${s.date} (${fmt(s.total)})</option>`).join('');
  }

  if (!sales.length) {
    listEl.innerHTML = '<li class="empty" style="padding:2rem 1rem; text-align:center;"><div class="empty-ico">📋</div>No recorded sales found for invoicing.</li>';
    return;
  }

  listEl.innerHTML = sales.map(sale => {
    const custName = sale.customer_name || sale.customerName || 'Customer';
    const payStatus = sale.payment_status || sale.paymentStatus || 'Paid';
    const payBadgeStyle = payStatus === 'Pending' ? 'background:#FCEAEA;color:#B53030;' : 'background:#E6F4EA;color:#137333;';
    const itemsSummary = (sale.items || []).map(i => `${i.qty}x ${i.name}`).join(', ');

    return `
      <li class="li" style="display:flex; justify-content:space-between; align-items:center; padding:0.65rem 0.85rem; border-radius:8px; margin-bottom:0.4rem; border:1px solid var(--border); background:#fff; cursor:pointer;" onclick="openInvoiceModalForSale('${sale.id}')" title="Click to pop up invoice on screen">
        <div class="li-body" style="flex:1; min-width:0; padding-right:0.5rem;">
          <div class="li-name" style="font-size:0.88rem; font-weight:700; color:var(--text); display:flex; align-items:center; gap:0.4rem;">
            ${esc(custName)}
            <span class="badge" style="font-size:0.65rem; padding:0.1rem 0.4rem; ${payBadgeStyle}">${esc(payStatus)}</span>
          </div>
          <div class="li-sub" style="font-size:0.72rem; color:var(--muted); margin-top:0.15rem;">
            📅 ${sale.date} · ${esc(itemsSummary)}
          </div>
        </div>
        <div class="li-right" style="display:flex; align-items:center; gap:0.6rem; flex-shrink:0;">
          <div style="font-size:0.92rem; font-weight:700; color:var(--green);">${fmt(sale.total)}</div>
          <button type="button" style="background:linear-gradient(135deg, var(--gold, #C9982A) 0%, #B8851E 100%); color:var(--ink, #141009); border:1px solid var(--gold-lt, #E8BE6A); padding:0.35rem 0.85rem; font-size:0.76rem; font-weight:700; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem;">
            🧾 Generate Invoice
          </button>
        </div>
      </li>`;
  }).join('');
}

function filterInvoiceSalesPicker() {
  _renderInvoiceSalesPicker();
}

function openInvoiceModalForSale(saleId) {
  INVOICE_MODE = 'sale';
  const selEl = getEl('inv-sale-sel');
  if (selEl) selEl.value = saleId;
  const manualContainer = getEl('inv-mode-manual');
  if (manualContainer) manualContainer.style.display = 'none';
  const saveManualBtn = getEl('btn-save-manual-invoice');
  if (saveManualBtn) saveManualBtn.style.display = 'none';
  const editBtn = getEl('btn-edit-invoice');
  if (editBtn) editBtn.style.display = 'inline-flex';

  const titleEl = getEl('invoice-modal-title');
  const record = (S.sales || []).find(s => s.id === saleId);
  if (titleEl && record) titleEl.textContent = `Invoice — ${record.customer_name || 'Sale'}`;

  previewInvoice();
  const modal = getEl('invoice-modal');
  if (modal) modal.style.display = 'flex';
}

function openInvoiceModalManual() {
  INVOICE_MODE = 'manual';
  const manualContainer = getEl('inv-mode-manual');
  if (manualContainer) manualContainer.style.display = 'block';
  const saveManualBtn = getEl('btn-save-manual-invoice');
  if (saveManualBtn) saveManualBtn.style.display = 'inline-flex';
  const editBtn = getEl('btn-edit-invoice');
  if (editBtn) editBtn.style.display = 'none';

  const titleEl = getEl('invoice-modal-title');
  if (titleEl) titleEl.textContent = 'Create Custom / Manual Invoice';

  previewInvoice();
  const modal = getEl('invoice-modal');
  if (modal) modal.style.display = 'flex';
}

function closeInvoiceModal() {
  const modal = getEl('invoice-modal');
  if (modal) modal.style.display = 'none';
}

function renderAll() {
  renderInsights();
  updateHeroStats();
  _renderSalesList();
  _renderExpensesList();
  _renderStockList();
  _renderDeletedSalesList();
  _renderInvoiceSalesPicker();
}

/* --- WIRING --- */
function wireForms() {
  getEl('form-profile')?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const { data: { user } } = await sb.auth.getUser();
      const pinVal = getEl('prof-pin').value.trim();
      if (!/^\d{4}$/.test(pinVal)) {
        return toast('⚠️  PIN must be exactly 4 digits');
      }
      const perms = readStaffPermsFromUI();
      const payload = {
        id: user.id,
        business_name: getEl('prof-biz-name').value.trim(),
        phone_number: getEl('prof-phone').value.trim(),
        location: getEl('prof-loc').value.trim(),
        bank_name: getEl('prof-bank').value.trim(),
        account_number: getEl('prof-acc-num').value.trim(),
        account_name: getEl('prof-acc-name').value.trim(),
        pin: pinVal,
        logo: PROFILE?.logo || null,
        staff_permissions: perms
      };
      if (!payload.business_name) return toast('⚠️  Business Name is required');
      const { error } = await sb.from('profiles').upsert(payload);
      if (error) throw error;
      PROFILE = payload;
      STAFF_PERMS = perms;
      renderProfileBanner(PROFILE);
      toast('✅ Business details & permissions updated!');
      switchTab('sales');
    } catch (err) { 
      console.error(err);
      toast('⚠️  Update failed: ' + (err.message || 'Unknown error')); 
    }
  });

  getEl('form-sale')?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const custName = (getEl('cust-name')?.value || '').trim();
      if (!custName) {
        return toast('⚠️  Customer Name is required');
      }

      const items = getItems();
      if (!items || !items.length) {
        return toast('⚠️  Please add at least one item with a valid name');
      }

      // Check stock availability & prompt if insufficient
      const canProceed = await checkStockValidation(items);
      if (!canProceed) return;

      const userRes = await sb.auth.getUser();
      const user = userRes?.data?.user;
      if (!user) {
        return toast('⚠️  Session expired. Please log in again.');
      }

      const payload = { 
        user_id: user.id,
        date: getEl('sale-date')?.value || todayISO(), 
        customer_name: custName, 
        contact: (getEl('cust-phone')?.value || '').trim(), 
        address: (getEl('cust-address')?.value || '').trim(), 
        items, 
        delivery_fee: parseFloat(getEl('sale-delivery-fee')?.value) || 0, 
        discount: parseFloat(getEl('sale-disc')?.value) || 0, 
        total: 0, 
        status: getEl('sale-status')?.value || 'Pending',
        payment_status: getEl('sale-payment-status')?.value || 'Paid'
      };
      const subtotal = payload.items.reduce((s, i) => s + i.qty * i.price, 0) + payload.delivery_fee;
      const discountAmt = subtotal * payload.discount / 100;
      payload.total = subtotal - discountAmt;
      
      if (SALE_EDIT_ID) {
        const { data: updated, error } = await sb.from('sales').update(payload).eq('id', SALE_EDIT_ID).eq('user_id', user.id).select('*');
        if (error) throw error;
      } else {
        const { error } = await sb.from('sales').insert([payload]);
        if (error) throw error;

        // Automatically deduct quantity from inventory stock
        await deductStockForSale(items);
      }
      await loadData();
      renderAll();
      event.target.reset();
      resetItemRows();
      const message = SALE_EDIT_ID ? '✅ Sale updated!' : '✅ Sale recorded & inventory updated!';
      clearSaleEditMode();
      toast(message);
    } catch (err) { 
      console.error('Error saving sale:', err);
      toast('⚠️  Error saving sale: ' + (err.message || 'Check required fields')); 
    }
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
      
      let error;
      if (EXPENSE_EDIT_ID) {
        const { data: updated, error: updateError } = await sb.from('expenses').update(payload).eq('id', EXPENSE_EDIT_ID).eq('user_id', user.id).select('*');
        if (updateError) throw updateError;
        if (!updated || updated.length === 0) throw new Error('Expense update did not return any updated rows.');
      } else {
        const { error: insertError } = await sb.from('expenses').insert([payload]);
        if (insertError) throw insertError;
      }
      await loadData(); renderAll(); event.target.reset();
      const message = EXPENSE_EDIT_ID ? '✅ Expense updated!' : '✅ Expense saved!';
      clearExpenseEditMode();
      toast(message);
    } catch (err) { toast('⚠️  Error saving expense'); }
  });

  getEl('form-inventory')?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const { data: { user } } = await sb.auth.getUser();
      const payload = { 
        user_id: user.id,
        name: getEl('inv-name').value.trim(), 
        category: getEl('inv-category').value, 
        qty: parseFloat(getEl('inv-qty').value) || 0, 
        unit: getEl('inv-unit').value, 
        cost_price: parseFloat(getEl('inv-cost').value) || 0, 
        selling_price: parseFloat(getEl('inv-sell').value) || 0, 
        added: todayISO() 
      };
      
      if (!payload.name) {
        return toast('⚠️  Product Name is required');
      }

      if (STOCK_EDIT_ID) {
        const oldItem = (S.stock || []).find(item => String(item.id) === String(STOCK_EDIT_ID));
        const oldQty = oldItem ? Number(oldItem.qty) || 0 : 0;
        const { data: updated, error: updateError } = await sb.from('stock').update(payload).eq('id', STOCK_EDIT_ID).eq('user_id', user.id).select('*');
        if (updateError) throw updateError;
        if (!updated || updated.length === 0) throw new Error('Stock update did not return any updated rows.');
        await addAuditLog({
          action: 'stock_manual_update',
          item_name: payload.name,
          stock_id: STOCK_EDIT_ID,
          qty_before: oldQty,
          qty_after: payload.qty,
          qty_change: payload.qty - oldQty,
          note: 'Manual inventory update'
        }, user.id);
      } else {
        const { data: inserted, error: insertError } = await sb.from('stock').insert([payload]).select('*');
        if (insertError) throw insertError;
        const newStockItem = inserted && inserted[0] ? inserted[0] : null;
        await addAuditLog({
          action: 'stock_manual_add',
          item_name: payload.name,
          stock_id: newStockItem ? newStockItem.id : null,
          qty_before: 0,
          qty_after: payload.qty,
          qty_change: payload.qty,
          note: 'Manual inventory addition'
        }, user.id);
      }
      await loadData(); 
      renderAll(); 
      closeAddProductModal(); 
      toast(STOCK_EDIT_ID ? '✅ Stock updated!' : '✅ Stock added to inventory!'); 
    } catch (err) { 
      console.error(err);
      toast('⚠️  Error saving inventory'); 
    }
  });

  getEl('form-settings')?.addEventListener('submit', event => {
    event.preventDefault();
    saveSettings();
  });
}

async function init() {
  const user = await checkAuth();
  if (!user) return;
  try {
    await loadData();
    PROFILE = await loadProfile();
  } catch (err) { toast('⚠️  Load failed.'); }
  renderProfileBanner(PROFILE);
  loadSettings(user.id);
  renderLogoPreview();
  
  // Set and apply lock state
  IS_LOCKED = localStorage.getItem('biztrack_locked') !== 'false';
  applyLockUIState();

  renderAll();
  calcTotals();
  wireForms();
  getEl('input-search')?.addEventListener('input', () => {
    CURRENT_SALES_PAGE = 1;
    _renderSalesList();
  });
  getEl('input-search')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerSalesSearch();
    }
  });
  getEl('input-filter-status')?.addEventListener('change', _renderSalesList);

  document.querySelectorAll('.iname, .iqty, .iprice').forEach(el => el.addEventListener('input', calcTotals));
  getEl('sale-disc')?.addEventListener('input', calcTotals);
  getEl('sale-delivery-fee')?.addEventListener('input', calcTotals);

  getEl('sale-cancel-btn')?.addEventListener('click', clearSaleEditMode);
  getEl('expense-cancel-btn')?.addEventListener('click', clearExpenseEditMode);
  getEl('inventory-cancel-btn')?.addEventListener('click', clearStockEditMode);
}

function editInvoiceSale() {
  if (INVOICE_MODE !== 'sale') return;
  const id = getEl('inv-sale-sel')?.value;
  if (!id) return;
  
  // Check permission
  const perms = IS_LOCKED
    ? { ...STAFF_PERMS, ...(PROFILE?.staff_permissions || {}) }
    : { can_edit_sale: true };
    
  if (!perms.can_edit_sale) {
    alert("Access Denied! You do not have permission to edit sales.");
    return;
  }
  
  enterSaleEditMode(id);
}

/* --- DASHBOARD TRANSACTIONS & FAB ROUTING --- */
function renderLatestTransactions() {
  const txListEl = getEl('dashboard-tx-list');
  if (!txListEl) return;

  const salesTx = S.sales.map(sale => ({
    id: sale.id,
    date: sale.date || '',
    title: sale.customer_name || 'Customer',
    subtitle: (sale.items || []).map(item => `${item.name} ×${item.qty}`).join(', '),
    amount: Number(sale.total) || 0,
    type: 'sale',
    paymentStatus: sale.payment_status || 'Paid',
    status: sale.status || 'Pending'
  }));

  const expensesTx = S.expenses.map(expense => ({
    id: expense.id,
    date: expense.date || '',
    title: expense.type || 'Expense',
    subtitle: expense.description || 'Business Expense',
    amount: Number(expense.amount) || 0,
    type: 'expense'
  }));

  // Combine and sort by date descending, then by id descending (newest first)
  const combined = [...salesTx, ...expensesTx].sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return b.id.localeCompare(a.id);
  });

  // Display up to 30 transactions on the dedicated page
  const latest = combined.slice(0, 30);

  if (latest.length === 0) {
    txListEl.innerHTML = `<li class="empty"><div class="empty-ico">💸</div>No transactions recorded yet.</li>`;
    return;
  }

  // Resolve see_amounts and action permissions for staff mode
  const perms = IS_LOCKED
    ? { ...STAFF_PERMS, ...(PROFILE?.staff_permissions || {}) }
    : { see_amounts: true, can_edit_sale: true, can_delete_sale: true, can_add_expense: true };

  const canEditSale = perms.can_edit_sale;
  const canDeleteSale = perms.can_delete_sale;
  const canEditExpense = perms.can_add_expense;
  const canDeleteExpense = perms.can_add_expense;

  txListEl.innerHTML = latest.map(tx => {
    if (tx.type === 'sale') {
      const payBadge = tx.paymentStatus === 'Pending' ? `<span class="badge" style="background:#FCEAEA;color:#B53030;margin-left:4px">Unpaid</span>` : '';
      const amtDisplay = perms.see_amounts ? `<span class="trans-amt in">${fmt(tx.amount)}</span>` : '<span class="trans-amt" style="visibility:hidden">₦0.00</span>';
      
      const editBtnHtml = canEditSale ? `<button type="button" class="btn-ghost" style="padding:.2rem .4rem;font-size:.65rem" onclick="window.editTx('sale', '${tx.id}')">Edit</button>` : '';
      const deleteBtnHtml = canDeleteSale ? `<button type="button" class="btn-ghost" style="margin-left:.25rem;padding:.2rem .4rem;font-size:.65rem;color:var(--red);border-color:rgba(181,48,48,.2)" onclick="window.deleteTx('sale', '${tx.id}')">Delete</button>` : '';
      const actionHtml = (canEditSale || canDeleteSale) ? `<div style="display:flex;gap:0.25rem;margin-top:0.35rem;justify-content:flex-end">${editBtnHtml}${deleteBtnHtml}</div>` : '';

      return `
        <li class="trans-item" style="align-items: flex-start;">
          <div class="trans-body" style="flex: 1;">
            <span class="trans-title">${esc(tx.title)} ${payBadge}</span>
            <span class="trans-meta">${tx.date} · ${esc(tx.subtitle)}</span>
          </div>
          <div class="trans-right" style="flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end;">
            ${amtDisplay}
            <span class="badge b-done" style="background:var(--gold-soft);color:var(--gold)">Sale</span>
            ${actionHtml}
          </div>
        </li>
      `;
    } else {
      const amtDisplay = perms.see_amounts ? `<span class="trans-amt out">-${fmt(tx.amount)}</span>` : '<span class="trans-amt" style="visibility:hidden">₦0.00</span>';
      
      const editBtnHtml = canEditExpense ? `<button type="button" class="btn-ghost" style="padding:.2rem .4rem;font-size:.65rem" onclick="window.editTx('expense', '${tx.id}')">Edit</button>` : '';
      const deleteBtnHtml = canDeleteExpense ? `<button type="button" class="btn-ghost" style="margin-left:.25rem;padding:.2rem .4rem;font-size:.65rem;color:var(--red);border-color:rgba(181,48,48,.2)" onclick="window.deleteTx('expense', '${tx.id}')">Delete</button>` : '';
      const actionHtml = (canEditExpense || canDeleteExpense) ? `<div style="display:flex;gap:0.25rem;margin-top:0.35rem;justify-content:flex-end">${editBtnHtml}${deleteBtnHtml}</div>` : '';

      return `
        <li class="trans-item" style="align-items: flex-start;">
          <div class="trans-body" style="flex: 1;">
            <span class="trans-title">${esc(tx.title)}</span>
            <span class="trans-meta">${tx.date} · ${esc(tx.subtitle)}</span>
          </div>
          <div class="trans-right" style="flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end;">
            ${amtDisplay}
            <span class="badge b-exp">Expense</span>
            ${actionHtml}
          </div>
        </li>
      `;
    }
  }).join('');
}

function toggleFabMenu(forceState) {
  const menu = getEl('fab-menu-list');
  const btn = getEl('fab-trigger-btn');
  if (!menu || !btn) return;

  const isOpen = menu.classList.contains('open');
  const shouldOpen = (forceState !== undefined) ? forceState : !isOpen;

  if (shouldOpen) {
    menu.style.display = 'flex';
    setTimeout(() => {
      menu.classList.add('open');
      btn.classList.add('open');
    }, 10);
  } else {
    menu.classList.remove('open');
    btn.classList.remove('open');
    setTimeout(() => {
      if (!menu.classList.contains('open')) {
        menu.style.display = 'none';
      }
    }, 220);
  }
}

function handleFabAction(tabName) {
  toggleFabMenu(false);
  switchTab(tabName);
}

function enterInnerApp(tabName) {
  const hero = getEl('hero');
  const main = getEl('main-content');
  const fab = getEl('app-fab');
  
  if (hero) hero.style.display = 'none';
  if (main) main.style.display = 'block';
  if (fab) fab.style.display = 'flex';
  
  switchTab(tabName);
}

function goToLandingPage() {
  const hero = getEl('hero');
  const main = getEl('main-content');
  const fab = getEl('app-fab');
  
  if (main) main.style.display = 'none';
  if (hero) hero.style.display = 'block';
  if (fab) fab.style.display = 'none';
  
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Click away listener to close FAB speed dial
document.addEventListener('click', event => {
  const container = getEl('app-fab');
  if (container && !container.contains(event.target)) {
    toggleFabMenu(false);
  }
});

/* --- SETTINGS & ADMIN SYSTEM --- */
function loadSettings(userId) {
  const saved = localStorage.getItem('biztrack_settings_' + userId);
  if (saved) {
    try {
      SETTINGS = { ...SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Error parsing settings', e);
    }
  }
  applySettingsToUI();
}

function applySettingsToUI() {
  const currencySelect = getEl('setting-currency');
  if (currencySelect) currencySelect.value = SETTINGS.currency || '₦';

  const taxEl = getEl('setting-invoice-tax');
  if (taxEl) taxEl.value = SETTINGS.tax_rate ?? 0;

  const termsSelect = getEl('setting-invoice-terms');
  if (termsSelect) termsSelect.value = SETTINGS.invoice_terms || 'Due on Receipt';

  const notesText = getEl('setting-invoice-notes');
  if (notesText) notesText.value = SETTINGS.invoice_notes || '';
}

function saveSettings() {
  sb.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    
    SETTINGS.currency = getEl('setting-currency')?.value || '₦';
    SETTINGS.tax_rate = parseFloat(getEl('setting-invoice-tax')?.value) || 0;
    SETTINGS.invoice_terms = getEl('setting-invoice-terms')?.value || 'Due on Receipt';
    SETTINGS.invoice_notes = getEl('setting-invoice-notes')?.value || '';
    
    localStorage.setItem('biztrack_settings_' + user.id, JSON.stringify(SETTINGS));
    toast('✅ Settings updated!');
    renderAll();
  });
}

function populateSettingsForm() {
  applySettingsToUI();
}

function populateAdminCenter() {
  _renderDeletedSalesList();
  
  const pinInput = getEl('admin-new-pin');
  if (pinInput) pinInput.value = '';

  if (PROFILE) {
    const perms = PROFILE.staff_permissions || {};
    const merged = { ...STAFF_PERMS, ...perms };
    Object.keys(merged).forEach(key => {
      const el = getEl('perm-' + key);
      if (el) el.checked = !!merged[key];
    });
  }

  // Render the Inventory Control section
  _renderInventoryControlStatus();
}

function toggleTheme(isDark) {
  SETTINGS.theme = isDark ? 'dark' : 'light';
  if (isDark) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  
  const themeToggle = getEl('setting-theme-toggle');
  if (themeToggle) themeToggle.checked = isDark;
  
  sb.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      localStorage.setItem('biztrack_settings_' + user.id, JSON.stringify(SETTINGS));
    }
  });
}

async function changeAdminPin() {
  const pinInput = getEl('admin-new-pin');
  const pinVal = pinInput ? pinInput.value.trim() : '';
  if (!/^\d{4}$/.test(pinVal)) {
    return toast('⚠️  PIN must be exactly 4 digits');
  }
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    
    const payload = {
      ...PROFILE,
      id: user.id,
      pin: pinVal
    };
    const { error } = await sb.from('profiles').upsert(payload);
    if (error) throw error;
    
    PROFILE = payload;
    
    const detailsPin = getEl('prof-pin');
    if (detailsPin) detailsPin.value = pinVal;
    
    pinInput.value = '';
    toast('✅ Owner PIN updated successfully!');
  } catch (err) {
    console.error(err);
    toast('⚠️  Failed to update PIN');
  }
}

async function exportDatabase() {
  try {
    toast('⏳ Generating backup...');
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const [sales, expenses, stock] = await Promise.all([
      sb.from('sales').select('*').eq('user_id', user.id),
      sb.from('expenses').select('*').eq('user_id', user.id),
      sb.from('stock').select('*').eq('user_id', user.id)
    ]);

    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      userId: user.id,
      sales: sales.data || [],
      expenses: expenses.data || [],
      stock: stock.data || []
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `biztrack-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('✅ Backup file downloaded!');
  } catch (err) {
    console.error(err);
    toast('⚠️  Failed to export database');
  }
}

async function importDatabase(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    toast('⏳ Importing data...');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importData = JSON.parse(e.target.result);
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;

        if (!importData.sales || !importData.expenses || !importData.stock) {
          throw new Error('Invalid backup file structure.');
        }

        const salesToUpsert = importData.sales.map(item => ({ ...item, user_id: user.id }));
        const expensesToUpsert = importData.expenses.map(item => ({ ...item, user_id: user.id }));
        const stockToUpsert = importData.stock.map(item => ({ ...item, user_id: user.id }));

        if (salesToUpsert.length > 0) {
          const { error } = await sb.from('sales').upsert(salesToUpsert);
          if (error) throw error;
        }
        if (expensesToUpsert.length > 0) {
          const { error } = await sb.from('expenses').upsert(expensesToUpsert);
          if (error) throw error;
        }
        if (stockToUpsert.length > 0) {
          const { error } = await sb.from('stock').upsert(stockToUpsert);
          if (error) throw error;
        }

        await loadData();
        renderAll();
        toast('✅ Backup restored successfully!');
      } catch (err) {
        console.error(err);
        toast('⚠️  Failed to restore backup: ' + err.message);
      }
    };
    reader.readAsText(file);
  } catch (err) {
    console.error(err);
    toast('⚠️  Error reading backup file');
  } finally {
    event.target.value = '';
  }
}

async function resetDatabase() {
  const text = prompt('WARNING: This will permanently delete ALL sales, expenses, and inventory items. To confirm, type "RESET" below:');
  if (text !== 'RESET') {
    toast('Cancelled database reset.');
    return;
  }

  try {
    toast('⏳ Resetting database...');
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    await Promise.all([
      sb.from('sales').delete().eq('user_id', user.id),
      sb.from('expenses').delete().eq('user_id', user.id),
      sb.from('stock').delete().eq('user_id', user.id)
    ]);

    await loadData();
    renderAll();
    toast('✅ Database reset successfully!');
  } catch (err) {
    console.error(err);
    toast('⚠️  Failed to reset database');
  }
}

async function saveStaffPermissions() {
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const perms = readStaffPermsFromUI();
    const payload = {
      id: user.id,
      business_name: PROFILE?.business_name || 'My Business',
      phone_number: PROFILE?.phone_number || '',
      location: PROFILE?.location || '',
      bank_name: PROFILE?.bank_name || '',
      account_number: PROFILE?.account_number || '',
      account_name: PROFILE?.account_name || '',
      pin: PROFILE?.pin || '1234',
      staff_permissions: perms,
      logo: PROFILE?.logo || ''
    };
    const { error } = await sb.from('profiles').upsert(payload);
    if (error) throw error;
    PROFILE = payload;
    STAFF_PERMS = perms;
    toast('✅ Settings & staff permissions saved!');
  } catch (err) {
    console.error(err);
    toast('⚠️  Failed to save staff permissions');
  }
}

async function deleteExpense(id) {
  if (IS_LOCKED) {
    const perms = (PROFILE && PROFILE.staff_permissions) ? { ...STAFF_PERMS, ...PROFILE.staff_permissions } : STAFF_PERMS;
    if (!perms.can_add_expense) {
      alert("Access Denied! You do not have permission to delete expenses.");
      return;
    }
  }
  
  if (!confirm('Are you sure you want to delete this expense record?')) return;

  try {
    if (window.sb) {
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { error } = await sb.from('expenses').delete().eq('id', id).eq('user_id', user.id);
        if (error && !isNaN(Number(id))) {
          await sb.from('expenses').delete().eq('id', Number(id)).eq('user_id', user.id);
        }
      }
    }
  } catch (err) {
    console.warn('Supabase expense delete warning:', err);
  }

  // Always filter out from in-memory state immediately
  S.expenses = (S.expenses || []).filter(exp => String(exp.id) !== String(id));

  try {
    const localExp = JSON.parse(localStorage.getItem('biztrack_expenses') || '[]');
    const updatedLocal = localExp.filter(exp => String(exp.id) !== String(id));
    localStorage.setItem('biztrack_expenses', JSON.stringify(updatedLocal));
  } catch (e) {}

  toast('🗑️ Expense deleted!');
  renderAll();
}

function editTx(type, id) {
  if (type === 'sale') {
    switchTab('sales');
    enterSaleEditMode(id);
  } else if (type === 'expense') {
    switchTab('expense');
    enterExpenseEditMode(id);
  }
}

async function deleteTx(type, id) {
  if (type === 'sale') {
    await deleteSale(id);
  } else if (type === 'expense') {
    await deleteExpense(id);
  }
}

async function prevSalesPage() {
  if (CURRENT_SALES_PAGE > 1) {
    CURRENT_SALES_PAGE--;
    await _renderSalesList();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

async function nextSalesPage() {
  if (CURRENT_SALES_PAGE < TOTAL_SALES_PAGES) {
    CURRENT_SALES_PAGE++;
    await _renderSalesList();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

document.addEventListener('DOMContentLoaded', init);

/* --- GLOBAL EXPOSURE --- */
function triggerSalesSearch() {
  CURRENT_SALES_PAGE = 1;
  _renderSalesList();
}

function clearSalesSearch() {
  const searchInput = getEl('input-search');
  if (searchInput) searchInput.value = '';
  CURRENT_SALES_PAGE = 1;
  _renderSalesList();
}

window.triggerSalesSearch = triggerSalesSearch;
window.clearSalesSearch = clearSalesSearch;
window.switchTab = switchTab;
window.addItemRow = addItemRow;
window.removeItemRow = removeItemRow;
window.viewSaleDetails = viewSaleDetails;
window.closeSaleDetailModal = closeSaleDetailModal;
window.viewExpenseDetails = viewExpenseDetails;
window.closeExpenseDetailModal = closeExpenseDetailModal;
window.toggleExpensesAccordion = toggleExpensesAccordion;
window.calcTotals = calcTotals;
window.previewInvoice = previewInvoice;
window.handleLogoUpload = handleLogoUpload;
window.toggleInvMode = toggleInvMode;
window.addManualItemRow = addManualItemRow;
window.saveInvoiceAsImage = saveInvoiceAsImage;
window.shareInvoicePDF = shareInvoicePDF;
window.saveManualInvoice = saveManualInvoice;
window.editInvoiceSale = editInvoiceSale;
window.signOut = signOut;
window.enterSaleEditMode = enterSaleEditMode;
window.clearSaleEditMode = clearSaleEditMode;
window.deleteSale = deleteSale;
window.restoreSale = restoreSale;
window.permanentlyDeleteSale = permanentlyDeleteSale;
window.toggleDeletedSalesHistory = toggleDeletedSalesHistory;
window.filterSales = filterSales;
window.markSalePaid = markSalePaid;
window.lockApp = lockApp;
window.unlockApp = unlockApp;
window.enterExpenseEditMode = enterExpenseEditMode;
window.clearExpenseEditMode = clearExpenseEditMode;
window.enterStockEditMode = enterStockEditMode;
window.clearStockEditMode = clearStockEditMode;
window.toggleFabMenu = toggleFabMenu;
window.handleFabAction = handleFabAction;
window.enterInnerApp = enterInnerApp;
window.goToLandingPage = goToLandingPage;
window.toggleTheme = toggleTheme;
window.saveSettings = saveSettings;
window.saveInventoryControl = saveInventoryControl;
window.changeAdminPin = changeAdminPin;
window.exportDatabase = exportDatabase;
window.importDatabase = importDatabase;
window.resetDatabase = resetDatabase;
window.deleteExpense = deleteExpense;
window.editTx = editTx;
window.deleteTx = deleteTx;
window.prevSalesPage = prevSalesPage;
window.nextSalesPage = nextSalesPage;
window.openStockListModal = openStockListModal;
window.closeStockListModal = closeStockListModal;
window.openAddProductModal = openAddProductModal;
window.closeAddProductModal = closeAddProductModal;
window.filterStockModalList = filterStockModalList;
window.deleteStockItem = deleteStockItem;
window.enterStockEditModeFromModal = enterStockEditModeFromModal;
function onStockItemSelect(el) { if (typeof onItemNameInput === "function") onItemNameInput(el); }
window.onStockItemSelect = onStockItemSelect;
window.onItemNameInput = onItemNameInput;
window.populateStockDropdowns = populateStockDropdowns;
window.renderInventoryDashboard = renderInventoryDashboard;
window.openInvoiceModalForSale = openInvoiceModalForSale;
window.openInvoiceModalManual = openInvoiceModalManual;
window.closeInvoiceModal = closeInvoiceModal;
window.filterInvoiceSalesPicker = filterInvoiceSalesPicker;



/* --- UTILITY FEATURES: THANK YOU CARD GENERATOR & INVOICE PICKER --- */
let TY_MODE = 'manual';
let TY_SELECTED_SALE = null;

function openThankYouModal() {
  const modal = getEl('thank-you-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  resetThankYouMode();
}

function closeThankYouModal() {
  const modal = getEl('thank-you-modal');
  if (!modal) return;
  modal.style.display = 'none';
}

function resetThankYouMode() {
  if (getEl('ty-step-options')) getEl('ty-step-options').style.display = 'block';
  if (getEl('ty-step-invoice-picker')) getEl('ty-step-invoice-picker').style.display = 'none';
  if (getEl('ty-step-editor')) getEl('ty-step-editor').style.display = 'none';
  TY_MODE = 'manual';
  TY_SELECTED_SALE = null;
}

function selectThankYouMode(mode) {
  TY_MODE = mode;
  if (mode === 'invoice') {
    openThankYouInvoicePicker();
  } else {
    if (getEl('ty-step-options')) getEl('ty-step-options').style.display = 'none';
    if (getEl('ty-step-invoice-picker')) getEl('ty-step-invoice-picker').style.display = 'none';
    if (getEl('ty-step-editor')) getEl('ty-step-editor').style.display = 'block';

    const badge = getEl('ty-mode-badge');
    if (badge) badge.textContent = '✏️ Manual Creation';

    const banner = getEl('ty-selected-invoice-banner');
    if (banner) banner.style.display = 'none';

    const itemsWrap = getEl('ty-items-preview-wrap');
    if (itemsWrap) itemsWrap.style.display = 'none';
    const cardItemsBox = getEl('ty-card-items-box');
    if (cardItemsBox) cardItemsBox.style.display = 'none';

    if (getEl('ty-cust-name')) getEl('ty-cust-name').value = '';
    if (getEl('ty-note-title')) getEl('ty-note-title').value = 'Thank You for Your Business!';
    if (getEl('ty-message')) getEl('ty-message').value = 'We truly appreciate your patronizing us! It was a pleasure serving you, and we hope to see you again soon.';
    updateThankYouPreview();
  }
}

function openThankYouInvoicePicker() {
  if (getEl('ty-step-options')) getEl('ty-step-options').style.display = 'none';
  if (getEl('ty-step-editor')) getEl('ty-step-editor').style.display = 'none';
  if (getEl('ty-step-invoice-picker')) getEl('ty-step-invoice-picker').style.display = 'block';
  if (getEl('ty-invoice-search')) getEl('ty-invoice-search').value = '';
  renderThankYouInvoicePickerList();
}

function renderThankYouInvoicePickerList() {
  const container = getEl('ty-invoice-picker-list');
  if (!container) return;

  const search = (getEl('ty-invoice-search')?.value || '').toLowerCase().trim();
  let sales = (S?.sales || []).filter(s => !s.is_deleted);

  if (search) {
    sales = sales.filter(s => {
      const name = (s.customerName || s.customer_name || '').toLowerCase();
      const itemsStr = (s.items || []).map(i => (i.name || '').toLowerCase()).join(' ');
      return name.includes(search) || itemsStr.includes(search);
    });
  }

  if (sales.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:1.5rem; color:var(--muted); font-size:0.82rem;">
        ${search ? '🔍 No recorded invoices match your search.' : '🧾 No recorded sales found in your database yet.<br/><span style="font-size:0.75rem;">Record a sale first or use "Create Manually".</span>'}
      </div>`;
    return;
  }

  sales.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  container.innerHTML = sales.map(s => {
    const custName = esc(s.customerName || s.customer_name || 'Customer');
    const totalAmt = fmt(s.total || s.total_amount || 0);
    const dt = s.date ? String(s.date).slice(0, 10) : todayISO();
    const items = s.items || [];
    const itemsSummary = items.length > 0
      ? items.map(i => `${esc(i.name)} ×${i.qty}`).join(', ')
      : 'No item breakdown';
    const status = s.paymentStatus || s.payment_status || 'Paid';
    const isPaid = status === 'Paid';

    return `
      <div class="card" style="padding:0.75rem 0.85rem; border:1px solid var(--border); border-radius:10px; background:#fff; display:flex; justify-content:space-between; align-items:center; gap:0.75rem; cursor:pointer;" onclick="pickThankYouInvoice('${esc(s.id)}')">
        <div style="flex:1; overflow:hidden;">
          <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.2rem;">
            <strong style="font-size:0.88rem; color:var(--ink);">${custName}</strong>
            <span style="font-size:0.65rem; font-weight:700; padding:0.1rem 0.4rem; border-radius:999px; background:${isPaid ? 'var(--green-bg, #E4F2EB)' : 'var(--red-bg, #FCEAEA)'}; color:${isPaid ? 'var(--green, #1E6641)' : 'var(--red, #B53030)'};">${status}</span>
          </div>
          <div style="font-size:0.75rem; color:var(--muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
            📅 ${dt} · 📦 ${itemsSummary}
          </div>
          <div style="font-size:0.82rem; font-weight:700; color:var(--gold); margin-top:0.15rem;">
            ${totalAmt}
          </div>
        </div>
        <button type="button" class="btn-save" onclick="event.stopPropagation(); pickThankYouInvoice('${esc(s.id)}')" style="width:auto; padding:0.35rem 0.75rem; font-size:0.78rem; flex-shrink:0;">
          Select ➔
        </button>
      </div>
    `;
  }).join('');
}

function pickThankYouInvoice(saleId) {
  const sale = (S?.sales || []).find(s => String(s.id) === String(saleId));
  if (!sale) return;

  TY_SELECTED_SALE = sale;
  TY_MODE = 'invoice';

  if (getEl('ty-step-options')) getEl('ty-step-options').style.display = 'none';
  if (getEl('ty-step-invoice-picker')) getEl('ty-step-invoice-picker').style.display = 'none';
  if (getEl('ty-step-editor')) getEl('ty-step-editor').style.display = 'block';

  const badge = getEl('ty-mode-badge');
  if (badge) badge.textContent = '🧾 From Recorded Invoice';

  const banner = getEl('ty-selected-invoice-banner');
  if (banner) banner.style.display = 'block';

  const custName = sale.customerName || sale.customer_name || 'Valued Customer';
  if (getEl('ty-banner-cust')) getEl('ty-banner-cust').textContent = custName;
  if (getEl('ty-banner-details')) {
    const dt = sale.date ? String(sale.date).slice(0, 10) : '';
    const amt = fmt(sale.total || sale.total_amount || 0);
    getEl('ty-banner-details').textContent = `${dt} · ${amt}`;
  }

  if (getEl('ty-cust-name')) getEl('ty-cust-name').value = custName;

  const items = sale.items || [];
  const itemsWrap = getEl('ty-items-preview-wrap');
  const itemsListEl = getEl('ty-items-list');
  const cardItemsBox = getEl('ty-card-items-box');
  const cardItemsContent = getEl('ty-card-items-content');
  const cardTotalRow = getEl('ty-card-total-row');

  if (items.length > 0) {
    const summaryText = items.map(i => `• ${esc(i.name)} ×${i.qty} (${fmt(i.total || (i.qty * (i.price || 0)))})`).join('<br/>');
    if (itemsListEl) itemsListEl.innerHTML = summaryText;
    if (itemsWrap) itemsWrap.style.display = 'block';

    if (cardItemsContent) cardItemsContent.innerHTML = summaryText;
    if (cardTotalRow) cardTotalRow.innerHTML = `Total Amount: ${fmt(sale.total || sale.total_amount || 0)}`;
    if (cardItemsBox) cardItemsBox.style.display = 'block';
  } else {
    if (itemsWrap) itemsWrap.style.display = 'none';
    if (cardItemsBox) cardItemsBox.style.display = 'none';
  }

  updateThankYouPreview();
}

function updateThankYouPreview() {
  const bizName = PROFILE?.businessName || PROFILE?.business_name || 'BizTrack Business';
  const custNameInput = getEl('ty-cust-name')?.value.trim();
  const headerInput = getEl('ty-note-title')?.value.trim() || 'Thank You for Your Business!';
  const msgInput = getEl('ty-message')?.value.trim() || 'We truly appreciate your patronizing us! It was a pleasure serving you, and we hope to see you again soon.';

  if (getEl('ty-card-biz-name')) getEl('ty-card-biz-name').textContent = bizName;
  if (getEl('ty-card-cust-name')) getEl('ty-card-cust-name').textContent = custNameInput || 'Valued Customer';
  if (getEl('ty-card-header')) getEl('ty-card-header').textContent = headerInput;
  if (getEl('ty-card-msg-text')) getEl('ty-card-msg-text').textContent = msgInput;

  const phone = PROFILE?.phoneNumber || PROFILE?.phone_number || '';
  if (getEl('ty-card-phone')) getEl('ty-card-phone').textContent = phone ? ('📞 ' + phone) : '📞 BizTrack Business';
  if (getEl('ty-card-date')) getEl('ty-card-date').textContent = '📅 ' + todayISO();
}

async function downloadThankYouPNG() {
  const cardEl = getEl('thank-you-card-render');
  if (!cardEl) return;
  if (typeof html2canvas !== 'function') {
    return alert('HTML2Canvas library is loading. Please try again in a moment.');
  }

  try {
    toast('⏳ Generating Thank You Card image...');
    const canvas = await html2canvas(cardEl, { scale: 2, useCORS: true, backgroundColor: null });
    const custName = (getEl('ty-cust-name')?.value || 'customer').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const link = document.createElement('a');
    link.download = `thank-you-card-${custName}-${todayISO()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('💌 Thank You Card downloaded!');
  } catch (err) {
    console.error('Download error:', err);
    toast('⚠️ Image Download Failed');
  }
}

function shareThankYouWhatsApp() {
  const bizName = PROFILE?.businessName || PROFILE?.business_name || 'BizTrack Business';
  const custName = getEl('ty-cust-name')?.value.trim() || 'Valued Customer';
  const header = getEl('ty-card-header')?.textContent || 'Thank You!';
  const msg = getEl('ty-card-msg-text')?.textContent || '';

  let text = `💌 *${header}*

Dear *${custName}*,

${msg}

`;

  if (TY_MODE === 'invoice' && TY_SELECTED_SALE) {
    const items = TY_SELECTED_SALE.items || [];
    if (items.length > 0) {
      text += `*Order Summary:*
`;
      items.forEach(i => {
        text += `• ${i.name} ×${i.qty} (${fmt(i.total || (i.qty * i.price))})
`;
      });
      text += `*Total Amount:* ${fmt(TY_SELECTED_SALE.total || TY_SELECTED_SALE.total_amount || 0)}

`;
    }
  }

  text += `Warm regards,
*${bizName}*
`;
  if (PROFILE?.phoneNumber) text += `📞 Phone: ${PROFILE.phoneNumber}
`;

  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}

window.openThankYouModal = openThankYouModal;
window.closeThankYouModal = closeThankYouModal;
window.resetThankYouMode = resetThankYouMode;
window.selectThankYouMode = selectThankYouMode;
window.openThankYouInvoicePicker = openThankYouInvoicePicker;
window.renderThankYouInvoicePickerList = renderThankYouInvoicePickerList;
window.pickThankYouInvoice = pickThankYouInvoice;
window.updateThankYouPreview = updateThankYouPreview;
window.downloadThankYouPNG = downloadThankYouPNG;
window.shareThankYouWhatsApp = shareThankYouWhatsApp;