/**
 * Google Sheets Backend Integration Service
 * 
 * Sends and fetches structured payment records and credentials to/from Google Apps Script.
 * Handles cross-device synchronization so logging in with ID and password from any
 * mobile phone or computer displays the user's complete data.
 */

const STORAGE_KEY_WEBHOOK = 'paylens_webhook_url';
const DEFAULT_WEBHOOK_URL = import.meta.env.VITE_SHEETS_WEBHOOK_URL || '';

/**
 * Normalizes input: converts raw Deployment ID into full Web App URL
 */
export const formatWebhookUrl = (input) => {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://script.google.com/macros/s/${trimmed}/exec`;
  }
  return trimmed;
};

/**
 * Get current configured webhook URL (LocalStorage with .env fallback)
 */
export const getWebhookUrl = () => {
  const stored = localStorage.getItem(STORAGE_KEY_WEBHOOK) || DEFAULT_WEBHOOK_URL;
  return formatWebhookUrl(stored);
};

/**
 * Save custom webhook URL to LocalStorage
 */
export const setWebhookUrl = (url) => {
  if (url) {
    const formatted = formatWebhookUrl(url);
    localStorage.setItem(STORAGE_KEY_WEBHOOK, formatted);
    return formatted;
  } else {
    localStorage.removeItem(STORAGE_KEY_WEBHOOK);
    return DEFAULT_WEBHOOK_URL;
  }
};

/**
 * Fetch all saved transactions from Google Sheets
 * Enables cross-device sync on login or page load
 * @param {string} [customUrl]
 * @returns {Promise<{success: boolean, transactions: Array, message?: string, needsScriptUpdate?: boolean}>}
 */
export const fetchTransactions = async (customUrl = null) => {
  const webhookUrl = formatWebhookUrl((customUrl || getWebhookUrl()).trim());

  if (!webhookUrl) {
    return {
      success: false,
      transactions: [],
      message: 'No Google Sheets Webhook URL configured.'
    };
  }

  try {
    const fetchUrl = `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}action=getTransactions&_t=${Date.now()}`;
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const responseText = await response.text();

    // Check if the deployed script is missing doGet
    if (responseText.includes('Script function not found: doGet') || responseText.includes('<html')) {
      return {
        success: false,
        transactions: [],
        needsScriptUpdate: true,
        message: 'Google Apps Script needs update: Deploy latest script with doGet to sync data across all devices.'
      };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      return {
        success: false,
        transactions: [],
        needsScriptUpdate: true,
        message: 'Could not parse response from Google Sheets.'
      };
    }

    if (data && data.status === 'success' && Array.isArray(data.transactions)) {
      return {
        success: true,
        transactions: data.transactions,
        message: `Synced ${data.transactions.length} records from Google Sheets.`
      };
    } else if (Array.isArray(data)) {
      return {
        success: true,
        transactions: data,
        message: `Synced ${data.length} records from Google Sheets.`
      };
    }

    return {
      success: false,
      transactions: [],
      message: data?.message || 'Unexpected response format.'
    };
  } catch (err) {
    console.warn('Failed to fetch transactions from Google Sheets:', err);
    return {
      success: false,
      transactions: [],
      message: `Failed to load cloud data: ${err.message || 'Network error'}`
    };
  }
};

/**
 * Fetch user security profile/credentials from Google Sheets (_PayLens_Auth sheet)
 * @param {string} [customUrl]
 */
export const fetchCloudAuth = async (customUrl = null) => {
  const webhookUrl = formatWebhookUrl((customUrl || getWebhookUrl()).trim());
  if (!webhookUrl) return { success: false };

  try {
    const fetchUrl = `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}action=getAuth&_t=${Date.now()}`;
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    const text = await response.text();
    if (text.includes('Script function not found: doGet') || text.includes('<html')) {
      return { success: false, needsScriptUpdate: true };
    }

    const data = JSON.parse(text);
    if (data && data.status === 'success' && data.user) {
      return { success: true, user: data.user };
    }
  } catch (e) {
    // Cloud auth lookup fails gracefully
  }
  return { success: false };
};

/**
 * Update user security profile/credentials in Google Sheets
 * @param {Object} creds
 * @param {string} [customUrl]
 */
