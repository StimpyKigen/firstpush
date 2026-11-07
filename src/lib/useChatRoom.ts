import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  useChatRoomStore,
  getRoomMockParticipants,
  type ChatMessage,
  type TypingUser,
  type ChatUser,
} from './chatRoomStore';
import { useCurrentUser } from './authStore';

// ── PRE-MATCH (Scheduled / Not Yet Started) ───────────────────────────
// Strictly discussions about analysis, predictions, odds value, and convictions.
// NEVER mentions imaginary live scores or in-play events!
const PRE_MATCH_TRAFFIC_COMMENTS = [
  'Lineups za leo zimetoka, tactical setup iko sharp.',
  'Mimi niko na conviction kubwa na home win leo.',
  'Hii fixture odds za draw ziko na value poa sana.',
  'Nani mwingine ameweka double chance 1X kwa multi-bet?',
  'Picks za leo ziko na analysis safi, lets see kickoff.',
  'Head to head records zinapeana advantage kwa home team.',
  'Hapa ni kuamini slip mapema kabla odds zishuke.',
  'Mimi nilishika over 1.5 kwa banker slip yangu.',
  'Form guide inaonyesha away team wako na momentum nzuri.',
  'Clean sheet inawezekana sana kulingana na defense yao.',
  'Kiprotich naye alitabiri BTTS kwa hii fixture.',
  'Odd ya over 2.5 iko juu sana, inaweza kuwa trap au value.',
];

const PRE_MATCH_REPLIES = [
  'Hapo niko na wewe boss, form yao kwa home ground ni solid.',
  'Mimi nimeamua kuweka 1X double chance kukuwa safe.',
  'Banker pick bila stress, stats zao za recent games ziko wazi.',
  'Hiyo prediction iko on point, midfield yao iko fit leo.',
  'Kama kawa, hapa ni kuamini analysis na kutulia tu.',
  'Hii game away side defense iko shaky, wanaweza admit goals.',
  'Picks za leo ziko na conviction kali sana!',
  'Tuko pamoja kwa hio pick bro, lets lock it in!',
];

const PRE_MATCH_INITIAL = [
  'Lineups za leo zimetoka, tactical setup iko sharp.',
  'Hii fixture inaonekana kuwa na value kubwa sana kwenye odds.',
  'Mimi niko na over 1.5 kwa banker slip yangu.',
  'Nani mwingine anaback home win kwa hii game?',
];

// ── LIVE MATCH (In-Play) ──────────────────────────────────────────────
// General flow, momentum, and game atmosphere. NEVER declares false scores!
const LIVE_TRAFFIC_COMMENTS = [
  'High tempo game, kila mtu ashikilie slip yake.',
  'Midfield battle iko tight sana pande zote mbili.',
  'Pace ya hii game iko juu sana.',
  'Tactical adjustments zitakuwa key hapa.',
  'Game inaendelea kuwa nzuri sana kuwatch.',
  'Tuko pamoja kwa hizi picks, let\'s stay focused.',
  'Hii fixture defense ya wote iko committed kabisa.',
  'Hapa ni kuangalia stats za live match kwa makini.',
];

const LIVE_REPLIES = [
  'True analysis bro, hii game iko na intensity ya hali ya juu.',
  'Kila mtu asimame imara na slip zake, 90 mins ni nyingi.',
  'Momentum inabadilika haraka sana, game iko open.',
  'Good observation boss, lets see how it unfolds.',
  'Tunaomba slips zetu zihold up vizuri mpaka mwisho.',
];

const LIVE_INITIAL = [
  'Game inaendelea na high intensity pande zote.',
  'Tactical battle nzuri sana, kila mtu awe macho na slips.',
  'Live odds zinabadilika kulingana na match tempo.',
];

// ── FINISHED MATCH (Full Time) ────────────────────────────────────────
const FINISHED_TRAFFIC_COMMENTS = [
  'Game imeisha, slip ilishika poa kabisa!',
  'Hiyo ilikuwa tough match pande zote mbili.',
  'Analysis ya leo ilikuwa on point kwa hii fixture.',
  'Wacha tujiandae kwa game inayofuata kwenye slate.',
  'Good match overall, let\'s review our final consensus.',
];

