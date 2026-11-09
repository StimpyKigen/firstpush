import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import LiveChatRoomOverlay from '../src/components/chat/LiveChatRoomOverlay';
import { useChatRoomStore } from '../src/lib/chatRoomStore';
import '../src/index.css';

const mockMatch = {
  id: 'test-fixture-1',
  providerId: 'test-fixture-1',
  home: 'Querétaro FC',
  away: 'Puebla',
  competition: 'Liga MX',
  kickoff: 'Sun, 15 Nov, 20:30 EAT',
  tier: 'blockbuster' as const,
  blurb: 'Free match prediction',
  syncedAt: new Date().toISOString(),
  status: 'pre' as const,
};

// Enable chatroom in store
useChatRoomStore.getState().enableChatRoom(mockMatch.id);

function TestApp() {
  const [isOpen, setIsOpen] = useState(false);
  const savedScrollRef = useRef(0);

  const handleOpenChat = () => {
    savedScrollRef.current = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    console.log('[test] OPEN CHAT savedScroll:', savedScrollRef.current);
    setIsOpen(true);
    window.scrollTo(0, 0);
  };

  const handleCloseChat = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    console.log('[test] CLOSE CHAT savedScroll:', savedScrollRef.current);
    setIsOpen(false);
    setTimeout(() => {
      console.log('[test] EXECUTING RESTORE TO:', savedScrollRef.current);
      window.scrollTo(0, savedScrollRef.current);
      console.log('[test] AFTER RESTORE scrollY:', window.scrollY);
    }, 300);
  };

  return (
    <>
      <div id="match-content" className={`p-4 bg-[#FFFDF0] ${isOpen ? 'hidden sm:block' : ''}`}>
        <div className="h-[2000px] border-4 border-dashed border-red-500 p-4">
          <h1 className="text-xl font-bold text-red-700">UNDERLYING PAGE BACKGROUND (RED BORDER)</h1>
          <p className="text-sm text-slate-700">If this red border or text is visible anywhere while chat is open, background leaked!</p>
          <button
            id="open-chat-btn"
            type="button"
            onClick={handleOpenChat}
            className="mt-64 px-4 py-2 bg-emerald-600 text-white rounded-lg cursor-pointer"
          >
            Open Chat Room
          </button>
        </div>
      </div>

      <LiveChatRoomOverlay
        isOpen={isOpen}
        onClose={handleCloseChat}
        match={mockMatch}
      />
    </>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<TestApp />);
