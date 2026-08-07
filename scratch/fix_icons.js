const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// Line 1613: "Recent Sales" card icon is 📝 (d83d+dcdd = U+1F4DD note emoji) + ‹ (U+2039 single left-pointing angle quotation mark)
// Replace by finding the exact unicode sequence
html = html.replace('\uD83D\uDCDD\u2039', '🗂️'); // Recent Sales

// Line 1629: "Reports" card icon is 📝 + Š (U+0160 Latin capital S with caron)
html = html.replace('\uD83D\uDCDD\u0160', '📊'); // Reports

// Line 1633: "Business Details" icon - check what's there
const bdLineIdx = html.indexOf('"qa-profile-card"');
const bdSnippet = html.substring(bdLineIdx, bdLineIdx + 200);
console.log('Business Details snippet:', JSON.stringify(bdSnippet));

// Line 1637: "Settings" card icon is 🔒 (d83d+dd12) + § (U+00A7 section sign)
html = html.replace('\uD83D\uDD12\u00A7', '⚙️'); // Settings

fs.writeFileSync('public/index.html', html, 'utf8');

// Verify remaining issues
const lines = fs.readFileSync('public/index.html', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('qa-icon') && (l.includes('\u203a') || l.includes('\u0160') || l.includes('\u00a7') || l.includes('™') || l.includes('Â'))) {
    console.log('Still corrupted line', i+1, ':', l.trim());
  }
});
console.log('Done');
