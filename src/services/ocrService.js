import { createWorker } from 'tesseract.js';

const STORAGE_KEY_GEMINI = 'paylens_gemini_api_key';
const DEFAULT_GEMINI_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || '';

export const getGeminiApiKey = () => {
  return localStorage.getItem(STORAGE_KEY_GEMINI) || DEFAULT_GEMINI_KEY;
};

export const setGeminiApiKey = (key) => {
  if (key) {
    localStorage.setItem(STORAGE_KEY_GEMINI, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_GEMINI);
  }
};

/**
 * Safely normalizes any image input (Blob, File, Data URL, Object URL, Event-wrapped object)
 * into a valid image URL string.
 */
export const normalizeImageSource = async (input) => {
  if (!input) return null;

  // If someone passed a DOM or React SyntheticEvent object (e.g. from onClick={handleAutoExtract})
  if (typeof input === 'object' && (input.nativeEvent || input.preventDefault || (input.target && input.target.value !== undefined && !input.target?.result))) {
    return null;
  }

  // Already a string
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    // Plain base64 string without data prefix
    if (/^[A-Za-z0-9+/=]+$/.test(trimmed.slice(0, 100))) {
      return `data:image/png;base64,${trimmed}`;
    }
    return trimmed;
  }

  // File or Blob instance
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => {
        try {
          resolve(URL.createObjectURL(input));
        } catch {
          resolve(null);
        }
      };
      reader.readAsDataURL(input);
    });
  }

  // Object containing url or src
  if (typeof input === 'object') {
    if (typeof input.src === 'string') return input.src;
    if (typeof input.url === 'string') return input.url;
    if (typeof input.dataUrl === 'string') return input.dataUrl;
    if (typeof input.screenshotUrl === 'string') return input.screenshotUrl;
    if (input.target && typeof input.target.result === 'string') return input.target.result;
  }

  return null;
};

/**
 * Preprocess image on HTML5 canvas with contrast enhancement, sharpening,
 * and high-fidelity PNG output for maximum Tesseract OCR accuracy.
 */
export const preprocessImageForOCR = async (imageSource) => {
  const normalized = await normalizeImageSource(imageSource);
  if (!normalized || typeof normalized !== 'string') {
    return imageSource;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(normalized), 4000);
    const img = new Image();
    if (typeof normalized === 'string' && !normalized.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let width = img.width || 800;
        let height = img.height || 1000;
        
        // Scale to optimal OCR dimensions (1200-1600px width)
        if (width < 1000) {
          height = Math.round((height * 1200) / width);
          width = 1200;
        } else if (width > 1600) {
          height = Math.round((height * 1600) / width);
          width = 1600;
        }
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        // Advanced contrast stretching and binarization preparation
        const imgData = ctx.getImageData(0, 0, width, height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          // Standard ITU-R luminance weights
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          // Boost contrast moderately for sharp character edges without blowing out soft fonts
          const contrast = 1.15;
          const adjusted = ((gray / 255 - 0.5) * contrast + 0.5) * 255;
          const finalVal = Math.min(255, Math.max(0, adjusted));
          d[i] = finalVal;
          d[i + 1] = finalVal;
          d[i + 2] = finalVal;
        }
        ctx.putImageData(imgData, 0, 0);

        // PNG preserves crisp character boundaries without JPEG compression noise
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        resolve(normalized);
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(normalized);
    };
    img.src = normalized;
  });
};

/**
 * Compress image into a compact thumbnail for Google Sheets cell storage (< 15 KB)
 */
export const compressImageForSheets = async (imageSource, maxWidth = 350, quality = 0.6) => {
  const normalized = await normalizeImageSource(imageSource);
  if (!normalized || typeof normalized !== 'string' || !normalized.startsWith('data:image')) {
    return normalized || imageSource || '';
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(normalized), 2500);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let width = img.width || 400;
        let height = img.height || 600;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        resolve(normalized);
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(normalized);
    };
    img.src = normalized;
  });
};

/**
 * Clean up extracted names from OCR artifacts, symbols and UI labels
 */
