/**
 * Supabase Backend Integration Service for PayLens
 * 
 * Provides high-speed PostgreSQL cloud database persistence,
 * real-time live synchronization, cross-device authentication,
 * and cloud storage for payment screenshot receipts.
 */

import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY_SUPABASE_URL = 'paylens_supabase_url';
const STORAGE_KEY_SUPABASE_KEY = 'paylens_supabase_key';

const DEFAULT_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pewltrcchohaylamincw.supabase.co';
const DEFAULT_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_4XmrKr-upDmwH8wIIIpHKw_oFDHvsZe';

export const getSupabaseConfig = () => {
  const url = localStorage.getItem(STORAGE_KEY_SUPABASE_URL) || DEFAULT_URL;
  const anonKey = localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) || DEFAULT_KEY;
  return { url: url.trim(), anonKey: anonKey.trim() };
};

export const setSupabaseConfig = (url, anonKey) => {
  if (url && anonKey) {
    localStorage.setItem(STORAGE_KEY_SUPABASE_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_SUPABASE_KEY, anonKey.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_SUPABASE_URL);
    localStorage.removeItem(STORAGE_KEY_SUPABASE_KEY);
  }
  // Reset client cache
  _cachedClient = null;
};

let _cachedClient = null;

export const getSupabaseClient = () => {
  if (_cachedClient) return _cachedClient;

  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;

  try {
    _cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });
    return _cachedClient;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return null;
  }
};

export const isSupabaseConfigured = () => {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey);
};

/**
 * Upload receipt image (Base64) to Supabase Storage
 */
export const uploadReceiptImage = async (base64Data, fileNamePrefix = 'receipt') => {
  const supabase = getSupabaseClient();
  if (!supabase || !base64Data || !base64Data.startsWith('data:image')) {
    return null;
  }

  try {
    const parts = base64Data.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([array], { type: mime });
    const extension = mime.split('/')[1] || 'jpg';
    const fileName = `${fileNamePrefix}-${Date.now()}.${extension}`;

    const { data, error } = await supabase.storage
      .from('receipts')
      .upload(fileName, blob, {
        contentType: mime,
        upsert: true
      });

    if (error) {
      console.warn('Supabase storage upload error:', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(data.path);

    return publicUrlData?.publicUrl || null;
  } catch (e) {
    console.warn('Receipt upload exception:', e);
    return null;
  }
};

/**
 * Fetch all transactions from Supabase
 */
export const fetchSupabaseTransactions = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, transactions: [], message: 'Supabase not configured' };

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return {
        success: false,
        transactions: [],
        tableMissing: error.code === '42P01' || error.message?.includes('does not exist'),
        message: error.message
      };
    }

    const transactions = (data || []).map((t) => ({
      id: t.id,
      appName: t.app_name || 'Unknown',
      type: t.type || 'Sent',
      from: t.sender || '',
      to: t.receiver || '',
      amount: t.amount || '₹0',
      dateTime: t.date_time || '',
      transactionId: t.transaction_id || 'N/A',
      screenshotUrl: t.screenshot_url || null,
      timestamp: t.created_at || new Date().toISOString(),
      synced: true
    }));

    return {
      success: true,
      transactions,
      message: `Loaded ${transactions.length} records from Supabase cloud.`
    };
  } catch (err) {
    return {
      success: false,
      transactions: [],
      message: err.message || 'Network error connecting to Supabase.'
    };
  }
};

/**
 * Insert new transaction into Supabase
 */
export const insertSupabaseTransaction = async (tx) => {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, message: 'Supabase not configured' };

  try {
    let cloudImageUrl = tx.screenshotUrl;

    // If receipt is base64, upload to Supabase Storage bucket
    if (tx.screenshotUrl && tx.screenshotUrl.startsWith('data:image')) {
      const uploadedUrl = await uploadReceiptImage(tx.screenshotUrl, tx.appName || 'payment');
      if (uploadedUrl) {
        cloudImageUrl = uploadedUrl;
      }
    }

    const row = {
      app_name: tx.appName || 'Unknown',
      type: tx.type || 'Sent',
      sender: tx.from || '',
      receiver: tx.to || '',
      amount: tx.amount || '₹0',
      date_time: tx.dateTime || '',
      transaction_id: tx.transactionId || 'N/A',
      screenshot_url: cloudImageUrl || null,
      created_at: tx.timestamp || new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('transactions')
      .insert([row])
      .select()
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      record: {
        ...tx,
        id: data.id,
        screenshotUrl: data.screenshot_url || tx.screenshotUrl,
        synced: true
      },
      message: 'Transaction saved to Supabase cloud successfully!'
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

/**
 * Delete a transaction from Supabase
 */
export const deleteSupabaseTransaction = async (id, transactionId) => {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false };

  try {
    let query = supabase.from('transactions').delete();
    if (id && id.length > 20) {
      query = query.eq('id', id);
    } else if (transactionId && transactionId !== 'N/A') {
      query = query.eq('transaction_id', transactionId);
    } else {
      query = query.eq('id', id);
    }

    const { error } = await query;
    return { success: !error };
  } catch (e) {
    return { success: false };
  }
};

/**
 * Clear all transactions in Supabase
 */
export const clearAllSupabaseTransactions = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false };

  try {
    // Delete all records where id is not null
    const { error } = await supabase
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    return { success: !error };
  } catch (e) {
    return { success: false };
  }
};

/**
 * Real-time Subscription: Listen for changes across all devices
 */
export const subscribeToTransactions = (onInsert, onDelete) => {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  try {
    const channel = supabase
      .channel('public:transactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const t = payload.new;
            onInsert?.({
              id: t.id,
              appName: t.app_name || 'Unknown',
              type: t.type || 'Sent',
              from: t.sender || '',
              to: t.receiver || '',
              amount: t.amount || '₹0',
              dateTime: t.date_time || '',
              transactionId: t.transaction_id || 'N/A',
              screenshotUrl: t.screenshot_url || null,
              timestamp: t.created_at,
              synced: true
            });
          } else if (payload.eventType === 'DELETE') {
            onDelete?.(payload.old?.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Realtime subscription failed:', err);
    return () => {};
  }
};

/**
 * Cross-device User Authentication via Supabase
 */
export const fetchSupabaseAuth = async (username = null) => {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false };

  try {
    let query = supabase.from('paylens_users').select('*');
    if (username) {
      query = query.ilike('username', username.trim());
    }
    const { data, error } = await query.limit(1).maybeSingle();

    if (error || !data) return { success: false };

    return {
      success: true,
      user: {
        username: data.username,
        passwordHash: data.password_hash,
        fullName: data.full_name
      }
    };
  } catch (e) {
    return { success: false };
  }
};

export const updateSupabaseAuth = async (user, oldUsername = null) => {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false };

  try {
    // If username changed, delete the old username entry
    if (oldUsername && oldUsername.trim().toLowerCase() !== user.username.trim().toLowerCase()) {
      await supabase
        .from('paylens_users')
        .delete()
        .ilike('username', oldUsername.trim());
    }

    const { error } = await supabase
      .from('paylens_users')
      .upsert([
        {
          username: user.username.trim(),
          password_hash: user.passwordHash,
          full_name: user.fullName,
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'username' });

    if (error) {
      console.warn('Supabase auth update error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
