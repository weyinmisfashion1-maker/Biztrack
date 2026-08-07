const fs = require('fs');

// === 1. UPDATE public/index.html ===
let html = fs.readFileSync('public/index.html', 'utf8');

// Insert Utility Features section after Quick Actions section (around line 1646)
const utilitySectionHTML = `
    <!-- UTILITY FEATURES -->
    <section style="margin-top: 1rem;">
      <h3 class="card-h" style="margin-bottom: 0.35rem; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--gold);">Utility Features</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.75rem;">
        <!-- THANK YOU CARD -->
        <div class="qa-card" id="qa-thank-you-card" style="padding: 1rem; text-align: left; align-items: flex-start; gap: 0.5rem; flex-direction: column;" onclick="openThankYouModal()">
          <div style="display: flex; align-items: center; gap: 0.6rem; width: 100%;">
            <div class="qa-icon" style="width: 36px; height: 36px; font-size: 1.3rem;">💌</div>
            <div style="flex: 1;">
              <div class="qa-lbl" style="font-size: 0.88rem; font-weight: 700; text-align: left;">Thank You Card</div>
              <span style="font-size: 0.72rem; color: var(--muted);">Customer Appreciation & Receipt Notes</span>
            </div>
          </div>
          <p style="font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem;">Generate and send custom branded Thank You notes directly to your clients.</p>
          <button type="button" class="btn-save" style="width: 100%; margin-top: 0.5rem; padding: 0.45rem; font-size: 0.8rem; text-align: center; display: flex; justify-content: center; align-items: center; gap: 0.35rem;" onclick="event.stopPropagation(); openThankYouModal();">
            <span>💌</span> Create Thank You Card
          </button>
        </div>
      </div>
    </section>`;

if (!html.includes('id="qa-thank-you-card"')) {
  const qaEndRegex = /(<\/section>\s*<\/section>\s*<!-- TABS)/;
  html = html.replace(qaEndRegex, `${utilitySectionHTML}\n  </section>\n\n  <!-- TABS`);
}

