const fs = require('fs');

let js = fs.readFileSync('public/app.js', 'utf8');

const completeUtilityFunctions = `
/* --- UTILITY FEATURES MODAL HANDLERS --- */
function openUtilityFeaturesModal() {
  const modal = getEl('utility-features-modal');
  if (!modal) return;
  modal.style.display = 'flex';
}

function closeUtilityFeaturesModal() {
  const modal = getEl('utility-features-modal');
  if (!modal) return;
  modal.style.display = 'none';
}

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
    container.innerHTML = \`
      <div style="text-align:center; padding:1.5rem; color:var(--muted); font-size:0.82rem;">
        \${search ? '🔍 No recorded invoices match your search.' : '🧾 No recorded sales found in your database yet.<br/><span style="font-size:0.75rem;">Record a sale first or use "Create Manually".</span>'}
      </div>\`;
    return;
  }

  sales.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  container.innerHTML = sales.map(s => {
    const custName = esc(s.customerName || s.customer_name || 'Customer');
    const totalAmt = fmt(s.total || s.total_amount || 0);
    const dt = s.date ? String(s.date).slice(0, 10) : todayISO();
    const items = s.items || [];
    const itemsSummary = items.length > 0
      ? items.map(i => \`\${esc(i.name)} ×\${i.qty}\`).join(', ')
      : 'No item breakdown';
    const status = s.paymentStatus || s.payment_status || 'Paid';
    const isPaid = status === 'Paid';

    return \`
      <div class="card" style="padding:0.75rem 0.85rem; border:1px solid var(--border); border-radius:10px; background:#fff; display:flex; justify-content:space-between; align-items:center; gap:0.75rem; cursor:pointer;" onclick="pickThankYouInvoice('\${esc(s.id)}')">
        <div style="flex:1; overflow:hidden;">
          <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.2rem;">
            <strong style="font-size:0.88rem; color:var(--ink);">\${custName}</strong>
            <span style="font-size:0.65rem; font-weight:700; padding:0.1rem 0.4rem; border-radius:999px; background:\${isPaid ? 'var(--green-bg, #E4F2EB)' : 'var(--red-bg, #FCEAEA)'}; color:\${isPaid ? 'var(--green, #1E6641)' : 'var(--red, #B53030)'};">\${status}</span>
          </div>
          <div style="font-size:0.75rem; color:var(--muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
            📅 \${dt} · 📦 \${itemsSummary}
          </div>
          <div style="font-size:0.82rem; font-weight:700; color:var(--gold); margin-top:0.15rem;">
            \${totalAmt}
          </div>
        </div>
        <button type="button" class="btn-save" onclick="event.stopPropagation(); pickThankYouInvoice('\${esc(s.id)}')" style="width:auto; padding:0.35rem 0.75rem; font-size:0.78rem; flex-shrink:0;">
          Select ➔
        </button>
      </div>
    \`;
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
    getEl('ty-banner-details').textContent = \`\${dt} · \${amt}\`;
  }

  if (getEl('ty-cust-name')) getEl('ty-cust-name').value = custName;

  const items = sale.items || [];
  const itemsWrap = getEl('ty-items-preview-wrap');
  const itemsListEl = getEl('ty-items-list');
  const cardItemsBox = getEl('ty-card-items-box');
  const cardItemsContent = getEl('ty-card-items-content');
  const cardTotalRow = getEl('ty-card-total-row');

  if (items.length > 0) {
    const summaryText = items.map(i => \`• \${esc(i.name)} ×\${i.qty} (\${fmt(i.total || (i.qty * (i.price || 0)))})\`).join('<br/>');
    if (itemsListEl) itemsListEl.innerHTML = summaryText;
    if (itemsWrap) itemsWrap.style.display = 'block';

    if (cardItemsContent) cardItemsContent.innerHTML = summaryText;
    if (cardTotalRow) cardTotalRow.innerHTML = \`Total Amount: \${fmt(sale.total || sale.total_amount || 0)}\`;
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
    link.download = \`thank-you-card-\${custName}-\${todayISO()}.png\`;
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

  let text = \`💌 *\${header}*\n\nDear *\${custName}*,\n\n\${msg}\n\n\`;

  if (TY_MODE === 'invoice' && TY_SELECTED_SALE) {
    const items = TY_SELECTED_SALE.items || [];
    if (items.length > 0) {
      text += \`*Order Summary:*\n\`;
      items.forEach(i => {
        text += \`• \${i.name} ×\${i.qty} (\${fmt(i.total || (i.qty * i.price))})\n\`;
      });
      text += \`*Total Amount:* \${fmt(TY_SELECTED_SALE.total || TY_SELECTED_SALE.total_amount || 0)}\n\n\`;
    }
  }

  text += \`Warm regards,\n*\${bizName}*\n\`;
  if (PROFILE?.phoneNumber) text += \`📞 Phone: \${PROFILE.phoneNumber}\n\`;

  const encoded = encodeURIComponent(text);
  window.open(\`https://wa.me/?text=\${encoded}\`, '_blank');
}

window.openUtilityFeaturesModal = openUtilityFeaturesModal;
window.closeUtilityFeaturesModal = closeUtilityFeaturesModal;
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
`;

const marker1 = js.indexOf('/* --- UTILITY FEATURES MODAL HANDLERS ---');
const marker2 = js.indexOf('/* --- UTILITY FEATURES: THANK YOU CARD GENERATOR');

let cutoff = -1;
if (marker1 !== -1) cutoff = marker1;
else if (marker2 !== -1) cutoff = marker2;

if (cutoff !== -1) {
  js = js.substring(0, cutoff) + completeUtilityFunctions.trim();
} else {
  js += `\n${completeUtilityFunctions}`;
}

fs.writeFileSync('public/app.js', js, 'utf8');
console.log('Fixed public/app.js with complete utility functions!');

// Sync to www
fs.copyFileSync('public/app.js', 'public/www/app.js');
fs.copyFileSync('public/index.html', 'public/www/index.html');
console.log('Synced to public/www/');
