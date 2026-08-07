const fs = require('fs');

// 1. Update public/www/index.html
let indexHtml = fs.readFileSync('public/www/index.html', 'utf8');

// Replace FAB action button with "🎤 BizTrack Voice Assistant"
const oldFabRegex = /<button class="fab-item" id="fab-action-voice"[\s\S]*?<\/button>/;
const newFabHtml = `<button class="fab-item" id="fab-action-voice" onclick="if(window.openVoiceModal) window.openVoiceModal(); if(window.toggleFabMenu) toggleFabMenu(false);" aria-label="BizTrack Voice Assistant">
      <span class="fab-label">🎤 BizTrack Voice Assistant</span>
      <div class="fab-icon-btn" style="background:var(--gold,#C9982A); color:var(--ink,#141009); font-size:1.2rem;">🎤</div>
    </button>`;

if (oldFabRegex.test(indexHtml)) {
  indexHtml = indexHtml.replace(oldFabRegex, newFabHtml);
} else {
  const stockNeedle = 'id="fab-action-stock"';
  if (indexHtml.includes(stockNeedle)) {
    const insertPos = indexHtml.indexOf('</button>', indexHtml.indexOf(stockNeedle)) + 9;
    indexHtml = indexHtml.slice(0, insertPos) + '\n    ' + newFabHtml + indexHtml.slice(insertPos);
  }
}

