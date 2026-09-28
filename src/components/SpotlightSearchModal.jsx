import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, X, Smartphone, ArrowUpRight, ArrowDownLeft, 
  Copy, Check, Eye, Calendar, Sparkles, Filter, CornerDownLeft
} from 'lucide-react';

export default function SpotlightSearchModal({ 
  isOpen, 
  onClose, 
  transactions = [], 
  onViewImage, 
  onSelectTransaction 
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const [appFilter, setAppFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
      setAppFilter('ALL');
      setTypeFilter('ALL');
    }
  }, [isOpen]);

  // Clean amount helper
  const parseAmount = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleaned = val.toString().replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // Distinct apps
  const distinctApps = Array.from(new Set(transactions.map(t => t.appName).filter(Boolean)));

  // Filtered results
  const filtered = transactions.filter((t) => {
    if (appFilter !== 'ALL' && t.appName !== appFilter) return false;
    if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;

    if (!query.trim()) return true;

    const q = query.toLowerCase().trim();

    // Check for amount operator like > 1000 or < 500
    if (q.startsWith('>') || q.startsWith('<')) {
      const op = q[0];
      const threshold = parseFloat(q.slice(1).trim());
      if (!isNaN(threshold)) {
        const amt = parseAmount(t.amount);
        return op === '>' ? amt >= threshold : amt <= threshold;
      }
    }

    const matchesUtr = (t.transactionId || '').toLowerCase().includes(q);
    const matchesFrom = (t.from || '').toLowerCase().includes(q);
    const matchesTo = (t.to || '').toLowerCase().includes(q);
    const matchesApp = (t.appName || '').toLowerCase().includes(q);
    const matchesAmount = (t.amount || '').toString().toLowerCase().includes(q);
    const matchesDate = (t.dateTime || '').toLowerCase().includes(q);

    return matchesUtr || matchesFrom || matchesTo || matchesApp || matchesAmount || matchesDate;
  });

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      const selected = filtered[selectedIndex];
      if (selected.screenshotUrl) {
        onViewImage(selected);
      } else if (onSelectTransaction) {
        onSelectTransaction(selected);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleCopy = async (e, utr, id) => {
    e.stopPropagation();
    if (!utr || utr === 'N/A') return;
    await navigator.clipboard.writeText(utr);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-all"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search by UTR, Person name, App, Date, or amount (e.g. >1000)..."
            className="w-full bg-transparent border-0 px-3 text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-0"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-100/60 dark:bg-slate-950/40 border-b border-slate-200/80 dark:border-slate-800/80 overflow-x-auto text-xs">
          <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1 text-[11px] mr-1">
            <Filter className="w-3 h-3" /> Filters:
          </span>

          <button
            onClick={() => setTypeFilter(typeFilter === 'Received' ? 'ALL' : 'Received')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition shrink-0 ${
              typeFilter === 'Received'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            Inward (Received)
          </button>

          <button
            onClick={() => setTypeFilter(typeFilter === 'Sent' ? 'ALL' : 'Sent')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition shrink-0 ${
              typeFilter === 'Sent'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            Outward (Sent)
          </button>

          {distinctApps.slice(0, 4).map((app) => (
            <button
              key={app}
              onClick={() => setAppFilter(appFilter === app ? 'ALL' : app)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition shrink-0 ${
                appFilter === app
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {app}
            </button>
          ))}

          {(appFilter !== 'ALL' || typeFilter !== 'ALL' || query) && (
            <button
              onClick={() => {
                setAppFilter('ALL');
                setTypeFilter('ALL');
                setQuery('');
              }}
              className="ml-auto text-[11px] text-indigo-500 hover:underline shrink-0"
            >
              Reset
            </button>
          )}
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No transactions match your search</p>
              <p className="text-xs text-slate-400 mt-1">Try searching by amount, UTR digits, or person name</p>
            </div>
          ) : (
            filtered.map((tx, idx) => {
              const isSelected = idx === selectedIndex;
              const isReceived = tx.type === 'Received';
              return (
                <div
                  key={tx.id || idx}
                  onClick={() => {
                    if (tx.screenshotUrl) onViewImage(tx);
                    else if (onSelectTransaction) onSelectTransaction(tx);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition ${
                    isSelected 
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isReceived 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}>
                      {isReceived ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {isReceived ? (tx.from || 'Unknown Sender') : (tx.to || 'Unknown Receiver')}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                          {tx.appName || 'UPI'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          UTR: {tx.transactionId || 'N/A'}
                        </span>
                        {tx.dateTime && (
                          <span className="flex items-center gap-1 truncate text-[11px]">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {tx.dateTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 pl-2">
                    <div className="text-right">
                      <span className={`text-sm font-black tracking-tight ${
                        isReceived ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                      }`}>
                        {isReceived ? '+' : '-'}{tx.amount}
                      </span>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">
                        {tx.type}
                      </p>
                    </div>

                    {tx.transactionId && tx.transactionId !== 'N/A' && (
                      <button
                        onClick={(e) => handleCopy(e, tx.transactionId, tx.id || idx)}
                        title="Copy UTR"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                      >
                        {copiedId === (tx.id || idx) ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    {tx.screenshotUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewImage(tx);
                        }}
                        title="View Receipt Screenshot"
                        className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span>Found <strong>{filtered.length}</strong> results</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Use <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono text-[10px]">↑</kbd> <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono text-[10px]">↓</kbd> to navigate</span>
            <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono text-[10px]">↵ Enter</kbd> to view</span>
          </div>
          <span className="text-indigo-500 font-medium">Power BI Instant Finder</span>
        </div>
      </div>
    </div>
  );
}
