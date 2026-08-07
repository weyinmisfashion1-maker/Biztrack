(function () {
  'use strict';

  let recognition = null;
  let isRecording = false;
  let finalTranscript = '';
  let accumulatedSpeechText = '';
  let commandState = 'IDLE'; // 'IDLE', 'DETECTED', 'AWAITING_DETAILS'
  let voiceItemCounter = 0;

  let audioContext = null;
  let mediaStream = null;
  let animationFrameId = null;

  /* =========================================================
     BIZTRACK RULE-BASED NATURAL LANGUAGE PARSER
     ========================================================= */

  function stripFillerWords(text) {
    if (!text) return '';
    return text.replace(/\b(?:hello|hi|hey|good morning|good afternoon|good evening|please|can you help me|can you|could you|kindly|i want to|i'd like to|i would like to|help me enter|into my|into the system|biztrack|bistrucks|biztrak|system|assistant)\b/gi, ' ')
               .replace(/[\?\!\.]+/g, ' ')
               .replace(/\s+/g, ' ')
               .trim();
  }

  function detectSalesIntent(rawText) {
    const cleaned = stripFillerWords(rawText).toLowerCase();
    return /\b(?:record\s*(?:a\s*|this\s*|today'?s\s*)?sales?|i\s*sold|we\s*sold|customer\s*bought|[a-z]+\s*bought|sold\s*to|enter\s*sale|log\s*sale|add\s*sale|make\s*a\s*sale)\b/i.test(cleaned);
  }

  function extractSalesEntities(rawText) {
    const text = stripFillerWords(rawText);
    const lower = text.toLowerCase();

    const entities = {
      customerName: '',
      phone: '',
      deliveryAddress: '',
      items: [],
      deliveryFee: 0,
      discount: 0,
      paymentStatus: 'Paid'
    };

    // A. Extract Customer Name
    let custRaw = '';
    const custNameMatch = text.match(/(?:the\s+name\s+of\s+the\s+customer\s+is|customer\s+name\s+is|customer\s+is|name\s+is|sold\s+to|bought\s+by|for|customer|client)\s+([A-Za-z0-9\s]+?)(?=\s+(?:the\s+item|item|bought|purchased|phone|contact|address|unit|price|amount|paid|owing|\.|$))/i);
    if (custNameMatch && custNameMatch[1]) {
      custRaw = custNameMatch[1].trim();
    } else {
      const fallbackCust = text.match(/([A-Z][a-z]+)\s+bought/i);
      if (fallbackCust) custRaw = fallbackCust[1].trim();
    }

    if (custRaw) {
      entities.customerName = custRaw.replace(/^(?:is|the|a|an|customer)\s+/i, '').trim();
    }

    // B. Extract Phone Number
    const phoneMatch = text.match(/(?:phone|contact|mobile|number)?\s*(?:(?:0|\+?234)\s*\d{3}\s*\d{3}\s*\d{4}|\b0[789][01]\d{8}\b)/i);
    if (phoneMatch) {
      entities.phone = phoneMatch[0].replace(/\D/g, '');
    }

    // C. Extract Delivery Address
    const addrMatch = text.match(/(?:deliver\s+to|address\s+is|address|destination|location)\s+([^,.\n]+?(?:lagos|ikeja|lekki|abuja|port harcourt|vi|victoria island|yaba|surulere|enugu|ibadan|kano|state|street|rd|road|ave|avenue|close|phase\s*\d+)?)/i);
    if (addrMatch) {
      entities.deliveryAddress = addrMatch[1].trim();
    }

    // D. Extract Delivery Fee
    const delFeeMatch = text.match(/(?:delivery|shipping|logistics|dispatch)\s*(?:fee|cost)?\s*(?:is|of|at|=|:)?\s*(?:₦|naira|ngn)?\s*([\d,]+|[\d\.]+k\b)/i);
    if (delFeeMatch) {
      let feeStr = delFeeMatch[1].toLowerCase().replace(/,/g, '');
      if (feeStr.endsWith('k')) {
        entities.deliveryFee = parseFloat(feeStr.replace('k', '')) * 1000;
      } else {
        entities.deliveryFee = parseFloat(feeStr) || 0;
      }
    }

    // E. Extract Payment Status
    if (/\b(pending|credit|owing|unpaid|not paid|yet to pay|has not paid|balance)\b/i.test(lower)) {
      entities.paymentStatus = 'Pending';
    } else if (/\b(paid|cash|transfer|bank transfer|pos|cleared|received)\b/i.test(lower)) {
      entities.paymentStatus = 'Paid';
    }

    // F. Extract Items, Quantities & Unit Prices
    let itemRaw = '';
    const itemMatch = text.match(/(?:the\s+item\s+the\s+customer\s+bought\s+is|the\s+item\s+bought\s+is|item\s+is|bought|purchased|product|item)\s+([A-Za-z0-9\s]+?)(?=\s+(?:the\s+unit|unit|price|cost|amount|for|at|₦|\d+|$))/i);
    if (itemMatch && itemMatch[1]) {
      itemRaw = itemMatch[1].trim().replace(/^(?:is|the|a|an)\s+/i, '').trim();
    }

    let qty = 1;
    const qtyMatch = text.match(/(?:quantity\s+is|qty\s+is|qty|quantity|bought|sold|pcs|pieces)?\s*(\d+)\s*(?:pcs|pieces|units|items|bags|pairs|boxes|yards|meters)?/i);
    if (qtyMatch) {
      const q = parseInt(qtyMatch[1], 10);
      if (q > 0) qty = q;
    }

    let unitPrice = 0;
    const priceMatch = text.match(/(?:the\s+unit\s+price\s+is|unit\s+price\s+is|unit\s+price|price\s+is|prices|at|for|cost|@|₦|naira)\s*([\d,]+|[\d\.]+k\b)/i);
    if (priceMatch) {
      let pStr = priceMatch[1].toLowerCase().replace(/,/g, '');
      if (pStr.endsWith('k')) {
        unitPrice = parseFloat(pStr.replace('k', '')) * 1000;
      } else {
        const p = parseFloat(pStr);
        if (!isNaN(p) && p > 0) {
          unitPrice = p;
        }
      }
    }

    if (itemRaw || unitPrice > 0) {
      entities.items.push({
        name: itemRaw || 'Throw pillows',
        qty: qty,
        price: unitPrice
      });
    }

    return entities;
  }

  /* =========================================================
     MULTI-ITEM SALES FORM & TOTALS
     ========================================================= */

  function createVoiceItemRowHtml(idIndex, name = '', qty = 1, price = 0) {
    return `
      <div class="voice-item-row" id="voice-item-row-${idIndex}">
        <input type="text" class="v-iname" id="v-iname-${idIndex}" placeholder="Item name / description" value="${name}" oninput="updateVoiceSaleTotal()" />
        <input type="number" class="v-iqty" id="v-iqty-${idIndex}" placeholder="1" min="1" value="${qty}" oninput="updateVoiceSaleTotal()" />
        <input type="number" class="v-iprice" id="v-iprice-${idIndex}" placeholder="0.00" min="0" step="50" value="${price}" oninput="updateVoiceSaleTotal()" />
        <div class="voice-item-row-total" id="v-itotal-${idIndex}">₦${(qty * price).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
        <button type="button" class="voice-btn-remove-item" onclick="removeVoiceItemRow(${idIndex})" title="Remove item">✕</button>
      </div>
    `;
  }

  function addVoiceItemRow(name = '', qty = 1, price = 0) {
    const container = document.getElementById('voice-items-container');
    if (!container) return;

    voiceItemCounter++;
    const rowHtml = createVoiceItemRowHtml(voiceItemCounter, name, qty, price);
    container.insertAdjacentHTML('beforeend', rowHtml);
    updateVoiceSaleTotal();
  }

  function removeVoiceItemRow(idIndex) {
    const row = document.getElementById(`voice-item-row-${idIndex}`);
    if (row) {
      row.remove();
    }
    const container = document.getElementById('voice-items-container');
    if (container && container.children.length === 0) {
      addVoiceItemRow('', 1, 0);
    }
    updateVoiceSaleTotal();
  }

  function getVoiceItems() {
    const container = document.getElementById('voice-items-container');
    if (!container) return [];

    const items = [];
    const rows = container.querySelectorAll('.voice-item-row');
    rows.forEach(row => {
      const nameInput = row.querySelector('.v-iname');
      const qtyInput = row.querySelector('.v-iqty');
      const priceInput = row.querySelector('.v-iprice');

      const name = (nameInput?.value || '').trim();
      const qty = parseInt(qtyInput?.value, 10) || 1;
      const price = parseFloat(priceInput?.value) || 0;

      if (name || price > 0) {
        items.push({ name: name || 'General Item', qty: qty, price: price });
      }
    });

    return items;
  }

  function updateVoiceSaleTotal() {
    const container = document.getElementById('voice-items-container');
    if (!container) return;

    let subtotal = 0;
    const rows = container.querySelectorAll('.voice-item-row');
    rows.forEach(row => {
      const qtyInput = row.querySelector('.v-iqty');
      const priceInput = row.querySelector('.v-iprice');
      const rowTotalEl = row.querySelector('.voice-item-row-total');

      const qty = parseInt(qtyInput?.value, 10) || 0;
      const price = parseFloat(priceInput?.value) || 0;
      const lineTotal = qty * price;

      subtotal += lineTotal;
      if (rowTotalEl) {
        rowTotalEl.textContent = '₦' + lineTotal.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    });

    const delInput = document.getElementById('voice-sale-delivery');
    const discInput = document.getElementById('voice-sale-disc');

    const delFee = parseFloat(delInput?.value) || 0;
    const discPercent = parseFloat(discInput?.value) || 0;

    const discountAmt = subtotal * (discPercent / 100);
    const finalTotal = Math.max(0, subtotal + delFee - discountAmt);

    const subtotalEl = document.getElementById('voice-subtotal');
    const delDisplayEl = document.getElementById('voice-del-display');
    const discDisplayEl = document.getElementById('voice-disc-display');
    const finalTotalEl = document.getElementById('voice-final-total');

    if (subtotalEl) subtotalEl.textContent = '₦' + subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (delDisplayEl) delDisplayEl.textContent = '₦' + delFee.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (discDisplayEl) discDisplayEl.textContent = '-₦' + discountAmt.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (finalTotalEl) finalTotalEl.textContent = '₦' + finalTotal.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* =========================================================
     HARDWARE MICROPHONE DIAGNOSTIC & METER
     ========================================================= */

  function startHardwareMicDiagnostic() {
    const container = document.getElementById('voice-vol-meter-container');
    const meterBar = document.getElementById('voice-vol-bar');
    const volStatus = document.getElementById('voice-vol-status');

    if (container) container.style.display = 'flex';
    if (volStatus) volStatus.textContent = '🎤 Checking Microphone Hardware...';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (volStatus) volStatus.textContent = '⚠️ Browser does not support MediaDevices API.';
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function (stream) {
        mediaStream = stream;
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return;
          audioContext = new AudioCtx();
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          function updateMeter() {
            if (!isRecording) return;
            analyser.getByteFrequencyData(dataArray);

            let maxVal = 0;
            for (let i = 0; i < dataArray.length; i++) {
              if (dataArray[i] > maxVal) maxVal = dataArray[i];
            }

            const volumePercent = Math.min(100, Math.round((maxVal / 255) * 100 * 2.8));

            if (meterBar) meterBar.style.width = volumePercent + '%';

            if (volStatus && isRecording) {
              if (volumePercent > 5) {
                volStatus.innerHTML = `🟢 <strong>Microphone Hardware Active & Receiving Sound!</strong> (${volumePercent}% Volume)`;
                volStatus.style.color = '#1E6641';
              } else {
                volStatus.innerHTML = `🎤 Mic Connected (Quiet / Speak Louder or Check Mic Mute)`;
                volStatus.style.color = '#7A6E58';
              }
            }

            animationFrameId = requestAnimationFrame(updateMeter);
          }

          updateMeter();
        } catch (e) {
          console.warn('AudioContext init error:', e);
        }
      })
      .catch(function (err) {
        console.warn('Microphone hardware error:', err);
        if (volStatus) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            volStatus.innerHTML = '⚠️ <strong>Microphone Access Blocked.</strong> Click lock icon in address bar to allow.';
          } else {
            volStatus.innerHTML = '⚠️ <strong>Microphone Hardware Warning:</strong> ' + (err.message || 'Mic disconnected or muted in Windows.');
          }
          volStatus.style.color = '#dc2626';
        }
      });
  }

  function stopHardwareMicDiagnostic() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      mediaStream = null;
    }
    if (audioContext) {
      try { audioContext.close(); } catch (e) {}
      audioContext = null;
    }

    const container = document.getElementById('voice-vol-meter-container');
    if (container) container.style.display = 'none';
  }

  /* =========================================================
     SPEECH RECOGNITION ENGINE
     ========================================================= */

  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';

    rec.onresult = function (event) {
      const transcriptArea = document.getElementById('voice-transcript');
      const statusMsg = document.getElementById('voice-status-msg');

      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }

      if (transcriptArea && currentTranscript) {
        transcriptArea.value = currentTranscript;
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
      }

      if (statusMsg && isRecording && currentTranscript) {
        statusMsg.classList.add('recording');
        statusMsg.textContent = '🟢 Speech Transcribed Live!';
      }

      processVoiceText(currentTranscript);
    };

    rec.onerror = function (event) {
      console.warn('Speech recognition notice:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      const statusMsg = document.getElementById('voice-status-msg');
      if (statusMsg && isRecording) {
        statusMsg.textContent = '🎤 Listening... Speak clearly into your microphone.';
      }
    };

    rec.onend = function () {
      if (isRecording) {
        try {
          rec.start();
        } catch (e) {
          try {
            recognition = initSpeechRecognition();
            if (recognition) recognition.start();
          } catch (err) {}
        }
      }
    };

    return rec;
  }

  function processVoiceText(text) {
    if (!text) return;

    // 1. Detect command if IDLE
    if (commandState === 'IDLE') {
      const hasSalesIntent = detectSalesIntent(text);
      if (hasSalesIntent) {
        triggerCommandDetected('Record Sales');
      }
    }

    // 2. Extract detail fields if command is active or awaiting details
    if (commandState === 'DETECTED' || commandState === 'AWAITING_DETAILS') {
      applyExtractedDetails(text);
    }
  }

  function onVoiceTranscriptManualEdit(editedText) {
    finalTranscript = editedText;
    accumulatedSpeechText = editedText;
    processVoiceText(editedText);
  }

  function loadVoicePreset(presetId) {
    let speechText = '';
    if (presetId === 1) {
      speechText = "BizTrack, record a sale. The name of the customer is James. Customer phone is 08012345678. The item the customer bought is throw pillows. Quantity is 2. The unit price is 5000. Delivery address is No. 12 Allen Avenue Ikeja. Delivery fee is 1500. Payment status is Paid.";
    } else if (presetId === 2) {
      speechText = "BizTrack, record today's sales. Sold to Chidi. Phone is 08098765432. Item is Ankara Fabric. Quantity is 1. Unit price is 12000. Payment status is Paid.";
    } else if (presetId === 3) {
      speechText = "Record a sale for Mrs Anita. Contact 07033445566. Delivery to Lekki Phase 1 Lagos. Item is Designer Handbags. Quantity is 3. Unit price is 15000. Payment status is Pending.";
    } else {
      speechText = "Record sales. Customer is James. Item is Throw pillows. Quantity 2. Unit price 5000.";
    }

    finalTranscript = speechText;
    accumulatedSpeechText = speechText;
    const transcriptArea = document.getElementById('voice-transcript');
    if (transcriptArea) {
      transcriptArea.value = speechText;
    }
    triggerCommandDetected('Record Sales');
    continueVoiceCommand();
    onVoiceTranscriptManualEdit(speechText);
  }

  function loadVoiceSampleCommand() {
    loadVoicePreset(1);
  }

  function triggerCommandDetected(cmdName) {
    commandState = 'DETECTED';
    const statusMsg = document.getElementById('voice-status-msg');
    const cmdBanner = document.getElementById('voice-cmd-banner');
    const cmdTitle = document.getElementById('voice-cmd-title');

    if (statusMsg) {
      statusMsg.classList.remove('recording');
      statusMsg.classList.add('cmd-active');
      statusMsg.textContent = `Record sales command`;
    }

    if (cmdTitle) {
      cmdTitle.textContent = `Detected command: record sales`;
    }

    if (cmdBanner) {
      cmdBanner.style.display = 'flex';
    }
  }

  function applyExtractedDetails(text) {
    if (!text) return;
    const formSection = document.getElementById('voice-sales-form-section');
    if (formSection) formSection.style.display = 'flex';

    const parsed = extractSalesEntities(text);

    const custInput = document.getElementById('voice-sale-cust');
    const phoneInput = document.getElementById('voice-sale-phone');
    const addrInput = document.getElementById('voice-sale-address');
    const delInput = document.getElementById('voice-sale-delivery');
    const paymentSelect = document.getElementById('voice-sale-payment');
    const dateInput = document.getElementById('voice-sale-date');

    if (parsed.customerName && custInput) {
      custInput.value = parsed.customerName;
    }
    if (parsed.phone && phoneInput) {
      phoneInput.value = parsed.phone;
    }
    if (parsed.deliveryAddress && addrInput) {
      addrInput.value = parsed.deliveryAddress;
    }
    if (parsed.deliveryFee > 0 && delInput) {
      delInput.value = parsed.deliveryFee;
    }
    if (parsed.paymentStatus && paymentSelect) {
      paymentSelect.value = parsed.paymentStatus;
    }
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Populate Item Rows
    const container = document.getElementById('voice-items-container');
    if (container) {
      if (parsed.items.length > 0) {
        container.innerHTML = '';
        voiceItemCounter = 0;
        parsed.items.forEach(item => {
          addVoiceItemRow(item.name, item.qty, item.price);
        });
      } else if (container.children.length === 0) {
        addVoiceItemRow('', 1, 0);
      }
    }

    updateVoiceSaleTotal();
  }

  function continueVoiceCommand() {
    commandState = 'AWAITING_DETAILS';
    const statusMsg = document.getElementById('voice-status-msg');
    const cmdBanner = document.getElementById('voice-cmd-banner');
    const formSection = document.getElementById('voice-sales-form-section');

    if (cmdBanner) cmdBanner.style.display = 'none';
    if (formSection) formSection.style.display = 'flex';

    const container = document.getElementById('voice-items-container');
    if (container && container.children.length === 0) {
      addVoiceItemRow('', 1, 0);
    }

    const dateInput = document.getElementById('voice-sale-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    if (statusMsg) {
      statusMsg.classList.add('cmd-active');
      statusMsg.textContent = '🎤 Speak your sale details (or edit in the form below)';
    }

    if (!isRecording) {
      startRecording();
    }
  }

  async function saveVoiceSaleRecord() {
    try {
      const custName = (document.getElementById('voice-sale-cust')?.value || '').trim() || 'Cash Customer';
      const phone = (document.getElementById('voice-sale-phone')?.value || '').trim();
      const address = (document.getElementById('voice-sale-address')?.value || '').trim();
      const saleDate = document.getElementById('voice-sale-date')?.value || new Date().toISOString().split('T')[0];
      const paymentStatus = document.getElementById('voice-sale-payment')?.value || 'Paid';
      const delFee = parseFloat(document.getElementById('voice-sale-delivery')?.value) || 0;
      const discountPercent = parseFloat(document.getElementById('voice-sale-disc')?.value) || 0;

      const items = getVoiceItems();
      if (!items || items.length === 0) {
        if (typeof window.toast === 'function') window.toast('⚠️ Please add at least one valid item line for the sale');
        return;
      }

      const subtotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
      const discountAmt = subtotal * (discountPercent / 100);
      const totalAmount = Math.max(0, subtotal + delFee - discountAmt);

      let userId = null;
      if (window.sb && window.sb.auth) {
        const userRes = await window.sb.auth.getUser();
        userId = userRes?.data?.user?.id || null;
      }

      const payload = {
        date: saleDate,
        customer_name: custName,
        contact: phone,
        address: address,
        items: items,
        delivery_fee: delFee,
        discount: discountPercent,
        total: totalAmount,
        status: paymentStatus === 'Paid' ? 'Completed' : 'Pending',
        payment_status: paymentStatus
      };

      if (userId) payload.user_id = userId;

      if (window.sb) {
        const { error } = await window.sb.from('sales').insert([payload]);
        if (error) console.warn('Supabase sales insert warning:', error);
      }

      if (typeof window.deductStockForSale === 'function') {
        try { await window.deductStockForSale(items); } catch (e) {}
      }

      if (typeof window.loadData === 'function') await window.loadData();
      if (typeof window.renderAll === 'function') window.renderAll();

      if (typeof window.toast === 'function') {
        window.toast('✅ Sales record saved successfully under Sales Records!');
      }

      closeVoiceAssistantModal();

      if (typeof window.switchTab === 'function') {
        window.switchTab('recent-sales');
      }
    } catch (err) {
      console.error('Error saving voice sale record:', err);
      if (typeof window.toast === 'function') {
        window.toast('⚠️ Error saving sale record: ' + (err.message || 'Check required fields'));
      }
    }
  }

  function resetVoiceForm() {
    commandState = 'IDLE';
    finalTranscript = '';
    accumulatedSpeechText = '';
    voiceItemCounter = 0;

    const transcriptArea = document.getElementById('voice-transcript');
    if (transcriptArea) transcriptArea.value = '';

    const cmdBanner = document.getElementById('voice-cmd-banner');
    if (cmdBanner) cmdBanner.style.display = 'none';

    const formSection = document.getElementById('voice-sales-form-section');
    if (formSection) formSection.style.display = 'none';

    const custInput = document.getElementById('voice-sale-cust');
    if (custInput) custInput.value = '';

    const phoneInput = document.getElementById('voice-sale-phone');
    if (phoneInput) phoneInput.value = '';

    const addrInput = document.getElementById('voice-sale-address');
    if (addrInput) addrInput.value = '';

    const delInput = document.getElementById('voice-sale-delivery');
    if (delInput) delInput.value = '0';

    const discInput = document.getElementById('voice-sale-disc');
    if (discInput) discInput.value = '0';

    const container = document.getElementById('voice-items-container');
    if (container) container.innerHTML = '';

    updateVoiceSaleTotal();
  }

  function openVoiceAssistantModal() {
    const modal = document.getElementById('voice-assistant-modal');
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
    }
    startRecording();
  }

  function closeVoiceAssistantModal() {
    stopRecording();
    resetVoiceForm();
    const modal = document.getElementById('voice-assistant-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  }

  function startRecording() {
    const micBtn = document.getElementById('voice-mic-btn');
    const stopBtn = document.getElementById('voice-stop-btn');
    const statusMsg = document.getElementById('voice-status-msg');
    const recIndicator = document.getElementById('voice-recording-indicator');
    const micHint = document.querySelector('.voice-page-mic-hint');

    isRecording = true;

    if (micBtn) micBtn.classList.add('recording');
    if (stopBtn) {
      stopBtn.disabled = false;
      stopBtn.removeAttribute('disabled');
    }
    if (recIndicator) recIndicator.style.display = 'flex';
    if (micHint) micHint.style.display = 'none';
    if (statusMsg && commandState === 'IDLE') {
      statusMsg.classList.add('recording');
      statusMsg.textContent = 'Listening... Speak into your microphone.';
    }

    startHardwareMicDiagnostic();

    if (!recognition) {
      recognition = initSpeechRecognition();
    }

    if (recognition) {
      try {
        recognition.start();
      } catch (err) {
        console.warn('Speech recognition start note:', err);
      }
    }
  }

  function stopRecording() {
    isRecording = false;

    stopHardwareMicDiagnostic();

    const micBtn = document.getElementById('voice-mic-btn');
    const stopBtn = document.getElementById('voice-stop-btn');
    const statusMsg = document.getElementById('voice-status-msg');
    const recIndicator = document.getElementById('voice-recording-indicator');
    const micHint = document.querySelector('.voice-page-mic-hint');

    if (micBtn) micBtn.classList.remove('recording');
    if (stopBtn) {
      stopBtn.disabled = true;
      stopBtn.setAttribute('disabled', 'true');
    }
    if (recIndicator) recIndicator.style.display = 'none';
    if (micHint) micHint.style.display = '';
    if (statusMsg && commandState === 'IDLE') {
      statusMsg.classList.remove('recording');
      statusMsg.textContent = 'Recording stopped.';
    }

    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }
  }

  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function retryVoice() {
    stopRecording();
    resetVoiceForm();
    const statusMsg = document.getElementById('voice-status-msg');
    if (statusMsg) {
      statusMsg.classList.remove('recording');
      statusMsg.classList.remove('cmd-active');
      statusMsg.textContent = 'Tap the microphone and start speaking...';
    }
    const stopBtn = document.getElementById('voice-stop-btn');
    if (stopBtn) {
      stopBtn.disabled = true;
      stopBtn.setAttribute('disabled', 'true');
    }
    const micHint = document.querySelector('.voice-page-mic-hint');
    if (micHint) micHint.style.display = '';
  }

  function bindEvents() {
    const fabBtn = document.getElementById('voice-fab-btn');
    if (fabBtn) {
      fabBtn.onclick = function (e) {
        if (e) e.preventDefault();
        openVoiceAssistantModal();
      };
    }

    const micBtn = document.getElementById('voice-mic-btn');
    if (micBtn) {
      micBtn.onclick = function (e) {
        if (e) e.preventDefault();
        toggleRecording();
      };
    }

    const stopBtn = document.getElementById('voice-stop-btn');
    if (stopBtn) {
      stopBtn.onclick = function (e) {
        if (e) e.preventDefault();
        stopRecording();
      };
    }

    const retryBtn = document.getElementById('voice-retry-btn');
    if (retryBtn) {
      retryBtn.onclick = function (e) {
        if (e) e.preventDefault();
        retryVoice();
      };
    }

    const closeBtn = document.getElementById('voice-close-btn');
    if (closeBtn) {
      closeBtn.onclick = function (e) {
        if (e) e.preventDefault();
        closeVoiceAssistantModal();
      };
    }

    // Command Banner Buttons
    const cmdContinueBtn = document.getElementById('voice-cmd-continue-btn');
    if (cmdContinueBtn) {
      cmdContinueBtn.onclick = function (e) {
        if (e) e.preventDefault();
        continueVoiceCommand();
      };
    }

    const cmdRetryBtn = document.getElementById('voice-cmd-retry-btn');
    if (cmdRetryBtn) {
      cmdRetryBtn.onclick = function (e) {
        if (e) e.preventDefault();
        retryVoice();
      };
    }

    const cmdCancelBtn = document.getElementById('voice-cmd-cancel-btn');
    if (cmdCancelBtn) {
      cmdCancelBtn.onclick = function (e) {
        if (e) e.preventDefault();
        resetVoiceForm();
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

  // Expose global methods directly to window
  window.openVoiceAssistantModal = openVoiceAssistantModal;
  window.closeVoiceAssistantModal = closeVoiceAssistantModal;
  window.openVoiceModal = openVoiceAssistantModal;
  window.closeVoiceModal = closeVoiceAssistantModal;
  window.startVoiceRecording = startRecording;
  window.stopVoiceRecording = stopRecording;
  window.toggleVoiceRecording = toggleRecording;
  window.retryVoice = retryVoice;
  window.updateVoiceSaleTotal = updateVoiceSaleTotal;
  window.saveVoiceSaleRecord = saveVoiceSaleRecord;
  window.continueVoiceCommand = continueVoiceCommand;
  window.addVoiceItemRow = addVoiceItemRow;
  window.removeVoiceItemRow = removeVoiceItemRow;
  window.onVoiceTranscriptManualEdit = onVoiceTranscriptManualEdit;
  window.loadVoiceSampleCommand = loadVoiceSampleCommand;
  window.loadVoicePreset = loadVoicePreset;
})();
