import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2,
  Send, RotateCcw, Calendar, Trophy, Globe, Sparkles, Layers,
  ChevronRight, RefreshCw, X
} from 'lucide-react';
import {
  extractTextFromPdfBuffer,
  parseFixturesText,
  type ParsedFixtureRow,
  type ParseFixturesResult
} from '../../lib/fixturePdfParser';
import { setUploadedFreeMatches, clearAllFreeMatches, type FreeMatch } from '../../lib/freeMatches';
import { showToast } from '../../lib/notificationStore';

const SAMPLE_DEMO_FIXTURES = `ENGLAND: Premier League
5821 2026-10-24 14:30 Arsenal vs Chelsea 1.95 3.60 3.80 1.25 1.28 1.80 1.75 2.05 1.70 2.10
5822 2026-10-24 17:00 Aston Villa vs Newcastle 2.40 3.40 2.90 1.40 1.30 1.55 1.80 2.00 1.65 2.20
5823 2026-10-25 19:30 Liverpool vs Manchester City 2.30 3.50 3.10 1.35 1.28 1.60 1.65 2.20 1.55 2.35

ENGLAND: Championship
5901 2026-10-24 15:00 Leeds United vs Sunderland 1.80 3.50 4.20 1.20 1.28 1.95 1.90 1.90 1.85 1.95
5902 2026-10-24 15:00 Sheffield Utd vs Burnley 2.20 3.25 3.30 1.32 1.32 1.65 2.05 1.75 1.80 2.00
5903 2026-10-25 14:00 Norwich City vs West Brom 2.15 3.30 3.40 1.30 1.31 1.66 1.85 1.95 1.75 2.05

SPAIN: La Liga
6001 2026-10-24 21:00 Real Madrid vs Barcelona 2.25 3.60 3.00 1.38 1.28 1.62 1.55 2.40 1.50 2.50
6002 2026-10-25 17:15 Atletico Madrid vs Sevilla 1.75 3.60 4.75 1.18 1.27 2.05 1.95 1.85 1.90 1.90

GERMANY: Bundesliga
7001 2026-10-24 16:30 Bayern Munich vs Dortmund 1.60 4.50 4.80 1.18 1.18 2.30 1.40 2.90 1.50 2.50
7002 2026-10-25 18:30 Leverkusen vs RB Leipzig 2.05 3.70 3.40 1.30 1.26 1.74 1.50 2.50 1.48 2.55

ITALY: Serie A
8001 2026-10-24 19:00 Inter Milan vs Juventus 2.10 3.25 3.60 1.28 1.32 1.70 1.90 1.90 1.80 2.00
8002 2026-10-25 21:45 Napoli vs AC Milan 2.35 3.30 3.10 1.35 1.31 1.58 1.85 1.95 1.70 2.10`;