// Modern Modal for Phase 1 BizTrack Voice Assistant
const newModalHtml = `<!-- ===== BIZTRACK VOICE ASSISTANT MODAL ===== -->
<div id="voice-modal" role="dialog" aria-modal="true" aria-label="BizTrack Voice Assistant"
  style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);
         align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px);">
  <div style="background:#fff;border-radius:20px;padding:1.5rem;width:100%;max-width:440px;
              box-shadow:0 12px 48px rgba(0,0,0,0.3);border:1.5px solid var(--border,#DDD4BE);
              display:flex;flex-direction:column;gap:0.85rem;animation:fadeSlideUp 0.25s ease-out;">
    
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <h3 style="font-family:'Playfair Display',Georgia,serif;color:var(--gold,#C9982A);margin:0;font-size:1.25rem;font-weight:700;display:flex;align-items:center;gap:0.4rem;">
          🎤 BizTrack Voice Assistant
        </h3>
        <p style="font-size:0.8rem;color:var(--muted,#7A6E58);margin:0.2rem 0 0 0;">
          Tell BizTrack what you'd like to do.
        </p>
      </div>
      <button id="voice-close-x" onclick="if(window.closeVoiceModal) window.closeVoiceModal();" 
        style="background:transparent;border:none;font-size:1.25rem;color:var(--muted,#7A6E58);cursor:pointer;padding:0.2rem 0.4rem;">✕</button>
    </div>

    <!-- Status Message -->
    <div id="voice-status-msg" style="font-size:0.82rem;font-weight:600;color:var(--text,#1C1509);background:var(--cream2,#F3EDE0);padding:0.45rem 0.75rem;border-radius:8px;border-left:3px solid var(--gold,#C9982A);text-align:center;">
      Tap the microphone and start speaking...
    </div>

    <!-- Large Microphone & Controls Row -->
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.75rem;margin:0.4rem 0;">
      <button id="voice-mic-btn" aria-label="Start or resume recording"
        style="width:76px;height:76px;border-radius:50%;background:var(--gold,#C9982A);border:none;cursor:pointer;
               display:flex;align-items:center;justify-content:center;
               box-shadow:0 6px 20px rgba(201,152,42,.4);transition:transform .15s,box-shadow .15s;">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
             stroke="#141009" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3"/>
          <path d="M19 10a7 7 0 0 1-14 0"/>
          <line x1="12" y1="17" x2="12" y2="22"/>
          <line x1="9" y1="22" x2="15" y2="22"/>
        </svg>
      </button>

      <!-- Stop Button -->
      <button id="voice-stop-btn" style="display:none;padding:0.4rem 1rem;border-radius:20px;background:#B53030;color:#fff;border:none;font-size:0.78rem;font-weight:700;cursor:pointer;align-items:center;gap:0.35rem;box-shadow:0 2px 8px rgba(181,48,48,0.3);">
        ⏹ Stop Recording
      </button>
    </div>

    <!-- Processing Indicator -->
    <div id="voice-processing-indicator" style="display:none;align-items:center;justify-content:center;gap:0.5rem;background:var(--cream2,#F3EDE0);padding:0.5rem;border-radius:8px;font-size:0.82rem;color:var(--gold,#C9982A);font-weight:600;">
      <span style="display:inline-block;width:14px;height:14px;border:2px solid var(--gold,#C9982A);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></span>
      <span>Processing command...</span>
    </div>

    <!-- Live Transcript & Edit Area -->
    <div style="display:flex;flex-direction:column;gap:0.35rem;">
      <label style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted,#7A6E58);">
        Recognized Speech / Command:
      </label>
      <textarea id="voice-transcript"
        placeholder="Say something like: 'Record sale of 3 Bread for 1500 naira' or 'Record expense 2000 for transport'..."
        style="width:100%;min-height:85px;padding:0.65rem 0.75rem;border:1.5px solid var(--border,#DDD4BE);
               border-radius:10px;font-family:'Outfit',sans-serif;font-size:0.9rem;color:var(--text,#1C1509);
               background:var(--cream,#FAF6EF);resize:vertical;line-height:1.5;"></textarea>
    </div>

    <!-- Command Interpretation Preview Box -->
    <div id="voice-command-preview" style="display:none;background:var(--green-bg,#E4F2EB);border:1px solid var(--green,#1E6641);border-radius:10px;padding:0.65rem;font-size:0.82rem;color:var(--green,#1E6641);">
      <div style="font-weight:700;margin-bottom:0.2rem;display:flex;align-items:center;gap:0.3rem;">
        ⚡ Intent Recognized: <span id="voice-intent-name" style="text-decoration:underline;">General Text</span>
      </div>
      <div id="voice-intent-details" style="font-size:0.78rem;color:#141009;line-height:1.4;"></div>
    </div>

    <!-- Action Buttons: Confirm, Edit, Cancel -->
    <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.25rem;">
      <button id="voice-cancel-btn"
        style="flex:1;padding:0.6rem 0.8rem;border:1.5px solid var(--border,#DDD4BE);border-radius:10px;
               background:#fff;color:var(--muted,#7A6E58);font-size:0.85rem;font-weight:600;cursor:pointer;">
        Cancel
      </button>
      <button id="voice-edit-btn"
        style="flex:1;padding:0.6rem 0.8rem;border:1.5px solid var(--gold,#C9982A);border-radius:10px;
               background:var(--cream2,#F3EDE0);color:var(--ink,#141009);font-size:0.85rem;font-weight:600;cursor:pointer;">
        ✏️ Edit
      </button>
      <button id="voice-confirm-btn"
        style="flex:1.2;padding:0.6rem 1rem;border:none;border-radius:10px;
               background:var(--gold,#C9982A);color:var(--ink,#141009);font-size:0.88rem;font-weight:700;cursor:pointer;
               box-shadow:0 4px 12px rgba(201,152,42,0.3);">
        ✓ Confirm
      </button>
    </div>

  </div>
</div>`;

const modalPattern = /<div id="voice-modal"[\s\S]*?<\/div>\s*<\/div>/;
if (modalPattern.test(indexHtml)) {
  indexHtml = indexHtml.replace(modalPattern, newModalHtml);
} else if (indexHtml.includes('</body>')) {
  indexHtml = indexHtml.replace('</body>', newModalHtml + '\n</body>');
}

