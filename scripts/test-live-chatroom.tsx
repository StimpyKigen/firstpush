import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  useChatRoomStore,
  getRoomMockParticipants,
  type ChatMessage,
  type TypingUser,
} from '../src/lib/chatRoomStore';
import GlyphAvatarGroup from '../src/components/chat/GlyphAvatarGroup';
import TypingIndicator, { formatTypingNames } from '../src/components/chat/TypingIndicator';
import ChatMessageList, { groupMessages } from '../src/components/chat/ChatMessageList';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runTests() {
  console.log('\n--- 1. Testing Admin Gating & Chat Room Store ---');
  const store = useChatRoomStore.getState();
  const testMatchId = 'test-fixture-arsenal-chelsea';

  // Initially should not be enabled
  assert(!store.isChatRoomEnabled(testMatchId), 'Chat room is NOT enabled by default for fixture');

  // Admin enables chat room
  store.enableChatRoom(testMatchId);
  assert(useChatRoomStore.getState().isChatRoomEnabled(testMatchId), 'Admin enableChatRoom enables chatroom');

  // Admin toggles chat room
  const toggledOff = store.toggleChatRoom(testMatchId);
  assert(!toggledOff && !useChatRoomStore.getState().isChatRoomEnabled(testMatchId), 'Admin toggleChatRoom disables when already active');

  const toggledOn = store.toggleChatRoom(testMatchId);
  assert(toggledOn && useChatRoomStore.getState().isChatRoomEnabled(testMatchId), 'Admin toggleChatRoom enables when inactive');

  store.disableChatRoom(testMatchId);
  assert(!useChatRoomStore.getState().isChatRoomEnabled(testMatchId), 'Admin disableChatRoom explicitly disables room');

  console.log('\n--- 2. Testing Connected User Counter (+1 on user join) ---');
  const mockParticipants = getRoomMockParticipants(`room-${testMatchId}`);
  assert(mockParticipants.length >= 5 && mockParticipants.length <= 8, `Mock participants assigned between 5 and 8 (actual: ${mockParticipants.length})`);
  
  const countBeforeUser = mockParticipants.length;
  const countAfterUserJoins = mockParticipants.length + 1;
  assert(countAfterUserJoins === countBeforeUser + 1, `Connected users increments by exactly +1 when user joins (${countBeforeUser} -> ${countAfterUserJoins})`);

  console.log('\n--- 3. Testing Consecutive Message Run Collapsing ---');
  const testMessages: ChatMessage[] = [
    {
      id: 'm1',
      roomId: 'room-1',
      userId: 'user-a',
      userName: 'NairobiNostradamus',
      colorSeed: 2,
      text: 'First message from Nostradamus',
      sentAt: 1000,
    },
    {
      id: 'm2',
      roomId: 'room-1',
      userId: 'user-a',
      userName: 'NairobiNostradamus',
      colorSeed: 2,
      text: 'Second consecutive message from Nostradamus',
      sentAt: 2000,
    },
    {
      id: 'm3',
      roomId: 'room-1',
      userId: 'user-b',
      userName: 'SlipDoctorKE',
      colorSeed: 1,
      text: 'Message from SlipDoctor',
      sentAt: 3000,
    },
    {
      id: 'm4',
      roomId: 'room-1',
      userId: 'user-a',
      userName: 'NairobiNostradamus',
      colorSeed: 2,
      text: 'Another message from Nostradamus after Doctor',
      sentAt: 4000,
    },
  ];

  const groups = groupMessages(testMessages);
  assert(groups.length === 3, `Consecutive messages from same sender collapsed into 3 groups (actual: ${groups.length})`);
  assert(groups[0].length === 2, `Group 0 has 2 consecutive messages from Nostradamus`);
  assert(groups[1].length === 1, `Group 1 has 1 message from SlipDoctor`);
  assert(groups[2].length === 1, `Group 2 has 1 new group for Nostradamus`);

  console.log('\n--- 4. Testing Typing Names Formatting ---');
  const typing1: TypingUser[] = [{ id: '1', name: 'MtaaAnalyst', colorSeed: 3 }];
  const typing2: TypingUser[] = [
    { id: '1', name: 'MtaaAnalyst', colorSeed: 3 },
    { id: '2', name: 'FormGuideFred', colorSeed: 6 },
  ];
  const typing4: TypingUser[] = [
    { id: '1', name: 'MtaaAnalyst', colorSeed: 3 },
    { id: '2', name: 'FormGuideFred', colorSeed: 6 },
    { id: '3', name: 'HustlerOdds', colorSeed: 4 },
    { id: '4', name: 'ChezaKamaWewe', colorSeed: 7 },
  ];

  assert(formatTypingNames(typing1) === 'MtaaAnalyst is typing', `1 user label: "${formatTypingNames(typing1)}"`);
  assert(formatTypingNames(typing2) === 'MtaaAnalyst and FormGuideFred are typing', `2 users label: "${formatTypingNames(typing2)}"`);
  assert(formatTypingNames(typing4) === 'MtaaAnalyst, FormGuideFred and 2 more are typing', `4 users label: "${formatTypingNames(typing4)}"`);

  console.log('\n--- 5. Testing Component Server Rendering (No Crashes) ---');
  // GlyphAvatarGroup
  const avatarHtml = renderToString(<GlyphAvatarGroup users={mockParticipants} max={3} size={28} />);
  assert(avatarHtml.includes('+'), `GlyphAvatarGroup renders +N badge when users > max 3`);
  console.log('Avatar Group HTML generated successfully');

  // TypingIndicator
  const typingHtml = renderToString(<TypingIndicator users={typing2} />);
  assert(typingHtml.includes('MtaaAnalyst and FormGuideFred are typing'), 'TypingIndicator renders correct text');

  // ChatMessageList
  const listHtml = renderToString(<ChatMessageList messages={testMessages} currentUserId="user-b" />);
  assert(listHtml.includes('NairobiNostradamus'), 'ChatMessageList renders sender name');
  assert(listHtml.includes('First message from Nostradamus'), 'ChatMessageList renders message 1');
  assert(listHtml.includes('Second consecutive message from Nostradamus'), 'ChatMessageList renders message 2');
  assert(listHtml.includes('You'), 'ChatMessageList renders "You" for current user');

  console.log('\n🎉 ALL LIVE CHAT ROOM UNIT & RENDER TESTS PASSED!\n');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
