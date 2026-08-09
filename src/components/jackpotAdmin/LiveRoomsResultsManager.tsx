import { Radio, Trash2, Zap, CheckCircle2, RotateCcw } from 'lucide-react';
import { clearAllJackpots, deleteAdminJackpot, updateJackpotMatchResult, autoSimulateNextLegResult } from '../../lib/mockData';
import { showToast } from '../../lib/notificationStore';
import type { Jackpot, Outcome } from '../../lib/types';

interface LiveRoomsResultsManagerProps {
  publishedJackpots: Jackpot[];
  selectedResultRoomId: string | null;
  setSelectedResultRoomId: (id: string) => void;
  activeResultRoom: Jackpot | undefined;
}

export default function LiveRoomsResultsManager({
  publishedJackpots,
  selectedResultRoomId,
  setSelectedResultRoomId,
  activeResultRoom,
}: LiveRoomsResultsManagerProps) {
  return (
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
  );
}
