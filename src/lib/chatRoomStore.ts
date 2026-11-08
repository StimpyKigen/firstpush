import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatUser {
  id: string;
  name: string;
  colorSeed: number;
  avatarId?: string;
  isMock?: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  colorSeed: number;
  avatarId?: string;
  text: string;
  sentAt: number;
}

export interface TypingUser {
  id: string;
  name: string;
  colorSeed: number;
  avatarId?: string;
}

export const PLATFORM_MOCK_USERS: ChatUser[] = [
  { id: 'mock-1', name: 'NairobiNostradamus', colorSeed: 2, isMock: true },
  { id: 'mock-2', name: 'BankerOnly254', colorSeed: 5, isMock: true },
  { id: 'mock-3', name: 'SlipDoctorKE', colorSeed: 1, isMock: true },
  { id: 'mock-4', name: 'FormGuideFred', colorSeed: 6, isMock: true },
  { id: 'mock-5', name: 'MtaaAnalyst', colorSeed: 3, isMock: true },
  { id: 'mock-6', name: 'ChezaKamaWewe', colorSeed: 7, isMock: true },
  { id: 'mock-7', name: 'HustlerOdds', colorSeed: 4, isMock: true },
  { id: 'mock-8', name: 'KipchogePredictor', colorSeed: 8, isMock: true },
  { id: 'mock-9', name: 'MshindiPro', colorSeed: 14, isMock: true },
  { id: 'mock-10', name: 'Juma_Master', colorSeed: 18, isMock: true },
  { id: 'mock-11', name: 'Otieno_Tips', colorSeed: 25, isMock: true },
  { id: 'mock-12', name: 'MwangiPicks', colorSeed: 32, isMock: true },
  { id: 'mock-13', name: 'KiprotichPicks', colorSeed: 9, isMock: true },
  { id: 'mock-14', name: 'OddsMasterKE', colorSeed: 10, isMock: true },
  { id: 'mock-15', name: 'Kamau_Betting', colorSeed: 35, isMock: true },
  { id: 'mock-16', name: 'Achieng_Bets', colorSeed: 39, isMock: true },
  { id: 'mock-17', name: 'Wanjiku_Picks', colorSeed: 42, isMock: true },
  { id: 'mock-18', name: 'Kip_Punter', colorSeed: 21, isMock: true },
  { id: 'mock-19', name: 'Nairobi_King', colorSeed: 28, isMock: true },
  { id: 'mock-20', name: 'SureBetSniper', colorSeed: 47, isMock: true },
  { id: 'mock-21', name: 'CornerCountKE', colorSeed: 51, isMock: true },
  { id: 'mock-22', name: 'HalfTimeDraws', colorSeed: 56, isMock: true },
  { id: 'mock-23', name: 'GambaWise', colorSeed: 63, isMock: true },
  { id: 'mock-24', name: 'MatatuPunter', colorSeed: 67, isMock: true },
  { id: 'mock-25', name: 'BetikaGuru', colorSeed: 72, isMock: true },
  { id: 'mock-26', name: 'MegaJackpotHunter', colorSeed: 78, isMock: true },
  { id: 'mock-27', name: 'CleanSheetDan', colorSeed: 84, isMock: true },
  { id: 'mock-28', name: 'OverUnderSpecialist', colorSeed: 91, isMock: true },
  { id: 'mock-29', name: 'EldoretTips', colorSeed: 95, isMock: true },
  { id: 'mock-30', name: 'KisumuStrikers', colorSeed: 99, isMock: true },
];

/**
 * Returns a stable pool of 18 to 28 mock users assigned to a room based on room ID hash to emulate high traffic.
 */
export function getRoomMockParticipants(roomId: string): ChatUser[] {
  let hash = 0;
  for (let i = 0; i < roomId.length; i++) {
    hash = (hash << 5) - hash + roomId.charCodeAt(i);
    hash |= 0;
  }
  // 18 to 28 active mock users per room
  const count = 18 + (Math.abs(hash) % 11);
  const startIndex = Math.abs(hash) % PLATFORM_MOCK_USERS.length;
  const pool: ChatUser[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (startIndex + i) % PLATFORM_MOCK_USERS.length;
    pool.push(PLATFORM_MOCK_USERS[idx]);
  }
  return pool;
}

export const CHAT_COOLDOWN_SECONDS = 30;

