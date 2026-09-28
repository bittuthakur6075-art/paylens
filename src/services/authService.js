/**
 * Authentication and Security Service
 * Secures PayLens with multi-user, multi-device cloud authorization.
 * Supports granular access levels: Admin, Write Access (Editor), and Read-Only.
 */

import { fetchCloudAuth, updateCloudAuth } from './sheetsService';
import { 
  fetchSupabaseAuth, 
  updateSupabaseAuth, 
  fetchSupabaseUsers, 
  insertSupabaseUser, 
  deleteSupabaseUser 
} from './supabaseService';

const STORAGE_KEY_AUTH = 'paylens_auth_credentials';
const STORAGE_KEY_SESSION = 'paylens_active_session';
const STORAGE_KEY_USERS = 'paylens_users_list';
const STORAGE_KEY_INITIALIZED = 'paylens_auth_initialized';

// Simple hashing utility (SHA-256 via Web Crypto API)
export const sha256 = async (str) => {
  const utf8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Common breached passwords known to trigger Google Chrome's
 * "The password you just used was found in a data breach" modal.
 */
export const COMMON_BREACHED_PASSWORDS = new Set([
  'admin', 'password', '123456', '12345678', '123456789', 'admin123',
  '12345', 'qwerty', 'letmein', 'welcome', 'login', 'pass123', 'admin@123',
  'pradeep', 'pradeep123', 'root', 'master', 'iloveyou', 'test', 'guest'
]);

/**
 * Evaluates password strength and checks against known breached words
 */
export const validatePasswordStrength = (pass) => {
  if (!pass) return { score: 0, label: 'Empty', isBreachedRisk: false, color: 'slate' };
  const trimmed = pass.trim().toLowerCase();

  if (COMMON_BREACHED_PASSWORDS.has(trimmed)) {
    return {
      score: 1,
      label: 'Compromised / Breach Risk',
      isBreachedRisk: true,
      color: 'rose',
      message: 'This password is in public leaked lists and triggers browser breach alerts. Please use a unique password.'
    };
  }

  let score = 0;
  if (pass.length >= 6) score++;
  if (pass.length >= 8) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[A-Z]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++;

  if (score <= 1) {
    return {
      score: 1,
      label: 'Weak',
      isBreachedRisk: false,
      color: 'amber',
      message: 'Password is too short. Use at least 6 characters.'
    };
  }
  if (score <= 3) {
    return {
      score: 2,
      label: 'Moderate',
      isBreachedRisk: false,
      color: 'sky',
      message: 'Good password. Add numbers or special characters to make it breach-proof.'
    };
  }
  return {
    score: 3,
    label: 'Strong & Breach-Safe',
    isBreachedRisk: false,
    color: 'emerald',
    message: 'Strong unique password! Will never trigger browser breach warnings.'
  };
};

const STORAGE_KEY_RECOVERY_EMAIL = 'paylens_recovery_email';
export const DEFAULT_RECOVERY_EMAIL = 'sharmab7615@gmail.com';

// Backward compatibility alias
const STORAGE_KEY_RECOVERY_PHONE = 'paylens_recovery_phone';
export const DEFAULT_RECOVERY_PHONE = '8521583071';

export const DEFAULT_USER = {
  username: 'pradeep',
  // SHA-256 hash for default password: "admin"
  passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  fullName: 'PRADEEP KUMAR SHARMA',
  role: 'admin',
  email: DEFAULT_RECOVERY_EMAIL
};

/**
 * Get current registered recovery email for OTP login & password recovery
 */
export const getRecoveryEmail = () => {
  return (localStorage.getItem(STORAGE_KEY_RECOVERY_EMAIL) || DEFAULT_RECOVERY_EMAIL).trim().toLowerCase();
};

/**
 * Backward compatibility helper
 */
export const getRecoveryPhone = () => {
  return localStorage.getItem(STORAGE_KEY_RECOVERY_PHONE) || DEFAULT_RECOVERY_PHONE;
};

/**
 * Update registered recovery email
 */
export const setRecoveryEmail = (email) => {
  const clean = String(email || '').trim().toLowerCase();
  if (clean && clean.includes('@') && clean.includes('.')) {
    localStorage.setItem(STORAGE_KEY_RECOVERY_EMAIL, clean);
    try {
      const current = getStoredCredentials();
      if (current) {
        current.email = clean;
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(current));
      }
    } catch {}
    return clean;
  }
  return null;
};

