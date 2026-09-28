import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Trash2, ShieldCheck, KeyRound, 
  CheckCircle2, AlertCircle, Shield, RefreshCw 
} from 'lucide-react';
import { fetchAllUsers, createNewUser, deleteUserAccount, getCurrentUser } from '../services/authService';

export default function UsersPage({ currentUser, onUsersUpdated }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('editor');
  const [feedback, setFeedback] = useState(null);

  const activeUser = currentUser || getCurrentUser();
  const isAdmin = activeUser?.role === 'admin';

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const list = await fetchAllUsers();
      setUsers(list || []);
    } catch (e) {
      console.warn('Failed to fetch users:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim() || !newFullName.trim()) {
      setFeedback({ type: 'error', message: 'Please fill in all fields' });
      return;
    }

    try {
      const res = await createNewUser({
        username: newUsername.trim().toLowerCase(),
        password: newPassword.trim(),
        fullName: newFullName.trim(),
        role: newRole
      });

      if (res.success) {
        setFeedback({ type: 'success', message: `User "${newUsername}" created successfully!` });
        setNewUsername('');
        setNewFullName('');
        setNewPassword('');
        setShowAddForm(false);
        loadUsers();
        if (onUsersUpdated) onUsersUpdated();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to create user' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'User creation error' });
    }
  };

  const handleDelete = async (username) => {
    if (username === 'pradeep' || username === activeUser?.username) {
      alert('Cannot delete primary or currently logged in administrator account.');
      return;
    }

    if (window.confirm(`Are you sure you want to remove user "${username}"?`)) {
      try {
        const res = await deleteUserAccount(username);
        if (res.success) {
          setFeedback({ type: 'success', message: `User "${username}" removed.` });
          loadUsers();
          if (onUsersUpdated) onUsersUpdated();
        } else {
          setFeedback({ type: 'error', message: res.message });
        }
      } catch (err) {
        setFeedback({ type: 'error', message: err.message });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Users &amp; Team Access Control
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage accounts, multi-device team login, and permission levels
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadUsers}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
            title="Refresh users"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>{showAddForm ? 'Cancel' : 'Add New User'}</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-2xl text-xs flex items-center gap-2 ${
          feedback.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Add User Modal / Form */}
      {showAddForm && (
        <form onSubmit={handleCreateUser} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-purple-500/30 shadow-lg space-y-4 animate-in fade-in">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-purple-500" />
            Create Team Member Account
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. rahul"
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Temporary password"
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Role Permission
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
              >
                <option value="editor">Editor (Upload &amp; Scan)</option>
                <option value="admin">Administrator (Full Control)</option>
                <option value="viewer">Viewer (Read-Only)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition shadow-sm"
            >
              Save User
            </button>
          </div>
        </form>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Active Accounts ({users.length})
          </h4>
          <span className="text-xs text-slate-400">Authenticated via Supabase &amp; Local Vault</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold uppercase text-[10px] text-slate-400">
              <tr>
                <th className="py-3 px-5">User</th>
                <th className="py-3 px-5">Username</th>
                <th className="py-3 px-5">Access Role</th>
                <th className="py-3 px-5">Registered</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {users.map((u) => {
                const isCurrent = u.username === activeUser?.username;
                const isPrimaryAdmin = u.username === 'pradeep';

                return (
                  <tr key={u.username} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center uppercase shrink-0">
                          {u.fullName?.charAt(0) || u.username.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {u.fullName || u.username}
                          </p>
                          {isCurrent && (
                            <span className="text-[10px] font-semibold text-blue-500">
                              (You)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-5 font-mono text-slate-500">
                      @{u.username}
                    </td>

                    <td className="py-3 px-5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          : u.role === 'viewer'
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      }`}>
                        <Shield className="w-3 h-3" />
                        {u.role || 'editor'}
                      </span>
                    </td>

                    <td className="py-3 px-5 text-slate-400 text-[11px]">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'System Default'}
                    </td>

                    <td className="py-3 px-5 text-right">
                      {isAdmin && !isPrimaryAdmin && !isCurrent ? (
                        <button
                          onClick={() => handleDelete(u.username)}
                          title="Delete user account"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">Protected</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
