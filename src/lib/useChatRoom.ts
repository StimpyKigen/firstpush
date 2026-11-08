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
  const currentUserId = currentUser ? currentUser.phone || currentUser.username : 'guest-punter';
  const roomMessages = useChatRoomStore((s) => s.messagesByRoom[roomId] || []);
  const addMessageToStore = useChatRoomStore((s) => s.addMessage);

  const [cooldownRemaining, setCooldownRemaining] = useState<number>(() => {
    return useChatRoomStore.getState().canUserSendMessage(currentUserId).remainingSeconds;
  });

  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const backgroundTrafficIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track wall-clock cooldown deadline reliably across visibility/focus/backgrounding
  useEffect(() => {
    const syncCooldown = () => {
      const { remainingSeconds } = useChatRoomStore.getState().canUserSendMessage(currentUserId);
      setCooldownRemaining(remainingSeconds);
    };

    syncCooldown();
    const interval = setInterval(syncCooldown, 250);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncCooldown();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', syncCooldown);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', syncCooldown);
      }
    };
  }, [currentUserId]);

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

  // Helper to add a typing user with an expiration timer
  const setMockUserTyping = useCallback((user: ChatUser, durationMs = 3200) => {
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

    const timerKey = `timer-${user.id}`;
    if (typingTimersRef.current.has(timerKey)) {
      clearTimeout(typingTimersRef.current.get(timerKey)!);
    }

    const timer = setTimeout(() => {
      setTypingUsers((prev) => prev.filter((u) => u.id !== user.id));
      typingTimersRef.current.delete(timerKey);
    }, durationMs);

    typingTimersRef.current.set(timerKey, timer);
  }, []);

  // Helper to trigger multiple mock users typing (stacking avatars)
  const setMultipleMockUsersTyping = useCallback(
    (users: ChatUser[], baseDuration = 3200) => {
      users.forEach((u, idx) => {
        const staggerDelay = idx * 250;
        const staggerTimer = setTimeout(() => {
          setMockUserTyping(u, baseDuration - staggerDelay + Math.random() * 600);
        }, staggerDelay);
        typingTimersRef.current.set(`stagger-${u.id}-${Date.now()}`, staggerTimer);
      });
    },
    [setMockUserTyping]
  );

  // Background High-Traffic Simulator: periodic comments & consistent typing presence
  useEffect(() => {
    if (!isRoomOpen || mockParticipants.length === 0) {
      if (backgroundTrafficIntervalRef.current) {
        clearInterval(backgroundTrafficIntervalRef.current);
        backgroundTrafficIntervalRef.current = null;
      }
      return;
    }

    // Interval to emulate active room comments and concurrent typing without inventing scores
    const interval = setInterval(() => {
      // Pick primary commenter and 1-2 co-typers for stacking avatars
      const shuffled = [...mockParticipants].sort(() => 0.5 - Math.random());
      const typingCount = Math.min(shuffled.length, Math.random() > 0.4 ? 2 : 3);
      const activeTypers = shuffled.slice(0, typingCount);
      const primaryPoster = activeTypers[0];
      const randomComment =
        trafficComments[Math.floor(Math.random() * trafficComments.length)];

      // Trigger concurrent typing with stacking avatars
      setMultipleMockUsersTyping(activeTypers, 3400);

      // Primary poster delivers the comment after typing
      const postTimer = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.id !== primaryPoster.id));
        const timerKey = `timer-${primaryPoster.id}`;
        if (typingTimersRef.current.has(timerKey)) {
          clearTimeout(typingTimersRef.current.get(timerKey)!);
          typingTimersRef.current.delete(timerKey);
        }

        const trafficMsg: ChatMessage = {
          id: `traffic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          roomId,
          userId: primaryPoster.id,
          userName: primaryPoster.name,
          colorSeed: primaryPoster.colorSeed,
          avatarId: primaryPoster.avatarId,
          text: randomComment,
          sentAt: Date.now(),
        };
        addMessageToStore(roomId, trafficMsg);
      }, 2400);

      typingTimersRef.current.set(`traffic-post-${Date.now()}`, postTimer);
    }, 6500);

    backgroundTrafficIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      backgroundTrafficIntervalRef.current = null;
    };
  }, [
    isRoomOpen,
    roomId,
    mockParticipants,
    addMessageToStore,
    setMultipleMockUsersTyping,
    trafficComments,
  ]);

  // When current user types, immediately trigger 2-3 mock users typing in response
  const notifyTyping = useCallback(() => {
    if (mockParticipants.length === 0) return;
    const shuffled = [...mockParticipants].sort(() => 0.5 - Math.random());
    const count = Math.min(shuffled.length, Math.random() > 0.35 ? 2 : 3);
    const responders = shuffled.slice(0, count);

    setMultipleMockUsersTyping(responders, 3600);
  }, [mockParticipants, setMultipleMockUsersTyping]);

  // Send message handler
  const sendMessage = useCallback(
    (text: string) => {
      const cleanText = text.trim();
      if (!cleanText) return false;

      const userId = currentUser ? currentUser.phone || currentUser.username : 'guest-punter';
      const userName = currentUser ? currentUser.username : 'Guest Punter';
      const colorSeed = currentUser ? currentUser.username.length * 7 : 3;

      const isSticker = cleanText.startsWith('[sticker:');
      if (!isSticker) {
        const { allowed, remainingSeconds } = useChatRoomStore.getState().canUserSendMessage(userId);
        if (!allowed) {
          setCooldownRemaining(remainingSeconds);
          return false;
        }
      }

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

      const added = addMessageToStore(roomId, userMsg);
      if (!added) return false;

      if (!isSticker) {
        setCooldownRemaining(30);
        if (typeof window !== 'undefined' && typeof fetch === 'function') {
          fetch('/api/sports/chat-cooldown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, isSticker: false }),
          }).catch(() => {
            // Non-blocking fire-and-forget fallback
          });
        }
      }

      // Simulate a realistic mock reply with multiple users typing in reaction
      if (mockParticipants.length > 0) {
        const availableMocks = mockParticipants.filter((m) => m.id !== userId);
        if (availableMocks.length > 0) {
          const shuffled = [...availableMocks].sort(() => 0.5 - Math.random());
          const responderCount = Math.min(availableMocks.length, Math.random() > 0.3 ? 2 : 3);
          const responders = shuffled.slice(0, responderCount);
          const primaryResponder = responders[0];
          const replyText =
            mockReplies[Math.floor(Math.random() * mockReplies.length)];

          // Trigger responders typing with stacking avatars
          setMultipleMockUsersTyping(responders, 3400);

          // Primary responder delivers the reply after typing
          const sendDelay = setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u.id !== primaryResponder.id));
            const timerKey = `timer-${primaryResponder.id}`;
            if (typingTimersRef.current.has(timerKey)) {
              clearTimeout(typingTimersRef.current.get(timerKey)!);
              typingTimersRef.current.delete(timerKey);
            }

            const mockMsg: ChatMessage = {
              id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              roomId,
              userId: primaryResponder.id,
              userName: primaryResponder.name,
              colorSeed: primaryResponder.colorSeed,
              avatarId: primaryResponder.avatarId,
              text: replyText,
              sentAt: Date.now(),
            };

            addMessageToStore(roomId, mockMsg);
          }, 2400);

          typingTimersRef.current.set(`reply-send-${Date.now()}`, sendDelay);
        }
      }

      return true;
    },
    [
      currentUser,
      roomId,
      mockParticipants,
      addMessageToStore,
      setMultipleMockUsersTyping,
      mockReplies,
    ]
  );

  return {
    messages: roomMessages,
    typingUsers,
    activeUsersCount,
    sendMessage,
    notifyTyping,
    currentUserId,
    cooldownRemaining,
  };
}
