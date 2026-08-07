const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

code = code.replace(/\u00e2\u008f\u00b3/g, '⏳');

fs.writeFileSync('public/app.js', code, 'utf8');
console.log('Fixed hourglass symbols');
