// Script to rebuild the end of www/index.html cleanly and create voice.js
const fs = require('fs');
const path = require('path');

// ── 1. Fix www/index.html ────────────────────────────────────────────────────
let html = fs.readFileSync('public/www/index.html', 'utf8');

// Find the FIRST occurrence of <!-- Toast --> and cut everything after it
const cutIdx = html.indexOf('<!-- Toast -->');
if (cutIdx === -1) { console.error('Toast marker not found'); process.exit(1); }
const base = html.substring(0, cutIdx);

const voiceModal = `
<!-- ===== VOICE ENTRY MODAL ===== -->
<div id="voice-modal" role="dialog" aria-modal="true" aria-label="Voice input"
  style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);
         align-items:center;justify-content:center;padding:1rem;">
  <div style="background:#fff;border-radius:16px;padding:1.5rem;width:100%;max-width:420px;
              box-shadow:0 8px 40px rgba(0,0,0,0.25);border:1px solid #DDD4BE;">
    <h3 style="font-family:'Playfair Display',Georgia,serif;color:#C9982A;margin-bottom:0.25rem;font-size:1.1rem;">
      &#127897;&#65039; Voice Input
    </h3>
    <p id="voice-status-msg" style="font-size:0.75rem;color:#7A6E58;margin-bottom:0.85rem;">
      Tap the mic and speak clearly.
    </p>

    <!-- Big pulsing mic button -->
    <div style="display:flex;justify-content:center;margin-bottom:1rem;">
      <button id="voice-mic-btn" aria-label="Start or stop recording"
        style="width:72px;height:72px;border-radius:50%;background:#C9982A;border:none;cursor:pointer;
               display:flex;align-items:center;justify-content:center;
               box-shadow:0 4px 16px rgba(201,152,42,.35);transition:transform .15s,box-shadow .15s;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
             stroke="#141009" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3"/>
          <path d="M19 10a7 7 0 0 1-14 0"/>
          <line x1="12" y1="17" x2="12" y2="22"/>
          <line x1="9" y1="22" x2="15" y2="22"/>
        </svg>
      </button>
    </div>

    <!-- Live transcript textarea (editable) -->
    <textarea id="voice-transcript"
      placeholder="Transcribed text appears here — you can also edit it..."
      style="width:100%;min-height:90px;padding:0.65rem 0.75rem;border:1.5px solid #DDD4BE;
             border-radius:8px;font-family:'Outfit',sans-serif;font-size:0.9rem;color:#1C1509;
             resize:vertical;margin-bottom:1rem;line-height:1.5;"></textarea>

    <!-- Actions -->
    <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
      <button id="voice-cancel-btn"
        style="padding:0.55rem 1.1rem;border:1px solid #DDD4BE;border-radius:8px;
               background:#fff;color:#7A6E58;font-size:0.88rem;font-weight:600;cursor:pointer;">
        Cancel
      </button>
      <button id="voice-confirm-btn"
        style="padding:0.55rem 1.25rem;border:none;border-radius:8px;
               background:#C9982A;color:#141009;font-size:0.88rem;font-weight:700;cursor:pointer;">
        &#10003; Confirm
      </button>
    </div>
  </div>
</div>

<!-- Floating voice trigger button -->
<button id="voice-fab" aria-label="Open voice input"
  style="position:fixed;bottom:1.5rem;right:1.5rem;width:56px;height:56px;border-radius:50%;
         background:#C9982A;border:none;cursor:pointer;z-index:9998;
         box-shadow:0 4px 16px rgba(201,152,42,.4);display:flex;align-items:center;
         justify-content:center;transition:transform .15s,box-shadow .15s;">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
       stroke="#141009" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="2" width="6" height="12" rx="3"/>
    <path d="M19 10a7 7 0 0 1-14 0"/>
    <line x1="12" y1="17" x2="12" y2="22"/>
    <line x1="9" y1="22" x2="15" y2="22"/>
  </svg>
</button>
`;

const tail = `<!-- Toast -->
<div id="toast" role="status" aria-live="polite" aria-atomic="true"></div>

<!-- Libraries -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
<script>
  const SUPABASE_URL = 'https://zczxusyfepcblgelzmep.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_-onWuTJWF5CB1VClm3Uexg_3TszdyOQ';
  window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
</script>
<!-- app.js -->
<script src="app.js?v=44"></script>
<!-- voice.js -->
<script src="voice.js?v=1"></script>
${voiceModal}
</body>
</html>
`;

fs.writeFileSync('public/www/index.html', base + tail, 'utf8');
console.log('index.html rebuilt. Total bytes:', (base + tail).length);

