const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

code = code.replace(/toast\('â ³ /g, "toast('⏳ ");

fs.writeFileSync('public/app.js', code, 'utf8');
console.log('Fixed toast strings');