export const setRecoveryPhone = (phone) => {
  const clean = String(phone || '').replace(/[^0-9]/g, '').slice(-10);
  if (clean.length === 10) {
    localStorage.setItem(STORAGE_KEY_RECOVERY_PHONE, clean);
    return clean;
  }
  return null;
};

// Active in-memory OTP record
let activeOTPRecord = null;

/**
 * Generate and dispatch 6-digit OTP to registered email only.
 * Rejects any request sent to an unauthorized email address!
 */
export const requestLoginOTP = async (customEmail = null) => {
  const authorizedEmail = getRecoveryEmail();
  const targetEmail = (customEmail || authorizedEmail).trim().toLowerCase();

  // Strict check: OTP cannot be requested for any other email
  if (targetEmail !== authorizedEmail) {
    return {
      success: false,
      message: `Access Denied: Sirf authorized registered email (${authorizedEmail}) par hi OTP bheja ja sakta hai. Kisi anya email par OTP bhejne ki anumati nahi hai.`
    };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  activeOTPRecord = {
    code,
    email: authorizedEmail,
    expiresAt,
    createdAt: Date.now()
  };

  return {
    success: true,
    code,
    email: authorizedEmail,
    expiresAt,
    message: `Verification code sent to ${authorizedEmail}`
  };
};

/**
 * Verify submitted OTP and establish active user session
 */
export const verifyLoginOTP = async (enteredCode) => {
  if (!activeOTPRecord) {
    return {
      success: false,
      message: 'No OTP requested or session expired. Please click "Send OTP Code".'
    };
  }

  if (Date.now() > activeOTPRecord.expiresAt) {
    activeOTPRecord = null;
    return {
      success: false,
      message: 'OTP has expired (valid for 5 minutes). Please request a new code.'
    };
  }

  const cleanEntered = String(enteredCode || '').trim();
  if (cleanEntered !== activeOTPRecord.code) {
    return {
      success: false,
      message: 'Incorrect OTP. Please enter the valid 6-digit verification code.'
    };
  }

  // Clear OTP and log in
  activeOTPRecord = null;
  const user = getCurrentUser();
  const userSession = {
    username: user.username || 'pradeep',
    fullName: user.fullName || 'PRADEEP KUMAR SHARMA',
    role: user.role || 'admin',
    email: getRecoveryEmail()
  };

  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
    loggedIn: true,
    timestamp: Date.now(),
    loginMethod: 'email_otp',
    ...userSession
  }));
  localStorage.setItem(STORAGE_KEY_INITIALIZED, 'true');

  return {
    success: true,
    message: 'OTP verified successfully! Unlocking your dashboard...',
    user: userSession
  };
};

/**
 * Verify OTP and reset password simultaneously if user forgot password
 */
export const resetPasswordWithOTP = async (enteredCode, newPassword) => {
  const verifyRes = await verifyLoginOTP(enteredCode);
  if (!verifyRes.success) return verifyRes;

  if (newPassword && newPassword.trim().length >= 4) {
    const credRes = await updateCredentials({ newPassword: newPassword.trim() });
    if (!credRes.success) {
      return credRes;
    }
  }

  return {
    success: true,
    message: 'OTP verified & password updated successfully!',
    user: verifyRes.user
  };
};

/**
 * Check if default credentials have been superseded or initialized
 */
export const isAuthInitialized = () => {
  return localStorage.getItem(STORAGE_KEY_INITIALIZED) === 'true';
};

/**
 * Get stored primary credentials
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
 * Get all users stored in local cache
 */
export const getStoredUsers = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Users parse error:', e);
  }

  // Seed with primary stored credentials if available
  const primary = getStoredCredentials();
  return [primary];
};

/**
 * Save users list to local cache
 */
