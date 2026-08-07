const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const ids = ['sale-submit-btn', 'sale-cancel-btn', 'expense-submit-btn', 'inventory-submit-btn', 'ins-rev', 'ins-rev-sub', 'ins-exp', 'ins-exp-sub', 'ins-profit', 'ins-profit-sub', 'ins-tax', 'ins-tax-sub', 'hm-rev', 'hm-profit', 'hm-count'];
ids.forEach(id => {
  if (!html.includes('id="' + id + '"') && !html.includes('id=\'' + id + '\'')) {
    console.log('MISSING: ' + id);
  }
});
