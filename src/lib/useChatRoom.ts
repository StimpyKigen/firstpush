import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  useChatRoomStore,
  getRoomMockParticipants,
  type ChatMessage,
  type TypingUser,
  type ChatUser,
} from './chatRoomStore';
import { useCurrentUser } from './authStore';

const MOCK_REPLIES = [
  'Hapo niko na wewe boss, form yao leo iko locked.',
  'Hii game draw ni bait, away side watashinda.',
  'Banker bila stress! Wacha tuchukue mapema.',
  'Hiyo first half defensive play ilikuwa shaky, second half kutakuwa na goals.',
  'Hapa ni kuamini slip na kutulia tu.',
  'Over 1.5 tayari inaiva, tusiwe na haraka.',
  'Mimi nilishika 1X double chance mapema, so tuko safe kabisa.',
  'Momentum iko upande wao kabisa hii second half.',
  'Picks za leo ziko na conviction kali sana!',
  'True analysis bro, midfield yao iko on fire leo.',
  'Corner count pia inaenda juu sana leo.',
  'Kama kawaida, hii league haina easy fixtures.',
  'Subs za second half zitaamua game.',
];

const ONGOING_TRAFFIC_COMMENTS = [
  'Hii pressure ya away team ni moto sana leo!',
  'Ref anapeana easy cards, someone might see red soon.',
  'Kila mtu asimame imara na slip zake.',
  'Pace ya game iko juu sana!',
  'Winger wao anasumbua backline kila dakika.',
  'Odds za live market zinabadilika haraka sana.',
  'Over 2.5 banker bado iko hai kabisa.',
  'Tactical change imefanya midfield kuwa wazi.',
  'Shots on target zinaongezeka, goal inaninginia.',
  'Kipa wao leo ameamka poa sana, saves deadly!',
  'Hii match draw itakuwa surprise kubwa.',
  'Tumeingia second half na moto ile ile.',
];

const INITIAL_CONVERSATIONS: Record<string, string[]> = {
  default: [
    'Lineups za leo zimetoka, tactical setup iko sharp.',
    'Hii match inaonekana kuwa na high tempo kutoka kickoff.',
    'Mimi niko na over 2.5 kwa multi-bet yangu.',
    'Odds za home win ziko na value poa sana.',
  ],
};

export function useChatRoom(roomId: string, isRoomOpen = true) {
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

  // Seed initial room messages if empty
  useEffect(() => {
    if (roomMessages.length === 0 && mockParticipants.length >= 3) {
      const seeds = INITIAL_CONVERSATIONS.default;
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
          sentAt: now - (seeds.length - i) * 120000, // 2-8 mins ago
        };
        addMessageToStore(roomId, seedMsg);
      });
    }
  }, [roomId, roomMessages.length, mockParticipants, addMessageToStore]);

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

    // Interval to emulate active room comments
    const interval = setInterval(() => {
      const randomParticipant =
        mockParticipants[Math.floor(Math.random() * mockParticipants.length)];
      const randomComment =
        ONGOING_TRAFFIC_COMMENTS[
          Math.floor(Math.random() * ONGOING_TRAFFIC_COMMENTS.length)
        ];

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
    }, 8500); // every 8.5 seconds

    backgroundTrafficIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      backgroundTrafficIntervalRef.current = null;
    };
  }, [isRoomOpen, roomId, mockParticipants, addMessageToStore, setMockUserTyping]);

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

      // Simulate a realistic mock reply after user sends a message
      if (mockParticipants.length > 0) {
        const availableMocks = mockParticipants.filter((m) => m.id !== userId);
        const responder =
          availableMocks[Math.floor(Math.random() * availableMocks.length)];
        const replyText =
          MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];

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
    [currentUser, roomId, mockParticipants, addMessageToStore, setMockUserTyping]
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
