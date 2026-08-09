import React, { useState, useSyncExternalStore } from 'react';
import { ShieldCheck, Sparkles, Plus, Trash2, Calendar, DollarSign, Layers, Globe, Bot, Check, AlertCircle, RefreshCw, X, Radio, Trophy, Flame, Zap, RotateCcw, CheckCircle2, Lock, Tv, ShieldAlert } from 'lucide-react';
import AdminAdSettingsModal from './adSystem/AdminAdSettingsModal';
import AdminModerationDashboard from './AdminModerationDashboard';
import { createAdminJackpotRoom, deleteAdminJackpot, clearAllJackpots, subscribeToJackpots, getJackpotsSnapshot, updateJackpotMatchResult, autoSimulateNextLegResult } from '../lib/mockData';
import { showToast } from '../lib/notificationStore';
import { useAuth, isAdminUser, useCurrentUser } from '../lib/authStore';
import type { Bookie, Outcome } from '../lib/types';
import Modal from './ui/Modal';

export const KENYAN_BETTING_SITES = [
  'SportPesa',
  'Betika',
  'MozzartBet',
  'Odibets',
  'Shabiki',
  'BangBet',
  'PariPesa',
  '22Bet',
  '1xBet',
  'BetAfriq',
] as const;

export type MajorKenyanBookie = typeof KENYAN_BETTING_SITES[number];

export interface ExtractedMatch {
  home: string;
  away: string;
  competition: string;
  kickoff: string;
  homePct: number;
  drawPct: number;
  awayPct?: number;
}

