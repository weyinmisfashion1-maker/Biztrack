const fs = require('fs');

// ─── FIX APP.JS ───────────────────────────────────────────────────────────────
let js = fs.readFileSync('public/app.js', 'utf8');

// 1. Replace handleProfileQRUpload — strip all B&W conversion, just store raw upload
const oldUpload = /function handleProfileQRUpload\(event\)[\s\S]*?reader\.readAsDataURL\(file\);\s*\}/;
const newUpload = `function handleProfileQRUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    PROFILE_QR_DATA_URL = e.target.result;
    const img = getEl('prof-qr-preview');
    const wrap = getEl('prof-qr-preview-wrap');
    if (img) img.src = PROFILE_QR_DATA_URL;
    if (wrap) wrap.style.display = 'flex';
    toast('\\u2705 QR Code uploaded successfully!');
  };
  reader.readAsDataURL(file);
}`;
if (oldUpload.test(js)) {
  js = js.replace(oldUpload, newUpload);
  console.log('OK: handleProfileQRUpload simplified');
} else {
  console.error('ERROR: handleProfileQRUpload not found');
}

// 2. Fix populateProfileForm — remove B&W conversion and Instagram auto-generation
// Replace the qr_code_url block that calls processQRToBlackAndWhite and generateInstagramQRCode
const oldQrBlock = /if \(PROFILE\.qr_code_url\) \{[\s\S]*?} else \{\s*removeProfileQR\(\);\s*\}/;
const newQrBlock = `if (PROFILE.qr_code_url) {
    PROFILE_QR_DATA_URL = PROFILE.qr_code_url;
    if (getEl('prof-qr-preview')) getEl('prof-qr-preview').src = PROFILE.qr_code_url;
    if (getEl('prof-qr-preview-wrap')) getEl('prof-qr-preview-wrap').style.display = 'flex';
  } else {
    removeProfileQR();
  }`;
if (oldQrBlock.test(js)) {
  js = js.replace(oldQrBlock, newQrBlock);
  console.log('OK: populateProfileForm QR block simplified');
} else {
  console.error('ERROR: populateProfileForm QR block not found');
}

fs.writeFileSync('public/app.js', js, 'utf8');
console.log('app.js saved.');

// ─── FIX INDEX.HTML ───────────────────────────────────────────────────────────
let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Restore the Instagram field to plain input (remove generate button)
const oldInstaField = /(<div class="field">\n\s*<label for="prof-instagram">Instagram Handle \(Optional\)<\/label>[\s\S]*?<\/div>\s*<\/div>)/;
// Use a simpler string search
const genBtnStr = `<button type="button" onclick="createInstagramQRFromUI()"`;
if (html.includes(genBtnStr)) {
  // Find and replace the instagram field div
  const start = html.indexOf('<div class="field">\n            <label for="prof-instagram">');
  if (start === -1) {
    // try \r\n
    const start2 = html.indexOf('<div class="field">\r\n            <label for="prof-instagram">');
    console.log('Insta field search index (CRLF):', start2);
  } else {
    console.log('Insta field found at index:', start);
  }
}

// Replace the entire instagram+generate-button block
const patterns = [
  // With \n
  `          <div class="field">\n            <label for="prof-instagram">Instagram Handle (Optional)</label>\n            <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">\n              <input type="text" id="prof-instagram" placeholder="e.g. @mybrand_official" style="flex:1; min-width:140px;" />\n              <button type="button" onclick="createInstagramQRFromUI()"`,
  // Also try to find qr-preview-wrap to fix it
];

// Simple approach: find the instagram field block and restore it
let instaStart = html.indexOf('label for="prof-instagram"');
if (instaStart > 0) {
  // go back to find the opening <div class="field">
  instaStart = html.lastIndexOf('<div class="field">', instaStart);
  // find the closing </div> for this field div
  let instaEnd = html.indexOf('</div>', instaStart) + '</div>'.length;
  const instaBlock = html.slice(instaStart, instaEnd);
  console.log('Current instagram block:', JSON.stringify(instaBlock).substring(0, 150));
  
  const newInstaBlock = `<div class="field">
            <label for="prof-instagram">Instagram Handle (Optional)</label>
            <input type="text" id="prof-instagram" placeholder="e.g. @mybrand_official" />
          </div>`;
  html = html.slice(0, instaStart) + newInstaBlock + html.slice(instaEnd);
  console.log('OK: Instagram field restored to simple input');
}

