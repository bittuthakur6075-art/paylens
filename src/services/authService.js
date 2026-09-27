/**
 * Authentication and Security Service
 * Secures PayLens for personal access by Pradeep Kumar Sharma
 */

const STORAGE_KEY_AUTH = 'paylens_auth_credentials';
const STORAGE_KEY_SESSION = 'paylens_active_session';

// Simple hashing utility (SHA-256 via Web Crypto API)
const sha256 = async (str) => {
  const utf8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const DEFAULT_USER = {
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
 * Login verification
 */
export const login = async (username, password) => {
  const creds = getStoredCredentials();
  const inputHash = await sha256(password.trim());

  if (username.trim().toLowerCase() === creds.username.toLowerCase() && inputHash === creds.passwordHash) {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
      loggedIn: true,
      timestamp: Date.now(),
      username: creds.username
    }));
    return {
      success: true,
      user: {
        username: creds.username,
        fullName: creds.fullName
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
 */
export const logout = () => {
  localStorage.removeItem(STORAGE_KEY_SESSION);
};

/**
 * Update security credentials
 */
export const updateCredentials = async ({ currentPassword, newUsername, newPassword, newFullName }) => {
  const creds = getStoredCredentials();
  const currentHash = await sha256(currentPassword.trim());

  if (currentHash !== creds.passwordHash) {
    return {
      success: false,
      message: 'Current password does not match.'
    };
  }

  const updated = {
    ...creds,
    username: newUsername ? newUsername.trim() : creds.username,
    fullName: newFullName ? newFullName.trim() : creds.fullName
  };

  if (newPassword && newPassword.trim().length >= 4) {
    updated.passwordHash = await sha256(newPassword.trim());
  }

  localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(updated));

  // Update session
  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
    loggedIn: true,
    timestamp: Date.now(),
    username: updated.username
  }));

  return {
    success: true,
    message: 'Credentials updated successfully!',
    user: {
      username: updated.username,
      fullName: updated.fullName
    }
  };
};
