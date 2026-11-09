import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Calendar,
  Clock,
  History,
  ChevronDown,
  ChevronUp,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';

function formatDate(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

function getTimeRemaining(expiresAt?: string | null): string {
  if (!expiresAt) return '';
  const nowMs = Date.now();
  const expMs = Date.parse(expiresAt);
  if (!Number.isFinite(expMs)) return '';

  const diffMs = expMs - nowMs;
  if (diffMs <= 0) return 'Expired';

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }
  const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${mins}m remaining`;
}

export default function SubscriptionSection() {
  const {
    subscription,
    history,
    hasPremiumAccess,
    openPaywall,
    startTrial,
    isLoading,
  } = useSubscription();

  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const status = subscription?.status || 'none';
  const plan = subscription?.plan || null;
  const trialClaimed = Boolean(subscription?.trialClaimed);

  // Status badge visual properties
  let statusBadge = (
    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
      Free Plan
    </span>
  );

  if (status === 'active') {
    statusBadge = (
      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#006C54] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#006C54] dark:bg-emerald-400 animate-pulse" />
        Active ({plan === 'weekly' ? 'Weekly' : 'Monthly'})
      </span>
    );
  } else if (status === 'trial') {
    statusBadge = (
      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 inline-flex items-center gap-1.5">
        <Sparkles size={11} className="text-purple-500" />
        3-Day Trial
      </span>
    );
  } else if (status === 'expired') {
    statusBadge = (
      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1.5">
        <AlertCircle size={11} className="text-amber-500" />
        Expired
      </span>
    );
  }

  const timeRemainingStr = getTimeRemaining(
    status === 'trial' ? subscription?.trialExpiresAt : subscription?.expiresAt
  );

  return (
    <div className="bg-white dark:bg-[#202522] rounded-2xl border border-[#E6E6D2] dark:border-[#414A43] shadow-xs p-4 sm:p-5 mb-6 transition-all">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[#F0F0E4] dark:border-[#414A43]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#006C54] dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Subscription</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Uninterrupted access &amp; premium football features
            </p>
          </div>
        </div>

        <div>{statusBadge}</div>
      </div>

      {/* ── CURRENT SUBSCRIPTION CARD ── */}
      <div className="bg-slate-50 dark:bg-[#1A1F1C] border border-slate-200/80 dark:border-white/5 rounded-xl p-3.5 sm:p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Current Plan</div>
            <div className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
              <span>
                {plan === 'weekly'
                  ? 'Weekly Plan (Ksh 20)'
                  : plan === 'monthly'
                  ? 'Monthly Plan (Ksh 75)'
                  : status === 'trial'
                  ? '3-Day Free Trial'
                  : 'Free Tier'}
              </span>
              {hasPremiumAccess && timeRemainingStr && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                  {timeRemainingStr}
                </span>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="shrink-0 flex items-center gap-2">
            {!hasPremiumAccess && !trialClaimed && (
              <button
                type="button"
                onClick={() => startTrial()}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 font-bold text-xs transition-colors cursor-pointer"
              >
                Start 3-Day Trial
              </button>
            )}

            <button
              type="button"
              onClick={() => openPaywall('profile_section')}
              className="px-3.5 py-1.5 rounded-lg bg-[#006C54] hover:bg-[#005441] text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Zap size={13} className="text-[#FFD200]" />
              {hasPremiumAccess ? 'Renew / Extend' : 'Upgrade to Premium'}
            </button>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200 dark:border-white/5 text-xs">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Activation Date</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
              {formatDate(subscription?.activatedAt || subscription?.trialStartedAt)}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              {status === 'trial' ? 'Trial Expiry' : 'Renewal / Expiry Date'}
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
              {formatDate(subscription?.expiresAt || subscription?.trialExpiresAt)}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Last Payment Ref</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
              {subscription?.lastPaymentRef || 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* ── SUBSCRIPTION HISTORY ── */}
      <div>
        <button
          type="button"
          onClick={() => setIsHistoryExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between py-2 text-left group cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <History size={14} className="text-slate-400" />
            Subscription History ({history.length})
          </span>
          {isHistoryExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {isHistoryExpanded && (
          <div className="mt-2 space-y-2 animate-in fade-in duration-150">
            {history.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1A1F1C] border border-dashed border-slate-200 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400">
                No subscription history yet. Start your 3-day trial or subscribe to activate premium features.
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#1A1F1C] border border-slate-200/70 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white capitalize">
                        {item.plan === 'weekly'
                          ? 'Weekly Plan'
                          : item.plan === 'monthly'
                          ? 'Monthly Plan'
                          : '3-Day Free Trial'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          item.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                      <span>Ref: <strong className="font-mono">{item.transactionRef}</strong></span>
                      <span>•</span>
                      <span>Paid: {formatDate(item.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/50 dark:border-white/5">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
                      <div>Valid until</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                        {formatDate(item.endDate)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-extrabold text-sm text-[#006C54] dark:text-emerald-400">
                        {item.amountKsh > 0 ? `Ksh ${item.amountKsh}` : 'Free'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
