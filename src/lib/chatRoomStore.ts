import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MOCK_GAMBLERS } from './mockData';

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
];

/**
 * Returns a stable pool of 5 to 8 mock users assigned to a room based on room ID hash.
 */
export function getRoomMockParticipants(roomId: string): ChatUser[] {
  let hash = 0;
  for (let i = 0; i < roomId.length; i++) {
    hash = (hash << 5) - hash + roomId.charCodeAt(i);
    hash |= 0;
  }
  const count = 5 + (Math.abs(hash) % 4); // 5 to 8 users
  const startIndex = Math.abs(hash) % PLATFORM_MOCK_USERS.length;
  const pool: ChatUser[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (startIndex + i) % PLATFORM_MOCK_USERS.length;
    pool.push(PLATFORM_MOCK_USERS[idx]);
  }
  return pool;
}

interface ChatRoomState {
  // Admin-assigned fixtures where live chat room is explicitly enabled
  enabledMatchIds: string[];
  // Messages stored per room
  messagesByRoom: Record<string, ChatMessage[]>;
  
  // Actions
  isChatRoomEnabled: (matchId: string) => boolean;
  enableChatRoom: (matchId: string) => void;
  disableChatRoom: (matchId: string) => void;
  toggleChatRoom: (matchId: string) => boolean;
  addMessage: (roomId: string, message: ChatMessage) => void;
  getRoomMessages: (roomId: string) => ChatMessage[];
  clearRoomMessages: (roomId: string) => void;
}

export const useChatRoomStore = create<ChatRoomState>()(
  persist(
    (set, get) => ({
      enabledMatchIds: [],
      messagesByRoom: {},

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

      addMessage: (roomId: string, message: ChatMessage) => {
        set((state) => {
          const roomMsgs = state.messagesByRoom[roomId] || [];
          // Avoid duplicate message IDs
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
      }),
    }
  )
);
