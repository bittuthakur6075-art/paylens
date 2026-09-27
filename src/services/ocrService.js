import { createWorker } from 'tesseract.js';

const STORAGE_KEY_GEMINI = 'paylens_gemini_api_key';
const DEFAULT_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

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
 * Preprocess image on an HTML5 canvas to boost OCR text & number recognition
 */
export const preprocessImageForOCR = async (imageSource) => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(imageSource), 2500);
    const img = new Image();
    if (imageSource && !imageSource.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let width = img.width || 800;
        let height = img.height || 1000;
        if (width > 1400) {
          height = Math.round((height * 1400) / width);
          width = 1400;
        }
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        // Contrast enhancement & grayscale
        const imgData = ctx.getImageData(0, 0, width, height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const contrast = 1.25;
          const adjusted = ((gray / 255 - 0.5) * contrast + 0.5) * 255;
          const finalVal = Math.min(255, Math.max(0, adjusted));
          d[i] = finalVal;
          d[i + 1] = finalVal;
          d[i + 2] = finalVal;
        }
        ctx.putImageData(imgData, 0, 0);

        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (err) {
        resolve(imageSource);
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(imageSource);
    };
    img.src = imageSource;
  });
};

/**
 * Compress image into a compact thumbnail for Google Sheets cell storage (< 15 KB)
 */
export const compressImageForSheets = async (imageSource, maxWidth = 350, quality = 0.6) => {
  return new Promise((resolve) => {
    if (!imageSource || !imageSource.startsWith('data:image')) {
      resolve(imageSource || '');
      return;
    }
    const timeout = setTimeout(() => resolve(imageSource), 2000);
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
        resolve(imageSource);
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(imageSource);
    };
    img.src = imageSource;
  });
};

/**
 * Clean up extracted names from OCR artifacts and UI labels
 */
