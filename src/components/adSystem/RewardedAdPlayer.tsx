import { useEffect, useState } from 'react';
import { Volume2, VolumeX, X, ExternalLink, CheckCircle2, ShieldCheck, Play, Pause, AlertTriangle } from 'lucide-react';
import { AdMedia } from '../../lib/adSystem/types';
import Modal from '../ui/Modal';

interface RewardedAdPlayerProps {
  adMedia: AdMedia;
  onComplete: (adMedia: AdMedia, watchDurationSeconds: number) => void;
  onSkipped: () => void;
}

export default function RewardedAdPlayer({ adMedia, onComplete, onSkipped }: RewardedAdPlayerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(adMedia.durationSeconds);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showSkipWarning, setShowSkipWarning] = useState(false);

  const totalSeconds = adMedia.durationSeconds || 8;
  const progressPct = Math.round(((totalSeconds - secondsRemaining) / totalSeconds) * 100);

  useEffect(() => {
    if (!isPlaying || isFinished) return;

    if (secondsRemaining <= 0) {
      setIsFinished(true);
      onComplete(adMedia, totalSeconds);
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsFinished(true);
          onComplete(adMedia, totalSeconds);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, secondsRemaining, isFinished, adMedia, onComplete, totalSeconds]);

  function handleCloseAttempt() {
    if (isFinished) {
      onComplete(adMedia, totalSeconds);
    } else {
      setIsPlaying(false);
      setShowSkipWarning(true);
    }
  }

  function handleConfirmSkip() {
    onSkipped();
  }

  function handleResumeAd() {
    setShowSkipWarning(false);
    setIsPlaying(true);
  }

  return (
    <Modal isOpen={true} overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-2xl bg-ink border border-gold/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-panel/80 border-b border-line text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-2 animate-ping" />
            <span className="font-extrabold text-cream uppercase tracking-wider text-[11px]">
              Sponsored Ad · {adMedia.sponsorName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-lg text-cream-dim hover:text-cream bg-panel-2 hover:bg-line transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            <button
              onClick={handleCloseAttempt}
              className="p-1.5 rounded-lg text-cream-dim hover:text-rose-400 bg-panel-2 hover:bg-line transition-colors"
              title="Close Ad"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Ad Canvas Visual Frame */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group">
          {adMedia.imageUrl ? (
            <img
              src={adMedia.imageUrl}
              alt={adMedia.title}
              className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
              loading="eager"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-900/40 via-ink to-amber-900/30 flex items-center justify-center p-8 text-center">
              <div className="space-y-2">
                <span className="text-4xl">⚽</span>
                <h2 className="font-display font-extrabold text-2xl text-cream">{adMedia.title}</h2>
              </div>
            </div>
          )}

          {/* Dark Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-between p-6">
            {/* Top Badge Overlay */}
            <div className="flex items-center justify-between">
              <span className="bg-gold text-ink font-extrabold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full shadow">
                {adMedia.provider.replace('_', ' ')}
              </span>

              {/* Timer Pill */}
              <div className="bg-black/70 border border-gold/40 backdrop-blur-md px-3.5 py-1.5 rounded-full flex items-center gap-2 text-xs font-mono font-bold text-cream">
                {isFinished ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={14} /> Completed!
                  </span>
                ) : (
                  <>
                    <span className="text-gold font-extrabold text-sm">{secondsRemaining}s</span>
                    <span className="text-cream-dim text-[11px]">Remaining</span>
                  </>
                )}
              </div>
            </div>

            {/* Bottom Info Overlay */}
            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-bold text-gold uppercase tracking-wider">
                  {adMedia.sponsorName}
                </span>
                <h3 className="font-display font-extrabold text-xl sm:text-2xl text-white drop-shadow-md mt-0.5">
                  {adMedia.title}
                </h3>
                <p className="text-xs text-cream-dim/90 max-w-lg mt-1 line-clamp-2">
                  {adMedia.tagline}
                </p>
              </div>

              {/* Action Buttons inside Canvas */}
              <div className="flex items-center justify-between pt-2">
                {adMedia.ctaLink && (
                  <a
                    href={adMedia.ctaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-2 text-ink font-extrabold text-xs px-4 py-2 rounded-xl shadow transition-all"
                  >
                    <span>{adMedia.ctaText}</span>
                    <ExternalLink size={13} />
                  </a>
                )}

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur transition-colors"
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Smooth Countdown Progress Bar */}
        <div className="w-full h-2 bg-panel-2 overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-gold to-gold-2 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Footer Guarantee Status */}
        <div className="p-4 bg-panel/60 border-t border-line flex items-center justify-between text-xs text-cream-dim">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-2" /> 15-Minute Room Access Token granted upon ad completion
          </span>

          {isFinished && (
            <button
              onClick={() => onComplete(adMedia, totalSeconds)}
              className="bg-emerald-2 hover:bg-emerald text-ink font-extrabold text-xs px-4 py-2 rounded-xl shadow transition-all animate-bounce"
            >
              Enter Room Now →
            </button>
          )}
        </div>

        {/* Skip Warning Modal Overlay */}
        {showSkipWarning && (
          <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 text-center animate-fade-in">
            <div className="bg-panel border border-rose-500/40 rounded-2xl max-w-sm p-6 space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>

              <div>
                <h4 className="font-display font-extrabold text-base text-cream">Skip Advertisement?</h4>
                <p className="text-xs text-cream-dim mt-1.5 leading-relaxed">
                  If you close this ad now, your <strong className="text-gold">15-minute room access pass</strong> will not be generated.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleResumeAd}
                  className="w-full py-2.5 rounded-xl bg-gold hover:bg-gold-2 text-ink font-extrabold text-xs transition-colors"
                >
                  Resume Ad ({secondsRemaining}s left)
                </button>
                <button
                  onClick={handleConfirmSkip}
                  className="w-full py-2.5 rounded-xl bg-panel-2 hover:bg-line text-cream-dim hover:text-cream text-xs font-bold border border-line transition-colors"
                >
                  Skip & Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