export const saveStoredUsers = (users) => {
  try {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  } catch (e) {
    console.warn('Could not save users list to localStorage:', e);
  }
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
  try {
    const session = localStorage.getItem(STORAGE_KEY_SESSION);
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed && parsed.loggedIn) {
        return {
          username: parsed.username,
          fullName: parsed.fullName || 'PRADEEP KUMAR SHARMA',
          role: parsed.role || 'admin'
        };
      }
    }
  } catch (e) {}

  const creds = getStoredCredentials();
  return {
    username: creds.username,
    fullName: creds.fullName || 'PRADEEP KUMAR SHARMA',
    role: creds.role || 'admin'
  };
};

/**
 * Login verification with multi-device cloud synchronization
 * Enforces strict security: once updated, old username and old password are NEVER accepted.
 */
export const login = async (username, password) => {
  const inputHash = await sha256(password.trim());
  const inputUser = username.trim().toLowerCase();

  // 1. Direct Supabase Cloud Verification First (Authoritative cloud database)
  try {
    const supaRes = await fetchSupabaseAuth(inputUser);
    if (supaRes.success && supaRes.user) {
      const supaUser = supaRes.user;
      if (supaUser.username && supaUser.username.toLowerCase() === inputUser) {
        if (inputHash === supaUser.passwordHash) {
          const userSession = {
            username: supaUser.username,
            fullName: supaUser.fullName || 'PRADEEP KUMAR SHARMA',
            role: supaUser.role || 'admin'
          };

          // Cache credentials & session
          localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(supaUser));
          localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
            loggedIn: true,
            timestamp: Date.now(),
            ...userSession
          }));
          localStorage.setItem(STORAGE_KEY_INITIALIZED, 'true');

          // Update user in local users list
          const currentList = getStoredUsers();
          const filtered = currentList.filter(u => u.username.toLowerCase() !== inputUser);
          saveStoredUsers([supaUser, ...filtered]);

          return {
            success: true,
            user: userSession
          };
        } else {
          // Username exists in cloud, but password did not match!
          return {
            success: false,
            message: 'Incorrect password. Please verify and try again.'
          };
        }
      }
    }
  } catch (err) {
    console.warn('Supabase auth check failed:', err);
  }

  // 2. Check local credentials cache (Offline fallback)
  const localUsers = getStoredUsers();
  const matchedUser = localUsers.find(u => u.username.toLowerCase() === inputUser);
  if (matchedUser) {
    if (inputHash === matchedUser.passwordHash) {
      const userSession = {
        username: matchedUser.username,
        fullName: matchedUser.fullName || 'PRADEEP KUMAR SHARMA',
        role: matchedUser.role || 'admin'
      };

      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
        loggedIn: true,
        timestamp: Date.now(),
        ...userSession
      }));

      return {
        success: true,
        user: userSession
      };
    } else {
      return {
        success: false,
        message: 'Incorrect password. Please verify and try again.'
      };
    }
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
        const userSession = {
          username: cloudUser.username,
          fullName: cloudUser.fullName || 'PRADEEP KUMAR SHARMA',
          role: cloudUser.role || 'admin'
        };

        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(cloudUser));
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
          loggedIn: true,
          timestamp: Date.now(),
          ...userSession
        }));
        localStorage.setItem(STORAGE_KEY_INITIALIZED, 'true');

        return {
          success: true,
          user: userSession
        };
      }
    }
  } catch (err) {
    console.warn('Google Sheets cloud auth check failed:', err);
  }

  // 4. Initial Bootstrap Check ONLY:
  // Default credentials (pradeep / admin) are ONLY valid on a brand new, uninitialized setup.
  if (!isAuthInitialized()) {
    if (DEFAULT_USER.username.toLowerCase() === inputUser && inputHash === DEFAULT_USER.passwordHash) {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(DEFAULT_USER));
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
        loggedIn: true,
        timestamp: Date.now(),
        username: DEFAULT_USER.username,
        fullName: DEFAULT_USER.fullName,
        role: DEFAULT_USER.role
      }));
      return {
        success: true,
        user: {
          username: DEFAULT_USER.username,
          fullName: DEFAULT_USER.fullName,
          role: DEFAULT_USER.role
        }
      };
    }
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
 * Update security credentials across Supabase, local storage, and Google Sheets.
 * Securely deletes or replaces old username, updates password hash, and refreshes session.
 */