// ── 2. Create voice.js ────────────────────────────────────────────────────────
const voiceJS = `/* ============================================================
   voice.js — BizTrack Voice Entry (Web Speech API)
   Free, no paid API. Works on Chrome, Edge, mobile Chrome.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- element refs ---------- */
  const fab        = document.getElementById('voice-fab');
  const modal      = document.getElementById('voice-modal');
  const micBtn     = document.getElementById('voice-mic-btn');
  const transcript = document.getElementById('voice-transcript');
  const statusMsg  = document.getElementById('voice-status-msg');
  const confirmBtn = document.getElementById('voice-confirm-btn');
  const cancelBtn  = document.getElementById('voice-cancel-btn');

  if (!fab || !modal) return; // safety guard

  /* ---------- state ---------- */
  let targetInput   = null;   // the input/textarea that opened the modal
  let recognizer    = null;
  let isListening   = false;

  /* ---------- pulse animation (CSS injected) ---------- */
  const style = document.createElement('style');
  style.textContent = \`
    @keyframes voicePulse {
      0%   { box-shadow: 0 0 0 0   rgba(201,152,42,.55); }
      70%  { box-shadow: 0 0 0 18px rgba(201,152,42,0);  }
      100% { box-shadow: 0 0 0 0   rgba(201,152,42,0);  }
    }
    #voice-mic-btn.listening { animation: voicePulse 1.2s infinite; background:#E8BE6A !important; }
    #voice-fab:hover, #voice-mic-btn:hover { transform: scale(1.08); }
    #voice-confirm-btn:hover { background:#E8BE6A !important; }
    #voice-cancel-btn:hover  { border-color:#C9982A; color:#C9982A; }
  \`;
  document.head.appendChild(style);

  /* ---------- speech recognition setup ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SR) {
    // Hide FAB when unsupported; show message when modal is somehow opened
    fab.title = 'Voice input not supported in this browser';
    fab.style.opacity = '0.45';
    fab.addEventListener('click', () => {
      alert('Voice input requires Chrome or Edge. Please open the app in one of those browsers.');
    });
    return;
  }

  function buildRecognizer() {
    const r = new SR();
    r.continuous      = true;
    r.interimResults  = true;
    r.lang            = 'en-US';

    r.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      transcript.value = (transcript.value.replace(/[…]+$/, '') + final + (interim ? ' ' + interim + '…' : '')).trimStart();
    };

    r.onerror = (e) => {
      console.warn('SpeechRecognition error:', e.error);
      if (e.error === 'not-allowed') {
        setStatus('Microphone permission denied. Please allow mic access and try again.', true);
      } else {
        setStatus('Error: ' + e.error + '. Tap mic to retry.', true);
      }
      stopListening();
    };

    r.onend = () => { if (isListening) startListening(); }; // auto-restart for continuous mode

    return r;
  }

  /* ---------- helpers ---------- */
  function setStatus(msg, isError) {
    if (!statusMsg) return;
    statusMsg.textContent = msg;
    statusMsg.style.color = isError ? '#B53030' : '#7A6E58';
  }

  function openModal(triggerEl) {
    targetInput = (triggerEl && (triggerEl.tagName === 'INPUT' || triggerEl.tagName === 'TEXTAREA'))
      ? triggerEl : null;
    transcript.value = '';
    setStatus('Tap the mic and speak clearly.');
    modal.style.display = 'flex';
    startListening();
  }

  function closeModal() {
    modal.style.display = 'none';
    stopListening();
  }

  function startListening() {
    if (!recognizer) recognizer = buildRecognizer();
    try {
      recognizer.start();
      isListening = true;
      micBtn.classList.add('listening');
      setStatus('Listening… speak now.');
    } catch (e) {
      // already started — ignore
    }
  }

  function stopListening() {
    isListening = false;
    micBtn.classList.remove('listening');
    if (recognizer) { try { recognizer.stop(); } catch (_) {} recognizer = null; }
    setStatus('Tap the mic to start speaking.');
  }

  /* ---------- event listeners ---------- */

  // Floating button — opens modal; tries to detect the last-focused input
  let lastFocused = null;
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      lastFocused = e.target;
    }
  }, true);

  fab.addEventListener('click', () => openModal(lastFocused));

  // Big mic button inside modal toggles listening
  micBtn.addEventListener('click', () => {
    isListening ? stopListening() : startListening();
  });

  // Confirm — inject transcript into target input
  confirmBtn.addEventListener('click', () => {
    const text = transcript.value.replace(/…+$/, '').trim();
    if (targetInput && text) {
      targetInput.value = text;
      // Fire native input event so any existing listeners (e.g. React/Vue) pick it up
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      targetInput.dispatchEvent(new CustomEvent('voiceInputConfirmed', { detail: { text }, bubbles: true }));
      targetInput.focus();
    }
    closeModal();
  });

  // Cancel
  cancelBtn.addEventListener('click', closeModal);

  // Close on backdrop click
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  console.log('[BizTrack] Voice entry ready.');
})();
`;

fs.writeFileSync('public/www/voice.js', voiceJS, 'utf8');
console.log('voice.js created. Bytes:', voiceJS.length);