const FINISHED_REPLIES = [
  'Kabisa boss, hio prediction ililipa safi sana.',
  'Tough result lakini consensus ilikuwa close.',
  'Slips za leo zimetembea vizuri, on to the next one!',
];

const FINISHED_INITIAL = [
  'Full time result is locked in.',
  'Great discussion and analysis on this fixture today.',
  'Let\'s prepare for the upcoming matches on the slate.',
];

export function useChatRoom(roomId: string, isRoomOpen = true, matchStatus: string = 'pre') {
  const currentUser = useCurrentUser();
  const roomMessages = useChatRoomStore((s) => s.messagesByRoom[roomId] || []);
  const addMessageToStore = useChatRoomStore((s) => s.addMessage);

  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const backgroundTrafficIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stable mock participants for this room (18-28 active users)
  const mockParticipants = useMemo(() => getRoomMockParticipants(roomId), [roomId]);

  // Active users count: mock pool count + 1 if current user has joined/viewed
  const activeUsersCount = useMemo(() => {
    const baseCount = mockParticipants.length;
    return isRoomOpen ? baseCount + 1 : baseCount;
  }, [mockParticipants.length, isRoomOpen]);

  // Determine conversation category based on match lifecycle
  const isLive = matchStatus === 'in' || matchStatus === 'awaiting_confirmation';
  const isFinished = matchStatus === 'post' || matchStatus === 'finished';

  const trafficComments = isLive
    ? LIVE_TRAFFIC_COMMENTS
    : isFinished
    ? FINISHED_TRAFFIC_COMMENTS
    : PRE_MATCH_TRAFFIC_COMMENTS;

  const mockReplies = isLive
    ? LIVE_REPLIES
    : isFinished
    ? FINISHED_REPLIES
    : PRE_MATCH_REPLIES;

  const initialSeeds = isLive
    ? LIVE_INITIAL
    : isFinished
    ? FINISHED_INITIAL
    : PRE_MATCH_INITIAL;

  // Seed initial room messages if empty
  useEffect(() => {
    if (roomMessages.length === 0 && mockParticipants.length >= 3) {
      const seeds = initialSeeds;
      const now = Date.now();
      seeds.forEach((text, i) => {
        const participant = mockParticipants[i % mockParticipants.length];
        const seedMsg: ChatMessage = {
          id: `seed-${roomId}-${i}`,
          roomId,
          userId: participant.id,
          userName: participant.name,
          colorSeed: participant.colorSeed,
          avatarId: participant.avatarId,
          text,
          sentAt: now - (seeds.length - i) * 120000,
        };
        addMessageToStore(roomId, seedMsg);
      });
    }
  }, [roomId, roomMessages.length, mockParticipants, addMessageToStore, initialSeeds]);

  // Cleanup all typing timers on unmount
  useEffect(() => {
    return () => {
      typingTimersRef.current.forEach((t) => clearTimeout(t));
      typingTimersRef.current.clear();
      if (backgroundTrafficIntervalRef.current) {
        clearInterval(backgroundTrafficIntervalRef.current);
        backgroundTrafficIntervalRef.current = null;
      }
    };
  }, [roomId]);

  // Helper to add typing user
  const setMockUserTyping = useCallback((user: ChatUser, durationMs = 2200) => {
    const typingUser: TypingUser = {
      id: user.id,
      name: user.name,
      colorSeed: user.colorSeed,
      avatarId: user.avatarId,
    };

    setTypingUsers((prev) => {
      if (prev.some((u) => u.id === user.id)) return prev;
      return [...prev, typingUser];
    });

    if (typingTimersRef.current.has(user.id)) {
      clearTimeout(typingTimersRef.current.get(user.id)!);
    }

    const timer = setTimeout(() => {
      setTypingUsers((prev) => prev.filter((u) => u.id !== user.id));
      typingTimersRef.current.delete(user.id);
    }, durationMs);

    typingTimersRef.current.set(user.id, timer);
  }, []);

  // Background High-Traffic Simulator: periodic comments while room is open
  useEffect(() => {
    if (!isRoomOpen || mockParticipants.length === 0) {
      if (backgroundTrafficIntervalRef.current) {
        clearInterval(backgroundTrafficIntervalRef.current);
        backgroundTrafficIntervalRef.current = null;
      }
      return;
    }

    // Interval to emulate active room comments without inventing scores
    const interval = setInterval(() => {
      const randomParticipant =
        mockParticipants[Math.floor(Math.random() * mockParticipants.length)];
      const randomComment =
        trafficComments[Math.floor(Math.random() * trafficComments.length)];

      // Briefly show typing
      setMockUserTyping(randomParticipant, 1400);

      // Post comment after typing
      const postTimer = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.id !== randomParticipant.id));
        const trafficMsg: ChatMessage = {
          id: `traffic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          roomId,
          userId: randomParticipant.id,
          userName: randomParticipant.name,
          colorSeed: randomParticipant.colorSeed,
          avatarId: randomParticipant.avatarId,
          text: randomComment,
          sentAt: Date.now(),
        };
        addMessageToStore(roomId, trafficMsg);
      }, 1400);

      typingTimersRef.current.set(`traffic-post-${Date.now()}`, postTimer);
    }, 9500);

    backgroundTrafficIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      backgroundTrafficIntervalRef.current = null;
    };
  }, [isRoomOpen, roomId, mockParticipants, addMessageToStore, setMockUserTyping, trafficComments]);

  // When current user types, trigger a mock user typing as well
  const notifyTyping = useCallback(() => {
    if (Math.random() > 0.35 && mockParticipants.length > 0) {
      const randomMock =
        mockParticipants[Math.floor(Math.random() * mockParticipants.length)];
      setMockUserTyping(randomMock, 2200);
    }
  }, [mockParticipants, setMockUserTyping]);

  // Send message handler
  const sendMessage = useCallback(
    (text: string) => {
      const cleanText = text.trim();
      if (!cleanText) return;

      const userId = currentUser ? currentUser.phone || currentUser.username : 'guest-punter';
      const userName = currentUser ? currentUser.username : 'Guest Punter';
      const colorSeed = currentUser ? currentUser.username.length * 7 : 3;

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        roomId,
        userId,
        userName,
        colorSeed,
        avatarId: currentUser?.avatarId,
        text: cleanText,
        sentAt: Date.now(),
      };

      addMessageToStore(roomId, userMsg);

      // Simulate a realistic mock reply matching the match lifecycle
      if (mockParticipants.length > 0) {
        const availableMocks = mockParticipants.filter((m) => m.id !== userId);
        const responder =
          availableMocks[Math.floor(Math.random() * availableMocks.length)];
        const replyText =
          mockReplies[Math.floor(Math.random() * mockReplies.length)];

        // Start typing after 600ms
        const typingDelay = setTimeout(() => {
          setMockUserTyping(responder, 1600);
        }, 600);

        // Send reply after typing completes (approx 2.2s)
        const sendDelay = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.id !== responder.id));
          if (typingTimersRef.current.has(responder.id)) {
            clearTimeout(typingTimersRef.current.get(responder.id)!);
            typingTimersRef.current.delete(responder.id);
          }

          const mockMsg: ChatMessage = {
            id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            roomId,
            userId: responder.id,
            userName: responder.name,
            colorSeed: responder.colorSeed,
            avatarId: responder.avatarId,
            text: replyText,
            sentAt: Date.now(),
          };

          addMessageToStore(roomId, mockMsg);
        }, 2200);

        typingTimersRef.current.set(`reply-type-${Date.now()}`, typingDelay);
        typingTimersRef.current.set(`reply-send-${Date.now()}`, sendDelay);
      }
    },
    [currentUser, roomId, mockParticipants, addMessageToStore, setMockUserTyping, mockReplies]
  );

  return {
    messages: roomMessages,
    typingUsers,
    activeUsersCount,
    sendMessage,
    notifyTyping,
    currentUserId: currentUser ? currentUser.phone || currentUser.username : 'guest-punter',
  };
}