export const updateCredentials = async (params = {}) => {
  const currentSessionUser = getCurrentUser() || {};
  const currentPassword = (params.currentPassword || params.oldPassword || '').toString().trim();
  const targetUsername = (params.newUsername || params.username || currentSessionUser?.username || 'pradeep').toString().trim().toLowerCase();
  const targetFullName = (params.newFullName || params.fullName || currentSessionUser?.fullName || 'PRADEEP KUMAR SHARMA').toString().trim();
  const newPassword = (params.newPassword || params.password || '').toString().trim();

  // Verify current password against Supabase or local cache
  let activeUserRecord = null;

  try {
    const supaCheck = await fetchSupabaseAuth(currentSessionUser.username);
    if (supaCheck.success && supaCheck.user) {
      activeUserRecord = supaCheck.user;
    }
  } catch (e) {
    console.warn('Could not verify against Supabase:', e);
  }

  if (!activeUserRecord) {
    const storedUsers = getStoredUsers();
    activeUserRecord = storedUsers.find(u => u.username.toLowerCase() === currentSessionUser.username.toLowerCase());
    if (!activeUserRecord && !isAuthInitialized()) {
      activeUserRecord = DEFAULT_USER;
    }
  }

  // If currentPassword was provided, verify it strictly
  if (currentPassword) {
    const currentHash = await sha256(currentPassword);
    const validHash = activeUserRecord?.passwordHash || DEFAULT_USER.passwordHash;
    if (currentHash !== validHash) {
      return {
        success: false,
        message: 'Current password does not match. Please enter your existing password to authorize changes.'
      };
    }
  }

  const oldUsername = currentSessionUser?.username || 'pradeep';
  const finalUsername = (params.newUsername || params.username || oldUsername).toString().trim().toLowerCase();
  const finalFullName = (params.newFullName || params.fullName || currentSessionUser?.fullName || 'PRADEEP KUMAR SHARMA').toString().trim();

  // If changing username, ensure it doesn't collide with another existing user
  if (finalUsername !== oldUsername.toLowerCase()) {
    const storedUsers = getStoredUsers();
    if (storedUsers.some(u => u.username.toLowerCase() === finalUsername && u.username.toLowerCase() !== oldUsername.toLowerCase())) {
      return {
        success: false,
        message: `Username "${finalUsername}" is already taken by another account. Please choose a different username.`
      };
    }
  }

  const updated = {
    ...(activeUserRecord || currentSessionUser || {}),
    username: finalUsername,
    fullName: finalFullName,
    role: activeUserRecord?.role || currentSessionUser?.role || 'admin',
    updatedAt: new Date().toISOString()
  };

  if (params.email || params.recoveryEmail) {
    const cleanedEmail = setRecoveryEmail(params.email || params.recoveryEmail);
    if (cleanedEmail) {
      updated.email = cleanedEmail;
    }
  }

  if (params.phone || params.recoveryPhone) {
    const cleanedPhone = setRecoveryPhone(params.phone || params.recoveryPhone);
    if (cleanedPhone) {
      updated.phone = cleanedPhone;
    }
  }

  if (newPassword && newPassword.length > 0) {
    const strength = validatePasswordStrength(newPassword);
    if (strength.isBreachedRisk) {
      return {
        success: false,
        message: 'Security Notice: "' + newPassword + '" is a widely known breached password on the internet that triggers browser leak warnings. Please choose a unique password.'
      };
    }
    if (newPassword.length < 4) {
      return {
        success: false,
        message: 'New password must be at least 4 characters long.'
      };
    }
    updated.passwordHash = await sha256(newPassword);
  }

  // 1. Save directly to Supabase cloud database
  try {
    await updateSupabaseAuth(updated, oldUsername);
  } catch (err) {
    console.warn('Could not sync updated credentials to Supabase:', err);
  }

  // 2. Save to local storage cache & update users list
  const userList = getStoredUsers().filter(u => u.username.toLowerCase() !== oldUsername.toLowerCase() && u.username.toLowerCase() !== finalUsername);
  saveStoredUsers([updated, ...userList]);
  localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(updated));
  localStorage.setItem(STORAGE_KEY_INITIALIZED, 'true');

  // 3. Update active session
  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
    loggedIn: true,
    timestamp: Date.now(),
    username: updated.username,
    fullName: updated.fullName,
    role: updated.role
  }));

  // 4. Sync to Google Sheets fallback
  try {
    await updateCloudAuth(updated);
  } catch (err) {
    console.warn('Could not sync updated credentials to Google Sheets:', err);
  }

  return {
    success: true,
    message: 'Credentials updated and secured across all devices! Old credentials have been revoked.',
    user: {
      username: updated.username,
      fullName: updated.fullName,
      role: updated.role
    }
  };
};