interface ChatRoomState {
  // Admin-assigned fixtures where live chat room is explicitly enabled
  enabledMatchIds: string[];
  // Messages stored per room
  messagesByRoom: Record<string, ChatMessage[]>;
  // Cooldown deadline timestamp (epoch ms) per user
  userCooldowns: Record<string, number>;
  
  // Actions
  isChatRoomEnabled: (matchId: string) => boolean;
  enableChatRoom: (matchId: string) => void;
  disableChatRoom: (matchId: string) => void;
  toggleChatRoom: (matchId: string) => boolean;
  addMessage: (roomId: string, message: ChatMessage) => boolean;
  getRoomMessages: (roomId: string) => ChatMessage[];
  clearRoomMessages: (roomId: string) => void;

  // Cooldown actions
  getUserCooldownDeadline: (userId: string) => number;
  setUserCooldownDeadline: (userId: string, deadlineMs: number) => void;
  canUserSendMessage: (userId: string) => { allowed: boolean; remainingSeconds: number };
}

export const useChatRoomStore = create<ChatRoomState>()(
  persist(
    (set, get) => ({
      enabledMatchIds: [],
      messagesByRoom: {},
      userCooldowns: {},

      isChatRoomEnabled: (matchId: string) => {
        if (!matchId) return false;
        return get().enabledMatchIds.includes(matchId);
      },

      enableChatRoom: (matchId: string) => {
        if (!matchId) return;
        const current = get().enabledMatchIds;
        if (!current.includes(matchId)) {
          set({ enabledMatchIds: [...current, matchId] });
        }
      },

      disableChatRoom: (matchId: string) => {
        if (!matchId) return;
        set({
          enabledMatchIds: get().enabledMatchIds.filter((id) => id !== matchId),
        });
      },

      toggleChatRoom: (matchId: string) => {
        if (!matchId) return false;
        const current = get().enabledMatchIds;
        const isCurrentlyEnabled = current.includes(matchId);
        if (isCurrentlyEnabled) {
          set({ enabledMatchIds: current.filter((id) => id !== matchId) });
          return false;
        } else {
          set({ enabledMatchIds: [...current, matchId] });
          return true;
        }
      },

      getUserCooldownDeadline: (userId: string) => {
        if (!userId) return 0;
        return get().userCooldowns[userId] || 0;
      },

      setUserCooldownDeadline: (userId: string, deadlineMs: number) => {
        if (!userId) return;
        set((state) => ({
          userCooldowns: {
            ...state.userCooldowns,
            [userId]: deadlineMs,
          },
        }));
      },

      canUserSendMessage: (userId: string) => {
        if (!userId) return { allowed: true, remainingSeconds: 0 };
        const deadline = get().userCooldowns[userId] || 0;
        const now = Date.now();
        if (now >= deadline) {
          return { allowed: true, remainingSeconds: 0 };
        }
        const remainingSeconds = Math.max(0, Math.ceil((deadline - now) / 1000));
        return { allowed: remainingSeconds === 0, remainingSeconds };
      },

      addMessage: (roomId: string, message: ChatMessage) => {
        // Enforce cooldown if it is a message from a real user (text, sticker, or emoji)
        const isUserMessage = Boolean(message.userId && !message.userId.startsWith('mock-'));

        if (isUserMessage) {
          const { allowed } = get().canUserSendMessage(message.userId);
          if (!allowed) {
            return false;
          }
        }

        set((state) => {
          const roomMsgs = state.messagesByRoom[roomId] || [];
          if (roomMsgs.some((m) => m.id === message.id)) {
            return state;
          }
          return {
            messagesByRoom: {
              ...state.messagesByRoom,
              [roomId]: [...roomMsgs, message],
            },
          };
        });

        // Set fresh 30-second cooldown after successful message submission
        if (isUserMessage) {
          get().setUserCooldownDeadline(message.userId, Date.now() + CHAT_COOLDOWN_SECONDS * 1000);
        }

        return true;
      },

      getRoomMessages: (roomId: string) => {
        return get().messagesByRoom[roomId] || [];
      },

      clearRoomMessages: (roomId: string) => {
        set((state) => {
          const next = { ...state.messagesByRoom };
          delete next[roomId];
          return { messagesByRoom: next };
        });
      },
    }),
    {
      name: 'mshindi_chatroom_store_v1',
      partialize: (state) => ({
        enabledMatchIds: state.enabledMatchIds,
        messagesByRoom: state.messagesByRoom,
        userCooldowns: state.userCooldowns,
      }),
    }
  )
);
