const fs = require('fs');

const replacements = [
  ['â”──', '──'],
  ['â”', '─'],
  ['â ³', '⏳'],
  ['â€', '']
];

function fixRemaining(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  replacements.forEach(([from, to]) => {
    content = content.split(from).join(to);
  });
  fs.writeFileSync(filePath, content, 'utf8');
}

['public/app.js', 'public/index.html', 'public/login.html'].forEach(fixRemaining);