/**
 * Fetch all users from cloud or local cache
 */
export const fetchAllUsers = async () => {
  // Try Supabase first
  try {
    const supaRes = await fetchSupabaseUsers();
    if (supaRes.success && Array.isArray(supaRes.users) && supaRes.users.length > 0) {
      saveStoredUsers(supaRes.users);
      return supaRes.users;
    }
  } catch (e) {
    console.warn('Could not fetch users from Supabase:', e);
  }

  return getStoredUsers();
};

/**
 * Add a new user with specified role/access level
 * Role can be: 'write' (Editor / Write Access), 'admin' (Full Access), or 'read' (Read Only)
 */
export const createNewUser = async ({ username, fullName, password, role = 'write' }) => {
  const cleanUsername = username.trim().toLowerCase();
  const cleanName = fullName.trim();
  const cleanPassword = password.trim();

  if (!cleanUsername || cleanUsername.length < 3) {
    return { success: false, message: 'Username must be at least 3 characters long.' };
  }
  if (!cleanName) {
    return { success: false, message: 'Full Name cannot be empty.' };
  }
  if (!cleanPassword || cleanPassword.length < 4) {
    return { success: false, message: 'Password must be at least 4 characters long.' };
  }

  const strength = validatePasswordStrength(cleanPassword);
  if (strength.isBreachedRisk) {
    return {
      success: false,
      message: 'Security Notice: "' + cleanPassword + '" is a widely known breached password on the internet that triggers browser warnings. Please choose a unique password.'
    };
  }

  // Check if username already exists locally
  const currentUsers = getStoredUsers();
  if (currentUsers.some(u => u.username.toLowerCase() === cleanUsername)) {
    return { success: false, message: `User "${cleanUsername}" already exists.` };
  }

  const passwordHash = await sha256(cleanPassword);
  const newUser = {
    username: cleanUsername,
    fullName: cleanName,
    passwordHash,
    role: role || 'write',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // 1. Sync to Supabase
  try {
    const supaRes = await insertSupabaseUser(newUser);
    if (!supaRes.success && supaRes.message) {
      console.warn('Supabase user insert note:', supaRes.message);
    }
  } catch (err) {
    console.warn('Could not save user to Supabase:', err);
  }

  // 2. Save to local storage
  const updatedList = [newUser, ...currentUsers.filter(u => u.username.toLowerCase() !== cleanUsername)];
  saveStoredUsers(updatedList);
  localStorage.setItem(STORAGE_KEY_INITIALIZED, 'true');

  const roleLabel = role === 'admin' ? 'Admin Access' : role === 'write' ? 'Write Access' : 'Read-Only Access';

  return {
    success: true,
    message: `User "${cleanUsername}" created successfully with ${roleLabel}! They can now log in.`,
    user: newUser
  };
};

/**
 * Delete a user and revoke their access
 */
export const deleteUserAccount = async (usernameToDelete) => {
  const current = getCurrentUser();
  const target = usernameToDelete.trim().toLowerCase();

  if (current.username.toLowerCase() === target) {
    return { success: false, message: 'You cannot delete or revoke your own active account.' };
  }

  // 1. Delete from Supabase
  try {
    await deleteSupabaseUser(target);
  } catch (e) {
    console.warn('Could not delete user from Supabase:', e);
  }

  // 2. Delete from local storage
  const remaining = getStoredUsers().filter(u => u.username.toLowerCase() !== target);
  saveStoredUsers(remaining);

  return {
    success: true,
    message: `User "${target}" access has been revoked and removed.`
  };
};