// Insert Modal HTML before <!-- Toast -->
const modalHTML = `
<!-- MODAL: THANK YOU CARD GENERATOR -->
<div id="thank-you-modal" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.65); z-index:999; align-items:center; justify-content:center; overflow-y:auto; padding:1rem;" onclick="if(event.target === this) closeThankYouModal()">
  <div class="card" style="max-width:540px; width:100%; padding:1.25rem; border-radius:16px; position:relative; background:var(--cream, #faf6ef); box-shadow:0 12px 40px rgba(0,0,0,0.3); border:1px solid var(--border);">
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:0.65rem; margin-bottom:0.85rem;">
      <h2 style="font-size:1.15rem; font-weight:700; margin:0; color:var(--ink); display:flex; align-items:center; gap:0.4rem;">💌 Thank You Card Generator</h2>
      <button type="button" onclick="closeThankYouModal()" style="background:transparent; border:none; font-size:1.2rem; cursor:pointer; color:var(--muted); line-height:1; padding:0.2rem 0.5rem;">✕</button>
    </div>

    <!-- STEP 1: OPTIONS CHOICE (Create Manually vs Choose from Invoice) -->
    <div id="ty-step-options" style="display:block;">
      <p style="font-size:0.82rem; color:var(--muted); margin-bottom:1rem;">How would you like to create your Thank You card?</p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
        <div class="qa-card" onclick="selectThankYouMode('manual')" style="padding:1.25rem 0.85rem; text-align:center; align-items:center; cursor:pointer; border:1.5px solid var(--border);">
          <div class="qa-icon" style="width:44px; height:44px; font-size:1.5rem; margin-bottom:0.4rem;">✏️</div>
          <strong style="font-size:0.9rem; color:var(--text); margin-bottom:0.25rem; display:block;">Create Manually</strong>
          <span style="font-size:0.72rem; color:var(--muted); line-height:1.35;">Write a custom message and enter customer details from scratch.</span>
        </div>

        <div class="qa-card" onclick="selectThankYouMode('invoice')" style="padding:1.25rem 0.85rem; text-align:center; align-items:center; cursor:pointer; border:1.5px solid var(--border);">
          <div class="qa-icon" style="width:44px; height:44px; font-size:1.5rem; margin-bottom:0.4rem;">🧾</div>
          <strong style="font-size:0.9rem; color:var(--text); margin-bottom:0.25rem; display:block;">Choose from Invoice</strong>
          <span style="font-size:0.72rem; color:var(--muted); line-height:1.35;">Auto-fill customer name & purchased items from your recorded sales.</span>
        </div>
      </div>
    </div>

    <!-- STEP 2: EDITOR & PREVIEW -->
    <div id="ty-step-editor" style="display:none;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
        <button type="button" class="btn-ghost" onclick="resetThankYouMode()" style="width:auto; padding:0.25rem 0.6rem; font-size:0.75rem;">← Change Option</button>
        <span id="ty-mode-badge" style="font-size:0.72rem; font-weight:600; color:var(--gold); text-transform:uppercase; letter-spacing:0.5px;"></span>
      </div>

      <!-- Invoice Selector (Only shown if mode === 'invoice') -->
      <div id="ty-invoice-select-group" class="field" style="display:none; margin-bottom:0.75rem;">
        <label for="ty-sale-select" style="font-weight:600; font-size:0.78rem;">Select Sale / Invoice:</label>
        <select id="ty-sale-select" onchange="onThankYouSaleSelected()" style="width:100%;">
          <!-- Populated dynamically -->
        </select>
      </div>

      <!-- Inputs -->
      <div class="row2" style="gap:0.5rem; margin-bottom:0.5rem;">
        <div class="field">
          <label for="ty-cust-name" style="font-size:0.75rem;">Customer Name:</label>
          <input type="text" id="ty-cust-name" placeholder="e.g. Mrs. Blessing" oninput="updateThankYouPreview()" />
        </div>
        <div class="field">
          <label for="ty-note-title" style="font-size:0.75rem;">Card Header / Title:</label>
          <input type="text" id="ty-note-title" value="Thank You for Your Business!" oninput="updateThankYouPreview()" />
        </div>
      </div>

      <div class="field" style="margin-bottom:0.5rem;">
        <label for="ty-message" style="font-size:0.75rem;">Thank You Message:</label>
        <textarea id="ty-message" style="min-height:55px; font-size:0.82rem;" placeholder="Write a warm thank you message..." oninput="updateThankYouPreview()">We truly appreciate your patronizing us! It was a pleasure serving you, and we hope to see you again soon.</textarea>
      </div>

      <!-- Items Summary Box (Hidden if manual or no items) -->
      <div id="ty-items-preview-wrap" style="display:none; margin-bottom:0.5rem; background:#fff; padding:0.5rem; border-radius:8px; border:1px solid var(--border);">
        <div style="font-size:0.7rem; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:0.25rem;">Purchased Items:</div>
        <div id="ty-items-list" style="font-size:0.78rem; color:var(--text);"></div>
      </div>

      <!-- LIVE PREVIEW CARD CONTAINER -->
      <div style="margin-top:0.75rem;">
        <label style="font-size:0.75rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:0.35rem;">Card Preview:</label>
        <div id="thank-you-card-render" style="background:linear-gradient(135deg, #141009 0%, #2A2215 100%); color:#FAF6EF; padding:1.5rem; border-radius:16px; border:2px solid #C9982A; box-shadow:0 8px 24px rgba(0,0,0,0.25); text-align:center; position:relative; overflow:hidden;">
          <div style="position:absolute; top:-20px; right:-20px; width:90px; height:90px; background:rgba(201,152,42,0.12); border-radius:50%; pointer-events:none;"></div>
          
          <!-- Business Name -->
          <div id="ty-card-biz-name" style="font-family:'Playfair Display', Georgia, serif; font-size:1.3rem; font-weight:700; color:#C9982A; margin-bottom:0.2rem; letter-spacing:0.5px;">BizTrack Business</div>
          <div id="ty-card-biz-tag" style="font-size:0.7rem; color:rgba(250,246,239,0.6); text-transform:uppercase; letter-spacing:1px; margin-bottom:1rem;">Official Customer Appreciation</div>
          
          <!-- Heart Icon -->
          <div style="font-size:2rem; margin-bottom:0.5rem; text-shadow:0 0 10px rgba(201,152,42,0.5);">💌</div>

          <!-- Header Title -->
          <h3 id="ty-card-header" style="font-family:'Playfair Display', Georgia, serif; font-size:1.1rem; color:#E8BE6A; margin-bottom:0.6rem;">Thank You for Your Patronage!</h3>
          
          <!-- Customer Name -->
          <div style="font-size:0.85rem; color:#FAF6EF; font-weight:600; margin-bottom:0.5rem;">
            Dear <span id="ty-card-cust-name" style="color:#E8BE6A; text-decoration:underline;">Valued Customer</span>,
          </div>

          <!-- Message -->
          <p id="ty-card-msg-text" style="font-size:0.82rem; line-height:1.5; color:rgba(250,246,239,0.9); margin:0 auto 1rem; max-width:420px; font-style:italic;">
            We truly appreciate your patronizing us! It was a pleasure serving you, and we hope to see you again soon.
          </p>

          <!-- Items Purchased Box inside Card (If applicable) -->
          <div id="ty-card-items-box" style="display:none; background:rgba(255,255,255,0.06); border:1px dashed rgba(201,152,42,0.3); border-radius:10px; padding:0.65rem; margin-bottom:1rem; text-align:left;">
            <div style="font-size:0.65rem; font-weight:700; color:#C9982A; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.3rem;">Order Summary:</div>
            <div id="ty-card-items-content" style="font-size:0.75rem; color:rgba(250,246,239,0.85); line-height:1.4;"></div>
            <div id="ty-card-total-row" style="font-size:0.8rem; font-weight:700; color:#E8BE6A; margin-top:0.35rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:0.3rem; text-align:right;"></div>
          </div>

          <!-- Footer / Contact -->
          <div style="border-top:1px solid rgba(201,152,42,0.25); padding-top:0.75rem; margin-top:0.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; font-size:0.7rem; color:rgba(250,246,239,0.65);">
            <div id="ty-card-phone">📞 Contact Us</div>
            <div id="ty-card-date">📅 Date</div>
          </div>
        </div>
      </div>

      <!-- ACTION BUTTONS -->
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-top:1.1rem; border-top:1px solid var(--border); padding-top:0.85rem; flex-wrap:wrap;">
        <button type="button" class="btn-ghost" onclick="closeThankYouModal()" style="width:auto; padding:0.4rem 0.85rem; font-size:0.8rem;">Close</button>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          <button type="button" class="btn-save" onclick="downloadThankYouPNG()" style="width:auto; padding:0.4rem 0.85rem; font-size:0.8rem; background:var(--ink); color:var(--gold); border:1px solid var(--gold);">📥 Download PNG</button>
          <button type="button" class="btn-save" onclick="shareThankYouWhatsApp()" style="width:auto; padding:0.4rem 0.85rem; font-size:0.8rem; background:#25D366; color:#fff; border:none;">📱 Share WhatsApp</button>
        </div>
      </div>
    </div>

  </div>
</div>
`;

