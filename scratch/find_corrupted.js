const fs = require('fs');

const targets = ['public/index.html', 'public/app.js'];
let foundCount = 0;

targets.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    // Check for common UTF-8 double-encoding artifacts (Â, â, ð, ï, etc)
    if (/Â|â|ð|ï|Ã/.test(line)) {
      console.log(`${file}:${i + 1}: ${line.trim()}`);
      foundCount++;
    }
  });
});

if (foundCount === 0) {
  console.log('✅ Clean! No corrupted characters found in index.html or app.js.');
} else {
  console.log(`⚠️ Found ${foundCount} lines with potential character issues.`);
}
