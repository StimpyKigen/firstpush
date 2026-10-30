import { useState, useSyncExternalStore } from 'react';
import { createAdminJackpotRoom, subscribeToJackpots, getJackpotsSnapshot } from './mockData';
import { showToast } from './notificationStore';
import { parseJackpotWebpageText } from './jackpotWebParser';
import type { Bookie } from './types';

export const KENYAN_BETTING_SITES = [
  'SportPesa',
  'Betika',
  'MozzartBet',
  'Odibets',
  'SportyBet',
  'BetPawa',
  '1xBet',
  '22Bet',
  'Shabiki',
  'BangBet',
  'PariPesa',
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

/** Drives the "Create & Publish New Jackpot Room" form: config, AI text parsing, and the match list editor. */
export function useJackpotAdminForm() {
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
  const activeResultRoom = selectedResultRoomId ? publishedJackpots.find((j) => j.id === selectedResultRoomId) : undefined;

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

  async function handleAiArrange() {
    if (!webpageText.trim()) {
      showToast({ title: 'Input Required', message: 'Please paste the webpage text first into the raw text box', type: 'error' });
      return;
    }

    setIsAiProcessing(true);
    setAiSuccessMessage('');

    try {
      let extracted: ExtractedMatch[] = [];

      try {
        const res = await fetch('/api/gemini/parse-jackpot-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': 'mshindi_admin_audit_key_2026',
          },
          body: JSON.stringify({
            rawText: webpageText,
            bookie: selectedBookie,
            legCount: numLegs,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.matches) && data.matches.length > 0) {
            extracted = data.matches.map((m: any, i: number) => ({
              home: m.home || `Team ${i + 1}A`,
              away: m.away || `Team ${i + 1}B`,
              competition: m.competition || 'Football League',
              kickoff: m.kickoff || formatDateTimeDisplay(startDateTime),
              homePct: Number(m.homePct) || 45,
              drawPct: Number(m.drawPct) || 30,
            }));
          }
        }
      } catch (networkErr) {
        console.warn('Server parse request failed, proceeding to deterministic local parser', networkErr);
      }

      // If server parser returned fewer matches than target, run high-precision local regex parser
      if (extracted.length < numLegs) {
        const localMatches = parseJackpotWebpageText(webpageText, numLegs, formatDateTimeDisplay(startDateTime));
        if (localMatches.length > extracted.length) {
          extracted = localMatches.map((m) => ({
            home: m.home,
            away: m.away,
            competition: m.competition,
            kickoff: m.kickoff,
            homePct: m.homePct,
            drawPct: m.drawPct,
          }));
        }
      }

      if (extracted.length > 0) {
        setMatches(extracted);
        setAiSuccessMessage(`✨ Web parser accurately arranged ${extracted.length} legs for ${selectedBookie}!`);
        showToast({
          title: 'Extraction Complete',
          message: `Categorized ${extracted.length} matches accurately from Leg 1 to Leg ${extracted.length}`,
          type: 'success',
        });
      } else {
        showToast({
          title: 'No Matches Detected',
          message: 'Could not auto-extract matches from the pasted text. Loaded editable sample slate.',
          type: 'warning',
        });
        generateSampleMatches(numLegs);
      }
    } catch (err: any) {
      console.error('AI Arrange error:', err);
      showToast({ title: 'Parser Notice', message: 'Could not parse text. Loaded sample slate.', type: 'error' });
      generateSampleMatches(numLegs);
    } finally {
      setIsAiProcessing(false);
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

  function handlePublishJackpot(onPublished: () => void) {
    if (!jackpotName.trim()) {
      showToast({ title: 'Title Required', message: 'Jackpot Room Display Title is compulsory. Please enter a title.', type: 'error' });
      return;
    }

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
      ? 'MozzartBet'
      : selectedBookie.includes('Odibets')
      ? 'Odibets'
      : selectedBookie.includes('Sporty')
      ? 'SportyBet'
      : selectedBookie.includes('Pawa')
      ? 'BetPawa'
      : selectedBookie.includes('1x')
      ? '1xBet'
      : selectedBookie.includes('22')
      ? '22Bet'
      : 'SportPesa';

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
      name: jackpotName.trim(),
      prizePool: prizePool,
      startTime: formattedStart,
      entryFee: 10,
      rawMatches,
    });

    showToast({ title: 'Jackpot Published', message: `Published ${created.name} (${matches.length} legs) successfully!`, type: 'success' });
    onPublished();
  }

  return {
    selectedBookie,
    setSelectedBookie,
    jackpotName,
    setJackpotName,
    numLegs,
    setNumLegs,
    prizePool,
    setPrizePool,
    startDateTime,
    setStartDateTime,
    webpageText,
    setWebpageText,
    isAiProcessing,
    aiSuccessMessage,
    matches,
    selectedResultRoomId,
    setSelectedResultRoomId,
    publishedJackpots,
    activeResultRoom,
    generateSampleMatches,
    handleAiArrange,
    handleUpdateMatch,
    handleAddMatch,
    handleRemoveMatch,
    handlePublishJackpot,
  };
}
