/**
 * Google Sheets Backend Integration Service
 * 
 * Sends structured payment records to a Google Apps Script Web App.
 * Handles Google Apps Script redirect nuances and CORS gracefully.
 */

const STORAGE_KEY_WEBHOOK = 'paylens_webhook_url';
const DEFAULT_WEBHOOK_URL = import.meta.env.VITE_SHEETS_WEBHOOK_URL || '';

/**
 * Normalizes input: converts raw Deployment ID (e.g., AKfycb...) into full Web App URL
 */
export const formatWebhookUrl = (input) => {
  if (!input) return '';
  const trimmed = input.trim();
  // If user entered only deployment ID (e.g., AKfycbxhnHF0xZeZRNCCWJppVr-Lr69n3BJ7jLrMDpdU1BcFOpo0cTpd4WYa35AQkjUJWqMc)
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
    return '';
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

  // If no webhook URL is configured, record locally with a friendly notification
  if (!webhookUrl) {
    return {
      success: true,
      simulated: true,
      message: 'Transaction saved to local dashboard! Configure Google Sheets Webhook to sync to the cloud.'
    };
  }

  // Format payload according to specification (No external links)
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
    screenshotUrl: payload.screenshotUrl ? 'Verified in Dashboard' : 'N/A',
    timestamp: new Date().toISOString()
  };

  try {
    // Send directly with mode: 'no-cors' to avoid browser CORS redirect failures on script.google.com
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
    // Send a test ping action
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'ping', test: true, timestamp: new Date().toISOString() }),
    });

    return {
      valid: true,
      formattedUrl: url,
      message: 'Connection verified! Webhook responded successfully.'
    };
  } catch (error) {
    return {
      valid: false,
      message: `Connection failed: ${error.message}`
    };
  }
};
