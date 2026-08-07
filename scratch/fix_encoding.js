const fs = require('fs');

const replacements = [
  // Garbled Naira
  ['â‚¦', '₦'],
  ['â‚|', '₦'],
  ['â‚', '₦'],

  // Garbled Emojis & Symbols
  ['âœ…', '✅'],
  ['âœï¸', '✏️'],
  ['âœ', '✏️'],
  ['ðŸš«', '🚫'],
  ['â€¢', '•'],
  ['â„¹ï¸', 'ℹ️'],
  ['â„¹', 'ℹ️'],
  ['ðŸ—‘ï¸', '🗑️'],
  ['ðŸ—‘', '🗑️'],
  ['â ³', '⏳'],
  ['ðŸ§¾', '🧾'],
  ['ðŸšš', '🚚'],
  ['âœ—', '✕'],
  ['âŒ›', '⌛'],
  ['ðŸ‘‘', '👑'],
  ['âž•', '➕'],
  ['âˆ−', '−'],
  ['âˆ', '−'],

  // Punctuation & Quotes
  ['â€”', '—'],
  ['â€“', '–'],
  ['â€¦', '…'],
  ['â€˜', '‘'],
  ['â€™', '’'],
  ['â€œ', '“'],
  ['â€ ', '”'],
  ['â€', '—'],
  ['âœ•', '✕'],
  ['âœ✓', '✓'],
  ['âœ', '✓'],
  ['âšï¸', '⚠️'],
  ['âš', '⚠️'],

  // More Emojis
  ['ðŸ“D', '📍'],
  ['ðŸ“¦', '📦'],
  ['ðŸ“', '📝'],
  ['ðŸ’¸', '💸'],
  ['ðŸ’', '💼'],
  ['ðŸ”“', '🔓'],
  ['ðŸ”', '🔒']
];

function fixMojibake(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix missing onStockItemSelect in app.js
  if (filePath.endsWith('app.js') && !content.includes('function onStockItemSelect')) {
    content = content.replace(
      'window.onStockItemSelect = onStockItemSelect;',
      'function onStockItemSelect(el) { if (typeof onItemNameInput === "function") onItemNameInput(el); }\nwindow.onStockItemSelect = onStockItemSelect;'
    );
  }

  replacements.forEach(([from, to]) => {
    content = content.split(from).join(to);
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed:', filePath);
}

['public/app.js', 'public/index.html', 'public/login.html'].forEach(fixMojibake);