fs.writeFileSync('public/www/index.html', indexHtml, 'utf8');
console.log('Updated index.html modal & FAB!');

if (fs.existsSync('public/index.html')) {
  try { fs.writeFileSync('public/index.html', indexHtml, 'utf8'); } catch (e) {}
}

// 2. Write updated public/www/voice.js
const voiceAssistantJs = `/* ============================================================
   voice.js — BizTrack Voice Assistant (Phase 1)
   Built with free Web Speech API (SpeechRecognition).
   ============================================================ */
(function () {
  'use strict';

  let targetInput     = null;
  let recognizer      = null;
  let isListening     = false;
  let lastFocused     = null;
  let parsedCommand   = null;

  // Track active/focused input elements across app
  document.addEventListener('focusin', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.target.id !== 'voice-transcript') {
      lastFocused = e.target;
    }
  }, true);

  function getEl(id) { return document.getElementById(id); }

  // Inject animation styles
  if (!document.getElementById('voice-assistant-style')) {
    const style = document.createElement('style');
    style.id = 'voice-assistant-style';
    style.textContent = \`
      @keyframes voicePulse {
        0%   { box-shadow: 0 0 0 0 rgba(201,152,42,.65); transform: scale(1); }
        50%  { transform: scale(1.04); }
        70%  { box-shadow: 0 0 0 20px rgba(201,152,42,0); }
        100% { box-shadow: 0 0 0 0 rgba(201,152,42,0); transform: scale(1); }
      }
      #voice-mic-btn.listening { animation: voicePulse 1.2s infinite; background: #E8BE6A !important; }
      #voice-mic-btn:hover { transform: scale(1.05); }
      #voice-confirm-btn:hover { background: #E8BE6A !important; transform: translateY(-1px); }
      #voice-edit-btn:hover { background: #EAE1CC !important; }
      #voice-cancel-btn:hover { border-color: #C9982A; color: #C9982A; }
    \`;
    document.head.appendChild(style);
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function setStatus(msg, isError) {
    const el = getEl('voice-status-msg');
    if (!el) return;
    el.textContent = msg;
    el.style.borderColor = isError ? '#B53030' : 'var(--gold,#C9982A)';
    el.style.color = isError ? '#B53030' : 'var(--text,#1C1509)';
  }

  function setProcessing(show) {
    const proc = getEl('voice-processing-indicator');
    if (proc) proc.style.display = show ? 'flex' : 'none';
  }

  function setStopBtn(show) {
    const btn = getEl('voice-stop-btn');
    if (btn) btn.style.display = show ? 'inline-flex' : 'none';
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
      const tx = getEl('voice-transcript');
      if (tx) {
        const current = tx.value.replace(/[…]+$/, '').trim();
        const addition = (final + (interim ? ' ' + interim + '…' : '')).trim();
        tx.value = (current + ' ' + addition).trim();
      }
      interpretCommand();
    };

    r.onerror = (e) => {
      console.warn('SpeechRecognition error:', e.error);
      if (e.error === 'not-allowed') {
        setStatus('Microphone permission denied. Please allow mic access in your browser.', true);
      } else if (e.error !== 'no-speech') {
        setStatus('Speech recognition error: ' + e.error, true);
      }
      stopListening();
    };

    r.onend = () => {
      if (isListening) {
        try { recognizer.start(); } catch (_) { stopListening(); }
      }
    };

    return r;
  }

  function startListening() {
    if (!SR) {
      setStatus('Speech Recognition is not supported in this browser. Please try Google Chrome or MS Edge.', true);
      return;
    }
    if (!recognizer) recognizer = buildRecognizer();
    try {
      recognizer.start();
      isListening = true;
      const micBtn = getEl('voice-mic-btn');
      if (micBtn) micBtn.classList.add('listening');
      setStopBtn(true);
      setStatus('🎙️ Listening... Speak your command clearly.');
    } catch (e) {
      // Already running
    }
  }

  function stopListening() {
    isListening = false;
    const micBtn = getEl('voice-mic-btn');
    if (micBtn) micBtn.classList.remove('listening');
    setStopBtn(false);
    if (recognizer) {
      try { recognizer.stop(); } catch (_) {}
      recognizer = null;
    }
    setStatus('Recording stopped. Review your command or tap mic to resume.');
    interpretCommand();
  }

  function interpretCommand() {
    const tx = getEl('voice-transcript');
    if (!tx) return;
    const text = tx.value.replace(/…+$/, '').trim();
    if (!text) {
      hidePreview();
      return;
    }

    setProcessing(true);

    setTimeout(() => {
      setProcessing(false);
      const lower = text.toLowerCase();
      parsedCommand = null;

      if (lower.includes('sale') || lower.includes('sold') || lower.includes('sell')) {
        const qtyMatch = lower.match(/(?:sold|sale|of|qty)\s+(\d+)/) || lower.match(/(\d+)\s+[a-zA-Z]/);
        const priceMatch = lower.match(/(?:for|price|cost|naira|₦)\s*(\d+(?:\.\d+)?)/) || lower.match(/(\d+(?:\.\d+)?)\s*(?:naira|n)/);
        const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
        const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
        
        let productName = text.replace(/record|sale|sold|sell|of|for|naira|₦|\d+/gi, '').trim() || 'Item';
        productName = productName.replace(/^\s*(?:a|an|the)\s+/i, '');

        parsedCommand = {
          type: 'SALE',
          title: 'Record Sale',
          details: \`Product: <strong>\${productName}</strong> | Qty: <strong>\${qty}</strong> | Price: <strong>₦\${price.toLocaleString()}</strong>\`,
          data: { name: productName, qty, price }
        };
      } else if (lower.includes('expense') || lower.includes('paid') || lower.includes('bought') || lower.includes('spent')) {
        const amountMatch = lower.match(/(?:expense|paid|spent|cost|naira|₦|\$)\s*(\d+(?:\.\d+)?)/) || lower.match(/(\d+(?:\.\d+)?)\s*(?:naira|for)/);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
        
        let category = text.replace(/record|expense|paid|spent|bought|for|naira|₦|\d+/gi, '').trim() || 'General Expense';
        category = category.replace(/^\s*(?:a|an|the)\s+/i, '');

        parsedCommand = {
          type: 'EXPENSE',
          title: 'Record Expense',
          details: \`Category: <strong>\${category}</strong> | Amount: <strong>₦\${amount.toLocaleString()}</strong>\`,
          data: { category, amount }
        };
      } else if (lower.includes('invoice') || lower.includes('bill')) {
        let customer = text.replace(/create|generate|invoice|bill|for|customer/gi, '').trim() || 'Customer';
        parsedCommand = {
          type: 'INVOICE',
          title: 'Create Invoice',
          details: \`Customer: <strong>\${customer}</strong>\`,
          data: { customer }
        };
      } else {
        parsedCommand = {
          type: 'TEXT',
          title: 'Insert Text',
          details: \`Text: "<em>\${text}</em>"\`,
          data: { text }
        };
      }

      showPreview(parsedCommand);
    }, 120);
  }

  function showPreview(cmd) {
    const preview = getEl('voice-command-preview');
    const intentName = getEl('voice-intent-name');
    const intentDetails = getEl('voice-intent-details');
    if (!preview || !cmd) return;

    intentName.textContent = cmd.title;
    intentDetails.innerHTML = cmd.details;
    preview.style.display = 'block';
  }

  function hidePreview() {
    const preview = getEl('voice-command-preview');
    if (preview) preview.style.display = 'none';
  }

  function openVoiceModal(inputEl) {
    const modal = getEl('voice-modal');
    if (!modal) return;

    targetInput = inputEl || (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') && document.activeElement.id !== 'voice-transcript' ? document.activeElement : lastFocused);

    const tx = getEl('voice-transcript');
    if (tx) tx.value = '';

    hidePreview();
    setProcessing(false);

    modal.style.display = 'flex';
    startListening();
  }

  function closeVoiceModal() {
    const modal = getEl('voice-modal');
    if (modal) modal.style.display = 'none';
    stopListening();
  }

  function executeConfirmedAction() {
    const tx = getEl('voice-transcript');
    const text = tx ? tx.value.replace(/…+$/, '').trim() : '';

    if (!text) {
      closeVoiceModal();
      return;
    }

    if (parsedCommand) {
      if (parsedCommand.type === 'SALE' && window.handleFabAction) {
        window.handleFabAction('sales');
        setTimeout(() => {
          const pName = getEl('sale-name') || getEl('product-name');
          const pQty = getEl('sale-qty') || getEl('qty');
          const pPrice = getEl('sale-price') || getEl('price');
          if (pName) pName.value = parsedCommand.data.name;
          if (pQty) pQty.value = parsedCommand.data.qty;
          if (pPrice) pPrice.value = parsedCommand.data.price;
        }, 200);
      } else if (parsedCommand.type === 'EXPENSE' && window.handleFabAction) {
        window.handleFabAction('expense');
        setTimeout(() => {
          const expCat = getEl('exp-category') || getEl('exp-desc');
          const expAmt = getEl('exp-amount');
          if (expCat) expCat.value = parsedCommand.data.category;
          if (expAmt) expAmt.value = parsedCommand.data.amount;
        }, 200);
      } else if (parsedCommand.type === 'INVOICE' && window.handleFabAction) {
        window.handleFabAction('invoice');
        setTimeout(() => {
          const cust = getEl('inv-customer-name') || getEl('customer-name');
          if (cust) cust.value = parsedCommand.data.customer;
        }, 200);
      } else if (targetInput) {
        targetInput.value = text;
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        targetInput.dispatchEvent(new Event('change', { bubbles: true }));
        targetInput.focus();
      } else {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text);
          if (window.showToast) window.showToast('Copied voice text to clipboard!');
        }
      }
    }

    closeVoiceModal();
  }

  // Global exports
  window.openVoiceModal  = openVoiceModal;
  window.closeVoiceModal = closeVoiceModal;

  function initVoiceUI() {
    const modal = getEl('voice-modal');
    if (!modal) return;

    const micBtn = getEl('voice-mic-btn');
    if (micBtn) {
      micBtn.onclick = () => { isListening ? stopListening() : startListening(); };
    }

    const stopBtn = getEl('voice-stop-btn');
    if (stopBtn) {
      stopBtn.onclick = stopListening;
    }

    const confirmBtn = getEl('voice-confirm-btn');
    if (confirmBtn) {
      confirmBtn.onclick = executeConfirmedAction;
    }

    const editBtn = getEl('voice-edit-btn');
    if (editBtn) {
      editBtn.onclick = () => {
        stopListening();
        const tx = getEl('voice-transcript');
        if (tx) {
          tx.focus();
          setStatus('✏️ Editing transcript manually...');
        }
      };
    }

    const cancelBtn = getEl('voice-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = closeVoiceModal;
    }

    const tx = getEl('voice-transcript');
    if (tx) {
      tx.oninput = interpretCommand;
    }

    modal.onclick = (e) => {
      if (e.target === modal) closeVoiceModal();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVoiceUI);
  } else {
    initVoiceUI();
  }

  console.log('[BizTrack] Voice Assistant Phase 1 initialized.');
})();
`;

fs.writeFileSync('public/www/voice.js', voiceAssistantJs, 'utf8');
console.log('Updated public/www/voice.js Phase 1 successfully!');

if (fs.existsSync('public/voice.js')) {
  try { fs.writeFileSync('public/voice.js', voiceAssistantJs, 'utf8'); } catch (e) {}
}
