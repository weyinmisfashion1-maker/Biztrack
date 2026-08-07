const fs = require('fs');

// Read app.js
const appCode = fs.readFileSync('public/app.js', 'utf8');

// Find all window.xxx = yyy; statements
const windowAssigns = [...appCode.matchAll(/window\.(\w+)\s*=\s*(\w+);/g)];
console.log('Total window assignments:', windowAssigns.length);

windowAssigns.forEach(match => {
  const name = match[2];
  const regex = new RegExp('function\\s+' + name + '\\b|var\\s+' + name + '\\b|let\\s+' + name + '\\b|const\\s+' + name + '\\b');
  const isDefined = regex.test(appCode);
  if (!isDefined) {
    console.log('UNDEFINED VARIABLE:', name);
  }
});
