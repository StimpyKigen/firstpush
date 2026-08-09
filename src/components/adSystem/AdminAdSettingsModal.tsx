import { useState } from 'react';
import { Tv, Settings, BarChart3, ShieldCheck, Check, Save, RotateCcw, X, Layers, AlertCircle, DollarSign, Clock, Zap } from 'lucide-react';
import { adStore, DEFAULT_AD_CONFIG, useAdStore } from '../../lib/adSystem/adStore';
import { AdProviderId } from '../../lib/adSystem/types';
import { showToast } from '../../lib/notificationStore';

interface AdminAdSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminAdSettingsModal({ isOpen, onClose }: AdminAdSettingsModalProps) {
  const storeState = useAdStore();
  const config = storeState.config;
  const analytics = storeState.analytics;

  const [activeTab, setActiveTab] = useState<'settings' | 'analytics'>('settings');

  // Form State
  const [adsEnabled, setAdsEnabled] = useState(config.adsEnabled);
  const [preferredDuration, setPreferredDuration] = useState(config.preferredDuration);
  const [maxPreferredDuration, setMaxPreferredDuration] = useState(config.maxPreferredDuration);
  const [absoluteMaxDuration, setAbsoluteMaxDuration] = useState(config.absoluteMaxDuration);
  const [tokenDurationMinutes, setTokenDurationMinutes] = useState(config.tokenDurationMinutes);
  const [fallbackProvider, setFallbackProvider] = useState<AdProviderId>(config.fallbackProvider);
  const [houseAdPriority, setHouseAdPriority] = useState(config.houseAdPriority);

  if (!isOpen) return null;

  function handleSaveSettings() {
    adStore.updateConfig({
      adsEnabled,
      preferredDuration: Number(preferredDuration),
      maxPreferredDuration: Number(maxPreferredDuration),
      absoluteMaxDuration: Number(absoluteMaxDuration),
      tokenDurationMinutes: Number(tokenDurationMinutes),
      fallbackProvider,
      houseAdPriority,
    });

    showToast({
      title: 'Ad Config Saved',
      message: 'Advertisement system parameters updated successfully.',
      type: 'success',
    });
    onClose();
  }

  function handleResetDefaults() {
    adStore.updateConfig(DEFAULT_AD_CONFIG);
    setAdsEnabled(DEFAULT_AD_CONFIG.adsEnabled);
    setPreferredDuration(DEFAULT_AD_CONFIG.preferredDuration);
    setMaxPreferredDuration(DEFAULT_AD_CONFIG.maxPreferredDuration);
    setAbsoluteMaxDuration(DEFAULT_AD_CONFIG.absoluteMaxDuration);
    setTokenDurationMinutes(DEFAULT_AD_CONFIG.tokenDurationMinutes);
    setFallbackProvider(DEFAULT_AD_CONFIG.fallbackProvider);
    setHouseAdPriority(DEFAULT_AD_CONFIG.houseAdPriority);

    showToast({
      title: 'Config Reset',
      message: 'Restored default advertisement settings.',
      type: 'info',
    });
  }

