const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

const target = `  if (PROFILE.qr_code_url) {
    PROFILE_QR_DATA_URL = PROFILE.qr_code_url;
    if (getEl('prof-qr-preview')) getEl('prof-qr-preview').src = PROFILE.qr_code_url;
    if (getEl('prof-qr-preview-wrap')) getEl('prof-qr-preview-wrap').style.display = 'flex';
  } else {
    removeProfileQR();
  }
    });
  } else {
    removeProfileQR();
  }`;

const replacement = `  if (PROFILE.qr_code_url) {
    PROFILE_QR_DATA_URL = PROFILE.qr_code_url;
    if (getEl('prof-qr-preview')) getEl('prof-qr-preview').src = PROFILE.qr_code_url;
    if (getEl('prof-qr-preview-wrap')) getEl('prof-qr-preview-wrap').style.display = 'flex';
  } else {
    removeProfileQR();
  }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('public/app.js', code, 'utf8');
  console.log('SUCCESS: Syntax error fixed in app.js');
} else {
  console.error('Target not found, checking CRLF vs LF');
  const targetLF = target.replace(/\r\n/g, '\n');
  if (code.includes(targetLF)) {
    code = code.replace(targetLF, replacement);
    fs.writeFileSync('public/app.js', code, 'utf8');
    console.log('SUCCESS: Syntax error fixed in app.js (LF)');
  } else {
    console.error('STILL NOT FOUND');
  }
}