if (!html.includes('id="thank-you-modal"')) {
  html = html.replace('<!-- Toast -->', `${modalHTML}\n<!-- Toast -->`);
}

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Updated public/index.html with Utility Features & Thank You Modal');


// === 2. UPDATE public/app.js ===
let js = fs.readFileSync('public/app.js', 'utf8');

const thankYouJSCode = `
/* --- UTILITY FEATURES: THANK YOU CARD GENERATOR --- */
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
  if (getEl('ty-step-editor')) getEl('ty-step-editor').style.display = 'none';
  TY_MODE = 'manual';
  TY_SELECTED_SALE = null;
}

function selectThankYouMode(mode) {
  TY_MODE = mode;
  if (getEl('ty-step-options')) getEl('ty-step-options').style.display = 'none';
  if (getEl('ty-step-editor')) getEl('ty-step-editor').style.display = 'block';

  const badge = getEl('ty-mode-badge');
  const selGroup = getEl('ty-invoice-select-group');
  const itemsWrap = getEl('ty-items-preview-wrap');
  const cardItemsBox = getEl('ty-card-items-box');

  if (mode === 'invoice') {
    if (badge) badge.textContent = '🧾 From Sale / Invoice';
    if (selGroup) selGroup.style.display = 'block';
    populateThankYouSalesDropdown();
  } else {
    if (badge) badge.textContent = '✏️ Manual Creation';
    if (selGroup) selGroup.style.display = 'none';
    if (itemsWrap) itemsWrap.style.display = 'none';
    if (cardItemsBox) cardItemsBox.style.display = 'none';
    
    if (getEl('ty-cust-name')) getEl('ty-cust-name').value = '';
    if (getEl('ty-note-title')) getEl('ty-note-title').value = 'Thank You for Your Business!';
    if (getEl('ty-message')) getEl('ty-message').value = 'We truly appreciate your patronizing us! It was a pleasure serving you, and we hope to see you again soon.';
    updateThankYouPreview();
  }
}

function populateThankYouSalesDropdown() {
  const sel = getEl('ty-sale-select');
  if (!sel) return;
  sel.innerHTML = '';

  const sales = (S?.sales || []).filter(s => !s.is_deleted);
  if (sales.length === 0) {
    sel.innerHTML = '<option value="">No recorded sales found</option>';
    onThankYouSaleSelected();
    return;
  }

  sales.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  sel.innerHTML = sales.map(s => {
    const custName = esc(s.customerName || s.customer_name || 'Customer');
    const amt = fmt(s.total || s.total_amount || 0);
    const dt = s.date ? String(s.date).slice(0, 10) : '';
    return \`<option value="\${esc(s.id)}">\${dt} — \${custName} (\${amt})</option>\`;
  }).join('');

  onThankYouSaleSelected();
}

function onThankYouSaleSelected() {
  const sel = getEl('ty-sale-select');
  if (!sel) return;
  const saleId = sel.value;
  const sale = (S?.sales || []).find(s => String(s.id) === String(saleId));

  const itemsWrap = getEl('ty-items-preview-wrap');
  const itemsListEl = getEl('ty-items-list');
  const cardItemsBox = getEl('ty-card-items-box');
  const cardItemsContent = getEl('ty-card-items-content');
  const cardTotalRow = getEl('ty-card-total-row');

  if (sale) {
    TY_SELECTED_SALE = sale;
    const custName = sale.customerName || sale.customer_name || '';
    if (getEl('ty-cust-name')) getEl('ty-cust-name').value = custName;

    const items = sale.items || [];
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
  } else {
    TY_SELECTED_SALE = null;
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

window.openThankYouModal = openThankYouModal;
window.closeThankYouModal = closeThankYouModal;
window.resetThankYouMode = resetThankYouMode;
window.selectThankYouMode = selectThankYouMode;
window.onThankYouSaleSelected = onThankYouSaleSelected;
window.updateThankYouPreview = updateThankYouPreview;
window.downloadThankYouPNG = downloadThankYouPNG;
window.shareThankYouWhatsApp = shareThankYouWhatsApp;
`;

if (!js.includes('openThankYouModal')) {
  js += `\n${thankYouJSCode}`;
}

fs.writeFileSync('public/app.js', js, 'utf8');
console.log('Updated public/app.js with Thank You Card functions');

// === 3. SYNC TO www/ ===
fs.copyFileSync('public/index.html', 'public/www/index.html');
fs.copyFileSync('public/app.js', 'public/www/app.js');
console.log('Synced all changes to public/www/');
