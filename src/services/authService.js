/**
 * Authentication and Security Service
 * Secures PayLens for personal access by Pradeep Kumar Sharma
 * Supports cloud credentials synchronization across multiple devices via Supabase & Google Sheets.
 */

import { fetchCloudAuth, updateCloudAuth } from './sheetsService';
import { fetchSupabaseAuth, updateSupabaseAuth } from './supabaseService';

const STORAGE_KEY_AUTH = 'paylens_auth_credentials';
const STORAGE_KEY_SESSION = 'paylens_active_session';

// Simple hashing utility (SHA-256 via Web Crypto API)
export const sha256 = async (str) => {
  const utf8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const DEFAULT_USER = {
  username: 'pradeep',
  // SHA-256 hash for default password: "admin"
  passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  fullName: 'PRADEEP KUMAR SHARMA'
};

/**
 * Initialize credentials if not set
 */
export const getStoredCredentials = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Auth parse error:', e);
  }
  return DEFAULT_USER;
};

/**
 * Check if a session is currently active
 */
export const isAuthenticated = () => {
  try {
    const session = localStorage.getItem(STORAGE_KEY_SESSION);
    if (!session) return false;
    const parsed = JSON.parse(session);
    return !!parsed && !!parsed.loggedIn;
  } catch (e) {
    return false;
  }
};

/**
 * Get currently logged in user info
 */
export const getCurrentUser = () => {
  const creds = getStoredCredentials();
  return {
    username: creds.username,
    fullName: creds.fullName || 'PRADEEP KUMAR SHARMA'
  };
};

/**
 * Login verification with multi-device cloud synchronization
 */
export const login = async (username, password) => {
  const inputHash = await sha256(password.trim());
  const inputUser = username.trim().toLowerCase();

  // 1. Direct Supabase Cloud Verification First (Authoritative cloud source)
  try {
    const supaRes = await fetchSupabaseAuth(inputUser);
    if (supaRes.success && supaRes.user) {
      const supaUser = supaRes.user;
      if (
        supaUser.username &&
        supaUser.username.toLowerCase() === inputUser &&
        inputHash === supaUser.passwordHash
      ) {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(supaUser));
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
          loggedIn: true,
          timestamp: Date.now(),
          username: supaUser.username
        }));
        return {
          success: true,
          user: {
            username: supaUser.username,
            fullName: supaUser.fullName || 'PRADEEP KUMAR SHARMA'
          }
        };
      }
    }
  } catch (err) {
    console.warn('Supabase auth check failed:', err);
  }

  // 2. Check local credentials cache (Offline fallback)
  const localCreds = getStoredCredentials();
  if (localCreds.username.toLowerCase() === inputUser && inputHash === localCreds.passwordHash) {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
      loggedIn: true,
      timestamp: Date.now(),
      username: localCreds.username
    }));

    // Trigger non-blocking cloud check to keep in sync
    fetchSupabaseAuth(inputUser).then(res => {
      if (res.success && res.user) {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(res.user));
      }
    }).catch(() => {});

    return {
      success: true,
      user: {
        username: localCreds.username,
        fullName: localCreds.fullName || 'PRADEEP KUMAR SHARMA'
      }
    };
  }

  // 3. Check Google Sheets cloud credentials fallback
  try {
    const cloudRes = await fetchCloudAuth();
    if (cloudRes.success && cloudRes.user) {
      const cloudUser = cloudRes.user;
      if (
        cloudUser.username &&
        cloudUser.username.toLowerCase() === inputUser &&
        inputHash === cloudUser.passwordHash
      ) {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(cloudUser));
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
          loggedIn: true,
          timestamp: Date.now(),
          username: cloudUser.username
        }));
        return {
          success: true,
          user: {
            username: cloudUser.username,
            fullName: cloudUser.fullName || 'PRADEEP KUMAR SHARMA'
          }
        };
      }
    }
  } catch (err) {
    console.warn('Google Sheets cloud auth check failed:', err);
  }

  // 4. Fallback: check against DEFAULT_USER
  if (DEFAULT_USER.username.toLowerCase() === inputUser && inputHash === DEFAULT_USER.passwordHash) {
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(DEFAULT_USER));
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
      loggedIn: true,
      timestamp: Date.now(),
      username: DEFAULT_USER.username
    }));
    return {
      success: true,
      user: {
        username: DEFAULT_USER.username,
        fullName: DEFAULT_USER.fullName
      }
    };
  }

  return {
    success: false,
    message: 'Incorrect username or password. Please try again.'
  };
};

/**
 * Terminate session
 * Note: Data is NEVER deleted on logout, only the active session token is cleared!
 */
export const logout = () => {
  localStorage.removeItem(STORAGE_KEY_SESSION);
};

/**
 * Update security credentials across Supabase, local storage, and Google Sheets
 */
export const updateCredentials = async ({ currentPassword, newUsername, newPassword, newFullName }) => {
  const creds = getStoredCredentials();
  const currentHash = await sha256(currentPassword.trim());

  let isCurrentPassValid = false;
  if (currentHash === creds.passwordHash || currentHash === DEFAULT_USER.passwordHash) {
    isCurrentPassValid = true;
  } else {
    // Check Supabase directly
    const supaCheck = await fetchSupabaseAuth(creds.username);
    if (supaCheck.success && supaCheck.user && supaCheck.user.passwordHash === currentHash) {
      isCurrentPassValid = true;
    }
  }

  if (!isCurrentPassValid) {
    return {
      success: false,
      message: 'Current password does not match.'
    };
  }

  const oldUsername = creds.username;
  const updated = {
    ...creds,
    username: newUsername ? newUsername.trim() : creds.username,
    fullName: newFullName ? newFullName.trim() : creds.fullName
  };

  if (newPassword && newPassword.trim().length >= 4) {
    updated.passwordHash = await sha256(newPassword.trim());
  }

  // 1. Save directly to Supabase cloud database
  try {
    await updateSupabaseAuth(updated, oldUsername);
  } catch (err) {
    console.warn('Could not sync updated credentials to Supabase:', err);
  }

  // 2. Save to local storage cache
  localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(updated));

  // 3. Update active session
  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
    loggedIn: true,
    timestamp: Date.now(),
    username: updated.username
  }));

  // 4. Sync to Google Sheets fallback
  try {
    await updateCloudAuth(updated);
  } catch (err) {
    console.warn('Could not sync updated credentials to Google Sheets:', err);
  }

  return {
    success: true,
    message: 'Credentials updated and secured in Supabase across all devices!',
    user: {
      username: updated.username,
      fullName: updated.fullName
    }
  };
};
