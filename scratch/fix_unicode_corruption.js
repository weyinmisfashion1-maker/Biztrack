const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix warning emoji corruption
  content = content.replace(/⚠️\s*ï¸\s*/g, '⚠️ ');
  content = content.replace(/⚠️ ï¸\s*/g, '⚠️ ');
  content = content.replace(/⚠️ ï¸/g, '⚠️');
  content = content.replace(/⚠️ï¸/g, '⚠️');

  // Fix pencil emoji corruption
  content = content.replace(/✏️\s*ï¸\s*/g, '✏️ ');

  // Fix export icon corruption
  content = content.replace(/¬‡ï¸\s*/g, '💾 ');

  // Fix multiplication sign corruption (Ã— -> ×)
  content = content.replace(/Ã—/g, '×');

  fs.writeFileSync(filePath, content, 'utf8');
}

fixFile('public/index.html');
fixFile('public/app.js');

console.log('Fixed specific unicode corruption!');

// Sync to www
fs.copyFileSync('public/index.html', 'public/www/index.html');
fs.copyFileSync('public/app.js', 'public/www/app.js');
console.log('Synced to public/www/');
