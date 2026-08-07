const fs = require('fs');
let content = fs.readFileSync('public/app.js', 'utf8');

// The broken handleProfileQRUpload ending - find it via a unique marker
// Line 524 ends with: PROFILE_QR_DATA_URL = bwUrl || rawUrl;
// Then immediately has: }  (line 525) and /* --- SALES & INVENTORY INTEGRATION --- */

const missingFunctions = `    const img = getEl('prof-qr-preview');
    const wrap = getEl('prof-qr-preview-wrap');
    if (img) img.src = PROFILE_QR_DATA_URL;
    if (wrap) wrap.style.display = 'flex';
    toast('\u2705 QR Code converted to Scannable Black & White!');
  };
  reader.readAsDataURL(file);
}

async function optimizeProfileQRBW() {
  const current = PROFILE_QR_DATA_URL || PROFILE?.qr_code_url;
  if (!current) return toast('\u26a0\ufe0f No QR code uploaded in Business Details');
  toast('\u26a1 Converting QR Code to High-Contrast Black & White...');
  const bwUrl = await processQRToBlackAndWhite(current);
  if (bwUrl) {
    PROFILE_QR_DATA_URL = bwUrl;
    if (PROFILE) PROFILE.qr_code_url = bwUrl;
    const img = getEl('prof-qr-preview');
    if (img) img.src = bwUrl;
    toast('\u2705 QR Code updated to High-Contrast Black & White!');
  }
}

function removeProfileQR() {
  PROFILE_QR_DATA_URL = null;
  if (getEl('prof-qr-file')) getEl('prof-qr-file').value = '';
  if (getEl('prof-qr-preview')) getEl('prof-qr-preview').src = '';
  if (getEl('prof-qr-preview-wrap')) getEl('prof-qr-preview-wrap').style.display = 'none';
}

/* --- LOCAL EXTRAS: instagram, website, qr_code_url stored in localStorage
   because these columns do not exist in the Supabase profiles schema.
   Keyed by user ID so multiple accounts on the same device work correctly. --- */
function _extrasKey(userId) {
  return 'biztrack_profile_extras_' + (userId || 'anon');
}
function loadProfileExtras(userId) {
  try {
    const raw = localStorage.getItem(_extrasKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}
function saveProfileExtras(userId, extras) {
  try {
    localStorage.setItem(_extrasKey(userId), JSON.stringify(extras));
  } catch(e) { console.error('Could not save profile extras', e); }
}

function populateProfileForm() {
  if (!PROFILE) return;
  getEl('prof-biz-name').value = PROFILE.business_name || '';
  getEl('prof-phone').value = PROFILE.phone_number || '';
  getEl('prof-loc').value = PROFILE.location || '';
  getEl('prof-bank').value = PROFILE.bank_name || '';
  getEl('prof-acc-num').value = PROFILE.account_number || '';
  getEl('prof-acc-name').value = PROFILE.account_name || '';
  getEl('prof-pin').value = PROFILE.pin || '1234';

  if (getEl('prof-instagram')) getEl('prof-instagram').value = PROFILE.instagram || '';
  if (getEl('prof-website')) getEl('prof-website').value = PROFILE.website || '';

  if (PROFILE.qr_code_url) {
    PROFILE_QR_DATA_URL = PROFILE.qr_code_url;
    if (getEl('prof-qr-preview')) getEl('prof-qr-preview').src = PROFILE.qr_code_url;
    if (getEl('prof-qr-preview-wrap')) getEl('prof-qr-preview-wrap').style.display = 'flex';
    processQRToBlackAndWhite(PROFILE.qr_code_url).then(bwUrl => {
      if (bwUrl && bwUrl !== PROFILE.qr_code_url) {
        PROFILE_QR_DATA_URL = bwUrl;
        PROFILE.qr_code_url = bwUrl;
        if (getEl('prof-qr-preview')) getEl('prof-qr-preview').src = bwUrl;
      }
    });
  } else if (PROFILE.instagram) {
    generateInstagramQRCode(PROFILE.instagram).then(bwUrl => {
      if (bwUrl) {
        PROFILE_QR_DATA_URL = bwUrl;
        if (PROFILE) PROFILE.qr_code_url = bwUrl;
        if (getEl('prof-qr-preview')) getEl('prof-qr-preview').src = bwUrl;
        if (getEl('prof-qr-preview-wrap')) getEl('prof-qr-preview-wrap').style.display = 'flex';
      } else {
        removeProfileQR();
      }
    });
  } else {
    removeProfileQR();
  }

  const perms = PROFILE.staff_permissions || {};
  const merged = { ...STAFF_PERMS, ...perms };
  Object.keys(merged).forEach(key => {
    const el = getEl('perm-' + key);
    if (el) el.checked = !!merged[key];
  });
}

function readStaffPermsFromUI() {
  const keys = Object.keys(STAFF_PERMS);
  const result = {};
  keys.forEach(key => {
    const el = getEl('perm-' + key);
    result[key] = el ? el.checked : STAFF_PERMS[key];
  });
  return result;
}

async function saveStaffPermissions() {
  try {
    const perms = readStaffPermsFromUI();
    const { data: { user } } = await sb.auth.getUser();
    const payload = { id: user.id, staff_permissions: perms };
    const { error } = await sb.from('profiles').upsert(payload);
    if (error) throw error;
    STAFF_PERMS = perms;
    if (PROFILE) PROFILE.staff_permissions = perms;
    toast('\u2705 Staff permissions saved!');
  } catch (err) {
    console.error(err);
    toast('\u26a0\ufe0f  Could not save permissions');
  }
}

`;

// Find the insertion point: right after "PROFILE_QR_DATA_URL = bwUrl || rawUrl;"
// followed immediately by a closing brace (the broken end of handleProfileQRUpload)
const searchStr = 'PROFILE_QR_DATA_URL = bwUrl || rawUrl;\r\n}\r\n';
const idx = content.indexOf(searchStr);

if (idx === -1) {
  // try with \n only
  const searchStr2 = 'PROFILE_QR_DATA_URL = bwUrl || rawUrl;\n}\n';
  const idx2 = content.indexOf(searchStr2);
  if (idx2 === -1) {
    console.error('MARKER NOT FOUND. Dumping lines around "bwUrl || rawUrl":');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('bwUrl || rawUrl')) console.log(i, JSON.stringify(lines.slice(i, i+5)));
    });
    process.exit(1);
  }
  // Replace with unix endings
  const before = content.slice(0, idx2 + 'PROFILE_QR_DATA_URL = bwUrl || rawUrl;\n'.length);
  const after = content.slice(idx2 + searchStr2.length);
  content = before + '\n' + missingFunctions + after;
} else {
  const before = content.slice(0, idx + 'PROFILE_QR_DATA_URL = bwUrl || rawUrl;\r\n'.length);
  const after = content.slice(idx + searchStr.length);
  content = before + '\r\n' + missingFunctions + after;
}

fs.writeFileSync('public/app.js', content, 'utf8');
console.log('SUCCESS: app.js repaired!');
console.log('New length:', content.length, 'chars');
