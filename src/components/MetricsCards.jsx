import React from 'react';
import { 
  ArrowUpRight, ArrowDownLeft, FileText, 
  Wallet, TrendingUp 
} from 'lucide-react';

export default function MetricsCards({ transactions = [] }) {
  // Compute analytics
  const totalCount = transactions.length;

  const parseAmountNumber = (amtStr) => {
    if (typeof amtStr === 'number') return amtStr;
    if (!amtStr) return 0;
    const cleaned = amtStr.toString().replace(/[^0-9.]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  };

  let totalSent = 0;
  let totalReceived = 0;

  transactions.forEach((tx) => {
    const val = parseAmountNumber(tx.amount);
    if (tx.type === 'Received') {
      totalReceived += val;
    } else {
      totalSent += val;
    }
  });

  const totalAmount = totalSent + totalReceived;
  const netBalance = totalReceived - totalSent;

  const formatCurrency = (val) => {
    return '₹' + val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const cards = [
    {
      title: 'Total Transactions',
      value: totalCount.toString(),
      subtext: `${totalCount} logged receipts`,
      icon: FileText,
      color: 'indigo',
      gradient: 'from-indigo-500/10 to-indigo-500/5',
      border: 'border-indigo-500/20',
      iconBg: 'bg-indigo-500/20 text-indigo-400'
    },
    {
      title: 'Total Amount Sent',
      value: formatCurrency(totalSent),
      subtext: 'Outward payments & bills',
      icon: ArrowUpRight,
      color: 'rose',
      gradient: 'from-rose-500/10 to-rose-500/5',
      border: 'border-rose-500/20',
      iconBg: 'bg-rose-500/20 text-rose-400'
    },
    {
      title: 'Total Amount Received',
      value: formatCurrency(totalReceived),
      subtext: 'Inward transfers & credits',
      icon: ArrowDownLeft,
      color: 'emerald',
      gradient: 'from-emerald-500/10 to-emerald-500/5',
      border: 'border-emerald-500/20',
      iconBg: 'bg-emerald-500/20 text-emerald-400'
    },
    {
      title: 'Total Amount',
      value: formatCurrency(totalAmount),
      subtext: 'Sent + Received combined',
      icon: Wallet,
      color: 'amber',
      gradient: 'from-amber-500/10 to-amber-500/5',
      border: 'border-amber-500/20',
      iconBg: 'bg-amber-500/20 text-amber-400'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <div
            key={idx}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} bg-white dark:bg-slate-900/60 p-5 border ${card.border} backdrop-blur-xl transition hover:border-indigo-400 dark:hover:border-slate-600/60 hover:translate-y-[-2px] duration-200 shadow-md dark:shadow-lg`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {card.title}
                </p>
                <h3 className="mt-2 text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {card.value}
                </h3>
              </div>
              <div className={`p-2.5 rounded-xl ${card.iconBg} shadow-inner`}>
                <IconComponent className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/80 dark:border-slate-800/60">
              <span className="truncate">{card.subtext}</span>
              {card.color === 'emerald' && netBalance >= 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium shrink-0 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> Net +
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
