import { useState } from 'react';
import { Radio, Trash2, CheckCircle2, RotateCcw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { clearAllJackpots, deleteAdminJackpot, updateJackpotMatchResult } from '../../lib/mockData';
import { showToast } from '../../lib/notificationStore';
import type { Jackpot, Outcome, NonResultStatus } from '../../lib/types';
import { getBookieTheme } from '../../lib/bookies';

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeStatusMenuMatchId, setActiveStatusMenuMatchId] = useState<string | null>(null);

  return (
    <div className="bg-white border border-[#E5E5EA] rounded-2xl p-5 space-y-4 shadow-2xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E5EA]">
        <div>
          <h3 className="font-semibold text-sm sm:text-base text-slate-900 flex items-center gap-2">
            <Radio size={16} className="text-[#006C54] animate-pulse" />
            Live Published Rooms &amp; Match Results ({publishedJackpots.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Update game outcomes leg by leg to drive live leaderboard rank recalculations for users.
          </p>
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
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Trash2 size={13} />
            <span>Clear All Rooms</span>
          </button>
        )}
      </div>

      {publishedJackpots.length === 0 ? (
        <div className="p-6 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500">
          No live jackpot rooms published yet. Use the form below to AI-arrange and publish a room!
        </div>
      ) : (
        <div className="space-y-4">
          {/* Room Selector Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-[#FBFBFA] p-3 rounded-xl border border-[#E5E5EA]">
            <label htmlFor="select-jackpot-room" className="text-xs font-semibold text-slate-700 shrink-0">
              Select Room:
            </label>
            <select
              id="select-jackpot-room"
              value={selectedResultRoomId || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedResultRoomId(val);
                if (val) setIsExpanded(true);
                else setIsExpanded(false);
              }}
              className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all shadow-2xs"
            >
              <option value="">-- Choose an active / not-started published room --</option>
              {publishedJackpots.map((jp) => {
                const completedCount = jp.matches.filter((m) => m.result !== undefined || m.nonResultStatus).length;
                return (
                  <option key={jp.id} value={jp.id}>
                    {jp.name} ({jp.bookie}) · {completedCount}/{jp.matches.length} Legs settled · {jp.deadline}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Selected Room Leg Result Editor (Collapsed by Default) */}
          {activeResultRoom && (
            <div className="bg-[#FBFBFA] border border-[#E5E5EA] rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E5EA] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-900 text-sm">
                      Leg Results &amp; Live Leaderboard Controller
                    </h4>
                    <span className="text-[#006C54] text-[11px] font-bold">
                      {activeResultRoom.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Set game outcomes leg by leg as matches conclude. Standings will recalculate live for all participants.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>{isExpanded ? 'Collapse Legs' : 'Expand Legs & Controller'}</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      deleteAdminJackpot(activeResultRoom.id);
                      showToast({ title: 'Room Deleted', message: `Removed ${activeResultRoom.name}`, type: 'info' });
                    }}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-2 rounded-xl transition-colors cursor-pointer"
                    title="Delete Room"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Leg Match Result Pickers (Visible only when expanded) */}
              {isExpanded && (
                <div className="max-h-80 overflow-y-auto space-y-2 pr-1 animate-fade-in">
                  {activeResultRoom.matches.map((match, idx) => {
                    return (
                      <div
                        key={match.id}
                        className="bg-white border border-[#E5E5EA] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-slate-300 transition-colors shadow-2xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] tabular-nums font-bold text-slate-700">
                              Leg {idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {match.home} <span className="text-slate-400 font-normal">vs</span> {match.away}
                            </span>
                            {match.nonResultStatus ? (
                              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertTriangle size={11} /> {match.nonResultStatus}
                              </span>
                            ) : match.result ? (
                              <span className="text-[11px] font-semibold text-[#006C54] bg-[#E8F5EE] px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 size={11} /> Outcome: {match.result}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                                Unplayed
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 truncate">
                            {match.competition} · {match.kickoff}
                          </p>
                        </div>

                        {/* Outcome Pickers & Special Status Dropdown */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          {/* Non-Result Status Dropdown Button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveStatusMenuMatchId(
                                  activeStatusMenuMatchId === match.id ? null : match.id
                                )
                              }
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                                match.nonResultStatus
                                  ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                              title="Set Canceled, Postponed, Abandoned, or TBD"
                            >
                              <span>{match.nonResultStatus || 'Status'}</span>
                              <ChevronDown
                                size={11}
                                className={
                                  activeStatusMenuMatchId === match.id
                                    ? 'rotate-180 transition-transform'
                                    : 'transition-transform'
                                }
                              />
                            </button>

                            {activeStatusMenuMatchId === match.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-30"
                                  onClick={() => setActiveStatusMenuMatchId(null)}
                                />
                                <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-40 animate-fade-in text-xs font-medium text-slate-800">
                                  {(['Canceled', 'Postponed', 'Abandoned', 'TBD'] as NonResultStatus[]).map(
                                    (status) => (
                                      <button
                                        key={status}
                                        type="button"
                                        onClick={() => {
                                          updateJackpotMatchResult(
                                            activeResultRoom.id,
                                            match.id,
                                            undefined,
                                            null,
                                            null,
                                            status
                                          );
                                          setActiveStatusMenuMatchId(null);
                                          showToast({
                                            title: `Leg #${idx + 1} Status Updated`,
                                            message: `${match.home} vs ${match.away} marked as ${status}`,
                                            type: 'info',
                                          });
                                        }}
                                        className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between cursor-pointer ${
                                          match.nonResultStatus === status
                                            ? 'text-[#006C54] font-bold bg-[#E8F5EE]'
                                            : ''
                                        }`}
                                      >
                                        <span>{status}</span>
                                        {match.nonResultStatus === status && (
                                          <CheckCircle2 size={12} className="text-[#006C54]" />
                                        )}
                                      </button>
                                    )
                                  )}
                                  {match.nonResultStatus && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateJackpotMatchResult(
                                          activeResultRoom.id,
                                          match.id,
                                          undefined,
                                          null,
                                          null,
                                          null
                                        );
                                        setActiveStatusMenuMatchId(null);
                                        showToast({
                                          title: 'Status Cleared',
                                          message: `Leg #${idx + 1} status cleared`,
                                          type: 'info',
                                        });
                                      }}
                                      className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 border-t border-slate-100 cursor-pointer flex items-center gap-1.5"
                                    >
                                      <RotateCcw size={11} />
                                      <span>Clear Status</span>
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>

                          {(['1', 'X', '2'] as Outcome[]).map((outcome) => {
                            const isSelected = match.result === outcome;
                            return (
                              <button
                                key={outcome}
                                type="button"
                                onClick={() => {
                                  const homeScore = outcome === '1' ? 2 : outcome === 'X' ? 1 : 0;
                                  const awayScore = outcome === '2' ? 2 : outcome === 'X' ? 1 : 0;
                                  updateJackpotMatchResult(
                                    activeResultRoom.id,
                                    match.id,
                                    outcome,
                                    homeScore,
                                    awayScore,
                                    null
                                  );
                                  showToast({
                                    title: `Leg #${idx + 1} Updated`,
                                    message: `${match.home} vs ${match.away} set to ${
                                      outcome === '1'
                                        ? '1 (Home Win)'
                                        : outcome === 'X'
                                        ? 'X (Draw)'
                                        : '2 (Away Win)'
                                    }`,
                                    type: 'success',
                                  });
                                }}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#006C54] text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                {outcome === '1' ? '1 Home' : outcome === 'X' ? 'X Draw' : '2 Away'}
                              </button>
                            );
                          })}

                          {(match.result !== undefined || match.nonResultStatus) && (
                            <button
                              type="button"
                              onClick={() => {
                                updateJackpotMatchResult(
                                  activeResultRoom.id,
                                  match.id,
                                  undefined,
                                  null,
                                  null,
                                  null
                                );
                                showToast({
                                  title: 'Leg Reset',
                                  message: `Leg #${idx + 1} set to unplayed`,
                                  type: 'info',
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
