const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const ids = ['ty-preview-biz-name', 'ty-preview-meta', 'ty-preview-greeting', 'ty-preview-body', 'ty-preview-contact', 'ty-preview-signature'];
ids.forEach(id => {
  if (!html.includes('id="' + id + '"') && !html.includes('id=\'' + id + '\'')) {
    console.log('MISSING: ' + id);
  }
});
