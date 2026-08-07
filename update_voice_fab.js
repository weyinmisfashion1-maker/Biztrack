const fs = require('fs');

// 1. Update index.html to include Voice Input item in fab-menu-list
let indexHtml = fs.readFileSync('public/www/index.html', 'utf8');
const needle = 'id="fab-action-stock"';

if (indexHtml.includes(needle) && !indexHtml.includes('id="fab-action-voice"')) {
  const insertPos = indexHtml.indexOf('</button>', indexHtml.indexOf(needle)) + 9;
  const voiceFabHtml = `
    <button class="fab-item" id="fab-action-voice" onclick="if(window.openVoiceModal) window.openVoiceModal(); if(window.toggleFabMenu) toggleFabMenu(false);" aria-label="Voice Input">
      <span class="fab-label">Voice Input</span>
      <div class="fab-icon-btn" style="background:var(--gold,#C9982A); color:var(--ink,#141009); font-size:1.2rem;">🎙️</div>
    </button>`;
  indexHtml = indexHtml.slice(0, insertPos) + voiceFabHtml + indexHtml.slice(insertPos);
  fs.writeFileSync('public/www/index.html', indexHtml, 'utf8');
  console.log('Updated index.html with Voice FAB button');
} else {
  console.log('index.html already has Voice FAB or needle missing.');
}

// Also update public/index.html if it exists
if (fs.existsSync('public/index.html')) {
  try {
    fs.writeFileSync('public/index.html', indexHtml, 'utf8');
    console.log('Synced public/index.html!');
  } catch (e) {
    console.log('public/index.html sync skipped or locked');
  }
}

// 2. Update voice.js to support global openVoiceModal and not depend strictly on #voice-fab
const voiceJsContent = `/* ============================================================
   voice.js — BizTrack Voice Entry (Web Speech API)
   ============================================================ */
(function () {
  'use strict';

  let targetInput   = null;   // input/textarea targeted for voice insertion
  let recognizer    = null;
  let isListening   = false;
  let lastFocused   = null;

  // Track last focused input/textarea across the app
  document.addEventListener('focusin', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.target.id !== 'voice-transcript') {
      lastFocused = e.target;
    }
  }, true);

  function getModal() { return document.getElementById('voice-modal'); }
  function getMicBtn() { return document.getElementById('voice-mic-btn'); }
  function getTranscript() { return document.getElementById('voice-transcript'); }
  function getStatusMsg() { return document.getElementById('voice-status-msg'); }

  // Inject pulse styles
  if (!document.getElementById('voice-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'voice-pulse-style';
    style.textContent = \`
      @keyframes voicePulse {
        0%   { box-shadow: 0 0 0 0 rgba(201,152,42,.6); }
        70%  { box-shadow: 0 0 0 18px rgba(201,152,42,0); }
        100% { box-shadow: 0 0 0 0 rgba(201,152,42,0); }
      }
      #voice-mic-btn.listening { animation: voicePulse 1.2s infinite; background: #E8BE6A !important; }
      #voice-confirm-btn:hover { background: #E8BE6A !important; }
      #voice-cancel-btn:hover  { border-color: #C9982A; color: #C9982A; }
    \`;
    document.head.appendChild(style);
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function setStatus(msg, isError) {
    const el = getStatusMsg();
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#B53030' : '#7A6E58';
  }

  function buildRecognizer() {
    if (!SR) return null;
    const r = new SR();
    r.continuous     = true;
    r.interimResults = true;
    r.lang           = 'en-US';

    r.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      const tx = getTranscript();
      if (tx) {
        tx.value = (tx.value.replace(/[…]+$/, '') + ' ' + final + (interim ? ' ' + interim + '…' : '')).trim();
      }
    };

    r.onerror = (e) => {
      console.warn('SpeechRecognition error:', e.error);
      if (e.error === 'not-allowed') {
        setStatus('Microphone access denied. Please enable mic permissions.', true);
      } else {
        setStatus('Speech error: ' + e.error, true);
      }
      stopListening();
    };

    r.onend = () => {
      if (isListening) startListening();
    };

    return r;
  }

  function startListening() {
    if (!SR) {
      setStatus('Speech Recognition is not supported in this browser. Please use Chrome or Edge.', true);
      return;
    }
    if (!recognizer) recognizer = buildRecognizer();
    try {
      recognizer.start();
      isListening = true;
      const btn = getMicBtn();
      if (btn) btn.classList.add('listening');
      setStatus('Listening… Speak now.');
    } catch (e) {
      // already listening
    }
  }

  function stopListening() {
    isListening = false;
    const btn = getMicBtn();
    if (btn) btn.classList.remove('listening');
    if (recognizer) {
      try { recognizer.stop(); } catch (_) {}
      recognizer = null;
    }
    setStatus('Tap mic to start speaking.');
  }

  function openVoiceModal(inputEl) {
    const modal = getModal();
    if (!modal) return;

    targetInput = inputEl || (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') && document.activeElement.id !== 'voice-transcript' ? document.activeElement : lastFocused);

    const tx = getTranscript();
    if (tx) tx.value = '';

    modal.style.display = 'flex';
    startListening();
  }

  function closeVoiceModal() {
    const modal = getModal();
    if (modal) modal.style.display = 'none';
    stopListening();
  }

  // Global exports
  window.openVoiceModal = openVoiceModal;
  window.closeVoiceModal = closeVoiceModal;

  // Bind UI buttons once DOM is ready
  function initVoiceUI() {
    const modal = getModal();
    if (!modal) return;

    const micBtn = getMicBtn();
    if (micBtn) {
      micBtn.onclick = () => { isListening ? stopListening() : startListening(); };
    }

    const confirmBtn = document.getElementById('voice-confirm-btn');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        const tx = getTranscript();
        const text = tx ? tx.value.replace(/…+$/, '').trim() : '';
        if (targetInput && text) {
          targetInput.value = text;
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          targetInput.dispatchEvent(new Event('change', { bubbles: true }));
          targetInput.focus();
        } else if (text) {
          // Copy to clipboard if no target field selected
          navigator.clipboard?.writeText(text);
          alert('Transcribed: "' + text + '" (Copied to clipboard!)');
        }
        closeVoiceModal();
      };
    }

    const cancelBtn = document.getElementById('voice-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = closeVoiceModal;
    }

    modal.onclick = (e) => {
      if (e.target === modal) closeVoiceModal();
    };

    // Also support standalone #voice-fab if present
    const fab = document.getElementById('voice-fab');
    if (fab) {
      fab.onclick = () => openVoiceModal();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVoiceUI);
  } else {
    initVoiceUI();
  }

  console.log('[BizTrack] Voice entry module initialized.');
})();
`;

fs.writeFileSync('public/www/voice.js', voiceJsContent, 'utf8');
console.log('Updated public/www/voice.js successfully!');

if (fs.existsSync('public/voice.js')) {
  try {
    fs.writeFileSync('public/voice.js', voiceJsContent, 'utf8');
    console.log('Synced public/voice.js!');
  } catch (e) {}
}
