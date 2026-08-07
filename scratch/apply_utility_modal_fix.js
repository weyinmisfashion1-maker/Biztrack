const fs = require('fs');

// === 1. UPDATE public/index.html ===
let html = fs.readFileSync('public/index.html', 'utf8');

// Replace Quick Actions section with clean SVG icons + Utilities card
const newQuickActionsHTML = `    <!-- QUICK ACTIONS -->
    <section style="margin-top: 0.4rem;">
      <h3 class="card-h" style="margin-bottom: 0.35rem; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--gold);">Quick Actions</h3>
      <div class="quick-actions-grid">
        <div class="qa-card" id="qa-sales-card" onclick="switchTab('sales')">
          <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"></path></svg></div>
          <div class="qa-lbl">Record Sale</div>
        </div>
        <div class="qa-card" id="qa-recent-sales-card" onclick="switchTab('recent-sales')">
          <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></div>
          <div class="qa-lbl">Recent Sales</div>
        </div>
        <div class="qa-card" id="qa-expense-card" onclick="switchTab('expense')">
          <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg></div>
          <div class="qa-lbl">Record Expense</div>
        </div>
        <div class="qa-card" id="qa-inventory-card" onclick="switchTab('inventory')">
          <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg></div>
          <div class="qa-lbl">Inventory</div>
        </div>
        <div class="qa-card" id="qa-invoice-card" onclick="switchTab('invoice')">
          <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg></div>
          <div class="qa-lbl">Invoice</div>
        </div>
        <div class="qa-card" id="qa-report-card" onclick="switchTab('report')">
          <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg></div>
          <div class="qa-lbl">Reports</div>
        </div>
        <div class="qa-card" id="qa-profile-card" onclick="switchTab('profile')">
          <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path></svg></div>
          <div class="qa-lbl">Business Details</div>
        </div>
        <div class="qa-card" id="qa-settings-card" onclick="switchTab('settings')">
          <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></div>
          <div class="qa-lbl">Settings</div>
        </div>
        <div class="qa-card" id="qa-admin-card" onclick="switchTab('admin')">
          <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg></div>
          <div class="qa-lbl">Admin Center</div>
        </div>
        <div class="qa-card" id="qa-utility-card" onclick="openUtilityFeaturesModal()">
          <div class="qa-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg></div>
          <div class="qa-lbl">Utilities</div>
        </div>
      </div>
    </section>`;

// Replace from <!-- QUICK ACTIONS --> down to before <!-- TABS
const startQA = html.indexOf('<!-- QUICK ACTIONS -->');
const endQA = html.indexOf('<!-- TABS');

if (startQA !== -1 && endQA !== -1) {
  html = html.substring(0, startQA) + newQuickActionsHTML + '\n  </section>\n\n  ' + html.substring(endQA);
}

// Add Utility Features Modal before Thank You Modal
const utilityModalHTML = `
<!-- MODAL: UTILITY FEATURES SELECTOR -->
<div id="utility-features-modal" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.65); z-index:998; align-items:center; justify-content:center; overflow-y:auto; padding:1rem;" onclick="if(event.target === this) closeUtilityFeaturesModal()">
  <div class="card" style="max-width:480px; width:100%; padding:1.25rem; border-radius:16px; position:relative; background:var(--cream, #faf6ef); box-shadow:0 12px 40px rgba(0,0,0,0.3); border:1px solid var(--border);">
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:0.65rem; margin-bottom:0.85rem;">
      <h2 style="font-size:1.15rem; font-weight:700; margin:0; color:var(--ink); display:flex; align-items:center; gap:0.4rem;">🛠️ Utility Features</h2>
      <button type="button" onclick="closeUtilityFeaturesModal()" style="background:transparent; border:none; font-size:1.2rem; cursor:pointer; color:var(--muted); line-height:1; padding:0.2rem 0.5rem;">✕</button>
    </div>

    <p style="font-size:0.82rem; color:var(--muted); margin-bottom:1rem;">Select a utility tool to enhance your business:</p>

    <div style="display:grid; grid-template-columns:1fr; gap:0.75rem;">
      <!-- Utility Item 1: Thank You Card -->
      <div class="qa-card" onclick="closeUtilityFeaturesModal(); openThankYouModal();" style="padding:1rem; text-align:left; align-items:flex-start; cursor:pointer; border:1.5px solid var(--border); background:#fff; flex-direction:row; gap:0.85rem;">
        <div class="qa-icon" style="width:42px; height:42px; font-size:1.3rem; flex-shrink:0; background:var(--cream2);">💌</div>
        <div style="flex:1;">
          <strong style="font-size:0.92rem; color:var(--text); display:block; margin-bottom:0.15rem;">Thank You Card Generator</strong>
          <span style="font-size:0.75rem; color:var(--muted); line-height:1.35; display:block;">Create custom branded Thank You notes for your customers (Manual or from Invoice).</span>
        </div>
      </div>
    </div>

    <div style="display:flex; justify-content:flex-end; margin-top:1rem; border-top:1px solid var(--border); padding-top:0.75rem;">
      <button type="button" class="btn-ghost" onclick="closeUtilityFeaturesModal()" style="width:auto; padding:0.35rem 0.85rem; font-size:0.8rem;">Close</button>
    </div>
  </div>
</div>
`;

if (!html.includes('id="utility-features-modal"')) {
  html = html.replace('<!-- MODAL: THANK YOU CARD GENERATOR -->', `${utilityModalHTML}\n<!-- MODAL: THANK YOU CARD GENERATOR -->`);
}

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Successfully updated public/index.html');

// === 2. UPDATE public/app.js ===
let js = fs.readFileSync('public/app.js', 'utf8');

const utilityJSFunctions = `
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

window.openUtilityFeaturesModal = openUtilityFeaturesModal;
window.closeUtilityFeaturesModal = closeUtilityFeaturesModal;
`;

if (!js.includes('openUtilityFeaturesModal')) {
  js += `\n${utilityJSFunctions}`;
}

fs.writeFileSync('public/app.js', js, 'utf8');
console.log('Successfully updated public/app.js');

// === 3. SYNC TO www/ ===
fs.copyFileSync('public/index.html', 'public/www/index.html');
fs.copyFileSync('public/app.js', 'public/www/app.js');
console.log('Synced all changes to public/www/');
