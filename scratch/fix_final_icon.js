const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
// Fix the Sale Record Details modal header icon (📝 + ‹)
html = html.replace('\uD83D\uDCDD\u2039 Sale Record Details', '🧾 Sale Record Details');
fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Fixed Sale Record Details header icon');
console.log('Remaining issues:', fs.readFileSync('public/index.html','utf8').split('\n').filter(l => /[Âðâ‹Š™§]/.test(l)).length);
