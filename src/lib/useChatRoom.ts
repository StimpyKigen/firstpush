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
];

const INITIAL_CONVERSATIONS: Record<string, string[]> = {
  default: [
    'Lineups za leo zimetoka, tactical setup iko sharp.',
    'Hii match inaonekana kuwa na high tempo kutoka kickoff.',
    'Mimi niko na over 2.5 kwa multi-bet yangu.',
  ],
};

export function useChatRoom(roomId: string, isRoomOpen = true) {
  const currentUser = useCurrentUser();
  const roomMessages = useChatRoomStore((s) => s.messagesByRoom[roomId] || []);
  const addMessageToStore = useChatRoomStore((s) => s.addMessage);

  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Stable mock participants for this room
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
          sentAt: now - (seeds.length - i) * 180000, // 3-9 mins ago
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
    };
  }, [roomId]);

  // Helper to add typing user
  const setMockUserTyping = useCallback((user: ChatUser, durationMs = 2500) => {
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

    // Clear existing timer
    if (typingTimersRef.current.has(user.id)) {
      clearTimeout(typingTimersRef.current.get(user.id)!);
    }

    const timer = setTimeout(() => {
      setTypingUsers((prev) => prev.filter((u) => u.id !== user.id));
      typingTimersRef.current.delete(user.id);
    }, durationMs);

    typingTimersRef.current.set(user.id, timer);
  }, []);

  // When current user types, optionally trigger a mock user typing as well
  const notifyTyping = useCallback(() => {
    if (Math.random() > 0.45 && mockParticipants.length > 0) {
      const randomMock = mockParticipants[Math.floor(Math.random() * mockParticipants.length)];
      setMockUserTyping(randomMock, 2200);
    }
  }, [mockParticipants, setMockUserTyping]);

  // Send message handler
  const sendMessage = useCallback(
    (text: string) => {
      const cleanText = text.trim();
      if (!cleanText) return;

      const userId = currentUser ? (currentUser.phone || currentUser.username) : 'guest-punter';
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

      // Simulate a realistic mock reply after user sends a message!
      if (mockParticipants.length > 0) {
        const availableMocks = mockParticipants.filter((m) => m.id !== userId);
        const responder = availableMocks[Math.floor(Math.random() * availableMocks.length)];
        const replyText = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];

        // Start typing after 800ms
        const typingDelay = setTimeout(() => {
          setMockUserTyping(responder, 1800);
        }, 800);

        // Send reply after typing completes (approx 2.4s)
        const sendDelay = setTimeout(() => {
          // Immediately remove typing state for this user
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
        }, 2400);

        // Clean up on component unmount
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
    currentUserId: currentUser ? (currentUser.phone || currentUser.username) : 'guest-punter',
  };
}