// 2. Replace the QR preview section with a clean, large clear version
const oldQrLabel = `<label style="font-weight:700; font-size:0.85rem; color:var(--ink); display:block; margin-bottom:0.2rem;">\ud83d\udcf1 QR Code Preview</label>`;
// Find the entire QR section div
let qrSectionStart = html.indexOf(oldQrLabel);
if (qrSectionStart < 0) {
  qrSectionStart = html.indexOf('QR Code Preview</label>');
  if (qrSectionStart > 0) qrSectionStart = html.lastIndexOf('<div class="field"', qrSectionStart);
  console.log('QR section found at (fallback):', qrSectionStart);
} else {
  qrSectionStart = html.lastIndexOf('<div class="field"', qrSectionStart);
  console.log('QR section found at:', qrSectionStart);
}

if (qrSectionStart > 0) {
  // find end of this section — next </div>\n        </div> pattern (closing the outer div.field)
  // It ends at </div>\r\n        \r\n        <button type="submit"
  let qrSectionEnd = html.indexOf('<button type="submit" class="btn-save">', qrSectionStart);
  // walk back to find the end of the QR div
  qrSectionEnd = html.lastIndexOf('</div>', qrSectionEnd) + '</div>'.length;
  
  const newQrSection = `<div class="field" style="margin-top:0.5rem; margin-bottom:1.2rem; background:var(--cream2, #f3ede0); padding:0.85rem 1rem; border-radius:12px; border:1px solid var(--border);">
          <label style="font-weight:700; font-size:0.85rem; color:var(--ink); display:block; margin-bottom:0.25rem;">\ud83d\udcf8 Business QR Code (Optional)</label>
          <span style="font-size:0.75rem; color:var(--muted); display:block; margin-bottom:0.7rem;">Upload your QR Code image (Instagram, Website, WhatsApp, Bank Transfer — anything). When scanned on your invoice or thank-you card, it will take customers directly to your link.</span>
          <div id="prof-qr-preview-wrap" style="display:none; flex-direction:column; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
            <div style="background:#FFFFFF; padding:10px; border-radius:10px; border:2px solid var(--gold); display:inline-block;">
              <img id="prof-qr-preview" src="" alt="Your QR Code" style="width:160px; height:160px; object-fit:contain; display:block;" />
            </div>
            <button type="button" class="btn-ghost" onclick="removeProfileQR()" style="padding:0.3rem 0.7rem; font-size:0.72rem; color:var(--red); border-color:var(--red);">\ud83d\uddd1 Remove QR</button>
          </div>
          <label for="prof-qr-file" style="display:inline-block; background:var(--gold); color:#fff; font-weight:700; font-size:0.8rem; padding:0.45rem 1rem; border-radius:8px; cursor:pointer; margin-top:0.25rem;">\u2b06\ufe0f Upload QR Code Image</label>
          <input type="file" id="prof-qr-file" accept="image/*" onchange="handleProfileQRUpload(event)" style="display:none;" />
        </div>`;
  
  html = html.slice(0, qrSectionStart) + newQrSection + html.slice(qrSectionEnd);
  console.log('OK: QR section replaced with clean upload version');
}

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('index.html saved.');

// 3. Also update the Thank You card QR image display to use auto image-rendering for crisp colors
let html2 = fs.readFileSync('public/index.html', 'utf8');
const oldTyQrImg = `image-rendering:pixelated;-webkit-optimize-contrast;display:block;background:#FFFFFF;`;
const newTyQrImg = `display:block;background:#FFFFFF;image-rendering:auto;`;
if (html2.includes(oldTyQrImg)) {
  html2 = html2.replace(oldTyQrImg, newTyQrImg);
  console.log('OK: Thank You card QR image-rendering fixed');
}
fs.writeFileSync('public/index.html', html2, 'utf8');