const sanitizeName = (raw) => {
  if (!raw) return '';
  return raw
    .replace(/^[:\s\-–—>|•*~✔✓O©¢\.\d\/\\#?_=+]+/, '')
    .replace(/\b(success|successful|completed|paid to|paid|payment to|payment from|payment|received from|received|verified|banking name|upi id|vpa|account|ac|xx|xxxx|via|check balance|split|repeat|share|view details|share receipt|done)\b/gi, '')
    .replace(/[+0-9()]{8,}/g, '') // remove phone numbers
    .replace(/[@#%^*_~|<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Clean & format amount to standard Indian Rupee format ₹X,XXX.XX
 */
const formatAmountValue = (num) => {
  if (isNaN(num) || num <= 0) return '';
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * High-precision regex and line-by-line parser for Indian UPI receipts
 * (PhonePe, Google Pay, Paytm, BHIM, CRED, Amazon Pay, Banks)
 */
export const parsePaymentText = (text) => {
  const result = {
    appName: 'Unknown',
    type: 'Sent',
    from: '',
    to: '',
    amount: '',
    dateTime: '',
    transactionId: '',
    rawText: text
  };

  if (!text) return result;

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const lower = text.toLowerCase();

  // -------------------------------------------------------------
  // 1. Detect Payment App (Keywords, signatures + UPI handle detection)
  // -------------------------------------------------------------
  if (
    lower.includes('phonepe') || 
    lower.includes('phone pe') || 
    lower.includes('phone-pe') ||
    /@(?:ybl|ibl|axl)\b/i.test(text) ||
    /\bT[0-9]{18,24}\b/.test(text) ||
    (lower.includes('banking name') && (lower.includes('debited from') || lower.includes('transfer details'))) ||
    lower.includes('transfer details')
  ) {
    result.appName = 'PhonePe';
  } else if (
    lower.includes('google pay') || 
    lower.includes('gpay') || 
    lower.includes('g pay') || 
    lower.includes('tez') ||
    /@(?:okhdfcbank|oksbi|okaxis|okicici)\b/i.test(text) ||
    lower.includes('google transaction id') ||
    /cicag/i.test(text)
  ) {
    result.appName = 'Google Pay';
  } else if (
    lower.includes('paytm') || 
    lower.includes('pay tm') || 
    /@(?:paytm|pthdfc|ptsbi)\b/i.test(text) ||
    lower.includes('one97') ||
    lower.includes('paytm payments bank')
  ) {
    result.appName = 'Paytm';
  } else if (
    lower.includes('cred') || 
    /@(?:cred|axiscred)\b/i.test(text)
  ) {
    result.appName = 'CRED';
  } else if (
    lower.includes('bhim') || 
    lower.includes('npci') || 
    lower.includes('bharat interface') ||
    /@upi\b/i.test(text)
  ) {
    result.appName = 'BHIM';
  } else if (
    lower.includes('amazon pay') || 
    lower.includes('amazonpay') ||
    /@(?:apl|rapl)\b/i.test(text)
  ) {
    result.appName = 'Amazon Pay';
  } else if (lower.includes('state bank') || lower.includes('sbi') || lower.includes('yono')) {
    result.appName = 'SBI';
  } else if (lower.includes('hdfc')) {
    result.appName = 'HDFC Bank';
  } else if (lower.includes('icici')) {
    result.appName = 'ICICI Bank';
  } else if (lower.includes('axis')) {
    result.appName = 'Axis Bank';
  } else if (lower.includes('kotak') || lower.includes('811')) {
    result.appName = 'Kotak Bank';
  } else if (lower.includes('punjab national') || lower.includes('pnb')) {
    result.appName = 'PNB';
  } else if (lower.includes('bank of baroda') || lower.includes('bob world')) {
    result.appName = 'Bank of Baroda';
  } else if (lower.includes('canara')) {
    result.appName = 'Canara Bank';
  } else if (lower.includes('whatsapp')) {
    result.appName = 'WhatsApp Pay';
  } else {
    result.appName = 'Other UPI';
  }

  // -------------------------------------------------------------
  // 2. Detect Transaction Type (Sent vs Received scoring)
  // -------------------------------------------------------------
  let sentScore = 0;
  let receivedScore = 0;

  const sentPatterns = [
    /paid\s+to/i,
    /payment\s+to/i,
    /transferred\s+to/i,
    /transfer\s+to/i,
    /you\s+paid/i,
    /money\s+sent/i,
    /sent\s+to/i,
    /debited\s+from/i,
    /payment\s+of/i,
    /recharge\s+successful/i,
    /bill\s+paid/i,
    /transfer\s+successful/i
  ];

  const receivedPatterns = [
    /received\s+from/i,
    /payment\s+received/i,
    /money\s+received/i,
    /received\s+successfully/i,
    /you\s+received/i,
    /transferred\s+by/i,
    /credited\s+to/i,
    /credit\s+to/i,
    /cashback\s+received/i,
    /refund\s+from/i
  ];

  sentPatterns.forEach(p => { if (p.test(text)) sentScore += 2; });
  receivedPatterns.forEach(p => { if (p.test(text)) receivedScore += 2; });

  if (receivedScore > sentScore) {
    result.type = 'Received';
  } else {
    result.type = 'Sent';
  }

  // -------------------------------------------------------------
  // 3. Extract Amount (Handles ₹, â‚¹, Rs, INR, misread symbols *, z, =, ~, decimals & integers)
  // -------------------------------------------------------------
  const amountCandidates = [];

  // Pass 1: Explicit currency symbol or common OCR misreads for ₹ (?, *, z, ~, =, _, â‚¹, ¥, €, ¢)
  const currencyRegex = /(?:₹|â‚¹|rs\.?|inr|[\?\*\~=_\^¥€¢£])\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]{1,6}(?:\.[0-9]{1,2})?)(?![0-9])/gi;
  let cMatch;
  while ((cMatch = currencyRegex.exec(text)) !== null) {
    const rawVal = cMatch[1].replace(/,/g, '');
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0 && num < 10000000 && num !== 2024 && num !== 2025 && num !== 2026 && num !== 2027) {
      const hasDecimals = cMatch[1].includes('.');
      amountCandidates.push({ val: num, priority: hasDecimals ? 45 : 35 });
    }
  }

  // Pass 2: Context phrases like "Paid 72.00", "Amount: 1,050", "Payment of 72"
  const contextRegex = /(?:paid|amount|total|sent|received|transferred|transfer|payment|debited|credited)\s*(?:is|of|[:\-])?\s*[^\w\s]?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]{1,6}(?:\.[0-9]{1,2})?)(?![0-9])/gi;
  let ctxMatch;
  while ((ctxMatch = contextRegex.exec(text)) !== null) {
    const rawVal = ctxMatch[1].replace(/,/g, '');
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0 && num < 10000000 && num !== 2024 && num !== 2025 && num !== 2026 && num !== 2027) {
      amountCandidates.push({ val: num, priority: 38 });
    }
  }

  // Pass 3: Standalone numbers on receipt lines (especially in top 10 lines)
  lines.forEach((line, idx) => {
    const cleanLine = line.replace(/^[^\w\d₹â‚¹]+|[^\w\d]+$/g, '').trim();
    if (/^[0-9]{1,3}(?:,[0-9]{2,3})*\.[0-9]{2}$/.test(cleanLine) || /^[0-9]{1,6}\.[0-9]{2}$/.test(cleanLine)) {
      const num = parseFloat(cleanLine.replace(/,/g, ''));
      if (!isNaN(num) && num > 0 && num < 10000000) {
        amountCandidates.push({ val: num, priority: idx < 8 ? 40 : 25 });
      }
    } else if (/^[0-9]{1,5}$/.test(cleanLine)) {
      const num = parseFloat(cleanLine);
      if (!isNaN(num) && num > 0 && num < 10000000 && num !== 2024 && num !== 2025 && num !== 2026 && num !== 2027) {
        if (idx < 6) {
          amountCandidates.push({ val: num, priority: 28 });
        }
      }
    }
  });

  if (amountCandidates.length > 0) {
    amountCandidates.sort((a, b) => b.priority - a.priority || b.val - a.val);
    result.amount = formatAmountValue(amountCandidates[0].val);
  }

  // -------------------------------------------------------------
  // 4. Extract UTR / Transaction ID (12-digit UPI UTR or App Txn ID)
  // -------------------------------------------------------------
  // Check labeled 12-digit UTR first
  const utrLabeled = text.match(/(?:upi\s*ref(?:\s*no|\s*id|\s*number)?|utr(?:\s*no)?|rrn|bank\s*ref(?:\s*no)?|ref\s*(?:no|id|number))[:\s#-]*([0-9]{12})\b/i);
  if (utrLabeled && utrLabeled[1]) {
    result.transactionId = utrLabeled[1].trim();
  }

  // Check PhonePe specific Transaction ID (e.g. T240927...)
  if (!result.transactionId) {
    const phonePeTxn = text.match(/\b(T[0-9]{18,25})\b/);
    if (phonePeTxn && phonePeTxn[1]) {
      result.transactionId = phonePeTxn[1].trim();
    }
  }

  // Check Google Transaction ID
  if (!result.transactionId) {
    const gpayTxn = text.match(/(?:google\s*transaction\s*id)[:\s#-]*([a-zA-Z0-9.-]{12,35})/i);
    if (gpayTxn && gpayTxn[1]) {
      result.transactionId = gpayTxn[1].trim();
    }
  }

  // Check general Transaction / Order ID
  if (!result.transactionId) {
    const generalTxn = text.match(/(?:transaction\s*id|txn\s*id|order\s*id)[:\s#-]*([a-zA-Z0-9_-]{10,30})/i);
    if (generalTxn && generalTxn[1]) {
      result.transactionId = generalTxn[1].trim();
    }
  }

  // Fallback: any standalone 12-digit number (standard Indian UPI UTR length)
  if (!result.transactionId) {
    const standalone12 = text.match(/\b([0-9]{12})\b/);
    if (standalone12 && standalone12[1]) {
      result.transactionId = standalone12[1].trim();
    }
  }

  // -------------------------------------------------------------
  // 5. Extract From (Sender) and To (Receiver)
  // -------------------------------------------------------------
  let extractedTo = '';
  let extractedFrom = '';

  // Look for verified Banking Name or Beneficiary Name
  const bankingRegex = /(?:banking\s*name|verified\s*name|beneficiary\s*name)\s*[:\-–—]?\s*([A-Za-z0-9\s.&'-]{3,40})/i;
  const bankingMatch = text.match(bankingRegex);
  if (bankingMatch && bankingMatch[1]) {
    const firstLine = bankingMatch[1].split(/\r?\n/)[0].trim();
    const name = sanitizeName(firstLine);
    if (name.length >= 3 && !/^[0-9₹*z]/i.test(name)) {
      if (result.type === 'Sent') {
        extractedTo = name;
      } else {
        extractedFrom = name;
      }
    }
  }

  // Also check if "Banking Name" is on one line and the name is on the next line
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    if (l === 'banking name' || l === 'verified name' || l.startsWith('banking name') || l.startsWith('verified name')) {
      const inline = sanitizeName(lines[i].replace(/^(?:banking\s*name|verified\s*name)[:\s\-–—]*/i, ''));
      if (inline.length >= 3) {
        if (result.type === 'Sent') extractedTo = inline;
        else extractedFrom = inline;
      } else if (i + 1 < lines.length) {
        const next = sanitizeName(lines[i + 1]);
        if (next.length >= 3 && !/^[0-9₹*z]/i.test(next) && !next.toLowerCase().includes('utr')) {
          if (result.type === 'Sent') extractedTo = next;
          else extractedFrom = next;
        }
      }
    }
  }

  // Line-by-line inspection
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Check if line contains "paid to", "payment to", "sent to", "transferred to" anywhere in line
    const paidToMatch = line.match(/(?:paid\s+to|payment\s+to|transferred\s+to|sent\s+to)\s*[:\-–—]?\s*(.*)/i);
    if (paidToMatch) {
      const inline = sanitizeName(paidToMatch[1]);
      if (inline.length >= 3 && !/^[0-9₹*z]/i.test(inline)) {
        if (!extractedTo) extractedTo = inline;
      } else {
        // Look up to 4 lines ahead for the recipient name, skipping currency lines or icons
        for (let j = 1; j <= 4 && i + j < lines.length; j++) {
          const nextLine = lines[i + j];
          const nextSanitized = sanitizeName(nextLine);
          // Check if this line is an amount or symbol
          if (/^[0-9₹*z\?~=]/.test(nextLine) || nextLine.length < 2) continue;
          // Check if it's a known non-name header or status
          if (/^(?:transfer|transaction|debited|credited|view|repeat|share|check|completed|successful|failed)/i.test(nextSanitized)) continue;
          
          if (nextLine.includes('@')) {
            const upiUser = nextLine.match(/\b([a-zA-Z][a-zA-Z0-9._-]{2,25})@/);
            if (upiUser && !/^\d+$/.test(upiUser[1])) {
              const formatted = upiUser[1].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              if (!extractedTo) extractedTo = formatted;
            }
            continue;
          }

          if (nextSanitized.length >= 3 && !extractedTo) {
            extractedTo = nextSanitized;
            break;
          }
        }
      }
    }

    // Check "Received from", "Payment from", "Transferred by"
    const receivedFromMatch = line.match(/(?:received\s+from|payment\s+from|transferred\s+by)\s*[:\-–—]?\s*(.*)/i);
    if (receivedFromMatch) {
      const inline = sanitizeName(receivedFromMatch[1]);
      if (inline.length >= 3 && !/^[0-9₹*z]/i.test(inline)) {
        if (!extractedFrom) extractedFrom = inline;
      } else {
        for (let j = 1; j <= 4 && i + j < lines.length; j++) {
          const nextLine = lines[i + j];
          const nextSanitized = sanitizeName(nextLine);
          if (/^[0-9₹*z\?~=]/.test(nextLine) || nextLine.length < 2) continue;
          if (/^(?:transfer|transaction|debited|credited|view|repeat|share|check|completed|successful)/i.test(nextSanitized)) continue;

          if (nextLine.includes('@')) {
            const upiUser = nextLine.match(/\b([a-zA-Z][a-zA-Z0-9._-]{2,25})@/);
            if (upiUser && !/^\d+$/.test(upiUser[1])) {
              const formatted = upiUser[1].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              if (!extractedFrom) extractedFrom = formatted;
            }
            continue;
          }

          if (nextSanitized.length >= 3 && !extractedFrom) {
            extractedFrom = nextSanitized;
            break;
          }
        }
      }
    }

    // Check "Debited from <Bank/Account>" (Same line or next line)
    if (/debited\s+from/i.test(line)) {
      const inline = sanitizeName(line.replace(/.*debited\s+from[:\s\-–—]*/i, ''));
      if (inline.length >= 3) {
        if (!extractedFrom) extractedFrom = inline;
      } else if (i + 1 < lines.length) {
        const next = sanitizeName(lines[i + 1]);
        if (next.length >= 3 && !/^[0-9₹*z]/i.test(next) && !next.toLowerCase().includes('utr')) {
          if (!extractedFrom) extractedFrom = next;
        }
      }
    }

    // Check "Credited to <Bank/Account>"
    if (/credited\s+to/i.test(line)) {
      const inline = sanitizeName(line.replace(/.*credited\s+to[:\s\-–—]*/i, ''));
      if (inline.length >= 3) {
        if (!extractedTo) extractedTo = inline;
      } else if (i + 1 < lines.length) {
        const next = sanitizeName(lines[i + 1]);
        if (next.length >= 3 && !/^[0-9₹*z]/i.test(next) && !next.toLowerCase().includes('utr')) {
          if (!extractedTo) extractedTo = next;
        }
      }
    }

    // "To: Name"
    if (!extractedTo && /^to\s*[:\-–—]\s*(.+)/i.test(line)) {
      const m = line.match(/^to\s*[:\-–—]\s*(.+)/i);
      if (m && m[1]) {
        const name = sanitizeName(m[1]);
        if (name.length >= 3) extractedTo = name;
      }
    }

    // "From: Name"
    if (!extractedFrom && /^from\s*[:\-–—]\s*(.+)/i.test(line)) {
      const m = line.match(/^from\s*[:\-–—]\s*(.+)/i);
      if (m && m[1]) {
        const name = sanitizeName(m[1]);
        if (name.length >= 3) extractedFrom = name;
      }
    }
  }

  // Fallback to UPI VPA ID (e.g. rahul.sharma@okaxis or surveen@ybl)
  if (!extractedTo && result.type === 'Sent') {
    const upiMatch = text.match(/\b([a-zA-Z][a-zA-Z0-9._-]{2,25})@(okhdfcbank|oksbi|okaxis|okicici|paytm|ybl|ibl|axl|upi|apl|barodampay|federal|kotak|idfcbank)\b/i);
    if (upiMatch && upiMatch[1]) {
      if (!/^\d+$/.test(upiMatch[1])) {
        extractedTo = upiMatch[1].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    }
  }

  // Set logical defaults based on direction
  result.to = extractedTo || (result.type === 'Received' ? 'You (Self)' : '');
  result.from = extractedFrom || (result.type === 'Sent' ? 'You (Self)' : '');

  // -------------------------------------------------------------
  // 6. Extract Date & Time
  // -------------------------------------------------------------
  const datePatterns = [
    // "07:45 PM on 27 Sep 2026" or "07:45 PM, 27 Sep 2026" (PhonePe format)
    /\b([0-1]?[0-9]:[0-5][0-9](?::[0-5][0-9])?\s*(?:am|pm)?\s*(?:on|,|\s+at\s+)?\s*[0-3]?[0-9]\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+[0-9]{4})/i,
    // "27 Sep 2026 at 7:45 PM" or "27 Sep 2026, 07:45 PM"
    /\b([0-3]?[0-9]\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+[0-9]{4}(?:,?\s*(?:at\s+)?[0-1]?[0-9]:[0-5][0-9](?::[0-5][0-9])?\s*(?:am|pm)?)?)/i,
    // "Sep 27, 2026, 6:30 PM" (Google Pay format)
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+[0-3]?[0-9],?\s+[0-9]{4}(?:,?\s*(?:at\s+)?[0-1]?[0-9]:[0-5][0-9](?::[0-5][0-9])?\s*(?:am|pm)?)?)/i,
    // "27 Sep, 07:45 PM" (Paytm format)
    /\b([0-3]?[0-9]\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*,?\s+[0-1]?[0-9]:[0-5][0-9]\s*(?:am|pm)?)/i,
    // "27/09/2026, 19:45"
    /\b([0-3]?[0-9][/-][0-1]?[0-9][/-][0-9]{2,4}(?:,?\s+[0-1]?[0-9]:[0-5][0-9](?::[0-5][0-9])?\s*(?:am|pm)?)?)/i,
    // "Today, 7:45 PM"
    /\b((?:today|yesterday),?\s+[0-1]?[0-9]:[0-5][0-9]\s*(?:am|pm)?)/i
  ];

  for (const regex of datePatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      result.dateTime = match[1].trim();
      break;
    }
  }

  if (!result.dateTime) {
    result.dateTime = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  return result;
};

/**
 * Extract data using Google Gemini Vision API (fast & 100% human-accurate)
 */
async function extractWithGemini(base64Image, apiKey, onProgress) {
  onProgress?.({ stage: 'gemini', progress: 45, message: 'Analyzing receipt with Google Gemini Vision AI...' });

  let cleanBase64 = base64Image;
  let mimeType = 'image/jpeg';
  if (typeof base64Image === 'string' && base64Image.startsWith('data:')) {
    const match = base64Image.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      cleanBase64 = match[2];
    }
  }

  const prompt = `You are a specialist Indian UPI payment OCR parser.
Examine this payment receipt screenshot (PhonePe, Google Pay, Paytm, BHIM, CRED, Amazon Pay, Bank app, etc.) and extract the transaction details with exact precision into this JSON structure:
{
  "appName": "Exact App Name (e.g. PhonePe | Google Pay | Paytm | BHIM | CRED | Amazon Pay | SBI | HDFC Bank | ICICI Bank | Axis Bank | Other UPI)",
  "type": "Sent | Received (Sent if user paid/sent money or debited; Received if user got credited/received money)",
  "from": "Sender person or entity name (If user sent, write 'You (Self)' or sender bank. If received, write sender name)",
  "to": "Receiver person or merchant name (If user received, write 'You (Self)'. If sent, write receiver or merchant name)",
  "amount": "Exact amount formatted with ₹ (e.g. ₹72.00 or ₹1,050.00)",
  "dateTime": "Exact date and time from receipt (e.g. 27 Sep 2026, 07:45 PM)",
  "transactionId": "12-digit UPI UTR number or Transaction Ref ID",
  "confidence": "High"
}
Output strictly valid JSON only. Do not include markdown codeblocks or explanation.`;

  // Try gemini-2.0-flash first, then gemini-1.5-flash
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: cleanBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini ${model} error (${response.status}): ${errorText}`);
      }

      const jsonResponse = await response.json();
      const textContent = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) {
        throw new Error(`Gemini ${model} returned empty response.`);
      }

      const parsed = JSON.parse(textContent.trim().replace(/^```json/, '').replace(/```$/, ''));
      return {
        ...parsed,
        rawText: `Extracted via Gemini Vision AI (${model}):\n${JSON.stringify(parsed, null, 2)}`
      };
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('Gemini Vision extraction failed.');
}

/**
 * Extract data using client-side Tesseract.js OCR engine
 */
async function extractWithTesseract(imageSource, onProgress) {
  onProgress?.({ stage: 'init', progress: 20, message: 'Sharpening receipt image for OCR recognition...' });

  // Pre-process canvas to enhance contrast and remove background noise
  const enhancedImage = await preprocessImageForOCR(imageSource);

  onProgress?.({ stage: 'engine', progress: 35, message: 'Initializing OCR engine...' });
  const worker = await createWorker('eng', 1, {
    logger: m => {
      if (m?.status === 'recognizing text' && typeof m.progress === 'number') {
        const p = Math.round(35 + m.progress * 55);
        onProgress?.({ stage: 'recognizing', progress: p, message: `Scanning receipt text (${Math.round(m.progress * 100)}%)...` });
      }
    }
  });

  try {
    onProgress?.({ stage: 'recognizing', progress: 50, message: 'Scanning payment app, recipient, amount & UTR...' });

    const ret = await worker.recognize(enhancedImage);
    const rawText = ret.data.text;

    onProgress?.({ stage: 'parsing', progress: 95, message: 'Structuring extracted payment data...' });

    const parsedData = parsePaymentText(rawText);
    return parsedData;
  } finally {
    await worker.terminate();
  }
}

/**
 * Main OCR Extraction coordinator
 */
export const extractReceiptData = async (imageSource, onProgress) => {
  const normalizedSource = await normalizeImageSource(imageSource);
  if (!normalizedSource || typeof normalizedSource !== 'string') {
    throw new Error('Please upload or choose a valid payment screenshot.');
  }

  const geminiKey = getGeminiApiKey();

  if (geminiKey) {
    try {
      return await extractWithGemini(normalizedSource, geminiKey, onProgress);
    } catch (geminiError) {
      console.warn('Gemini Vision failed, falling back to local OCR:', geminiError);
      onProgress?.({ stage: 'fallback', progress: 30, message: 'Switching to high-accuracy local OCR engine...' });
      return await extractWithTesseract(normalizedSource, onProgress);
    }
  }

  return await extractWithTesseract(normalizedSource, onProgress);
};

