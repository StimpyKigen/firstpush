import { useState, useSyncExternalStore } from 'react';
import { createAdminJackpotRoom, subscribeToJackpots, getJackpotsSnapshot } from './mockData';
import { showToast } from './notificationStore';
import type { Bookie } from './types';

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
  const activeResultRoom = publishedJackpots.find((j) => j.id === (selectedResultRoomId || publishedJackpots[0]?.id));

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
