import React, { useState } from 'react';
import { ShieldCheck, X, Trophy, Lock, Tv, ShieldAlert } from 'lucide-react';
import AdminAdSettingsModal from './adSystem/AdminAdSettingsModal';
import AdminModerationDashboard from './AdminModerationDashboard';
import LiveRoomsResultsManager from './jackpotAdmin/LiveRoomsResultsManager';
import CreateJackpotForm from './jackpotAdmin/CreateJackpotForm';
import { isAdminUser, useCurrentUser } from '../lib/authStore';
import { useJackpotAdminForm } from '../lib/useJackpotAdminForm';
import { showToast } from '../lib/notificationStore';
import Modal from './ui/Modal';

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

  const form = useJackpotAdminForm();

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
              aria-label="Close"
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
    </Modal>
  );
}
