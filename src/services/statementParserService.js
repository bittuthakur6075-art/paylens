import ExcelJS from 'exceljs';
import * as pdfjsLib from 'pdfjs-dist';

// Ensure PDF.js worker is properly configured
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions?.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

/**
 * Clean and parse raw amount string into positive float
 */
export const parseAmount = (val) => {
  if (typeof val === 'number') return Math.abs(val);
  if (!val) return 0;
  const cleaned = val.toString().replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Detect Payment App or Bank from text description
 */
export const detectAppOrChannel = (text = '') => {
  const upper = (text || '').toUpperCase();
  if (upper.includes('PHONEPE') || upper.includes('YBL') || upper.includes('IBL')) return 'PhonePe';
  if (upper.includes('GPAY') || upper.includes('GOOGLE') || upper.includes('OKAXIS') || upper.includes('OKHDFC') || upper.includes('OKSBI')) return 'Google Pay';
  if (upper.includes('PAYTM') || upper.includes('PYTM')) return 'Paytm';
  if (upper.includes('CRED')) return 'CRED';
  if (upper.includes('BHIM') || upper.includes('UPI/')) return 'BHIM UPI';
  if (upper.includes('AMAZON') || upper.includes('APL')) return 'Amazon Pay';
  if (upper.includes('HDFC')) return 'HDFC Bank';
  if (upper.includes('SBI') || upper.includes('STATE BANK')) return 'State Bank of India';
  if (upper.includes('ICICI')) return 'ICICI Bank';
  if (upper.includes('AXIS')) return 'Axis Bank';
  if (upper.includes('KOTAK')) return 'Kotak Bank';
  if (upper.includes('PNB')) return 'PNB';
  if (upper.includes('BOB') || upper.includes('BARODA')) return 'Bank of Baroda';
  return 'Bank Statement';
};

/**
 * Parse CSV text into array of object rows
 */
export const parseCSVText = (csvText) => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Detect delimiter
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  let delimiter = ',';
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

  // Helper to split row respecting quotes
  const parseRow = (rowStr) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (char === '"' || char === "'") {
        if (inQuotes && rowStr[i + 1] === char) {
          cur += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.replace(/^["']|["']$/g, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;
    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] !== undefined ? values[idx].replace(/^["']|["']$/g, '').trim() : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
};

/**
 * Normalize generic rows into standardized PayLens transactions
 * Supports official 10-field schema:
 * 1. Date
 * 2. Time
 * 3. Transaction Details
 * 4. Other Transaction Details (UPI ID or A/c No)
 * 5. Your Account
 * 6. Amount
 * 7. UPI Ref No.
 * 8. Order ID
 * 9. Remarks
 * 10. Tags
 */
export const normalizeStatementRows = (rows = [], existingTransactions = []) => {
  const existingTxnIds = new Set(
    existingTransactions.map(t => (t.transactionId || t.upiRefNo || '').trim()).filter(Boolean)
  );

  return rows.map((row, index) => {
    const keys = Object.keys(row);
    const findVal = (regex) => {
      const k = keys.find(key => regex.test(key.trim()));
      return k && row[k] !== undefined && row[k] !== null ? row[k].toString().trim() : '';
    };

    // 1. Exact or fuzzy matching for the 10 standard columns
    // 1.1 Date
    let date = findVal(/^date$/i) || 
               findVal(/^(txn_date|value_date|transaction_date|posting_date)$/i) || 
               findVal(/date/i);

    // 1.2 Time
    let time = findVal(/^time$/i) || 
               findVal(/^(txn_time|transaction_time)$/i) || 
               findVal(/time/i);

    // If date contains both date and time (e.g. "28/09/2026, 04:30 PM" or "28 Sep 2026 14:30:00")
    if (date && !time) {
      const timeMatch = date.match(/\b([0-1]?[0-9]:[0-5][0-9](?::[0-5][0-9])?\s*(?:AM|PM|am|pm)?)\b/);
      if (timeMatch) {
        time = timeMatch[1].trim();
        date = date.replace(timeMatch[0], '').replace(/[,\sat]+$/, '').trim();
      }
    }
    if (!date) {
      date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    if (!time) {
      time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // 1.3 Transaction Details (Beneficiary / Merchant / Description)
    let transactionDetails = findVal(/^transaction\s*details$/i) ||
                             findVal(/^(particulars|narration|description|details)$/i) ||
                             findVal(/details/i) ||
                             findVal(/narration/i) ||
                             findVal(/description/i) ||
                             findVal(/party/i);

    // 1.4 Other Transaction Details (UPI ID or A/c No)
    let otherDetails = findVal(/other.*details/i) ||
                       findVal(/^upi\s*id$/i) ||
                       findVal(/vpa/i) ||
                       findVal(/beneficiary.*acc/i) ||
                       findVal(/counterparty/i);

    // 1.5 Your Account
    let yourAccount = findVal(/^your\s*account$/i) ||
                      findVal(/^my\s*account$/i) ||
                      findVal(/^(debit_account|from_account|account_no|a\/c\s*no)$/i) ||
                      findVal(/account/i);

    // 1.6 Amount & Flow Detection
    const creditKey = keys.find(k => /credit|deposit|cr|inflow|received|amount_cr/i.test(k) && !/debit|dr/i.test(k));
    const debitKey = keys.find(k => /debit|withdrawal|dr|outflow|sent|amount_dr/i.test(k) && !/credit|cr/i.test(k));
    const amountVal = findVal(/^amount$/i) || findVal(/amount|total|sum|inr|value/i);
    const typeVal = findVal(/type|flow|dr_cr|drcr|transaction_type|mode/i);

    let type = 'Sent';
    let rawAmount = 0;

    const creditNum = creditKey ? parseAmount(row[creditKey]) : 0;
    const debitNum = debitKey ? parseAmount(row[debitKey]) : 0;

    if (creditNum > 0 && debitNum === 0) {
      type = 'Received';
      rawAmount = creditNum;
    } else if (debitNum > 0 && creditNum === 0) {
      type = 'Sent';
      rawAmount = debitNum;
    } else if (amountVal) {
      rawAmount = parseAmount(amountVal);
      if (amountVal.startsWith('+') || amountVal.toLowerCase().includes('cr')) {
        type = 'Received';
      } else if (amountVal.startsWith('-') || amountVal.toLowerCase().includes('dr')) {
        type = 'Sent';
      } else if (typeVal) {
        const rawType = typeVal.toLowerCase();
        if (rawType.includes('cr') || rawType.includes('credit') || rawType.includes('receive') || rawType.includes('deposit') || rawType.includes('inward')) {
          type = 'Received';
        } else {
          type = 'Sent';
        }
      } else if (transactionDetails) {
        const tdLower = transactionDetails.toLowerCase();
        if (tdLower.includes('received from') || tdLower.includes('credit') || tdLower.includes('by transfer') || tdLower.includes('refund')) {
          type = 'Received';
        }
      }
    }

    // 1.7 UPI Ref No. (UTR)
    let upiRefNo = findVal(/^upi\s*ref(\s*no\.?|\s*num)?$/i) ||
                   findVal(/^(utr|rrn|reference\s*no\.?|ref\s*no\.?|ref_num)$/i) ||
                   findVal(/utr/i) ||
                   findVal(/ref_no/i);

    // 1.8 Order ID
    let orderId = findVal(/^order\s*id$/i) ||
                  findVal(/^(order_no|order_num|orderid|merchant_ref)$/i) ||
                  findVal(/order/i);

    // 1.9 Remarks
    let remarks = findVal(/^remarks?$/i) ||
                  findVal(/^(notes?|comments?|purpose|narration_note)$/i);

    // 1.10 Tags
    let tags = findVal(/^tags?$/i) ||
               findVal(/^(category|label)$/i);

    // Intelligently parse missing fields from narration / transaction details if available
    const combinedText = `${transactionDetails} ${row.rawLine || ''}`.trim();

    if (!otherDetails && combinedText) {
      // Look for UPI ID (e.g. rahul@okaxis, surveen@ybl, 9876543210@paytm)
      const upiMatch = combinedText.match(/\b([a-zA-Z0-9.\-_]{2,30}@[a-zA-Z]{2,15})\b/);
      if (upiMatch) {
        otherDetails = upiMatch[1];
      } else {
        // Look for Account No mask (e.g. A/c XX4892 or XX9912)
        const accMatch = combinedText.match(/(?:a\/c|acc|ac|account)\s*(?:no\.?)?\s*[:\-\s]*([X*\d]{4,18})/i);
        if (accMatch) {
          otherDetails = `A/c ${accMatch[1]}`;
        }
      }
    }

    if (!upiRefNo && combinedText) {
      // Look for 12-digit UTR number
      const utrMatch = combinedText.match(/\b\d{12}\b/);
      if (utrMatch) {
        upiRefNo = utrMatch[0];
      }
    }

    if (!orderId && combinedText) {
      // Look for Order ID like T240928... or OD...
      const orderMatch = combinedText.match(/\b([A-Z0-9]{14,24})\b/);
      if (orderMatch && orderMatch[1] !== upiRefNo) {
        orderId = orderMatch[1];
      }
    }

    if (!yourAccount && combinedText) {
      const myAccMatch = combinedText.match(/(?:debited from|credited to|from bank|bank a\/c)\s*[:\-\s]*([A-Za-z0-9\s\-*]+)/i);
      if (myAccMatch) {
        yourAccount = myAccMatch[1].trim();
      }
    }

    if (!tags) {
      tags = type === 'Received' ? 'UPI Inflow' : 'Payment / Expense';
    }

    if (!transactionDetails) {
      const fromVal = findVal(/sender|from|paid_by/i);
      const toVal = findVal(/receiver|beneficiary|to|paid_to/i);
      if (type === 'Received') {
        transactionDetails = fromVal || otherDetails || 'Received Transfer';
      } else {
        transactionDetails = toVal || otherDetails || 'Payment Sent';
      }
    }

    // App detection
    const appKey = keys.find(k => /app|platform|channel|bank|source/i.test(k));
    let appName = appKey ? row[appKey] : '';
    if (!appName || appName === 'Unknown') {
      appName = detectAppOrChannel(`${transactionDetails} ${otherDetails} ${yourAccount} ${combinedText}`);
    }

    const finalTransactionId = (upiRefNo || orderId || `IMP-${Date.now().toString().slice(-6)}-${index + 1}`).trim();
    const isDuplicate = existingTxnIds.has(finalTransactionId);

    const fromParty = type === 'Received' ? (transactionDetails || otherDetails || 'Customer') : (yourAccount || 'Self / My Account');
    const toParty = type === 'Sent' ? (transactionDetails || otherDetails || 'Merchant') : (yourAccount || 'Self / My Account');

    return {
      id: `imported-${Date.now()}-${index}`,
      date: date || '-',
      time: time || '-',
      transactionDetails: transactionDetails || '-',
      otherDetails: otherDetails || '-',
      yourAccount: yourAccount || '-',
      amount: `₹ ${Number(rawAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      rawAmount,
      upiRefNo: upiRefNo || '-',
      orderId: orderId || '-',
      remarks: remarks || '-',
      tags: tags || 'General',
      // Backwards-compatible fields for table & database
      appName,
      type,
      from: fromParty,
      to: toParty,
      dateTime: `${date} ${time}`.trim(),
      transactionId: finalTransactionId,
      screenshotUrl: null,
      synced: false,
      timestamp: new Date().toISOString(),
      source: 'Statement Import',
      isDuplicate,
      selected: !isDuplicate
    };
  });
};

/**
 * Parse Excel file buffer into transaction list
 */
export const parseExcelStatement = async (arrayBuffer, existingTransactions = []) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel workbook contains no valid worksheets.');

  let headerRowIndex = 1;
  let headers = [];

  // Scan first 10 rows to locate header row
  for (let r = 1; r <= Math.min(15, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const values = [];
    row.eachCell((cell) => {
      values.push(cell.text?.trim() || '');
    });

    const isHeaderCandidate = values.some(v => 
      /date|narration|description|amount|debit|credit|utr|type|particulars/i.test(v)
    );

    if (isHeaderCandidate && values.length >= 3) {
      headerRowIndex = r;
      headers = values;
      break;
    }
  }

  if (headers.length === 0) {
    const firstRow = worksheet.getRow(1);
    firstRow.eachCell(c => headers.push(c.text?.trim() || ''));
  }

  const rawRows = [];
  for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const rowObj = {};
    let hasData = false;

    headers.forEach((h, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      let val = cell.value;
      if (val && typeof val === 'object') {
        val = val.text || val.result || val.toString();
      }
      rowObj[h || `Col_${colIdx + 1}`] = val !== undefined && val !== null ? val.toString().trim() : '';
      if (val) hasData = true;
    });

    if (hasData) {
      rawRows.push(rowObj);
    }
  }

  return normalizeStatementRows(rawRows, existingTransactions);
};

/**
 * Parse CSV file into transaction list
 */
export const parseCSVStatement = async (fileText, existingTransactions = []) => {
  const { rows } = parseCSVText(fileText);
  return normalizeStatementRows(rows, existingTransactions);
};

/**
 * Parse PDF Bank Statement by extracting text and parsing lines
 * Supports password-protected PDF unlocking
 */
export const parsePDFStatement = async (arrayBuffer, existingTransactions = [], password = '') => {
  let pdfDoc;
  try {
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      password: password || undefined 
    });
    pdfDoc = await loadingTask.promise;
  } catch (err) {
    if (
      err.name === 'PasswordException' || 
      err.code === 1 || 
      err.code === 2 ||
      (err.message && err.message.toLowerCase().includes('password'))
    ) {
      const isIncorrect = err.code === 2 || (Boolean(password) && password.length > 0);
      const passErr = new Error(
        isIncorrect 
          ? 'Incorrect PDF password. Please check and try again.' 
          : 'PDF is password-protected. Please enter password to unlock.'
      );
      passErr.isPasswordRequired = true;
      passErr.isPasswordIncorrect = isIncorrect;
      throw passErr;
    }
    throw err;
  }

  const numPages = pdfDoc.numPages;
  let allLines = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    
    // Group text items by vertical position (Y) to reconstruct statement lines
    const lineMap = new Map();
    textContent.items.forEach(item => {
      const y = Math.round(item.transform[5]); // Y coordinate
      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y).push(item);
    });

    // Sort Y descending (top of page first)
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
    sortedY.forEach(y => {
      const items = lineMap.get(y);
      // Sort X ascending (left to right)
      items.sort((a, b) => a.transform[4] - b.transform[4]);
      const lineText = items.map(it => it.str).join('   ').trim();
      if (lineText.length > 5) {
        allLines.push(lineText);
      }
    });
  }

  // Regex patterns for transaction parsing
  const dateRegex = /\b(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i;
  const timeRegex = /\b([0-1]?[0-9]:[0-5][0-9](?::[0-5][0-9])?\s*(?:AM|PM|am|pm)?)\b/;
  const amountPattern = /(?:₹\s*|Rs\.?\s*|INR\s*)?([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2}))/g;

  const rawRows = [];

  for (const line of allLines) {
    const dateMatch = line.match(dateRegex);
    if (!dateMatch) continue;

    const amounts = Array.from(line.matchAll(amountPattern)).map(m => m[1]);
    if (amounts.length === 0) continue;

    const lowerLine = line.toLowerCase();
    const isCredit = lowerLine.includes('cr') || lowerLine.includes('credit') || lowerLine.includes('deposit') || lowerLine.includes('received') || lowerLine.includes('by transfer');
    const isDebit = lowerLine.includes('dr') || lowerLine.includes('debit') || lowerLine.includes('withdrawal') || lowerLine.includes('to transfer') || lowerLine.includes('paid');

    // Main transaction amount is usually the first or second extracted amount
    const mainAmount = amounts[0];
    const utrMatch = line.match(/\b\d{12}\b/) || line.match(/UPI\/(\w+)/i);
    const timeMatch = line.match(timeRegex);
    const upiIdMatch = line.match(/\b([a-zA-Z0-9.\-_]{2,30}@[a-zA-Z]{2,15})\b/);
    const orderIdMatch = line.match(/\b(T\d{14,24}|OD\d{12,20})\b/);
    const accMatch = line.match(/(?:a\/c|acc|account)\s*(?:no\.?)?\s*[:\-\s]*([X*\d]{4,18})/i);

    const cleanDescription = line
      .replace(dateMatch[0], '')
      .replace(mainAmount, '')
      .replace(timeMatch ? timeMatch[0] : '', '')
      .replace(/\s+/g, ' ')
      .trim();

    rawRows.push({
      Date: dateMatch[0],
      Time: timeMatch ? timeMatch[0] : '',
      'Transaction Details': cleanDescription,
      'Other Transaction Details (UPI ID or A/c No)': upiIdMatch ? upiIdMatch[1] : (accMatch ? `A/c ${accMatch[1]}` : ''),
      'Your Account': accMatch ? `A/c ${accMatch[1]}` : '',
      Amount: mainAmount,
      'UPI Ref No.': utrMatch ? (utrMatch[1] || utrMatch[0]) : '',
      'Order ID': orderIdMatch ? orderIdMatch[1] : '',
      Remarks: cleanDescription.length > 5 ? cleanDescription : '',
      Tags: isCredit && !isDebit ? 'Bank Inflow' : 'Bank Outflow',
      type: isCredit && !isDebit ? 'Received' : 'Sent',
      rawLine: line
    });
  }

  // If line parsing extracted transactions, normalize them
  if (rawRows.length > 0) {
    return normalizeStatementRows(rawRows, existingTransactions);
  }

  throw new Error('Could not automatically parse structured tabular records from this PDF. Please ensure the PDF is an official Bank or UPI statement, or export as CSV/Excel.');
};

/**
 * Universal Statement Parser that handles Excel, CSV, PDF, and JSON
 * Supports optional password for password-protected statements
 */
export const parseStatementFile = async (file, existingTransactions = [], password = '') => {
  const name = file.name.toLowerCase();

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const arrayBuffer = await file.arrayBuffer();
    return await parseExcelStatement(arrayBuffer, existingTransactions);
  }

  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text();
    return await parseCSVStatement(text, existingTransactions);
  }

  if (name.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer();
    return await parsePDFStatement(arrayBuffer, existingTransactions, password);
  }

  if (name.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const data = Array.isArray(parsed) ? parsed : (parsed.transactions || parsed.data || []);
    return normalizeStatementRows(data, existingTransactions);
  }

  throw new Error(`Unsupported file type: ${file.name}. Please upload .xlsx, .xls, .csv, .pdf, or .json`);
};
