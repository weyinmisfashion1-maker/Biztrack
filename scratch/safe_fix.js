const fs = require('fs');

// ===== FIX index.html =====
let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Fix corrupted Quick Action icons using exact byte-match strings
// "Recent Sales" card: 📝‹ -> 🗂️
html = html.replace(
  '<div class="qa-icon">📝\u203a</div>\r\n          <div class="qa-lbl">Recent Sales</div>',
  '<div class="qa-icon">🗂️</div>\r\n          <div class="qa-lbl">Recent Sales</div>'
);
// Fallback without \r
html = html.replace(
  '<div class="qa-icon">📝\u203a</div>\n          <div class="qa-lbl">Recent Sales</div>',
  '<div class="qa-icon">🗂️</div>\n          <div class="qa-lbl">Recent Sales</div>'
);

// "Reports" card: 📝Š -> 📊
html = html.replace(
  '<div class="qa-icon">📝\u0160</div>\r\n          <div class="qa-lbl">Reports</div>',
  '<div class="qa-icon">📊</div>\r\n          <div class="qa-lbl">Reports</div>'
);
html = html.replace(
  '<div class="qa-icon">📝\u0160</div>\n          <div class="qa-lbl">Reports</div>',
  '<div class="qa-icon">📊</div>\n          <div class="qa-lbl">Reports</div>'
);

// "Business Details" card: ⚠️™ï¸ -> 🏢
html = html.replace(
  '<div class="qa-icon">⚠️™\ufe0f</div>\r\n          <div class="qa-lbl">Business Details</div>',
  '<div class="qa-icon">🏢</div>\r\n          <div class="qa-lbl">Business Details</div>'
);
html = html.replace(
  '<div class="qa-icon">⚠️™\ufe0f</div>\n          <div class="qa-lbl">Business Details</div>',
  '<div class="qa-icon">🏢</div>\n          <div class="qa-lbl">Business Details</div>'
);
// Broader match backup
html = html.replace(/(<div class="qa-icon">)[^<]*(Business Details)/g, '$1🏢</div>\r\n          <div class="qa-lbl">$2');
html = html.replace(/⚠️™[^<]*(<\/div>\r?\n\s*<div class="qa-lbl">Business Details)/g, '🏢</div>$1');

// "Settings" card: 🔒§ -> ⚙️
html = html.replace(
  '<div class="qa-icon">🔒§</div>\r\n          <div class="qa-lbl">Settings</div>',
  '<div class="qa-icon">⚙️</div>\r\n          <div class="qa-lbl">Settings</div>'
);
html = html.replace(
  '<div class="qa-icon">🔒§</div>\n          <div class="qa-lbl">Settings</div>',
  '<div class="qa-icon">⚙️</div>\n          <div class="qa-lbl">Settings</div>'
);

// 2. Fix corrupted bullet separator Â· -> ·
html = html.split('Â·').join('·');

// 3. Fix corrupted £ currency symbol
html = html.split('Â£').join('£');

// 4. Fix insight-sub Revenue formula text
html = html.replace("Revenue −' Expenses", 'Revenue − Expenses');

// 5. Fix Sale Record Details modal header icon
html = html.replace('📝\u203a Sale Record Details', '🧾 Sale Record Details');

// 6. Fix corrupted "Add Custom Invoice" section icon
html = html.replace(
  '<span style="font-size:1.15rem;">📝\u201e</span>',
  '<span style="font-size:1.15rem;">✏️</span>'
);

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('index.html fixed');

// ===== FIX app.js =====
let js = fs.readFileSync('public/app.js', 'utf8');

// Fix all Â· separators
js = js.split('Â·').join('·');

// Fix emoji corruption
js = js.replace(/📝\u201e Opened print preview/g, '🖨️ Opened print preview');
js = js.replace(/<div class="empty-ico">📝\u201e<\/div>/g, '<div class="empty-ico">📋</div>');
js = js.replace(/📝\u201e Generate Invoice/g, '🧾 Generate Invoice');
js = js.replace(/📝\u2026 /g, '📅 ');
js = js.replace(/📝\u201e/g, '📋');

// Fix profile banner location icon
js = js.replace(/📝 \${esc\(profile\.location/g, '📍 ${esc(profile.location');

// Fix "Loss âœ—" corruption
js = js.replace(/Loss âœ—/g, 'Loss ✗');

// Fix bank account separator in profile banner
js = js.replace(/` Â· \${esc\(profile\.bank_name\)/g, "` · ${esc(profile.bank_name)");

fs.writeFileSync('public/app.js', js, 'utf8');
console.log('app.js fixed');

// ===== VERIFY results =====
const htmlResult = fs.readFileSync('public/index.html', 'utf8');
const jsResult = fs.readFileSync('public/app.js', 'utf8');
const stillCorrupted = [
  { file: 'index.html', text: htmlResult },
  { file: 'app.js', text: jsResult }
];
stillCorrupted.forEach(({ file, text }) => {
  const lines = text.split('\n');
  const bad = lines.filter(l => /[Âðâ‹Š™§]/.test(l));
  if (bad.length) {
    console.log(`\n${file} still has ${bad.length} corrupted lines:`);
    bad.forEach(l => console.log('  ' + l.trim().substring(0, 100)));
  } else {
    console.log(`${file}: CLEAN ✓`);
  }
});