export const updateCloudAuth = async (creds, customUrl = null) => {
  const webhookUrl = formatWebhookUrl((customUrl || getWebhookUrl()).trim());
  if (!webhookUrl) return { success: false };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updateAuth',
        username: creds.username,
        passwordHash: creds.passwordHash,
        fullName: creds.fullName,
        timestamp: new Date().toISOString()
      }),
    });
    return { success: true };
  } catch (err) {
    console.warn('Failed to update credentials in Google Sheets:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Submit payment transaction payload to Google Sheets via Webhook
 * @param {Object} payload 
 * @param {string} [customUrl]
 * @returns {Promise<{success: boolean, message: string, simulated?: boolean}>}
 */
export const submitTransaction = async (payload, customUrl = null) => {
  const webhookUrl = formatWebhookUrl((customUrl || getWebhookUrl()).trim());

  if (!webhookUrl) {
    return {
      success: true,
      simulated: true,
      message: 'Transaction saved to local dashboard! Configure Google Sheets Webhook to sync to the cloud.'
    };
  }

  const isDataImage = payload.screenshotUrl && payload.screenshotUrl.startsWith('data:image');
  const isHttpUrl = payload.screenshotUrl && payload.screenshotUrl.startsWith('http');

  const formattedPayload = {
    appName: payload.appName || 'Unknown',
    type: payload.type || 'Sent',
    from: payload.from || 'N/A',
    to: payload.to || 'N/A',
    amount: payload.amount?.toString().startsWith('₹') 
      ? payload.amount 
      : `₹${Number(payload.amount || 0).toLocaleString('en-IN')}`,
    dateTime: payload.dateTime || new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }),
    transactionId: payload.transactionId || 'N/A',
    screenshotBase64: isDataImage ? payload.screenshotUrl : null,
    screenshotUrl: isHttpUrl ? payload.screenshotUrl : (isDataImage ? 'Drive Receipt Pending' : 'N/A'),
    timestamp: payload.timestamp || new Date().toISOString()
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(formattedPayload),
    });

    return {
      success: true,
      message: 'Transaction successfully synced to Google Sheets!',
    };
  } catch (err) {
    console.error('Google Sheets submission failed:', err);
    return {
      success: false,
      message: `Failed to sync with Google Sheets: ${err.message || 'Network error'}`
    };
  }
};

/**
 * Delete a transaction from Google Sheets
 * @param {string} transactionId
 * @param {string} timestamp
 * @param {string} [customUrl]
 */
export const deleteCloudTransaction = async (transactionId, timestamp, customUrl = null) => {
  const webhookUrl = formatWebhookUrl((customUrl || getWebhookUrl()).trim());
  if (!webhookUrl) return { success: false };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'deleteTransaction',
        transactionId: transactionId || 'N/A',
        timestamp: timestamp || ''
      })
    });
    return { success: true };
  } catch (err) {
    console.warn('Failed to delete transaction in Google Sheets:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Clear all transactions from Google Sheets
 * @param {string} [customUrl]
 */
export const clearAllCloudTransactions = async (customUrl = null) => {
  const webhookUrl = formatWebhookUrl((customUrl || getWebhookUrl()).trim());
  if (!webhookUrl) return { success: false };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'clearAll' })
    });
    return { success: true };
  } catch (err) {
    console.warn('Failed to clear Google Sheets:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Test connectivity to the Google Apps Script Webhook
 * @param {string} rawInput 
 */
export const testWebhookConnection = async (rawInput) => {
  const url = formatWebhookUrl(rawInput);

  if (!url || !url.startsWith('https://script.google.com/macros/s/')) {
    return {
      valid: false,
      message: 'Invalid Google Apps Script URL or Deployment ID. Must start with https://script.google.com/macros/s/... or be a valid Deployment ID'
    };
  }

  try {
    // 1. Test POST
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'ping', test: true, timestamp: new Date().toISOString() }),
    });

    // 2. Test GET (check if doGet is deployed for multi-device sync)
    let hasDoGet = false;
    try {
      const getRes = await fetch(`${url}?action=ping&_t=${Date.now()}`);
      const getText = await getRes.text();
      if (!getText.includes('Script function not found: doGet') && !getText.includes('<html')) {
        hasDoGet = true;
      }
    } catch (e) {
      // Ignored
    }

    return {
      valid: true,
      hasDoGet,
      formattedUrl: url,
      message: hasDoGet
        ? 'Connection verified! Multi-device sync is fully supported.'
        : 'POST connection verified! Please update script with doGet to enable loading data on other devices.'
    };
  } catch (error) {
    return {
      valid: false,
      message: `Connection failed: ${error.message}`
    };
  }
};
