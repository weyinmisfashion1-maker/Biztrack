const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// --- CHANGE 1: Replace the Instagram field with one that has the Generate QR button ---
const oldInstaField = `          <div class="field">\r\n            <label for="prof-instagram">Instagram Handle (Optional)</label>\r\n            <input type="text" id="prof-instagram" placeholder="e.g. @mybrand_official" />\r\n          </div>`;
const newInstaField = `          <div class="field">
            <label for="prof-instagram">Instagram Handle (Optional)</label>
            <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
              <input type="text" id="prof-instagram" placeholder="e.g. @mybrand_official" style="flex:1; min-width:140px;" />
              <button type="button" onclick="createInstagramQRFromUI()" style="background:linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045); color:#fff; border:none; border-radius:8px; padding:0.4rem 0.75rem; font-size:0.75rem; font-weight:700; cursor:pointer; white-space:nowrap; flex-shrink:0;" title="Auto-generate a bold scannable QR code that links to your Instagram page">\ud83d\udcf7 Generate Instagram QR</button>
            </div>
          </div>`;

if (html.includes(oldInstaField)) {
  html = html.replace(oldInstaField, newInstaField);
  console.log('CHANGE 1 applied: Instagram field updated');
} else {
  console.error('CHANGE 1 NOT FOUND. Trying with LF...');
  const alt = oldInstaField.replace(/\r\n/g, '\n');
  if (html.includes(alt)) {
    html = html.replace(alt, newInstaField);
    console.log('CHANGE 1 applied (LF): Instagram field updated');
  } else {
    console.error('STILL NOT FOUND');
  }
}

// --- CHANGE 2: Replace the entire QR code section ---
const oldQrSection = `        <div class="field" style="margin-top:0.5rem; margin-bottom:1.2rem; background:var(--cream2, #f3ede0); padding:0.85rem 1rem; border-radius:12px; border:1px solid var(--border);">\r\n          <label style="font-weight:700; font-size:0.85rem; color:var(--ink); display:block; margin-bottom:0.25rem;">\ud83d\udcf8 Business Payment / Contact QR Code (Optional)</label>\r\n          <span style="font-size:0.75rem; color:var(--muted); display:block; margin-bottom:0.6rem;">Upload an image of your Business QR Code (Bank Transfer, Website, or WhatsApp QR).</span>\r\n          <div style="display:flex; align-items:center; gap:0.85rem; flex-wrap:wrap;">\r\n            <input type="file" id="prof-qr-file" accept="image/*" onchange="handleProfileQRUpload(event)" style="font-size:0.78rem;" />\r\n            <div id="prof-qr-preview-wrap" style="display:none; align-items:center; gap:0.6rem;">\r\n              <img id="prof-qr-preview" src="" alt="QR Code" style="width:60px; height:60px; border-radius:8px; border:1.5px solid var(--gold); object-fit:contain; image-rendering:pixelated; background:#fff; padding:2px;" />\r\n              <button type="button" class="btn-ghost" onclick="optimizeProfileQRBW()" style="padding:0.25rem 0.6rem; font-size:0.72rem; color:var(--emerald, #2e7d32); border-color:var(--emerald, #2e7d32);" title="Convert to high-contrast black and white for 100% phone scanning">\u26a1 Scannable B&amp;W</button>\r\n              <button type="button" class="btn-ghost" onclick="removeProfileQR()" style="padding:0.25rem 0.6rem; font-size:0.72rem; color:var(--red); border-color:var(--red);">Remove QR</button>\r\n            </div>\r\n          </div>\r\n        </div>`;

const newQrSection = `        <div class="field" style="margin-top:0.5rem; margin-bottom:1.2rem; background:var(--cream2, #f3ede0); padding:0.85rem 1rem; border-radius:12px; border:1px solid var(--border);">
          <label style="font-weight:700; font-size:0.85rem; color:var(--ink); display:block; margin-bottom:0.2rem;">\ud83d\udcf1 QR Code Preview</label>
          <span style="font-size:0.75rem; color:var(--muted); display:block; margin-bottom:0.6rem;">
            Click <strong>"\ud83d\udcf7 Generate Instagram QR"</strong> above to auto-create a bold scannable QR that opens your Instagram.
            Or upload your own QR image below.
          </span>
          <div id="prof-qr-preview-wrap" style="display:none; flex-direction:column; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
            <div style="background:#FFFFFF; padding:8px; border-radius:10px; border:2.5px solid #000000; display:inline-block; box-shadow:0 2px 12px rgba(0,0,0,0.18);">
              <img id="prof-qr-preview" src="" alt="QR Code" style="width:140px; height:140px; object-fit:contain; image-rendering:pixelated; display:block; background:#FFFFFF;" />
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:center;">
              <button type="button" onclick="createInstagramQRFromUI()" style="background:linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045); color:#fff; border:none; border-radius:8px; padding:0.35rem 0.75rem; font-size:0.75rem; font-weight:700; cursor:pointer;">\ud83d\udcf7 Regenerate Instagram QR</button>
              <button type="button" class="btn-ghost" onclick="removeProfileQR()" style="padding:0.35rem 0.6rem; font-size:0.72rem; color:var(--red); border-color:var(--red);">\ud83d\uddd1 Remove QR</button>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; font-size:0.72rem; color:var(--muted);">
            <span>Or upload your own QR image:</span>
            <input type="file" id="prof-qr-file" accept="image/*" onchange="handleProfileQRUpload(event)" style="font-size:0.75rem;" />
          </div>
        </div>`;

if (html.includes(oldQrSection)) {
  html = html.replace(oldQrSection, newQrSection);
  console.log('CHANGE 2 applied: QR section replaced');
} else {
  console.error('CHANGE 2 NOT FOUND. Trying partial match...');
  // Try matching just the label text
  const partialOld = `<label style="font-weight:700; font-size:0.85rem; color:var(--ink); display:block; margin-bottom:0.25rem;">\ud83d\udcf8 Business Payment / Contact QR Code (Optional)</label>`;
  if (html.includes(partialOld)) {
    // Find the full div block and replace it
    const startStr = `        <div class="field" style="margin-top:0.5rem; margin-bottom:1.2rem; background:var(--cream2, #f3ede0); padding:0.85rem 1rem; border-radius:12px; border:1px solid var(--border);">`;
    let searchFrom = html.indexOf(partialOld);
    let divStart = html.lastIndexOf(startStr, searchFrom);
    let divEnd = html.indexOf('\n        </div>', searchFrom);
    if (divEnd === -1) divEnd = html.indexOf('\r\n        </div>', searchFrom);
    if (divStart > 0 && divEnd > 0) {
      const toReplace = html.slice(divStart, divEnd + '\n        </div>'.length);
      html = html.replace(toReplace, newQrSection);
      console.log('CHANGE 2 applied via partial match');
    } else {
      console.error('Could not determine div boundaries');
    }
  } else {
    console.error('CHANGE 2 partial match also not found');
  }
}

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('SUCCESS: index.html updated');