export default function AdminFixturesManager() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseFixturesResult | null>(null);
  const [rawTextInput, setRawTextInput] = useState('');
  const [showRawTextInput, setShowRawTextInput] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [currentLiveCount, setCurrentLiveCount] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing saved fixtures count on mount
  useEffect(() => {
    fetchCurrentSlate();
  }, []);

  async function fetchCurrentSlate() {
    try {
      const res = await fetch('/api/admin/fixtures');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.count === 'number') {
          setCurrentLiveCount(data.count);
        }
      }
    } catch {
      // Check localStorage fallback
      try {
        const stored = localStorage.getItem('mshindi_uploaded_fixtures');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setCurrentLiveCount(parsed.length);
          }
        }
      } catch {}
    }
  }

  // Handle PDF / Text File Upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadedFileName(file.name);

    try {
      let extractedText = '';
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();

        // 1. Try server-side native zlib parser first
        try {
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          const resp = await fetch('/api/admin/parse-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64 }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.text) {
              extractedText = data.text;
            }
          }
        } catch {
          // Server endpoint unavailable, fallback to client decompression
        }

        // 2. Client-side native DecompressionStream fallback
        if (!extractedText.trim()) {
          extractedText = await extractTextFromPdfBuffer(arrayBuffer);
        }
      } else {
        extractedText = await file.text();
      }

      if (!extractedText.trim()) {
        showToast({
          type: 'error',
          title: 'Empty Document',
          message: 'Could not extract text stream from this file. You can paste the fixture table directly below.',
        });
        setIsProcessing(false);
        setShowRawTextInput(true);
        return;
      }

      setRawTextInput(extractedText);
      const result = parseFixturesText(extractedText);

      if (result.fixtures.length === 0) {
        showToast({
          type: 'warning',
          title: 'No Matches Parsed',
          message: 'No fixture rows matching the odds format were detected. Review the raw text below.',
        });
        setShowRawTextInput(true);
      } else {
        setParseResult(result);
        showToast({
          type: 'success',
          title: 'PDF Extracted Successfully',
          message: `Parsed ${result.fixtures.length} fixtures across ${Object.keys(result.sectoredLeagues).length} sectored leagues.`,
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Parsing Error',
        message: err?.message || 'Failed to parse file.',
      });
      setShowRawTextInput(true);
    } finally {
      setIsProcessing(false);
    }
  }

  // Handle Manual Text Parse
  function handleParseRawText() {
    if (!rawTextInput.trim()) {
      showToast({ type: 'warning', title: 'Input Required', message: 'Please enter fixture table text.' });
      return;
    }
    setIsProcessing(true);
    try {
      const result = parseFixturesText(rawTextInput);
      setParseResult(result);
      if (result.fixtures.length > 0) {
        showToast({
          type: 'success',
          title: 'Text Parsed',
          message: `Found ${result.fixtures.length} fixtures across ${Object.keys(result.sectoredLeagues).length} sectored leagues.`,
        });
      } else {
        showToast({
          type: 'warning',
          title: 'No Matches Found',
          message: 'Ensure your table has Home, Away, and decimal odds (e.g. 1.95 3.60 3.80).',
        });
      }
    } finally {
      setIsProcessing(false);
    }
  }

  // Load Sample Fixtures for Instant Testing
  function handleLoadSample() {
    setRawTextInput(SAMPLE_DEMO_FIXTURES);
    setUploadedFileName('official-sports-fixtures.pdf');
    const result = parseFixturesText(SAMPLE_DEMO_FIXTURES);
    setParseResult(result);
    showToast({
      type: 'info',
      title: 'Sample Slate Loaded',
      message: `Loaded 12 sample fixtures across England (EPL & Championship), Spain, Germany, and Italy.`,
    });
  }

  // Remove single row from preview
  function handleRemoveFixture(index: number) {
    if (!parseResult) return;
    const updatedFixtures = [...parseResult.fixtures];
    const updatedMarket = [...parseResult.marketFixtures];
    updatedFixtures.splice(index, 1);
    updatedMarket.splice(index, 1);

    // Recalculate sectored leagues
    const sectored: Record<string, { country: string; league: string; count: number }> = {};
    for (const r of updatedFixtures) {
      const key = `${r.country}__${r.competition}`;
      if (!sectored[key]) sectored[key] = { country: r.country, league: r.competition, count: 0 };
      sectored[key].count++;
    }

    setParseResult({
      ...parseResult,
      fixtures: updatedFixtures,
      marketFixtures: updatedMarket,
      sectoredLeagues: sectored,
    });
  }

  // Publish to Site Match Slate
  async function handlePublishToSlate() {
    if (!parseResult || parseResult.marketFixtures.length === 0) {
      showToast({ type: 'warning', title: 'No Fixtures', message: 'Parse a fixtures PDF before publishing.' });
      return;
    }

    setIsPublishing(true);

    try {
      // 1. Post to backend server endpoint
      const res = await fetch('/api/admin/fixtures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtures: parseResult.marketFixtures }),
      });

      // 2. Convert to client FreeMatch interface and hydrate reactive freeMatches store
      const converted: FreeMatch[] = parseResult.marketFixtures.map((m) => ({
        id: m.id,
        providerId: m.providerId,
        home: m.home,
        away: m.away,
        competition: m.competition,
        competitionId: m.competitionId,
        leagueCode: m.leagueCode,
        country: m.country,
        kickoff: m.kickoff,
        kickoffIso: m.kickoffIso,
        tier: 'blockbuster',
        blurb: `${m.home} face ${m.away} in ${m.competition}.`,
        syncedAt: m.syncedAt,
        status: m.status,
        homeOdds: m.homeOdds,
        drawOdds: m.drawOdds,
        awayOdds: m.awayOdds,
        homePct: m.homePct,
        drawPct: m.drawPct,
        awayPct: m.awayPct,
        bttsYesPct: m.bttsYesPct,
        over25Pct: m.over25Pct,
        bookmaker: m.bookmaker,
      }));

      setUploadedFreeMatches(converted);
      setCurrentLiveCount(converted.length);

      showToast({
        type: 'success',
        title: 'Fixtures Published to Site!',
        message: `Successfully published ${converted.length} fixtures to the Match Slate and Bet Builder.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Publish Failed',
        message: err?.message || 'Could not publish fixtures.',
      });
    } finally {
      setIsPublishing(false);
    }
  }

  // Clear Slate
  async function handleClearSlate() {
    if (!confirm('Are you sure you want to clear all fixtures currently displayed on the site?')) {
      return;
    }

    setIsClearing(true);
    try {
      await fetch('/api/admin/fixtures', { method: 'DELETE' });
      clearAllFreeMatches();
      setCurrentLiveCount(0);
      setParseResult(null);
      setRawTextInput('');
      setUploadedFileName(null);
      showToast({
        type: 'info',
        title: 'Slate Cleared',
        message: 'All fixtures removed from the site match slate.',
      });
    } catch {
      clearAllFreeMatches();
      setCurrentLiveCount(0);
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="space-y-6 text-slate-900 animate-fade-in max-w-5xl mx-auto">
      {/* SECTION HEADER & TELEMETRY BADGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E5EA]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#E8F5EE] text-[#006C54]">
              <FileText size={18} />
            </span>
            <h3 className="font-semibold text-lg text-slate-900 tracking-tight">
              Fixture Slate &amp; PDF Parser
            </h3>
            <span className="bg-[#E8F5EE] text-[#006C54] text-[10.5px] uppercase font-bold px-2.5 py-0.5 rounded-full">
              Automated Categorizer
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Upload official PDF fixture sheets with odds. Fixtures are parsed and sectored into their rightful leagues (e.g. England Premier League, Championship, etc.) with Match ID ignored.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white border border-[#E5E5EA] px-3 py-1.5 rounded-xl shadow-2xs text-left">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Active Site Slate</div>
            <div className="text-sm font-mono font-bold text-[#006C54] flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${currentLiveCount > 0 ? 'bg-[#006C54] animate-pulse' : 'bg-slate-300'}`} />
              {currentLiveCount} {currentLiveCount === 1 ? 'Fixture' : 'Fixtures'} Live
            </div>
          </div>

          {currentLiveCount > 0 && (
            <button
              type="button"
              onClick={handleClearSlate}
              disabled={isClearing}
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-200"
              title="Clear all live fixtures from the site"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Clear Slate</span>
            </button>
          )}
        </div>
      </div>

      {/* UPLOAD PDF CARD */}
      <div className="bg-white border border-[#E5E5EA] rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UploadCloud size={18} className="text-[#006C54]" />
            <h4 className="font-semibold text-sm text-slate-900 tracking-tight">
              Upload Fixtures Document
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSample}
              className="text-xs font-semibold text-[#006C54] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles size={13} />
              <span>Load Demo Slate</span>
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => setShowRawTextInput((p) => !p)}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {showRawTextInput ? 'Hide Text Area' : 'Paste Table Directly'}
            </button>
          </div>
        </div>

        {/* Drag & Drop File Zone */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.csv"
          onChange={handleFileUpload}
          className="hidden"
          id="admin-fixture-pdf-upload"
        />

        <label
          htmlFor="admin-fixture-pdf-upload"
          className="border-2 border-dashed border-[#DCDCC8] hover:border-[#006C54] rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-colors bg-[#FFFFF0]/50 hover:bg-[#E8F5EE]/20 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-white border border-[#E5E5EA] flex items-center justify-center text-[#006C54] shadow-2xs group-hover:scale-105 transition-transform">
            {isProcessing ? (
              <RefreshCw size={24} className="animate-spin text-[#006C54]" />
            ) : (
              <UploadCloud size={24} />
            )}
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">
              {uploadedFileName ? (
                <span className="text-[#006C54] font-bold">{uploadedFileName}</span>
              ) : (
                'Choose Fixtures PDF or drag and drop'
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Supports official sportsbook fixture lists containing Match ID, Kickoff Date, Teams, 1X2, Double Chance, Over/Under 2.5, and BTTS odds.
            </p>
          </div>

          <span className="px-4 py-1.5 rounded-xl bg-[#006C54] text-white font-semibold text-xs shadow-xs group-hover:bg-[#005441] transition-colors">
            {isProcessing ? 'Decompressing & Parsing PDF...' : 'Select PDF File'}
          </span>
        </label>

        {/* Raw Text Fallback Drawer */}
        {showRawTextInput && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Raw Table / Clipboard Text
              </label>
              <span className="text-[11px] text-slate-400">
                Paste tabular lines or section headers (e.g. ENGLAND: Premier League)
              </span>
            </div>
            <textarea
              rows={6}
              value={rawTextInput}
              onChange={(e) => setRawTextInput(e.target.value)}
              placeholder={`ENGLAND: Premier League\n5821 2026-10-24 14:30 Arsenal vs Chelsea 1.95 3.60 3.80 1.25 1.28 1.80 1.75 2.05 1.70 2.10\n\nENGLAND: Championship\n5901 2026-10-24 15:00 Leeds United vs Sunderland 1.80 3.50 4.20 1.20 1.28 1.95 1.90 1.90 1.85 1.95`}
              className="w-full font-mono text-xs p-3 bg-white border border-[#E5E5EA] rounded-xl focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54]"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleParseRawText}
                disabled={isProcessing || !rawTextInput.trim()}
                className="px-4 py-2 rounded-xl bg-[#006C54] hover:bg-[#005441] text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Parse Text Input
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const clipText = await navigator.clipboard.readText();
                    if (clipText.trim()) {
                      setRawTextInput(clipText);
                      const result = parseFixturesText(clipText);
                      setParseResult(result);
                      showToast({
                        type: 'success',
                        title: 'Pasted from Clipboard',
                        message: `Parsed ${result.fixtures.length} fixtures from clipboard text.`,
                      });
                    }
                  } catch {
                    showToast({
                      type: 'warning',
                      title: 'Clipboard Permission',
                      message: 'Please paste directly into the box using Ctrl+V.',
                    });
                  }
                }}
                className="px-3 py-2 rounded-xl border border-[#E5E5EA] bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Paste from Clipboard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PARSED RESULTS SUMMARY & SECTORED LEAGUES */}
      {parseResult && parseResult.fixtures.length > 0 && (
        <div className="space-y-6">
          {/* SECTORED LEAGUES OVERVIEW */}
          <div className="bg-white border border-[#E5E5EA] rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-[#006C54]" />
                <h4 className="font-semibold text-sm text-slate-900 tracking-tight">
                  Detected Sectored Leagues ({Object.keys(parseResult.sectoredLeagues).length})
                </h4>
              </div>
              <span className="text-xs font-bold text-[#006C54] bg-[#E8F5EE] px-2.5 py-0.5 rounded-full font-mono">
                {parseResult.fixtures.length} Total Fixtures
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
              {Object.entries(parseResult.sectoredLeagues).map(([key, item]) => (
                <div
                  key={key}
                  className="bg-[#FFFFF0] border border-[#E5E5EA] rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <div className="font-bold text-slate-900 truncate">{item.league}</div>
                    <div className="text-[11px] text-slate-500">{item.country}</div>
                  </div>
                  <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[#006C54] shrink-0">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* PARSED FIXTURES PREVIEW TABLE */}
          <div className="bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 border-b border-[#E5E5EA] bg-[#FBFBF0] flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-xs sm:text-sm text-slate-900 tracking-tight">
                  Parsed Slate Verification Table
                </h4>
                <p className="text-[11px] text-slate-500">
                  Match IDs are ignored as instructed. Verify kickoff and odds matrices before publishing.
                </p>
              </div>

              <button
                type="button"
                onClick={handlePublishToSlate}
                disabled={isPublishing}
                className="px-4 py-2 rounded-xl bg-[#006C54] hover:bg-[#005441] text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isPublishing ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                <span>Publish to Site Match Slate</span>
              </button>
            </div>

            <div className="overflow-x-auto max-h-[380px] overflow-y-auto divide-y divide-slate-100 text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F5F5F7] text-slate-600 font-semibold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Kickoff (EAT)</th>
                    <th className="py-2.5 px-3">Country &amp; League</th>
                    <th className="py-2.5 px-3">Home vs Away</th>
                    <th className="py-2.5 px-3 text-center">1X2 Odds</th>
                    <th className="py-2.5 px-3 text-center">DC (1X/X2)</th>
                    <th className="py-2.5 px-3 text-center">O/U 2.5</th>
                    <th className="py-2.5 px-3 text-center">BTTS</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {parseResult.fixtures.map((f, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {f.kickoffDisplay}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{f.competition}</div>
                        <div className="text-[10px] text-slate-500">{f.country}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-900">
                        <span>{f.homeTeam}</span>
                        <span className="text-slate-400 mx-1.5 font-normal">vs</span>
                        <span>{f.awayTeam}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold mr-1">
                          {f.odds.homeOdds.toFixed(2)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold mr-1">
                          {f.odds.drawOdds.toFixed(2)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">
                          {f.odds.awayOdds.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {f.odds.doubleChance1X?.toFixed(2)} / {f.odds.doubleChanceX2?.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        O: {f.odds.over25Odds?.toFixed(2)} / U: {f.odds.under25Odds?.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {f.odds.bttsYesOdds?.toFixed(2)} / {f.odds.bttsNoOdds?.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveFixture(idx)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove match"
                        >
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-[#FBFBF0] border-t border-[#E5E5EA] flex items-center justify-between flex-wrap gap-3">
              <span className="text-xs text-slate-500">
                Matches are automatically mapped to the existing Country &amp; League Directory.
              </span>
              <button
                type="button"
                onClick={handlePublishToSlate}
                disabled={isPublishing}
                className="px-5 py-2.5 rounded-xl bg-[#006C54] hover:bg-[#005441] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isPublishing ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                <span>Publish All {parseResult.fixtures.length} Fixtures to Match Slate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
