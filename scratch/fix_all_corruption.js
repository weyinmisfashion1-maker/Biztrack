const fs = require('fs');

// === FIX index.html ===
let html = fs.readFileSync('public/index.html', 'utf8');

// Fix corrupted Quick Action icons
html = html.replace(/<div class="qa-icon">📝‹<\/div>\s*\n\s*<div class="qa-lbl">Recent Sales<\/div>/, '<div class="qa-icon">🗂️</div>\n          <div class="qa-lbl">Recent Sales</div>');
html = html.replace(/<div class="qa-icon">📝Š<\/div>\s*\n\s*<div class="qa-lbl">Reports<\/div>/, '<div class="qa-icon">📊</div>\n          <div class="qa-lbl">Reports</div>');
html = html.replace(/<div class="qa-icon">⚠️™ï¸<\/div>\s*\n\s*<div class="qa-lbl">Business Details<\/div>/, '<div class="qa-icon">🏢</div>\n          <div class="qa-lbl">Business Details</div>');
html = html.replace(/<div class="qa-icon">🔒§<\/div>\s*\n\s*<div class="qa-lbl">Settings<\/div>/, '<div class="qa-icon">⚙️</div>\n          <div class="qa-lbl">Settings</div>');

// Fix corrupted icon in invoice list (Sale Record Details modal header)
html = html.replace(/📝‹ Sale Record Details/, '🧾 Sale Record Details');

// Fix corrupted icon in invoice section
html = html.replace(/<span style="font-size:1\.15rem;">📝„<\/span>/, '<span style="font-size:1.15rem;">✏️</span>');

// Fix corrupted "Â·" bullet separators (should be "·")
html = html.split('Â·').join('·');

// Fix corrupted currency symbols in currency dropdown
html = html.split('Â£').join('£');

// Fix footer text corruption
html = html.split('Â·').join('·');

// Fix insight-sub text corruption
html = html.replace("Revenue −' Expenses", 'Revenue − Expenses');

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Fixed: public/index.html');

// === FIX app.js ===
let js = fs.readFileSync('public/app.js', 'utf8');

// Fix all "Â·" to "·" (middle dot separator)
js = js.split('Â·').join('·');

// Fix corrupted icons in app.js
js = js.replace(/📝„ Opened print preview/g, '🖨️ Opened print preview');
js = js.replace(/<div class="empty-ico">📝„<\/div>/g, '<div class="empty-ico">📋</div>');
js = js.replace(/📝„ Generate Invoice/g, '🧾 Generate Invoice');
js = js.replace(/📝… /g, '📅 ');
js = js.replace(/📝„/g, '📋');

// Fix profile banner location icon
js = js.replace(/📝 \${esc\(profile\.location/g, '📍 ${esc(profile.location');

// Fix "Loss âœ—" → "Loss ✗" (clean result)
js = js.replace(/Loss âœ—/g, 'Loss ✗');

fs.writeFileSync('public/app.js', js, 'utf8');
console.log('Fixed: public/app.js');

console.log('All corrupted characters fixed!');
