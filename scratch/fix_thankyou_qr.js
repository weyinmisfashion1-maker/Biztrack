const fs = require('fs');

// 1. UPDATE INDEX.HTML - Thank You Card QR code element styling
let html = fs.readFileSync('public/index.html', 'utf8');

const oldQrBoxHtml = `<div id="ty-card-qr-box" style="display:none;flex-direction:column;align-items:center;background:#FFFFFF;padding:6px 6px 4px;border-radius:8px;border:2px solid #000000;min-width:100px;">
              <div style="font-size:0.48rem;font-weight:800;color:#000000;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:3px;text-align:center;">SCAN TO CONNECT</div>
              <img id="ty-card-qr-img" src="" alt="Scan QR Code" style="width:140px;height:140px;object-fit:contain;display:block;background:#FFFFFF;image-rendering:auto;" />
            </div>`;

const newQrBoxHtml = `<div id="ty-card-qr-box" style="display:none;flex-direction:column;align-items:center;background:#FFFFFF;padding:8px 8px 6px;border-radius:10px;border:2px solid #000000;box-shadow:0 2px 10px rgba(0,0,0,0.2);min-width:155px;flex-shrink:0;">
              <div style="font-size:0.52rem;font-weight:800;color:#000000;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4px;text-align:center;">SCAN TO CONNECT</div>
              <img id="ty-card-qr-img" src="" alt="Scan QR Code" style="width:155px;height:155px;object-fit:contain;display:block;background:#FFFFFF;image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;image-rendering:pixelated;" />
            </div>`;

if (html.includes(oldQrBoxHtml)) {
  html = html.replace(oldQrBoxHtml, newQrBoxHtml);
  console.log('OK: Thank You card QR box updated in index.html');
} else {
  // Try pattern match for ty-card-qr-img
  const idx = html.indexOf('id="ty-card-qr-img"');
  if (idx > 0) {
    const boxStart = html.lastIndexOf('<div id="ty-card-qr-box"', idx);
    const boxEnd = html.indexOf('</div>', idx) + '</div>'.length;
    if (boxStart > 0 && boxEnd > boxStart) {
      const oldSnippet = html.substring(boxStart, boxEnd);
      html = html.replace(oldSnippet, newQrBoxHtml);
      console.log('OK: Thank You card QR box updated via index lookup');
    }
  }
}

fs.writeFileSync('public/index.html', html, 'utf8');

// 2. UPDATE APP.JS - downloadThankYouPNG high-DPI scaling
let js = fs.readFileSync('public/app.js', 'utf8');
if (js.includes('scale: 3')) {
  js = js.replace('scale: 3', 'scale: 4, windowWidth: 1200');
  console.log('OK: downloadThankYouPNG scale upgraded to 4');
}
fs.writeFileSync('public/app.js', js, 'utf8');

console.log('Done!');
