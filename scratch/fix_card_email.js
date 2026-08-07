const fs = require('fs');

// 1. UPDATE APP.JS - Ensure registered business email is retrieved and displayed on Thank You card
let js = fs.readFileSync('public/app.js', 'utf8');

if (js.includes('const email    = PROFILE?.email || \'\';')) {
  js = js.replace(
    'const email    = PROFILE?.email || \'\';',
    "const email    = PROFILE?.email || getEl('user-display')?.textContent || '';"
  );
  console.log('OK: email retrieval updated to include login/registered email fallback');
}

fs.writeFileSync('public/app.js', js, 'utf8');

// 2. UPDATE INDEX.HTML - Enhance Thank You container into physical card shape
let html = fs.readFileSync('public/index.html', 'utf8');

const oldCardStyle = `style="background:linear-gradient(160deg,#141009 0%,#2A2215 100%);color:#FAF6EF;padding:1.6rem 1.5rem 1.1rem;border-radius:18px;border:2.5px solid #C9982A;box-shadow:0 12px 40px rgba(0,0,0,0.5);text-align:center;position:relative;overflow:hidden;transition:all 0.3s ease;font-family:'Playfair Display',Georgia,serif;"`;

const newCardStyle = `style="max-width:540px;margin:0 auto;width:100%;background:linear-gradient(160deg,#141009 0%,#2A2215 100%);color:#FAF6EF;padding:1.8rem 1.6rem 1.3rem;border-radius:20px;border:2.5px solid #C9982A;box-shadow:0 16px 48px rgba(0,0,0,0.5), 0 0 20px rgba(201,152,42,0.25);text-align:center;position:relative;overflow:hidden;transition:all 0.3s ease;font-family:'Playfair Display',Georgia,serif;"`;

if (html.includes(oldCardStyle)) {
  html = html.replace(oldCardStyle, newCardStyle);
  console.log('OK: Thank You card styling enhanced to luxury card shape');
}

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Done!');
