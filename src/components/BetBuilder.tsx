import {
  Dices, Layers, Trash2, Send,
  Sparkles, X, Trophy, ChevronDown, ChevronUp, Link2,
  Radio, RotateCcw, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ModerationWarningBox from './ModerationWarningBox';
import MatchFiltersToolbar from './MatchFiltersToolbar';
import { useBetBuilder } from '../lib/useBetBuilder';
import { generateOddsForFixture, type BuilderFixture } from '../lib/builderFixtures';
import { isCompletedMatch } from '../lib/matchStatus';
import type { BuiltSlipLeg } from '../lib/betSlipStore';
import Modal from './ui/Modal';

interface BetBuilderProps {
  onPublished?: () => void;
}

const TAG_PRESETS = ['Bet Builder', 'Value Pick', 'Multibet', 'EPL', 'Weekend Parlay', 'High Confidence'];
const BOOKMAKER_OPTIONS = ['SportPesa', 'Betika', '22Bet', '1xBet', 'MozzartBet', 'PariPesa', 'Shabiki', 'Odibets', 'Betway', 'Other'];

export default function BetBuilder({ onPublished }: BetBuilderProps) {
  const {
    activeTab,
    handleTabClick,
    selectedDate,
    setSelectedDate,
    selectedDateLabel,
    todayDateStr,
    counts,
    completedTodayCount,
    allDatesCount,
    availableDates,
    leagueFilter,
    selectedSubLeague,
    setSelectedSubLeague,
    selectedDirectoryLabel,
    directoryData,
    handleLeagueFilterChange,
    sectoredLeagueGroups,
    sectoredLeagueSummaries,
    visibleSectors,
    searchQuery,
    setSearchQuery,
    resetFilters,
    expandedFixtureId,
    setExpandedFixtureId,
    simulatedStake,
    setSimulatedStake,
    isSlipExpanded,
    setIsSlipExpanded,
    showPublishModal,
    setShowPublishModal,
    publishNote,
    setPublishNote,
    selectedTags,
    selectedBookmaker,
    setSelectedBookmaker,
    bookieCode,
    setBookieCode,
    bookieLink,
    setBookieLink,
    filteredFixtures,
    cartLegs,
    totalOdds,
    estimatedReturn,
    modResult,
    toggleLeg,
    removeLeg,
    isLegSelected,
    handlePublish,
    toggleTag,
    clearBuilderLegs,
  } = useBetBuilder(onPublished);

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-panel via-panel-2 to-panel border border-gold/30 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[#EEAA04] text-xs font-bold uppercase tracking-wide mb-1">
              <Dices size={13} /> Custom Bet Builder Engine
            </div>
            <h2 className="font-display font-bold text-xl sm:text-2xl text-cream">
              Build Custom Accumulators
            </h2>
            <p className="text-xs text-cream-dim mt-1 max-w-lg leading-relaxed">
              Search teams, combine match result, over/under, double chance &amp; BTTS markets into a clean custom slip, then publish to community or attach your official bookie code!
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-cream-dim bg-ink px-3 py-1.5 rounded-xl border border-line flex items-center gap-1.5">
              <Layers size={13} className="text-[#EEAA04]" />
              <strong className="text-[#EEAA04] tabular-nums text-sm">{cartLegs.length}</strong> Legs Selected
            </span>
          </div>
        </div>
      </div>

      {/* Match Filters Toolbar (Free Matches filter options styled with Gold accent) */}
      <MatchFiltersToolbar
        accent="gold"
        activeTab={activeTab}
        onTabChange={handleTabClick}
        counts={counts}
        selectedDate={selectedDate}
        selectedDateLabel={selectedDateLabel}
        onSelectDate={setSelectedDate}
        completedTodayCount={completedTodayCount}
        allDatesCount={allDatesCount}
        availableDates={availableDates}
        leagueFilter={leagueFilter}
        selectedSubLeague={selectedSubLeague}
        selectedDirectoryLabel={selectedDirectoryLabel}
        directoryData={directoryData}
        onLeagueFilterChange={handleLeagueFilterChange}
        onSelectSubLeague={setSelectedSubLeague}
        sectoredLeagues={sectoredLeagueSummaries}
        filteredTotalCount={filteredFixtures.length}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onResetFilters={resetFilters}
      />

      {/* Fixtures List */}
      <div className="space-y-3">
        {activeTab === 'live' && filteredFixtures.length === 0 ? (
          <div className="bg-panel border border-line rounded-2xl p-8 text-center flex flex-col items-center gap-3 shadow-xs">
            <Radio size={34} className="text-cream-dim/50 animate-pulse" />
            <h3 className="font-display font-bold text-base sm:text-lg text-cream uppercase tracking-tight">
              No Matches Currently In-Play
            </h3>
            <p className="text-xs text-cream-dim leading-relaxed max-w-md">
              There are no live games in progress right now. Browse upcoming fixtures to build your accumulator slip!
            </p>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  handleTabClick('upcoming');
                  setSelectedDate('all');
                }}
                className="inline-flex items-center gap-2 bg-gold hover:bg-gold-2 text-slate-950 font-bold text-xs uppercase tracking-wide px-5 h-9 rounded-full shadow-xs transition-colors cursor-pointer active:scale-95"
              >
                Browse Upcoming ({counts.upcoming})
              </button>
              <button
                type="button"
                onClick={() => {
                  handleTabClick('upcoming');
                  setSelectedDate(todayDateStr);
                }}
                className="inline-flex items-center gap-2 bg-panel-2 hover:bg-line text-cream font-bold text-xs uppercase tracking-wide px-4 h-9 rounded-full border border-line transition-colors cursor-pointer"
              >
                Today&apos;s Slate
              </button>
            </div>
          </div>
        ) : filteredFixtures.length === 0 ? (
          <div className="bg-panel border border-dashed border-line rounded-2xl p-8 text-center flex flex-col items-center gap-2.5">
            {selectedDate === 'completed' ? (
              <>
                <CheckCircle2 size={32} className="text-[#C48B03]" />
                <p className="text-sm font-bold text-cream">No Completed Matches Yet Today</p>
                <p className="text-xs text-cream-dim max-w-md">
                  Finished fixtures will appear here with final scores as today&apos;s matches conclude.
                </p>
              </>
            ) : (
              <>
                <Trophy size={32} className="text-cream-dim/30" />
                <p className="text-sm font-bold text-cream">No matching fixtures found</p>
                <p className="text-xs text-cream-dim">
                  No matches found for &quot;<strong className="text-cream">{searchQuery || selectedDirectoryLabel}</strong>&quot; under {activeTab} view.
                </p>
              </>
            )}
            <button
              type="button"
              onClick={resetFilters}
              className="mt-2 inline-flex items-center gap-1.5 bg-gold hover:bg-gold-2 text-slate-950 font-bold text-xs uppercase tracking-wide px-4 py-2 rounded-full transition-colors cursor-pointer active:scale-95"
            >
              <RotateCcw size={13} /> Reset Filters
            </button>
          </div>
        ) : sectoredLeagueGroups.length > 1 && leagueFilter !== 'all' ? (
          <div className="space-y-8">
            {visibleSectors.map((sector) => (
              <div key={sector.league} className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#EEAA04]/35">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EEAA04]" />
                    <h3 className="font-display font-bold text-sm sm:text-base text-cream tracking-tight uppercase">
                      {sector.league}
                    </h3>
                  </div>
                  <span className="text-[11px] tabular-nums font-bold px-2.5 py-0.5 rounded-full bg-[#EEAA04]/20 text-[#9A6B00]">
                    {sector.fixtures.length} {sector.fixtures.length === 1 ? 'Fixture' : 'Fixtures'}
                  </span>
                </div>
                <div className="space-y-3">
                  {sector.fixtures.map((fixture) => (
                    <BuilderFixtureItem
                      key={fixture.id}
                      fixture={fixture}
                      isExpanded={expandedFixtureId === fixture.id}
                      onToggleExpand={setExpandedFixtureId}
                      cartLegs={cartLegs}
                      isLegSelected={isLegSelected}
                      toggleLeg={toggleLeg}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          filteredFixtures.map((fixture) => (
            <BuilderFixtureItem
              key={fixture.id}
              fixture={fixture}
              isExpanded={expandedFixtureId === fixture.id}
              onToggleExpand={setExpandedFixtureId}
              cartLegs={cartLegs}
              isLegSelected={isLegSelected}
              toggleLeg={toggleLeg}
            />
          ))
        )}
      </div>

      {/* STICKY BUILDER CART FLOATING ICON / OVERLAY */}
      <AnimatePresence>
        {cartLegs.length > 0 && !isSlipExpanded && (
          <motion.div
            key="collapsed-slip-icon"
            initial={{ scale: 0.8, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 15 }}
            className="fixed bottom-[calc(128px+env(safe-area-inset-bottom))] sm:bottom-20 right-3.5 sm:right-6 z-40"
          >
            <button
              onClick={() => setIsSlipExpanded(true)}
              className="relative flex items-center gap-2 bg-panel border-2 border-gold/90 hover:border-gold rounded-2xl px-3 py-2.5 sm:px-3.5 sm:py-2.5 shadow-2xl shadow-gold/20 hover:scale-105 active:scale-95 transition-all text-gold group cursor-pointer touch-manipulation backdrop-blur-md"
              title="Open Bet Builder Slip"
              aria-label="Expand Bet Builder Slip"
            >
              <div className="relative flex items-center justify-center">
                <Dices size={22} className="text-gold transition-transform group-hover:rotate-12" />
                <span className="absolute -top-3 -right-3 bg-gold text-ink font-bold text-[11px] h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center border-2 border-panel shadow-lg animate-pulse">
                  {cartLegs.length}
                </span>
              </div>
              <div className="text-left leading-tight hidden xs:block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-cream-dim block">
                  Slip ({cartLegs.length})
                </span>
                <span className="text-xs font-bold text-gold tabular-nums">
                  @{totalOdds.toFixed(2)}x
                </span>
              </div>
            </button>
          </motion.div>
        )}

        {cartLegs.length > 0 && isSlipExpanded && (
          <motion.div
            key="expanded-slip-card"
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50 bg-panel border-2 border-gold rounded-2xl p-4 shadow-2xl space-y-3 backdrop-blur-xl"
          >
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSlipExpanded(false)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-ink-2 border border-line hover:border-gold/50 text-cream-dim hover:text-cream text-xs font-bold transition-all active:scale-95 touch-manipulation"
                  title="Collapse slip"
                  aria-label="Collapse Bet Builder Slip"
                >
                  <ChevronDown size={16} className="text-gold" />
                  <span className="text-[11px]">Back</span>
                </button>

                <div className="flex items-center gap-2 ml-1">
                  <div className="w-6 h-6 rounded-lg bg-gold/20 flex items-center justify-center text-gold font-bold text-xs">
                    {cartLegs.length}
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-xs sm:text-sm text-cream leading-tight">
                      {cartLegs.length}-Fold Accumulator
                    </h4>
                    <p className="text-[11px] text-cream-dim">Custom Bet Builder Slip</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    clearBuilderLegs();
                    setIsSlipExpanded(false);
                  }}
                  className="text-[11px] font-bold text-rose-400 hover:underline px-2 py-1"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Selected Legs Preview List (Collapsible / Scrollable) */}
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-xs scroll-touch">
              {cartLegs.map((leg) => (
                <div
                  key={leg.id}
                  className="flex items-center justify-between gap-2 bg-ink border border-line rounded-xl px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-cream truncate text-[11px]">
                      {leg.homeTeam} vs {leg.awayTeam}
                    </p>
                    <p className="text-[11px] text-gold font-semibold">
                      {leg.pick} <span className="text-cream-dim">({leg.market})</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums font-bold text-cream text-[11px]">
                      {leg.odds.toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeLeg(leg.id)}
                      className="text-cream-dim hover:text-rose-400 p-1"
                      aria-label="Remove leg"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Stake & Total Odds Summary */}
            <div className="bg-ink-2 rounded-xl p-2.5 border border-line space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-cream-dim">Total Multiplier Odds:</span>
                <span className="tabular-nums font-bold text-gold text-base">
                  @{totalOdds.toFixed(2)}x
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-cream-dim font-medium">Est. Stake (Ksh):</span>
                <input
                  type="number"
                  value={simulatedStake}
                  onChange={(e) => setSimulatedStake(Math.max(10, +e.target.value))}
                  className="w-24 bg-ink border border-line rounded-lg px-2 py-1 text-right tabular-nums font-bold text-cream focus:outline-none focus:border-gold"
                />
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-line/60">
                <span className="text-cream-dim font-bold">Estimated Payout:</span>
                <span className="tabular-nums font-bold text-emerald-300 text-sm">
                  {estimatedReturn.toLocaleString()} Ksh
                </span>
              </div>
            </div>

            {/* Publish Action Button */}
            <button
              onClick={() => setShowPublishModal(true)}
              className="w-full bg-gold hover:bg-gold-2 text-ink font-bold text-sm py-2.5 rounded-xl shadow transition-all flex items-center justify-center gap-2 active:scale-[0.98] touch-manipulation"
            >
              <Send size={15} />
              Publish Built Slip to Feed
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PUBLISH BUILT SLIP MODAL */}
      {showPublishModal && (
        <Modal isOpen={true} onClose={() => setShowPublishModal(false)} overlayClassName="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-panel border border-line rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl relative"
          >
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-display font-bold text-lg text-cream flex items-center gap-2">
                <Sparkles size={18} className="text-gold" />
                Publish Built Bet Slip
              </h3>
              <button
                onClick={() => setShowPublishModal(false)}
                aria-label="Close"
                className="text-cream-dim hover:text-cream p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Slip Summary Header */}
            <div className="bg-ink border border-gold/40 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase text-gold">Compiled Multi-Leg Bet</span>
                <p className="font-bold text-cream text-sm">
                  {cartLegs.length} Matches Combined
                </p>
              </div>
              <div className="text-right">
                <span className="tabular-nums font-bold text-gold text-lg">@{totalOdds.toFixed(2)}x</span>
                <p className="text-[11px] text-cream-dim">Est Return: {estimatedReturn.toLocaleString()} Ksh</p>
              </div>
            </div>

            {/* Optional Analysis Note */}
            <div>
              <label className="text-xs font-bold text-cream block mb-1">
                Analysis / Strategy Note (Optional)
              </label>
              <textarea
                value={publishNote}
                onChange={(e) => setPublishNote(e.target.value)}
                placeholder="Explain why you picked these games (e.g., High probability double chances, Arsenal in hot home form)..."
                rows={2}
                className="w-full bg-ink border border-line rounded-xl p-2.5 text-sm text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold resize-none"
              />
            </div>

            {/* Moderation Warning */}
            <ModerationWarningBox result={modResult} text={`${publishNote} ${bookieCode} ${bookieLink}`} />

            {/* Tags Preset */}
            <div>
              <label className="text-xs font-bold text-cream block mb-1">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {TAG_PRESETS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-gold border-gold text-ink font-bold'
                        : 'border-line text-cream-dim hover:border-gold/50'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Official Sportsbook Code or Link Attachment */}
            <div className="bg-ink-2 border border-line rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cream flex items-center gap-1.5">
                  <Link2 size={14} className="text-gold" />
                  Attach Official Bookie Code or Link (Optional)
                </span>
                <span className="text-[11px] text-cream-dim">Can add now or later</span>
              </div>

              <div>
                <label className="text-[11px] text-cream-dim block mb-1">Bookmaker Site</label>
                <div className="grid grid-cols-3 gap-1">
                  {BOOKMAKER_OPTIONS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setSelectedBookmaker(b)}
                      className={`text-[11px] font-bold py-1 px-1.5 rounded-lg border text-center transition-all ${
                        selectedBookmaker === b
                          ? 'bg-gold text-ink border-gold font-bold'
                          : 'bg-panel border-line text-cream-dim hover:text-cream'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-cream-dim block mb-1">Booking Code</label>
                  <input
                    type="text"
                    value={bookieCode}
                    onChange={(e) => setBookieCode(e.target.value)}
                    placeholder="e.g. SP-99120"
                    className="w-full bg-ink border border-line rounded-xl px-2.5 py-1.5 text-xs text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold tabular-nums"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-cream-dim block mb-1">Slip Share URL</label>
                  <input
                    type="text"
                    value={bookieLink}
                    onChange={(e) => setBookieLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-ink border border-line rounded-xl px-2.5 py-1.5 text-xs text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 text-xs font-bold text-cream-dim hover:text-cream rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={!modResult.isAllowed}
                className="px-5 py-2.5 text-xs font-bold bg-gold hover:bg-gold-2 disabled:opacity-40 text-ink rounded-xl shadow flex items-center gap-1.5"
              >
                <Send size={14} />
                Publish to Community
              </button>
            </div>
          </motion.div>
        </Modal>
      )}
    </div>
  );
}

interface BuilderFixtureItemProps {
  fixture: BuilderFixture;
  isExpanded: boolean;
  onToggleExpand: (id: string | null) => void;
  cartLegs: BuiltSlipLeg[];
  isLegSelected: (matchId: string, market: string, pick: string) => boolean;
  toggleLeg: (fixture: BuilderFixture, market: string, pick: string, odds: number) => void;
}

function BuilderFixtureItem({
  fixture,
  isExpanded,
  onToggleExpand,
  cartLegs,
  isLegSelected,
  toggleLeg,
}: BuilderFixtureItemProps) {
  const oddsData = generateOddsForFixture(fixture);
  const legsInThisMatch = cartLegs.filter((l) => l.matchId === fixture.id);
  const isFinished = isCompletedMatch(fixture);

  return (
    <div
      className={`bg-panel border rounded-2xl transition-all shadow-sm overflow-hidden ${
        legsInThisMatch.length > 0 ? 'border-gold/60 bg-gold/5' : 'border-line hover:border-gold/30'
      }`}
    >
      {/* Match Header Row */}
      <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[11px] uppercase font-bold text-cream-dim">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              {fixture.status === 'in' && (
                <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[11px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  LIVE {fixture.homeScore !== null && fixture.awayScore !== null ? `${fixture.homeScore} - ${fixture.awayScore}` : ''}
                </span>
              )}
              {isFinished && (
                <span className="bg-slate-200/70 text-slate-700 border border-slate-300 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  FT {fixture.homeScore !== null && fixture.awayScore !== null ? `${fixture.homeScore} - ${fixture.awayScore}` : ''}
                </span>
              )}
              <span className="text-gold">{fixture.competition}</span>
              <span>•</span>
              <span className="shrink-0">{fixture.kickoff}</span>
            </div>
            {legsInThisMatch.length > 0 && (
              <span className="bg-gold text-ink font-bold text-[11px] px-2.5 py-0.5 rounded-full shrink-0 whitespace-nowrap shadow-2xs">
                {legsInThisMatch.length} Pick{legsInThisMatch.length > 1 ? 's' : ''} Added
              </span>
            )}
          </div>
          <div className="font-display font-bold text-base text-cream mt-0.5 flex items-center gap-2">
            <span>{fixture.homeTeam}</span>
            <span className="text-cream-dim text-xs font-normal">vs</span>
            <span>{fixture.awayTeam}</span>
          </div>
        </div>

        {/* Quick 1X2 Market Buttons (or Finished Badge for Completed Matches) */}
        {isFinished ? (
          <div className="flex items-center shrink-0">
            <span className="text-xs font-bold text-slate-500 bg-panel-2 border border-line px-3 py-1.5 rounded-xl">
              Match Completed
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            {oddsData.matchResult.map((m) => {
              const selected = isLegSelected(fixture.id, 'Match Result (1X2)', m.label);
              return (
                <button
                  key={m.code}
                  onClick={() => toggleLeg(fixture, 'Match Result (1X2)', m.label, m.odds)}
                  className={`flex-1 sm:flex-none tabular-nums font-bold text-xs px-3 py-2 rounded-xl border transition-all flex flex-col items-center justify-center min-w-[62px] ${
                    selected
                      ? 'bg-gold text-ink border-gold shadow font-bold scale-105'
                      : 'bg-ink border-line text-cream hover:border-gold/50'
                  }`}
                >
                  <span className="text-[11px] text-cream-dim uppercase">{m.code}</span>
                  <span className={selected ? 'text-ink' : 'text-gold'}>{m.odds.toFixed(2)}</span>
                </button>
              );
            })}

            {/* Expand More Markets */}
            <button
              onClick={() => onToggleExpand(isExpanded ? null : fixture.id)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                isExpanded ? 'bg-gold/20 text-gold border-gold' : 'bg-ink-2 border-line text-cream-dim hover:text-cream'
              }`}
              title="More Markets"
            >
              <span>Markets</span>
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        )}
      </div>

      {/* Expanded Markets Accordion */}
      <AnimatePresence>
        {isExpanded && !isFinished && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-line/60 bg-ink/60 p-3.5 sm:p-4 space-y-3"
          >
            {/* Double Chance */}
            <div>
              <span className="text-[11px] font-bold uppercase text-cream-dim tracking-wide block mb-1.5">
                Double Chance
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {oddsData.doubleChance.map((dc) => {
                  const selected = isLegSelected(fixture.id, 'Double Chance', dc.label);
                  return (
                    <button
                      key={dc.code}
                      onClick={() => toggleLeg(fixture, 'Double Chance', dc.label, dc.odds)}
                      className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                        selected ? 'bg-gold text-ink border-gold font-bold shadow' : 'bg-panel border-line text-cream hover:border-gold/40'
                      }`}
                    >
                      <span className="text-[11px] truncate">{dc.label}</span>
                      <span className={`tabular-nums text-xs font-bold ${selected ? 'text-ink' : 'text-gold'}`}>
                        {dc.odds.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Over / Under Goals */}
            <div>
              <span className="text-[11px] font-bold uppercase text-cream-dim tracking-wide block mb-1.5">
                Over / Under Total Goals
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {oddsData.overUnderGoals.map((ou) => {
                  const selected = isLegSelected(fixture.id, 'Over / Under', ou.label);
                  return (
                    <button
                      key={ou.code}
                      onClick={() => toggleLeg(fixture, 'Over / Under', ou.label, ou.odds)}
                      className={`p-2 rounded-xl border text-center transition-all flex items-center justify-between px-3 ${
                        selected ? 'bg-gold text-ink border-gold font-bold shadow' : 'bg-panel border-line text-cream hover:border-gold/40'
                      }`}
                    >
                      <span className="text-xs">{ou.label}</span>
                      <span className={`tabular-nums text-xs font-bold ${selected ? 'text-ink' : 'text-gold'}`}>
                        {ou.odds.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BTTS / GG/NG */}
            <div>
              <span className="text-[11px] font-bold uppercase text-cream-dim tracking-wide block mb-1.5">
                Both Teams To Score (BTTS)
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {oddsData.btts.map((b) => {
                  const selected = isLegSelected(fixture.id, 'BTTS', b.label);
                  return (
                    <button
                      key={b.code}
                      onClick={() => toggleLeg(fixture, 'BTTS', b.label, b.odds)}
                      className={`p-2.5 rounded-xl border text-center transition-all flex items-center justify-between px-4 ${
                        selected ? 'bg-gold text-ink border-gold font-bold shadow' : 'bg-panel border-line text-cream hover:border-gold/40'
                      }`}
                    >
                      <span className="text-xs font-bold">{b.label}</span>
                      <span className={`tabular-nums text-xs font-bold ${selected ? 'text-ink' : 'text-gold'}`}>
                        {b.odds.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Handicap & Correct Score quick options */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase text-cream-dim tracking-wide block mb-1.5">
                  Handicap Lines
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {oddsData.handicap.map((h) => {
                    const selected = isLegSelected(fixture.id, 'Handicap', h.label);
                    return (
                      <button
                        key={h.code}
                        onClick={() => toggleLeg(fixture, 'Handicap', h.label, h.odds)}
                        className={`p-1.5 rounded-xl border text-center transition-all flex flex-col items-center ${
                          selected ? 'bg-gold text-ink border-gold font-bold shadow' : 'bg-panel border-line text-cream hover:border-gold/40'
                        }`}
                      >
                        <span className="text-[11px] truncate">{h.label}</span>
                        <span className={`tabular-nums text-xs font-bold ${selected ? 'text-ink' : 'text-gold'}`}>{h.odds.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase text-cream-dim tracking-wide block mb-1.5">
                  Correct Score
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {oddsData.correctScore.slice(0, 6).map((cs) => {
                    const selected = isLegSelected(fixture.id, 'Correct Score', cs.label);
                    return (
                      <button
                        key={cs.code}
                        onClick={() => toggleLeg(fixture, 'Correct Score', cs.label, cs.odds)}
                        className={`p-1.5 rounded-xl border text-center transition-all flex flex-col items-center ${
                          selected ? 'bg-gold text-ink border-gold font-bold shadow' : 'bg-panel border-line text-cream hover:border-gold/40'
                        }`}
                      >
                        <span className="text-[11px] tabular-nums font-bold">{cs.label}</span>
                        <span className={`tabular-nums text-[11px] ${selected ? 'text-ink' : 'text-gold'}`}>{cs.odds.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom bar: Done button & auto-collapse hint */}
            <div className="flex items-center justify-between pt-2 border-t border-line/40 text-[11px] text-cream-dim tabular-nums">
              <span className="text-cream-dim/60">Auto-collapses when picking outside</span>
              <button
                type="button"
                onClick={() => onToggleExpand(null)}
                className="px-3 py-1 rounded-lg bg-ink-2 hover:bg-ink border border-line text-xs font-bold text-cream hover:text-gold transition-colors flex items-center gap-1"
              >
                <span>Done</span>
                <ChevronUp size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