  const fillRate = analytics.requests > 0 ? Math.round((analytics.served / analytics.requests) * 100) : 100;
  const completionRate = analytics.served > 0 ? Math.round((analytics.completed / analytics.served) * 100) : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-panel border border-line rounded-2xl shadow-2xl overflow-hidden my-8 animate-rise">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-ink-2">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center text-gold">
              <Tv size={20} />
            </span>
            <div>
              <h2 className="font-display font-extrabold text-lg text-cream flex items-center gap-2">
                Advertisement Access Settings & Analytics
                <span className="bg-emerald-2/20 text-emerald-2 border border-emerald-2/30 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                  Admin Console
                </span>
              </h2>
              <p className="text-xs text-cream-dim">Configure ad fill strategy, token durations, and track revenue</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-cream-dim hover:text-cream hover:bg-panel-2 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-line/60 bg-ink-2/40">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'settings'
                ? 'border-gold text-gold bg-gold/5'
                : 'border-transparent text-cream-dim hover:text-cream'
            }`}
          >
            <Settings size={15} /> Ad Parameters & Provider Strategy
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'analytics'
                ? 'border-gold text-gold bg-gold/5'
                : 'border-transparent text-cream-dim hover:text-cream'
            }`}
          >
            <BarChart3 size={15} /> Performance & Analytics
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {activeTab === 'settings' ? (
            <div className="space-y-6">
              {/* Global Enable Toggle */}
              <div className="bg-ink-2/80 border border-line rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-display font-bold text-sm text-cream flex items-center gap-2">
                    Enable Ad Access System
                    {adsEnabled ? (
                      <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.2 rounded-full">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.2 rounded-full">
                        DISABLED
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-cream-dim mt-0.5">
                    When active, users who haven't bought permanent access can watch a short ad for temporary entry.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adsEnabled}
                    onChange={(e) => setAdsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-panel-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Durations Configuration Grid */}
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-ink-2/60 border border-line rounded-xl p-3.5 space-y-1.5">
                  <label className="block text-xs font-bold text-cream flex items-center gap-1">
                    <Clock size={13} className="text-gold" /> Preferred Ad Duration
                  </label>
                  <p className="text-[11px] text-cream-dim">Default: 8s (Range 6-10s)</p>
                  <input
                    type="number"
                    min={5}
                    max={12}
                    value={preferredDuration}
                    onChange={(e) => setPreferredDuration(Number(e.target.value))}
                    className="w-full bg-panel border border-line rounded-lg px-3 py-2 text-xs font-mono font-bold text-cream focus:border-gold"
                  />
                </div>

                <div className="bg-ink-2/60 border border-line rounded-xl p-3.5 space-y-1.5">
                  <label className="block text-xs font-bold text-cream flex items-center gap-1">
                    <Clock size={13} className="text-amber-400" /> Max Preferred Duration
                  </label>
                  <p className="text-[11px] text-cream-dim">Default: 15s</p>
                  <input
                    type="number"
                    min={10}
                    max={20}
                    value={maxPreferredDuration}
                    onChange={(e) => setMaxPreferredDuration(Number(e.target.value))}
                    className="w-full bg-panel border border-line rounded-lg px-3 py-2 text-xs font-mono font-bold text-cream focus:border-amber-400"
                  />
                </div>

                <div className="bg-ink-2/60 border border-line rounded-xl p-3.5 space-y-1.5">
                  <label className="block text-xs font-bold text-cream flex items-center gap-1">
                    <Zap size={13} className="text-emerald-400" /> Access Token Duration
                  </label>
                  <p className="text-[11px] text-cream-dim">Default: 15 Minutes</p>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={tokenDurationMinutes}
                    onChange={(e) => setTokenDurationMinutes(Number(e.target.value))}
                    className="w-full bg-panel border border-line rounded-lg px-3 py-2 text-xs font-mono font-bold text-cream focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Provider Fallback Strategy */}
              <div className="bg-ink-2/60 border border-line rounded-xl p-4 space-y-3">
                <h3 className="font-display font-bold text-sm text-cream flex items-center gap-2">
                  <Layers size={16} className="text-gold" /> Fallback Provider & House Ads Strategy
                </h3>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-cream-dim mb-1">Fallback Provider</label>
                    <select
                      value={fallbackProvider}
                      onChange={(e) => setFallbackProvider(e.target.value as AdProviderId)}
                      className="w-full bg-panel border border-line rounded-xl px-3 py-2 text-xs font-semibold text-cream focus:border-gold"
                    >
                      <option value="house_ads">House & Sponsor Ads (Recommended)</option>
                      <option value="direct_sponsored">Direct Brand Partners</option>
                      <option value="google_admob">Google AdMob</option>
                      <option value="unity_ads">Unity Ads</option>
                      <option value="applovin">AppLovin MAX</option>
                      <option value="simulated_test">Simulated Test Engine</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-panel border border-line rounded-xl">
                    <div>
                      <span className="text-xs font-bold text-cream block">Prioritize House Ads</span>
                      <span className="text-[11px] text-cream-dim">Serve internal partner campaigns first</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={houseAdPriority}
                      onChange={(e) => setHouseAdPriority(e.target.checked)}
                      className="w-4 h-4 rounded border-line text-gold focus:ring-gold"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="px-3.5 py-2 rounded-xl border border-line text-cream-dim hover:text-cream text-xs font-semibold flex items-center gap-1.5"
                >
                  <RotateCcw size={14} /> Restore Defaults
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-line text-cream-dim hover:text-cream text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="px-6 py-2 rounded-xl bg-gold hover:bg-gold-2 text-black font-extrabold text-xs shadow-md flex items-center gap-1.5"
                  >
                    <Save size={14} /> Save Config
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Analytics Tab */
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-ink-2/80 border border-line rounded-2xl p-4 text-center">
                  <span className="text-[10px] font-extrabold uppercase text-cream-dim tracking-wider block">
                    Ad Requests
                  </span>
                  <span className="font-display font-extrabold text-2xl text-cream mt-1 block">
                    {analytics.requests.toLocaleString()}
                  </span>
                </div>

                <div className="bg-ink-2/80 border border-emerald-500/30 rounded-2xl p-4 text-center">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider block">
                    Fill Rate
                  </span>
                  <span className="font-display font-extrabold text-2xl text-emerald-400 mt-1 block">
                    {fillRate}%
                  </span>
                </div>

                <div className="bg-ink-2/80 border border-amber-500/30 rounded-2xl p-4 text-center">
                  <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-wider block">
                    Completion Rate
                  </span>
                  <span className="font-display font-extrabold text-2xl text-amber-400 mt-1 block">
                    {completionRate}%
                  </span>
                </div>

                <div className="bg-ink-2/80 border border-gold/40 rounded-2xl p-4 text-center">
                  <span className="text-[10px] font-extrabold uppercase text-gold tracking-wider block">
                    Est. Revenue
                  </span>
                  <span className="font-display font-extrabold text-2xl text-gold mt-1 block">
                    Ksh {analytics.estimatedRevenueKsh.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Impression Log Table */}
              <div className="bg-ink-2/60 border border-line rounded-xl p-4 space-y-3">
                <h3 className="font-display font-bold text-sm text-cream flex items-center gap-2">
                  <BarChart3 size={16} className="text-gold" /> Recent Ad Impression Logs
                </h3>

                {storeState.impressions.length === 0 ? (
                  <div className="text-center py-6 text-xs text-cream-dim border border-dashed border-line rounded-lg">
                    No impression logs recorded yet. Watch an ad in any room to populate live telemetry!
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {storeState.impressions.map((log) => (
                      <div
                        key={log.id}
                        className="bg-panel border border-line/80 rounded-lg p-2.5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-cream flex items-center gap-1.5">
                            <span>{log.sponsorName || log.provider}</span>
                            <span className="text-[10px] text-cream-dim font-mono">
                              ({log.duration}s)
                            </span>
                          </p>
                          <p className="text-[10px] text-cream-dim">
                            Room: {log.roomId} · {new Date(log.requestedAt).toLocaleTimeString()}
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              log.completed
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {log.completed ? 'COMPLETED' : 'SKIPPED'}
                          </span>
                          <span className="text-xs font-mono font-bold text-gold block mt-0.5">
                            +Ksh {log.estimatedRevenueKsh || '0.00'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
