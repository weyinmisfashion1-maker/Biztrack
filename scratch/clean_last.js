const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

code = code.replace(/toast\('â ³ /g, "toast('⏳ ");
code = code.replace(/ðŸ–¨ Print/g, "🖨️ Print");
code = code.replace(/â¬‡ Download PNG/g, "📥 Download PNG");

fs.writeFileSync('public/app.js', code, 'utf8');
console.log('Cleaned last strings in app.js');
