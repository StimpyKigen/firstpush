import { useState } from 'react';
import { Tv, Settings, BarChart3, RotateCcw, X, Layers, Clock, Zap, Save } from 'lucide-react';
import { adStore, DEFAULT_AD_CONFIG, useAdStore } from '../../lib/adSystem/adStore';
import { AdProviderId } from '../../lib/adSystem/types';
import { showToast } from '../../lib/notificationStore';
import Modal from '../ui/Modal';

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl bg-[#FFFFF0] border border-[#E5E5EA] rounded-3xl shadow-2xl overflow-hidden my-8 animate-rise text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#E5E5EA] bg-white">
          <div className="flex items-center gap-3">
            <Tv size={22} className="text-[#006C54] shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-base sm:text-lg text-slate-900 tracking-tight">
                  Advertisement Access & Analytics
                </h2>
                <span className="bg-[#E8F5EE] text-[#006C54] text-[10.5px] uppercase font-bold px-2 py-0.5 rounded-full">
                  Admin Console
                </span>
              </div>
              <p className="text-xs text-slate-500">Configure ad fill strategy, token durations, and telemetry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 py-2.5 bg-[#F5F5F7] border-b border-[#E5E5EA] flex items-center gap-2">
          <div className="inline-flex items-center bg-white border border-[#E5E5EA] rounded-xl p-1 gap-1 shadow-2xs">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#006C54] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Settings size={14} />
              <span>Ad Parameters & Provider</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-[#006C54] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 size={14} />
              <span>Performance & Analytics</span>
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          {activeTab === 'settings' ? (
            <div className="space-y-6">
              {/* Global Enable Toggle */}
              <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-2xs">
                <div>
                  <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                    <span>Enable Ad Access System</span>
                    {adsEnabled ? (
                      <span className="text-[10.5px] font-bold bg-[#E8F5EE] text-[#006C54] px-2 py-0.5 rounded-full">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                        DISABLED
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    When active, users who haven't unlocked permanent access can watch a short partner ad for temporary entry.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adsEnabled}
                    onChange={(e) => setAdsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006C54]"></div>
                </label>
              </div>

              {/* Durations Configuration Grid */}
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 space-y-2 shadow-2xs">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock size={13} className="text-[#006C54]" /> Preferred Ad Duration
                  </label>
                  <p className="text-[11px] text-slate-400">Default: 8s (Range 6-10s)</p>
                  <input
                    type="number"
                    min={5}
                    max={12}
                    value={preferredDuration}
                    onChange={(e) => setPreferredDuration(Number(e.target.value))}
                    className="w-full bg-[#FBFBFA] border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#006C54]"
                  />
                </div>

                <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 space-y-2 shadow-2xs">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock size={13} className="text-[#006C54]" /> Max Preferred Duration
                  </label>
                  <p className="text-[11px] text-slate-400">Default: 15s</p>
                  <input
                    type="number"
                    min={10}
                    max={20}
                    value={maxPreferredDuration}
                    onChange={(e) => setMaxPreferredDuration(Number(e.target.value))}
                    className="w-full bg-[#FBFBFA] border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#006C54]"
                  />
                </div>

                <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 space-y-2 shadow-2xs">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Zap size={13} className="text-[#006C54]" /> Access Token Duration
                  </label>
                  <p className="text-[11px] text-slate-400">Default: 15 Minutes</p>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={tokenDurationMinutes}
                    onChange={(e) => setTokenDurationMinutes(Number(e.target.value))}
                    className="w-full bg-[#FBFBFA] border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#006C54]"
                  />
                </div>
              </div>

              {/* Provider Fallback Strategy */}
              <div className="bg-white border border-[#E5E5EA] rounded-2xl p-5 space-y-3 shadow-2xs">
                <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                  <Layers size={16} className="text-[#006C54]" /> Fallback Provider & House Ads Strategy
                </h3>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fallback Provider</label>
                    <select
                      value={fallbackProvider}
                      onChange={(e) => setFallbackProvider(e.target.value as AdProviderId)}
                      className="w-full bg-[#FBFBFA] border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#006C54]"
                    >
                      <option value="house_ads">House & Sponsor Ads (Recommended)</option>
                      <option value="direct_sponsored">Direct Brand Partners</option>
                      <option value="google_admob">Google AdMob</option>
                      <option value="unity_ads">Unity Ads</option>
                      <option value="applovin">AppLovin MAX</option>
                      <option value="simulated_test">Simulated Test Engine</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-[#FBFBFA] border border-[#E5E5EA] rounded-xl">
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block">Prioritize House Ads</span>
                      <span className="text-[11px] text-slate-500">Serve internal partner campaigns first</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={houseAdPriority}
                      onChange={(e) => setHouseAdPriority(e.target.checked)}
                      className="w-4 h-4 rounded text-[#006C54] focus:ring-[#006C54] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#E5E5EA]">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw size={14} /> Restore Defaults
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="px-5 py-2 rounded-xl bg-[#006C54] hover:bg-[#005441] text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Save size={14} /> Save Config
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Analytics Tab */
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 text-center shadow-2xs">
                  <span className="text-[10.5px] font-semibold uppercase text-slate-500 tracking-wider block">
                    Ad Requests
                  </span>
                  <span className="font-semibold text-2xl text-slate-900 mt-1 block">
                    {analytics.requests.toLocaleString()}
                  </span>
                </div>

                <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 text-center shadow-2xs">
                  <span className="text-[10.5px] font-semibold uppercase text-[#006C54] tracking-wider block">
                    Fill Rate
                  </span>
                  <span className="font-semibold text-2xl text-[#006C54] mt-1 block">
                    {fillRate}%
                  </span>
                </div>

                <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 text-center shadow-2xs">
                  <span className="text-[10.5px] font-semibold uppercase text-amber-600 tracking-wider block">
                    Completion Rate
                  </span>
                  <span className="font-semibold text-2xl text-amber-600 mt-1 block">
                    {completionRate}%
                  </span>
                </div>

                <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 text-center shadow-2xs">
                  <span className="text-[10.5px] font-semibold uppercase text-slate-700 tracking-wider block">
                    Est. Revenue
                  </span>
                  <span className="font-semibold text-2xl text-slate-900 mt-1 block">
                    Ksh {analytics.estimatedRevenueKsh.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Impression Log Table */}
              <div className="bg-white border border-[#E5E5EA] rounded-2xl p-5 space-y-3 shadow-2xs">
                <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                  <BarChart3 size={16} className="text-[#006C54]" /> Recent Ad Impression Logs
                </h3>

                {storeState.impressions.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                    No impression logs recorded yet. Watch an ad in any room to populate live telemetry.
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {storeState.impressions.map((log) => (
                      <div
                        key={log.id}
                        className="bg-[#FBFBFA] border border-[#E5E5EA] rounded-xl p-3 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{log.sponsorName || log.provider}</span>
                            <span className="text-[10.5px] text-slate-400 font-mono">
                              ({log.duration}s)
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Room: {log.roomId} · {new Date(log.requestedAt).toLocaleTimeString()}
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              log.completed
                                ? 'bg-[#E8F5EE] text-[#006C54]'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {log.completed ? 'COMPLETED' : 'SKIPPED'}
                          </span>
                          <span className="text-xs font-mono font-semibold text-slate-900 block mt-0.5">
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
    </Modal>
  );
}
