const fs = require('fs');

// 1. UPDATE INDEX.HTML - Thank You Card QR code box to ultra-bold 185px x 185px
let html = fs.readFileSync('public/index.html', 'utf8');

const newBoxHtml = '<div id="ty-card-qr-box" style="display:none;flex-direction:column;align-items:center;background:#FFFFFF;padding:12px 12px 8px;border-radius:12px;border:3px solid #000000;box-shadow:0 4px 16px rgba(0,0,0,0.25);min-width:185px;flex-shrink:0;">\n' +
'              <div style="font-size:0.58rem;font-weight:900;color:#000000;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;text-align:center;background:#FAF6EF;padding:2px 8px;border-radius:4px;border:1px solid #000000;">SCAN TO CONNECT</div>\n' +
'              <img id="ty-card-qr-img" src="" alt="Scan QR Code" style="width:185px;height:185px;object-fit:contain;display:block;background:#FFFFFF;image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;image-rendering:pixelated;-webkit-backface-visibility:hidden;transform:translateZ(0);" />\n' +
'            </div>';

const idx = html.indexOf('id="ty-card-qr-box"');
if (idx > 0) {
  const boxStart = html.lastIndexOf('<div id="ty-card-qr-box"', idx);
  const footerEnd = html.indexOf('<!-- Bottom tagline -->', idx);
  const boxEnd = html.lastIndexOf('</div>', footerEnd);
  if (boxStart > 0 && boxEnd > boxStart) {
    const oldSnippet = html.substring(boxStart, boxEnd + '</div>'.length);
    html = html.replace(oldSnippet, newBoxHtml);
    console.log('OK: Thank You card QR box updated to 185px ultra-bold in index.html');
  }
}

fs.writeFileSync('public/index.html', html, 'utf8');

// 2. UPDATE APP.JS - downloadThankYouPNG with onclone crisp rendering & scale 4
let js = fs.readFileSync('public/app.js', 'utf8');

if (js.includes('scale: 3') || js.includes('scale: 4')) {
  js = js.replace(/scale:\s*\d+[^,}]*/, 'scale: 4, windowWidth: 1400, onclone: (clonedDoc) => { const q = clonedDoc.querySelector("#ty-card-qr-img"); if (q) { q.style.width = "220px"; q.style.height = "220px"; q.style.imageRendering = "pixelated"; } }');
  console.log('OK: downloadThankYouPNG scale & onclone upgraded');
}

fs.writeFileSync('public/app.js', js, 'utf8');
console.log('Done!');