interface JackpotAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JackpotAdminModal({ isOpen, onClose }: JackpotAdminModalProps) {
  // Admin authentication & tabs state
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(true);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showAdSettingsModal, setShowAdSettingsModal] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<'jackpots' | 'moderation'>('jackpots');

  // Form State
  const [selectedBookie, setSelectedBookie] = useState<MajorKenyanBookie>('SportPesa');
  const [jackpotName, setJackpotName] = useState('Mega Jackpot Pro');
  const [numLegs, setNumLegs] = useState<number>(17);
  const [prizePool, setPrizePool] = useState('Ksh 350,000,000');
  const [startDateTime, setStartDateTime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(17, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [webpageText, setWebpageText] = useState('');

  // AI Parsing state
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState('');
  const [matches, setMatches] = useState<ExtractedMatch[]>([]);
  const [selectedResultRoomId, setSelectedResultRoomId] = useState<string | null>(null);

  // Published rooms live store
  const publishedJackpots = useSyncExternalStore(subscribeToJackpots, getJackpotsSnapshot, getJackpotsSnapshot);

  const activeResultRoom = publishedJackpots.find((j) => j.id === (selectedResultRoomId || publishedJackpots[0]?.id));

  const currentUser = useCurrentUser();
  const isAuthorized = isAdminUser(currentUser);

  if (!isAuthorized) {
    return (
      <Modal isOpen={isOpen} overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div className="bg-ink border border-rose-500/40 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <Lock size={24} />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-cream">Admin Access Restricted</h3>
            <p className="text-xs text-cream-dim mt-1.5 leading-relaxed">
              The Jackpot Admin Console is strictly restricted to the platform super-administrator (<strong className="text-gold font-mono">0743304579</strong>).
            </p>
          </div>
          <div className="bg-ink-2 border border-line rounded-xl p-3 text-left text-xs font-mono space-y-1">
            <div className="text-cream-dim flex justify-between">
              <span>Required Admin:</span>
              <span className="text-gold font-bold">0743304579</span>
            </div>
            <div className="text-cream-dim flex justify-between">
              <span>Current Account:</span>
              <span className="text-rose-400 font-bold">
                {currentUser ? `User (${currentUser.phone})` : 'Not Logged In'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-panel hover:bg-panel-2 text-cream font-bold text-xs border border-line transition-all"
          >
            Close Window
          </button>
        </div>
      </Modal>
    );
  }

  function handleUnlockPin(e: React.FormEvent) {
    e.preventDefault();
    if (adminPinInput === 'admin' || adminPinInput === '254' || adminPinInput === '1234' || adminPinInput.length >= 3) {
      setIsAdminUnlocked(true);
      setPinError('');
      showToast({ title: 'Admin Unlocked', message: 'Admin mode unlocked successfully', type: 'success' });
    } else {
      setPinError('Invalid PIN code. Try "admin" or "254"');
    }
  }

  async function handleAiArrange() {
    if (!webpageText.trim()) {
      showToast({ title: 'Input Required', message: 'Please paste the webpage text first into the raw text box', type: 'error' });
      return;
    }

    setIsAiProcessing(true);
    setAiSuccessMessage('');

    try {
      const res = await fetch('/api/gemini/parse-jackpot-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: webpageText,
          bookie: selectedBookie,
          legCount: numLegs,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.matches) && data.matches.length > 0) {
        const parsedMatches: ExtractedMatch[] = data.matches.map((m: any, i: number) => ({
          home: m.home || `Team ${i + 1}A`,
          away: m.away || `Team ${i + 1}B`,
          competition: m.competition || 'Football League',
          kickoff: m.kickoff || formatDateTimeDisplay(startDateTime),
          homePct: Number(m.homePct) || 45,
          drawPct: Number(m.drawPct) || 30,
        }));

        setMatches(parsedMatches);
        setAiSuccessMessage(`✨ AI Extension successfully extracted & arranged ${parsedMatches.length} matches for ${selectedBookie}!`);
        showToast({ title: 'AI Extraction Complete', message: `AI extracted ${parsedMatches.length} games for ${selectedBookie}`, type: 'success' });
      } else {
        showToast({ title: 'Fallback Format Loaded', message: 'AI parser completed with default format. Verify fixtures below.', type: 'info' });
        generateSampleMatches(numLegs);
      }
    } catch (err: any) {
      console.error('AI Arrange error:', err);
      showToast({ title: 'Extension Notice', message: 'Error connecting to AI parser extension. Loaded fallback fixtures.', type: 'error' });
      generateSampleMatches(numLegs);
    } finally {
      setIsAiProcessing(false);
    }
  }

  function generateSampleMatches(count: number) {
    const list: ExtractedMatch[] = [];
    const teams = [
      ['Arsenal', 'Coventry City'], ['Trabzonspor', 'Al Sadd'], ['Sunderland', 'Leeds United'],
      ['Deportivo Alavés', 'Getafe'], ['Sepsi OSK', 'Universitatea Cluj'], ['Ružomberok', 'Dunajska Streda'],
      ['Kaspiy', 'Zhenys'], ['Norrby IF', 'Ostersunds FK'], ['Sogndal', 'Ranheim'], ['KFUM Oslo', 'Molde'],
      ['FK Jablonec', 'Sigma Olomouc'], ['Soroksar', 'Mezokovesd-Zsory'], ['Puszcza Niepolomice', 'Polonia Warszawa'],
      ['Agropecuario', 'San Martin S.J.'], ['Atletico Tucuman', 'Independiente Rivadavia'],
      ['All Boys', 'Defensores De Belgrano'], ['Wisla Krakow', 'GKS Katowice']
    ];

    for (let i = 0; i < count; i++) {
      const pair = teams[i % teams.length];
      list.push({
        home: pair[0],
        away: pair[1],
        competition: i % 2 === 0 ? 'Premier League' : 'La Liga',
        kickoff: formatDateTimeDisplay(startDateTime),
        homePct: 40 + (i % 5) * 5,
        drawPct: 30,
      });
    }
    setMatches(list);
  }

  function formatDateTimeDisplay(dtStr: string): string {
    try {
      const d = new Date(dtStr);
      if (isNaN(d.getTime())) return 'Sat 17:00 EAT';
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = days[d.getDay()];
      const date = d.getDate();
      const month = months[d.getMonth()];
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day} ${date} ${month} · ${hours}:${mins} EAT`;
    } catch {
      return 'Sat 17:00 EAT';
    }
  }

  function handleUpdateMatch(index: number, field: keyof ExtractedMatch, value: any) {
    setMatches((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function handleAddMatch() {
    setMatches((prev) => [
      ...prev,
      {
        home: 'New Home Team',
        away: 'New Away Team',
        competition: 'League',
        kickoff: formatDateTimeDisplay(startDateTime),
        homePct: 45,
        drawPct: 30,
      },
    ]);
  }

  function handleRemoveMatch(index: number) {
    setMatches((prev) => prev.filter((_, i) => i !== index));
  }

  function handlePublishJackpot() {
    if (matches.length === 0) {
      showToast({ title: 'Matches Empty', message: 'Please add or AI-arrange matches before publishing.', type: 'error' });
      return;
    }

    const formattedStart = formatDateTimeDisplay(startDateTime);

    // Map selected major Kenyan bookie to valid Jackpot bookie union type
    const mappedBookie: Bookie = selectedBookie.includes('SportPesa')
      ? 'SportPesa'
      : selectedBookie.includes('Betika')
      ? 'Betika'
      : selectedBookie.includes('Mozzart')
      ? 'Mozzart'
      : 'Odibets';

    const rawMatches = matches.map((m) => ({
      home: m.home,
      away: m.away,
      competition: m.competition,
      kickoff: m.kickoff || formattedStart,
      homePct: m.homePct,
      drawPct: m.drawPct,
    }));

    const created = createAdminJackpotRoom({
      id: `admin-${selectedBookie.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`,
      bookie: mappedBookie,
      name: `${selectedBookie} ${jackpotName}`,
      prizePool: prizePool,
      startTime: formattedStart,
      entryFee: 10,
      rawMatches,
    });

    showToast({ title: 'Jackpot Published', message: `Published ${created.name} (${matches.length} legs) successfully!`, type: 'success' });
    onClose();
  }

  return (
    <Modal isOpen={isOpen} overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-panel border border-line rounded-2xl shadow-2xl overflow-hidden my-8 animate-rise">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-ink-2">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center text-gold">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 className="font-display font-extrabold text-lg text-cream flex items-center gap-2">
                Jackpot Rooms Admin Console
                <span className="bg-emerald-2/20 text-emerald-2 border border-emerald-2/30 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                  Admin Only
                </span>
              </h2>
              <p className="text-xs text-cream-dim">Manually update & layout jackpot rooms for Kenyan betting sites</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAdSettingsModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gold/15 border border-gold/40 text-gold hover:bg-gold hover:text-ink font-extrabold text-xs flex items-center gap-1.5 transition-all shadow"
            >
              <Tv size={14} /> Ad System Settings
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-cream-dim hover:text-cream hover:bg-panel-2 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <AdminAdSettingsModal
          isOpen={showAdSettingsModal}
          onClose={() => setShowAdSettingsModal(false)}
        />

        {/* Sub-header Navigation Tabs */}
        {isAdminUnlocked && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-ink-2/40 border-b border-line overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveAdminTab('jackpots')}
              className={`px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all ${
                activeAdminTab === 'jackpots'
                  ? 'bg-gold text-ink shadow-md'
                  : 'bg-panel-2 text-cream-dim hover:text-cream border border-line'
              }`}
            >
              <Trophy size={15} /> Jackpot Rooms
            </button>
            <button
              type="button"
              onClick={() => setActiveAdminTab('moderation')}
              className={`px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all ${
                activeAdminTab === 'moderation'
                  ? 'bg-gold text-ink shadow-md'
                  : 'bg-panel-2 text-cream-dim hover:text-cream border border-line'
              }`}
            >
              <ShieldAlert size={15} /> Moderation Dictionary & Safety
            </button>
          </div>
        )}

        {!isAdminUnlocked ? (
          <form onSubmit={handleUnlockPin} className="p-8 max-w-md mx-auto text-center flex flex-col gap-4">
            <span className="w-12 h-12 rounded-full bg-gold/15 text-gold flex items-center justify-center mx-auto">
              <ShieldCheck size={24} />
            </span>
            <h3 className="font-display font-bold text-xl text-cream">Admin Access Required</h3>
            <p className="text-sm text-cream-dim">Enter your Admin PIN or Security Key to manage jackpot rooms.</p>
            <input
              type="password"
              placeholder="Enter Admin PIN (e.g. admin or 254)"
              value={adminPinInput}
              onChange={(e) => setAdminPinInput(e.target.value)}
              className="bg-ink-2 border border-line rounded-xl px-4 py-3 text-center text-cream focus:outline-none focus:border-gold font-mono"
            />
            {pinError && <p className="text-xs text-rose-400">{pinError}</p>}
            <button
              type="submit"
              className="bg-gold hover:bg-gold-2 text-ink font-bold py-3 rounded-xl transition-colors"
            >
              Unlock Admin Console
            </button>
          </form>
        ) : activeAdminTab === 'moderation' ? (
          <div className="p-6 max-h-[80vh] overflow-y-auto">
            <AdminModerationDashboard />
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Live Published Rooms & Result Manager */}
            <div className="bg-ink-2/60 border border-line rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm text-cream flex items-center gap-2">
                    <Radio size={16} className="text-emerald-2 animate-pulse" /> Live Published Rooms & Match Results ({publishedJackpots.length})
                  </h3>
                  <p className="text-xs text-cream-dim">Update game results leg by leg till all games are played to drive live leaderboard rank movements</p>
                </div>
                {publishedJackpots.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Are you sure you want to remove ALL published jackpot rooms?')) {
                        clearAllJackpots();
                        showToast({ title: 'Rooms Cleared', message: 'All published jackpot rooms have been cleared.', type: 'info' });
                      }
                    }}
                    className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={13} /> Clear All Rooms
                  </button>
                )}
              </div>

              {publishedJackpots.length === 0 ? (
                <div className="p-4 border border-dashed border-line/70 rounded-xl text-center text-xs text-cream-dim">
                  No live jackpot rooms published yet. Use the form below to AI-arrange and publish a room!
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Room Selector Chips */}
                  <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-line">
                    <span className="text-xs font-bold text-cream-dim">Select Room to Update:</span>
                    {publishedJackpots.map((jp) => {
                      const completedCount = jp.matches.filter((m) => m.result !== undefined).length;
                      const isSelected = (selectedResultRoomId || publishedJackpots[0]?.id) === jp.id;
                      return (
                        <button
                          key={jp.id}
                          type="button"
                          onClick={() => setSelectedResultRoomId(jp.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            isSelected
                              ? 'bg-gold/20 text-gold border border-gold/50 shadow-sm'
                              : 'bg-panel border border-line text-cream-dim hover:text-cream'
                          }`}
                        >
                          <span>{jp.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            completedCount === jp.matches.length
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : completedCount > 0
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-ink text-cream-dim'
                          }`}>
                            {completedCount}/{jp.matches.length} Legs
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Room Leg Result Editor */}
                  {activeResultRoom && (
                    <div className="bg-panel border border-line/80 rounded-xl p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/60 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-display font-extrabold text-cream text-sm">
                              Leg Results & Live Leaderboard Controller
                            </h4>
                            <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {activeResultRoom.name}
                            </span>
                          </div>
                          <p className="text-xs text-cream-dim mt-0.5">
                            Set game outcomes leg by leg as matches conclude. Standings will recalculate live for all users!
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const res = autoSimulateNextLegResult(activeResultRoom.id);
                              if (res.matchName && res.result) {
                                showToast({
                                  title: 'Leg Result Updated!',
                                  message: `${res.matchName} → ${res.result}. Leaderboard recalculated live!`,
                                  type: 'success',
                                });
                              } else {
                                showToast({
                                  title: 'All Legs Completed',
                                  message: 'All matches in this room have already been concluded!',
                                  type: 'info',
                                });
                              }
                            }}
                            className="text-xs font-bold text-black bg-gradient-to-r from-gold via-amber-300 to-amber-500 hover:from-gold-bright hover:to-gold border border-gold-bright px-3 py-1.5 rounded-xl shadow transition-all flex items-center gap-1.5"
                          >
                            <Zap size={14} /> Auto-Simulate Next Leg
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              deleteAdminJackpot(activeResultRoom.id);
                              showToast({ title: 'Room Deleted', message: `Removed ${activeResultRoom.name}`, type: 'info' });
                            }}
                            className="text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-2.5 py-1.5 rounded-xl transition-all"
                            title="Delete Room"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Leg Match Result Pickers */}
                      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                        {activeResultRoom.matches.map((match, idx) => {
                          return (
                            <div key={match.id} className="bg-ink-2/80 border border-line/60 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-gold/30 transition-colors">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono font-bold text-gold bg-gold/10 px-1.5 py-0.2 rounded border border-gold/20">
                                    Leg #{idx + 1}
                                  </span>
                                  <span className="text-xs font-extrabold text-cream truncate">
                                    {match.home} <span className="text-gold font-normal">vs</span> {match.away}
                                  </span>
                                  {match.result ? (
                                    <span className="text-[10px] font-extrabold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 rounded flex items-center gap-1">
                                      <CheckCircle2 size={11} /> Outcome: {match.result}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-cream-dim/60 bg-ink border border-line px-1.5 py-0.2 rounded">
                                      Unplayed
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-cream-dim mt-0.5 truncate">
                                  {match.competition} · {match.kickoff}
                                </p>
                              </div>

                              {/* Outcome Pickers */}
                              <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                                {(['1', 'X', '2'] as Outcome[]).map((outcome) => {
                                  const isSelected = match.result === outcome;
                                  return (
                                    <button
                                      key={outcome}
                                      type="button"
                                      onClick={() => {
                                        const homeScore = outcome === '1' ? 2 : outcome === 'X' ? 1 : 0;
                                        const awayScore = outcome === '2' ? 2 : outcome === 'X' ? 1 : 0;
                                        updateJackpotMatchResult(activeResultRoom.id, match.id, outcome, homeScore, awayScore);
                                        showToast({
                                          title: `Leg #${idx + 1} Updated`,
                                          message: `${match.home} vs ${match.away} set to ${outcome === '1' ? '1 (Home Win)' : outcome === 'X' ? 'X (Draw)' : '2 (Away Win)'}`,
                                          type: 'success',
                                        });
                                      }}
                                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                                        isSelected
                                          ? 'bg-emerald-500 text-black font-extrabold shadow-sm'
                                          : 'bg-ink border border-line text-cream-dim hover:text-cream hover:bg-panel'
                                      }`}
                                    >
                                      {outcome === '1' ? '1 Home' : outcome === 'X' ? 'X Draw' : '2 Away'}
                                    </button>
                                  );
                                })}

                                {match.result !== undefined && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateJackpotMatchResult(activeResultRoom.id, match.id, undefined, null, null);
                                      showToast({ title: 'Leg Reset', message: `Leg #${idx + 1} set to unplayed`, type: 'info' });
                                    }}
                                    className="p-1 text-cream-dim hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                    title="Clear Result"
                                  >
                                    <RotateCcw size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section Heading for Publishing New Room */}
            <div className="border-t border-line pt-4">
              <h3 className="font-display font-extrabold text-base text-cream flex items-center gap-2 mb-1">
                <Plus size={18} className="text-gold" /> Create & Publish New Jackpot Room
              </h3>
              <p className="text-xs text-cream-dim">Configure site, bookie jackpot amount, fixtures, or use AI text auto-parser</p>
            </div>

            {/* Top Config Grid */}
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Dropdown for Betting Site Names */}
              <div>
                <label className="block text-xs font-bold text-cream-dim mb-1.5 flex items-center gap-1">
                  <Globe size={13} className="text-gold" /> Betting Site Name
                </label>
                <select
                  value={selectedBookie}
                  onChange={(e) => {
                    const b = e.target.value as MajorKenyanBookie;
                    setSelectedBookie(b);
                    if (b === 'SportPesa') setJackpotName('Mega Jackpot Pro');
                    else if (b === 'Betika') setJackpotName('Midweek Jackpot');
                    else if (b === 'MozzartBet') setJackpotName('Super Grand Jackpot');
                    else setJackpotName(`${b} Weekly Jackpot`);
                  }}
                  className="w-full bg-ink-2 border border-line rounded-xl px-3 py-2.5 text-sm text-cream font-semibold focus:outline-none focus:border-gold"
                >
                  {KENYAN_BETTING_SITES.map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
              </div>

              {/* Number of legs dropdown (13 to 17) */}
              <div>
                <label className="block text-xs font-bold text-cream-dim mb-1.5 flex items-center gap-1">
                  <Layers size={13} className="text-emerald-2" /> Number of Legs
                </label>
                <select
                  value={numLegs}
                  onChange={(e) => {
                    const count = Number(e.target.value);
                    setNumLegs(count);
                    if (matches.length > 0) generateSampleMatches(count);
                  }}
                  className="w-full bg-ink-2 border border-line rounded-xl px-3 py-2.5 text-sm text-cream font-semibold focus:outline-none focus:border-emerald-2"
                >
                  <option value={13}>13 Games (Midweek Jackpot)</option>
                  <option value={14}>14 Games (Pro Jackpot)</option>
                  <option value={15}>15 Games (Betika Midweek / Shabiki)</option>
                  <option value={16}>16 Games (Grand Pro)</option>
                  <option value={17}>17 Games (SportPesa Mega Jackpot)</option>
                </select>
              </div>

              {/* Prize Pool */}
              <div>
                <label className="block text-xs font-bold text-cream-dim mb-1.5 flex items-center gap-1">
                  <DollarSign size={13} className="text-gold" /> Bookie Jackpot Amount
                </label>
                <input
                  type="text"
                  value={prizePool}
                  onChange={(e) => setPrizePool(e.target.value)}
                  placeholder="e.g. Ksh 350,000,000"
                  className="w-full bg-ink-2 border border-line rounded-xl px-3 py-2.5 text-sm text-cream font-semibold focus:outline-none focus:border-gold"
                />
              </div>

              {/* Date & Time Setting Calendar */}
              <div>
                <label className="block text-xs font-bold text-cream-dim mb-1.5 flex items-center gap-1">
                  <Calendar size={13} className="text-[#3b82f6]" /> Jackpot Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={startDateTime}
                  onChange={(e) => setStartDateTime(e.target.value)}
                  className="w-full bg-ink-2 border border-line rounded-xl px-3 py-2.5 text-sm text-cream focus:outline-none focus:border-[#3b82f6]"
                />
              </div>
            </div>

            {/* Jackpot Title input */}
            <div>
              <label className="block text-xs font-bold text-cream-dim mb-1.5">Jackpot Room Display Title</label>
              <input
                type="text"
                value={jackpotName}
                onChange={(e) => setJackpotName(e.target.value)}
                placeholder="e.g. Mega Jackpot Pro"
                className="w-full bg-ink-2 border border-line rounded-xl px-4 py-2.5 text-sm text-cream font-semibold focus:outline-none focus:border-gold"
              />
            </div>

            {/* Raw Text Box & AI Extension */}
            <div className="bg-ink-2 border border-line rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-cream flex items-center gap-1.5">
                    <Bot size={16} className="text-gold" /> AI Jackpot Webpage Parser Extension
                  </h3>
                  <p className="text-xs text-cream-dim">
                    Paste raw text from {selectedBookie}'s webpage below. AI will clean and format all {numLegs} matches automatically!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAiArrange}
                  disabled={isAiProcessing || !webpageText.trim()}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-gold to-gold-2 hover:from-gold-2 hover:to-gold text-ink font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 shrink-0 shadow-lg"
                >
                  {isAiProcessing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      AI Structuring Layout...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      AI Arrange & Set Matches ({numLegs} Legs)
                    </>
                  )}
                </button>
              </div>

              <textarea
                rows={5}
                value={webpageText}
                onChange={(e) => setWebpageText(e.target.value)}
                placeholder={`Paste ${selectedBookie} jackpot webpage text here (e.g. copy all matches from ${selectedBookie}...)\nExample:\n1. Arsenal vs Coventry City 21/08 22:00\n2. Trabzonspor vs Al Sadd 30/07 20:00...`}
                className="w-full bg-panel border border-line rounded-xl p-3 text-xs text-cream font-mono placeholder:text-cream-dim/60 focus:outline-none focus:border-gold"
              />

              {aiSuccessMessage && (
                <div className="p-3 bg-emerald-2/15 border border-emerald-2/30 rounded-xl text-xs font-bold text-emerald-2 flex items-center gap-2">
                  <Check size={16} />
                  {aiSuccessMessage}
                </div>
              )}
            </div>

            {/* Match Fixture Layout List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-base text-cream flex items-center gap-2">
                  Match Layout Preview ({matches.length} / {numLegs} legs)
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => generateSampleMatches(numLegs)}
                    className="text-xs font-semibold text-cream-dim hover:text-cream underline"
                  >
                    Load Template
                  </button>
                  <button
                    type="button"
                    onClick={handleAddMatch}
                    className="inline-flex items-center gap-1 text-xs font-bold text-gold hover:text-gold-2 bg-gold/10 border border-gold/30 px-3 py-1.5 rounded-lg"
                  >
                    <Plus size={13} /> Add Match
                  </button>
                </div>
              </div>

              {matches.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-line rounded-xl text-xs text-cream-dim">
                  No matches loaded yet. Paste webpage text and click "AI Arrange & Set Matches" above.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {matches.map((m, idx) => (
                    <div key={idx} className="bg-ink-2 border border-line/80 rounded-xl p-3 grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-1 font-mono font-bold text-gold text-center">#{idx + 1}</div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={m.home}
                          onChange={(e) => handleUpdateMatch(idx, 'home', e.target.value)}
                          placeholder="Home Team"
                          className="w-full bg-panel border border-line rounded px-2 py-1 text-cream font-semibold focus:border-gold"
                        />
                      </div>
                      <div className="col-span-1 text-center font-bold text-cream-dim">vs</div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={m.away}
                          onChange={(e) => handleUpdateMatch(idx, 'away', e.target.value)}
                          placeholder="Away Team"
                          className="w-full bg-panel border border-line rounded px-2 py-1 text-cream font-semibold focus:border-gold"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={m.competition}
                          onChange={(e) => handleUpdateMatch(idx, 'competition', e.target.value)}
                          placeholder="League/Comp"
                          className="w-full bg-panel border border-line rounded px-2 py-1 text-cream-dim focus:border-gold"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveMatch(idx)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-line">
              <span className="text-xs text-cream-dim flex items-center gap-1">
                <AlertCircle size={13} className="text-gold" /> Updating will publish this room to all live users instantly.
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-line text-cream-dim hover:text-cream text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePublishJackpot}
                  className="px-6 py-2.5 rounded-xl bg-emerald-2 hover:bg-emerald-500 text-ink font-bold text-xs shadow-lg transition-all"
                >
                  Publish & Update Jackpot Room
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
