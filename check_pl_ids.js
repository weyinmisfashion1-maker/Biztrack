const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const ids = ['pl-preview-biz-name', 'pl-preview-title', 'pl-preview-subtitle', 'pl-preview-contact'];
ids.forEach(id => {
  if (!html.includes('id="' + id + '"') && !html.includes('id=\'' + id + '\'')) {
    console.log('MISSING: ' + id);
  }
});
