import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PickEditState {
  // Map of pickId -> edit count (max 2)
  editCounts: Record<string, number>;
  // Map of pickId -> set of usernames who liked
  likesMap: Record<string, string[]>;
  canEdit: (pickId: string) => boolean;
  incrementEdit: (pickId: string) => void;
  toggleLike: (pickId: string, username: string) => void;
}

export const usePickEdits = create<PickEditState>()(
  persist(
    (set, get) => ({
      editCounts: {},
      likesMap: {},
      canEdit: (pickId: string) => {
        const count = get().editCounts[pickId] || 0;
        return count < 2;
      },
      incrementEdit: (pickId: string) => {
        set((state) => ({
          editCounts: {
            ...state.editCounts,
            [pickId]: (state.editCounts[pickId] || 0) + 1,
          },
        }));
      },
      toggleLike: (pickId: string, username: string) => {
        set((state) => {
          const currentLikes = state.likesMap[pickId] || [];
          const hasLiked = currentLikes.includes(username);
          const updatedLikes = hasLiked
            ? currentLikes.filter((u) => u !== username)
            : [...currentLikes, username];
          return {
            likesMap: {
              ...state.likesMap,
              [pickId]: updatedLikes,
            },
          };
        });
      },
    }),
    { name: 'mshindi-pick-edits' }
  )
);
