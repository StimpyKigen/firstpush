import React, { useState } from 'react';
import { X, Trophy, Lock, ShieldAlert, Newspaper, KeyRound, CalendarDays, MessageSquare } from 'lucide-react';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import AdminModerationDashboard from './AdminModerationDashboard';
import AdminHomepageFeed from './admin/AdminHomepageFeed';
import AdminFixturesManager from './admin/AdminFixturesManager';
import AdminChatRoomManager from './admin/AdminChatRoomManager';
import LiveRoomsResultsManager from './jackpotAdmin/LiveRoomsResultsManager';
import CreateJackpotForm from './jackpotAdmin/CreateJackpotForm';
import { isAdminUser, useCurrentUser, hashPin } from '../lib/authStore';
import { useJackpotAdminForm } from '../lib/useJackpotAdminForm';
import { showToast } from '../lib/notificationStore';
import Modal from './ui/Modal';

interface JackpotAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AdminTab = 'jackpots' | 'moderation' | 'feed' | 'fixtures' | 'chatroom';

export default function JackpotAdminModal({ isOpen, onClose }: JackpotAdminModalProps) {
  // Admin authentication & tabs state
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('jackpots');

  const form = useJackpotAdminForm();
  const currentUser = useCurrentUser();
  const isAuthorized = isAdminUser(currentUser);

  if (!isAuthorized) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in"
      >
        <div className="bg-[#FFFFF0] dark:bg-ink border border-[#E5E5EA] dark:border-line rounded-3xl max-w-md w-full p-6 sm:p-8 text-center space-y-5 shadow-2xl text-slate-900 dark:text-cream">
          <div className="flex justify-center text-rose-500">
            <Lock size={32} />
          </div>

          <div>
            <h3 className="font-display font-bold text-xl text-slate-900 dark:text-cream tracking-tight">Admin Access Restricted</h3>
            <p className="text-xs text-slate-600 dark:text-cream-dim mt-2 leading-relaxed">
              The Admin Console is strictly restricted to the registered platform super-administrator (<strong className="text-slate-900 dark:text-cream tabular-nums font-bold">0743304579</strong>).
            </p>
          </div>

          <div className="bg-white dark:bg-panel border border-[#E5E5EA] dark:border-line rounded-2xl p-4 text-left text-xs tabular-nums space-y-2.5">
            <div className="text-slate-500 dark:text-cream-dim flex justify-between items-center">
              <span>Required Admin:</span>
              <span className="text-[#006C54] dark:text-emerald-400 font-bold">0743304579</span>
            </div>
            <div className="text-slate-500 dark:text-cream-dim flex justify-between items-center border-t border-[#E5E5EA]/60 dark:border-line/60 pt-2">
              <span>Current Account:</span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                {currentUser ? `User (${currentUser.phone})` : 'Not Logged In'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-slate-900 dark:bg-panel-2 hover:bg-slate-800 dark:hover:bg-panel text-white dark:text-cream font-semibold text-xs tracking-wide transition-all cursor-pointer shadow-xs active:scale-[0.99]"
          >
            Close Window
          </button>
        </div>
      </Modal>
    );
  }

  async function handleUnlockPin(e: React.FormEvent) {
    e.preventDefault();
    setPinError('');
    setIsVerifying(true);
    const cleanPin = adminPinInput.trim();

    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: currentUser?.phone || '254743304579', pin: cleanPin }),
      });
      const data = await res.json();
      const isOk = res.ok && (data.success || data.valid);
      if (!isOk) {
        // Also allow if the verified admin entered their own registered account PIN or default 7433
        const matchesAccountPin =
          currentUser &&
          isAuthorized &&
          (cleanPin === '7433' ||
            (currentUser.pinHash && hashPin(currentUser.phone, cleanPin) === currentUser.pinHash));
        if (matchesAccountPin) {
          setIsAdminUnlocked(true);
          setAdminPinInput('');
          setIsVerifying(false);
          showToast({ title: 'Admin Unlocked', message: 'Super-admin credentials verified successfully.', type: 'success' });
          return;
        }
        setPinError(data.error || 'Invalid administrator credentials.');
        setIsVerifying(false);
        return;
      }
      if (data.adminToken || data.token) {
        try {
          localStorage.setItem('mshindi_admin_token_v1', data.adminToken || data.token);
        } catch {}
      }
      setIsAdminUnlocked(true);
      setAdminPinInput('');
      setIsVerifying(false);
      showToast({ title: 'Admin Unlocked', message: 'Super-admin credentials verified successfully.', type: 'success' });
    } catch {
      // Fallback: strict check against super admin PIN or verified admin account PIN
      const matchesFallback =
        cleanPin === '7433' ||
        (currentUser &&
          isAuthorized &&
          currentUser.pinHash &&
          hashPin(currentUser.phone, cleanPin) === currentUser.pinHash);
      if (matchesFallback) {
        setIsAdminUnlocked(true);
        setPinError('');
        setAdminPinInput('');
        setIsVerifying(false);
        showToast({ title: 'Admin Unlocked', message: 'Admin mode verified and unlocked.', type: 'success' });
      } else {
        setPinError('Invalid administrator credentials.');
        setIsVerifying(false);
      }
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-5xl bg-[#FFFFF0] dark:bg-ink border border-[#E5E5EA] dark:border-line rounded-3xl shadow-2xl overflow-hidden my-6 animate-rise text-slate-900 dark:text-cream flex flex-col max-h-[90vh]">
        {/* PREMIUM SAAS CONSOLE HEADER */}
        <div className="bg-white/80 dark:bg-panel/90 backdrop-blur-md border-b border-[#E5E5EA] dark:border-line shrink-0">
          <div className="flex items-center justify-between px-6 pt-5 pb-3 sm:pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-cream tracking-tight">
                  Mshindi Admin Console
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-cream-dim hidden sm:block mt-0.5">
                Manage weekly homepage news, live jackpot consensus rooms, and moderation safety
              </p>
            </div>

            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-cream hover:bg-slate-100 dark:hover:bg-panel-2 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* APPLE-STYLE SEGMENTED NAVIGATION BAR */}
          {isAdminUnlocked && (
            <div className="px-6 pb-3 overflow-x-auto no-scrollbar">
              <div className="inline-flex items-center bg-[#F0F0EA] dark:bg-panel-2 border border-[#E5E5EA] dark:border-line rounded-xl p-1 gap-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setActiveAdminTab('jackpots')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    activeAdminTab === 'jackpots'
                      ? 'bg-[#006C54] text-white shadow-xs'
                      : 'text-slate-600 dark:text-cream-dim hover:text-slate-900 dark:hover:text-cream hover:bg-white/60 dark:hover:bg-panel'
                  }`}
                >
                  <Trophy size={14} className={activeAdminTab === 'jackpots' ? 'text-white' : 'text-[#006C54] dark:text-emerald-400'} />
                  <span>Jackpot Rooms</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAdminTab('moderation')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    activeAdminTab === 'moderation'
                      ? 'bg-[#006C54] text-white shadow-xs'
                      : 'text-slate-600 dark:text-cream-dim hover:text-slate-900 dark:hover:text-cream hover:bg-white/60 dark:hover:bg-panel'
                  }`}
                >
                  <ShieldAlert size={14} className={activeAdminTab === 'moderation' ? 'text-white' : 'text-[#006C54] dark:text-emerald-400'} />
                  <span>Moderation</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAdminTab('feed')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    activeAdminTab === 'feed'
                      ? 'bg-[#006C54] text-white shadow-xs'
                      : 'text-slate-600 dark:text-cream-dim hover:text-slate-900 dark:hover:text-cream hover:bg-white/60 dark:hover:bg-panel'
                  }`}
                >
                  <Newspaper size={14} className={activeAdminTab === 'feed' ? 'text-white' : 'text-[#006C54] dark:text-emerald-400'} />
                  <span>Homepage Feed</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAdminTab('fixtures')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    activeAdminTab === 'fixtures'
                      ? 'bg-[#006C54] text-white shadow-xs'
                      : 'text-slate-600 dark:text-cream-dim hover:text-slate-900 dark:hover:text-cream hover:bg-white/60 dark:hover:bg-panel'
                  }`}
                >
                  <CalendarDays size={14} className={activeAdminTab === 'fixtures' ? 'text-white' : 'text-[#006C54] dark:text-emerald-400'} />
                  <span>Fixtures</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAdminTab('chatroom')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    activeAdminTab === 'chatroom'
                      ? 'bg-[#006C54] text-white shadow-xs'
                      : 'text-slate-600 dark:text-cream-dim hover:text-slate-900 dark:hover:text-cream hover:bg-white/60 dark:hover:bg-panel'
                  }`}
                >
                  <MessageSquare size={14} className={activeAdminTab === 'chatroom' ? 'text-white' : 'text-[#006C54] dark:text-emerald-400'} />
                  <span>Chat room</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BODY CONTENT AREA */}
        <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain scroll-isolated">
          {!isAdminUnlocked ? (
            <div className="p-8 sm:p-14 max-w-md mx-auto text-center flex flex-col items-center gap-4">
              <div className="text-[#006C54] dark:text-emerald-400">
                <KeyRound size={36} />
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-slate-900 dark:text-cream tracking-tight">Admin Authentication Required</h3>
                <p className="text-xs text-slate-500 dark:text-cream-dim mt-1.5 leading-relaxed">
                  Enter your Super-Admin PIN or Security Code to manage jackpot slates, fixture odds, and homepage editorial feeds.
                </p>
              </div>

              <form onSubmit={handleUnlockPin} className="w-full flex flex-col items-center space-y-4 mt-2">
                <div className="flex justify-center py-1">
                  <InputOTP
                    maxLength={4}
                    type="password"
                    value={adminPinInput}
                    onChange={(val) => {
                      setAdminPinInput(val);
                      if (pinError) setPinError('');
                    }}
                    autoFocus
                  >
                    <InputOTPGroup className="space-x-2">
                      <InputOTPSlot index={0} className="rounded-md border-l" />
                      <InputOTPSlot index={1} className="rounded-md border-l" />
                      <InputOTPSlot index={2} className="rounded-md border-l" />
                      <InputOTPSlot index={3} className="rounded-md border-l" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {pinError && <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{pinError}</p>}

                <button
                  type="submit"
                  disabled={isVerifying || adminPinInput.trim().length === 0}
                  className="w-full h-11 bg-[#006C54] hover:bg-[#005441] text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-xs active:scale-[0.99] text-xs uppercase tracking-wider"
                >
                  {isVerifying ? 'Verifying Admin Credentials...' : 'Unlock Admin Console'}
                </button>
              </form>
            </div>
          ) : activeAdminTab === 'chatroom' ? (
            <div className="p-6 sm:p-8">
              <AdminChatRoomManager />
            </div>
          ) : activeAdminTab === 'fixtures' ? (
            <div className="p-6 sm:p-8">
              <AdminFixturesManager />
            </div>
          ) : activeAdminTab === 'feed' ? (
            <div className="p-6 sm:p-8">
              <AdminHomepageFeed />
            </div>
          ) : activeAdminTab === 'moderation' ? (
            <div className="p-6 sm:p-8">
              <AdminModerationDashboard />
            </div>
          ) : (
            <div className="p-6 sm:p-8 space-y-6">
              <LiveRoomsResultsManager
                publishedJackpots={form.publishedJackpots}
                selectedResultRoomId={form.selectedResultRoomId}
                setSelectedResultRoomId={form.setSelectedResultRoomId}
                activeResultRoom={form.activeResultRoom}
              />

              <CreateJackpotForm
                selectedBookie={form.selectedBookie}
                setSelectedBookie={form.setSelectedBookie}
                jackpotName={form.jackpotName}
                setJackpotName={form.setJackpotName}
                numLegs={form.numLegs}
                setNumLegs={form.setNumLegs}
                prizePool={form.prizePool}
                setPrizePool={form.setPrizePool}
                startDateTime={form.startDateTime}
                setStartDateTime={form.setStartDateTime}
                webpageText={form.webpageText}
                setWebpageText={form.setWebpageText}
                isAiProcessing={form.isAiProcessing}
                aiSuccessMessage={form.aiSuccessMessage}
                matches={form.matches}
                onAiArrange={form.handleAiArrange}
                onGenerateSample={form.generateSampleMatches}
                onUpdateMatch={form.handleUpdateMatch}
                onAddMatch={form.handleAddMatch}
                onRemoveMatch={form.handleRemoveMatch}
                onClose={onClose}
                onPublish={() => form.handlePublishJackpot(onClose)}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
