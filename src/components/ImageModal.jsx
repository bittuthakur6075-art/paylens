import React, { useEffect } from 'react';
import { X, Download, ExternalLink, ShieldCheck } from 'lucide-react';

export default function ImageModal({ isOpen, onClose, transaction }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !transaction) return null;

  const isBase64OrUrl = transaction.screenshotUrl && 
    (transaction.screenshotUrl.startsWith('data:image') || transaction.screenshotUrl.startsWith('http'));

  const handleDownload = async () => {
    if (!isBase64OrUrl) return;
    try {
      let blob;
      if (transaction.screenshotUrl.startsWith('data:')) {
        const parts = transaction.screenshotUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bin = atob(parts[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        blob = new Blob([arr], { type: mime });
      } else {
        const response = await fetch(transaction.screenshotUrl);
        blob = await response.blob();
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = `receipt-${transaction.appName || 'payment'}-${transaction.transactionId || Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (err) {
      window.open(transaction.screenshotUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative max-w-4xl w-full max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Payment Screenshot Verification</h3>
              <p className="text-xs text-slate-400">
                {transaction.appName} • {transaction.amount} • {transaction.type}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isBase64OrUrl && (
              <button
                onClick={handleDownload}
                title="Download Receipt"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6 items-center justify-center bg-slate-950/40">
          {/* Image Display */}
          <div className="flex-1 flex items-center justify-center min-h-[300px] max-h-[560px] w-full rounded-xl bg-slate-950 border border-slate-800/80 p-3 overflow-hidden">
            {isBase64OrUrl ? (
              <img
                src={transaction.screenshotUrl}
                alt="Payment Screenshot"
                className="max-h-[520px] max-w-full object-contain rounded-lg shadow-lg"
              />
            ) : (
              <div className="text-center p-8 text-slate-400">
                <p className="text-sm font-medium">No Image Preview Available</p>
                <p className="text-xs mt-1 text-slate-500">Record entered manually or image reference omitted.</p>
              </div>
            )}
          </div>

          {/* Quick Summary Sidebar */}
          <div className="w-full md:w-72 shrink-0 space-y-4 text-sm bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Transaction Summary</h4>
            <div className="space-y-3">
              <div>
                <span className="text-slate-400 text-xs block">Amount</span>
                <span className="text-xl font-bold text-white tracking-tight">{transaction.amount}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block">Status / Type</span>
                  <span className={`inline-block font-semibold px-2 py-0.5 mt-0.5 rounded-full ${
                    transaction.type === 'Received' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {transaction.type}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Payment App</span>
                  <span className="font-medium text-slate-200">{transaction.appName}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-xs block">From</span>
                <span className="font-medium text-slate-200 break-words">{transaction.from || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block">To</span>
                <span className="font-medium text-slate-200 break-words">{transaction.to || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block">UTR / Transaction ID</span>
                <span className="font-mono text-xs text-sky-400 break-all select-all font-semibold">
                  {transaction.transactionId || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block">Timestamp</span>
                <span className="text-xs text-slate-300">{transaction.dateTime || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
}
