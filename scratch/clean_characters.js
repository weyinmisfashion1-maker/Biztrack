const fs = require('fs');

// === 1. FIX public/index.html ===
let html = fs.readFileSync('public/index.html', 'utf8');

// Replace specific corrupted Quick Action icon lines
html = html.replace(/<div class="qa-icon">📝‹<\/div>\s*\r?\n\s*<div class="qa-lbl">Recent Sales<\/div>/g, 
  '<div class="qa-icon">🗂️</div>\n          <div class="qa-lbl">Recent Sales</div>');

html = html.replace(/<div class="qa-icon">📝Š<\/div>\s*\r?\n\s*<div class="qa-lbl">Reports<\/div>/g, 
  '<div class="qa-icon">📊</div>\n          <div class="qa-lbl">Reports</div>');

html = html.replace(/<div class="qa-icon">⚠️™ï¸\s*<\/div>\s*\r?\n\s*<div class="qa-lbl">Business Details<\/div>/g, 
  '<div class="qa-icon">🏢</div>\n          <div class="qa-lbl">Business Details</div>');

html = html.replace(/<div class="qa-icon">🔒§<\/div>\s*\r?\n\s*<div class="qa-lbl">Settings<\/div>/g, 
  '<div class="qa-icon">⚙️</div>\n          <div class="qa-lbl">Settings</div>');

// Replace any remaining known corrupted text strings
html = html.replace(/📝‹ Sale Record Details/g, '🧾 Sale Record Details');
html = html.replace(/📝„/g, '✏️');
html = html.replace(/Â·/g, '·');
html = html.replace(/Â£/g, '£');
html = html.replace(/â‚¦/g, '₦');
html = html.replace(/â€”/g, '—');
html = html.replace(/âœ•/g, '✕');
html = html.replace(/ðŸ’¸/g, '💸');
html = html.replace(/âš\x00ï¸ /g, '⚠️');
html = html.replace(/âšï¸ /g, '⚠️');
html = html.replace(/&larr;/g, '←');
html = html.replace(/&rarr;/g, '→');

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Successfully cleaned public/index.html');

// === 2. FIX public/app.js ===
let js = fs.readFileSync('public/app.js', 'utf8');

js = js.replace(/Â·/g, '·');
js = js.replace(/â‚¦/g, '₦');
js = js.replace(/â€”/g, '—');
js = js.replace(/âœ•/g, '✕');
js = js.replace(/ðŸ’¸/g, '💸');
js = js.replace(/📝„/g, '✏️');
js = js.replace(/âš\x00ï¸ /g, '⚠️');
js = js.replace(/âšï¸ /g, '⚠️');

fs.writeFileSync('public/app.js', js, 'utf8');
console.log('Successfully cleaned public/app.js');

// === 3. SYNC TO www/ ===
fs.copyFileSync('public/index.html', 'public/www/index.html');
fs.copyFileSync('public/app.js', 'public/www/app.js');
fs.copyFileSync('public/login.html', 'public/www/login.html');
console.log('Synced files to public/www/');
