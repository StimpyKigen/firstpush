import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  History,
  ChevronDown,
  ChevronUp,
  CreditCard,
  CheckCircle2,
  AlertCircle,
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

  // Status badge visual properties (clean text without bordered background)
  let statusBadge = (
    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
      Free Plan
    </span>
  );

  if (status === 'active') {
    statusBadge = (
      <span className="text-[11px] font-bold text-[#006C54] dark:text-emerald-400 inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#006C54] dark:bg-emerald-400 animate-pulse" />
        Active ({plan === 'weekly' ? 'Weekly' : 'Monthly'})
      </span>
    );
  } else if (status === 'trial') {
    statusBadge = (
      <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300">
        3-Day Trial
      </span>
    );
  } else if (status === 'expired') {
    statusBadge = (
      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
        Expired
      </span>
    );
  }

  return (
    <div className="bg-white dark:bg-[#202522] rounded-2xl border border-[#E6E6D2] dark:border-[#414A43] shadow-xs p-4 sm:p-5 mb-6 transition-all">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[#F0F0E4] dark:border-[#414A43]">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Subscription</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Uninterrupted access &amp; premium football features
          </p>
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
            </div>
          </div>

          {/* Action Button */}
          <div className="shrink-0 flex items-center gap-2">
            {!hasPremiumAccess && !trialClaimed && (
              <button
                type="button"
                onClick={() => startTrial()}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-xl bg-[#EEAA04] hover:bg-[#d99903] dark:bg-[#FFC72C] dark:hover:bg-[#e6b325] text-slate-950 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
              >
                Start 3-Day Trial
              </button>
            )}

            <button
              type="button"
              onClick={() => openPaywall('profile_section')}
              className="px-3.5 py-1.5 rounded-xl bg-[#006C54] hover:bg-[#005441] text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
            >
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