const sanitizeName = (raw) => {
  if (!raw) return '';
  return raw
    .replace(/^[:\s\-–—]+/, '')
    .replace(/\b(success|successful|completed|paid|payment|verified|banking name|upi id|vpa|account|ac|xx|xxxx|via|state bank|hdfc|icici|axis|kotak|check balance|split|repeat|share|view details)\b/gi, '')
    .replace(/[+0-9()]{8,}/g, '') // remove phone numbers
    .replace(/[^\w\s.&'-]/g, '')
    .trim();
};

/**
 * Intelligent regex and line-by-line parser to extract structured payment attributes
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

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const lower = text.toLowerCase();

  // 1. Detect App Name
  if (lower.includes('phonepe') || lower.includes('phone pe')) {
    result.appName = 'PhonePe';
  } else if (lower.includes('google pay') || lower.includes('gpay') || lower.includes('tez')) {
    result.appName = 'Google Pay';
  } else if (lower.includes('paytm')) {
    result.appName = 'Paytm';
  } else if (lower.includes('cred')) {
    result.appName = 'CRED';
  } else if (lower.includes('bhim') || lower.includes('npci')) {
    result.appName = 'BHIM';
  } else if (lower.includes('amazon pay') || lower.includes('amazonpay')) {
    result.appName = 'Amazon Pay';
  } else if (lower.includes('hdfc')) {
    result.appName = 'HDFC Bank';
  } else if (lower.includes('sbi') || lower.includes('state bank')) {
    result.appName = 'SBI';
  } else if (lower.includes('icici')) {
    result.appName = 'ICICI Bank';
  } else if (lower.includes('axis')) {
    result.appName = 'Axis Bank';
  } else {
    result.appName = 'UPI App';
  }

  // 2. Detect Transaction Type (Sent vs Received)
  if (
    lower.includes('received from') ||
    lower.includes('credited to') ||
    lower.includes('payment received') ||
    lower.includes('cashback received') ||
    lower.includes('received successfully') ||
    lower.includes('money received')
  ) {
    result.type = 'Received';
  } else {
    result.type = 'Sent';
  }

  // 3. Extract Amount (Handles ₹, Rs, INR, decimals, comma separators)
  const amountRegexes = [
    /[₹₹*]\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:rs\.?|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:paid|sent|amount|transferred)\s*(?:of|is)?\s*[₹₹Rs.]?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /\b([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2}))\b/,
    /\b([0-9]{2,6}(?:\.[0-9]{2}))\b/
  ];

  for (const regex of amountRegexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      const cleanVal = match[1].replace(/,/g, '');
      const numVal = parseFloat(cleanVal);
      if (!isNaN(numVal) && numVal > 0) {
        result.amount = `₹${numVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        break;
      }
    }
  }

  // 4. Extract UTR / Transaction ID (12 digits UPI reference or alphanumeric Txn ID)
  const utrPatterns = [
    /(?:utr|upi\s*ref|ref\s*(?:no|number)|rrn)[:\s#-]*([0-9]{12})/i,
    /(?:upi\s*transaction\s*id|transaction\s*id|txn\s*id)[:\s#-]*([a-zA-Z0-9]{10,25})/i,
    /\b([0-9]{12})\b/, // Standalone 12 digits
    /(?:google\s*transaction\s*id)[:\s#-]*([a-zA-Z0-9.-]+)/i,
    /(?:order\s*id)[:\s#-]*([a-zA-Z0-9.-]+)/i
  ];

  for (const regex of utrPatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      result.transactionId = match[1].trim();
      break;
    }
  }

  // 5. Line-by-Line Names Parsing (Receiver & Sender)
  let extractedTo = '';
  let extractedFrom = '';

  // Look for Banking Name first (highest confidence on UPI screens)
  const bankingMatch = text.match(/(?:banking\s*name)[:\s\-–—]+([A-Za-z0-9\s.&'-]{3,35})/i);
  if (bankingMatch && bankingMatch[1]) {
    extractedTo = sanitizeName(bankingMatch[1]);
  }

  // Inspect line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Check "Paid to" or "Payment to"
    if (lineLower.startsWith('paid to') || lineLower.startsWith('payment to') || lineLower.startsWith('transferred to')) {
      const inlineCandidate = sanitizeName(line.replace(/^(?:paid to|payment to|transferred to)[:\s]*/i, ''));
      if (inlineCandidate.length >= 3) {
        extractedTo = inlineCandidate;
      } else if (i + 1 < lines.length) {
        const nextLine = sanitizeName(lines[i + 1]);
        if (nextLine.length >= 3 && !nextLine.match(/^[0-9₹]/)) {
          extractedTo = nextLine;
        }
      }
    }

    // Check "Received from"
    if (lineLower.startsWith('received from') || lineLower.startsWith('payment from')) {
      const inlineCandidate = sanitizeName(line.replace(/^(?:received from|payment from)[:\s]*/i, ''));
      if (inlineCandidate.length >= 3) {
        extractedFrom = inlineCandidate;
      } else if (i + 1 < lines.length) {
        const nextLine = sanitizeName(lines[i + 1]);
        if (nextLine.length >= 3 && !nextLine.match(/^[0-9₹]/)) {
          extractedFrom = nextLine;
        }
      }
    }

    // Check "To: Name" or "From: Name"
    if (!extractedTo && /^to\s*[:\-–—]\s*(.+)/i.test(line)) {
      const match = line.match(/^to\s*[:\-–—]\s*(.+)/i);
      if (match && match[1]) {
        const nameCandidate = sanitizeName(match[1]);
        if (nameCandidate.length >= 3) extractedTo = nameCandidate;
      }
    }

    if (!extractedFrom && /^from\s*[:\-–—]\s*(.+)/i.test(line)) {
      const match = line.match(/^from\s*[:\-–—]\s*(.+)/i);
      if (match && match[1]) {
        const nameCandidate = sanitizeName(match[1]);
        if (nameCandidate.length >= 3) extractedFrom = nameCandidate;
      }
    }

    // Check "Debited from" or "Credited to"
    if (!extractedFrom && lineLower.includes('debited from')) {
      const rem = sanitizeName(line.replace(/.*debited from[:\s]*/i, ''));
      if (rem.length >= 3) extractedFrom = rem;
    }
  }

  // If still not found, check standard UPI ID pattern (e.g. rahul@oksbi)
  if (!extractedTo) {
    const upiMatch = text.match(/\b([a-zA-Z0-9._-]{3,25})@(okhdfcbank|oksbi|okaxis|okicici|paytm|ybl|ibl|upi)\b/i);
    if (upiMatch && upiMatch[1]) {
      extractedTo = upiMatch[1].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  // Set sender / receiver defaults
  result.to = extractedTo || (result.type === 'Received' ? 'You (Self)' : '');
  result.from = extractedFrom || (result.type === 'Sent' ? 'You (Self)' : '');

  // 6. Extract Date & Time
  const datePatterns = [
    /\b([0-3]?[0-9]\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+[0-9]{4}(?:,?\s+[0-1]?[0-9]:[0-5][0-9](?::[0-5][0-9])?\s*(?:am|pm)?)?)/i,
    /\b([0-3]?[0-9][/-][0-1]?[0-9][/-][0-9]{2,4}(?:,?\s+[0-1]?[0-9]:[0-5][0-9](?::[0-5][0-9])?\s*(?:am|pm)?)?)/i,
    /\b((?:today|yesterday),?\s+[0-1]?[0-9]:[0-5][0-9]\s*(?:am|pm)?)/i,
    /\b([A-Za-z]{3}\s+[0-3]?[0-9],?\s+[0-9]{4}\s+[0-1]?[0-9]:[0-5][0-9]\s*(?:am|pm)?)/i
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
 * Extract data using Gemini Flash Vision API (if user configured an API key)
 */
async function extractWithGemini(base64Image, apiKey, onProgress) {
  onProgress?.({ stage: 'gemini', progress: 50, message: 'Analyzing with Gemini Flash Vision AI...' });

  const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
  const mimeType = base64Image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/jpeg';

  const prompt = `Analyze this payment receipt screenshot (PhonePe, Google Pay, Paytm, BHIM, CRED, Bank, etc.) and extract all details in JSON format:
{
  "appName": "PhonePe | Google Pay | Paytm | BHIM | CRED | Amazon Pay | Bank Name",
  "type": "Sent | Received",
  "from": "Sender person or entity name (or 'You' if user is sender)",
  "to": "Receiver person or merchant name (or 'You' if user is receiver)",
  "amount": "₹X,XXX.XX (formatted with ₹ rupee symbol)",
  "dateTime": "16 Aug 2026, 04:21 PM (standard date and time format)",
  "transactionId": "12-digit UTR or Transaction Ref ID",
  "confidence": "High | Medium | Low"
}
Extract the exact person/merchant names accurately. Output pure JSON only, without markdown fences or additional explanation.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const jsonResponse = await response.json();
  const textContent = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('Gemini did not return readable text.');
  }

  const parsed = JSON.parse(textContent.trim().replace(/^```json/, '').replace(/```$/, ''));
  return {
    ...parsed,
    rawText: `Extracted via Gemini Flash Vision:\n${JSON.stringify(parsed, null, 2)}`
  };
}

/**
 * Extract data using client-side Tesseract.js OCR engine
 */
async function extractWithTesseract(imageSource, onProgress) {
  onProgress?.({ stage: 'init', progress: 15, message: 'Preprocessing image for sharp OCR recognition...' });

  // Pre-process canvas to enhance contrast
  const enhancedImage = await preprocessImageForOCR(imageSource);

  onProgress?.({ stage: 'engine', progress: 30, message: 'Initializing Tesseract OCR engine...' });
  const worker = await createWorker('eng');

  try {
    onProgress?.({ stage: 'recognizing', progress: 60, message: 'Scanning recipient name, amount & UTR...' });

    const ret = await worker.recognize(enhancedImage);
    const rawText = ret.data.text;

    onProgress?.({ stage: 'parsing', progress: 90, message: 'Extracting sender, receiver, and transaction ID...' });

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
  const geminiKey = getGeminiApiKey();

  if (geminiKey) {
    try {
      return await extractWithGemini(imageSource, geminiKey, onProgress);
    } catch (geminiError) {
      console.warn('Gemini Vision failed, falling back to local Tesseract OCR:', geminiError);
      onProgress?.({ stage: 'fallback', progress: 20, message: 'Switching to local OCR engine...' });
      return await extractWithTesseract(imageSource, onProgress);
    }
  }

  return await extractWithTesseract(imageSource, onProgress);
};
