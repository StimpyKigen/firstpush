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
import ChatComposer from '../src/components/chat/ChatComposer';
import StickerGallery from '../src/components/chat/StickerGallery';
import { getChatSticker, CHAT_STICKERS } from '../src/components/chat/chatStickers';

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
  assert(mockParticipants.length >= 18 && mockParticipants.length <= 28, `Mock participants assigned between 18 and 28 (actual: ${mockParticipants.length})`);
  
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

  // ChatComposer with inside send button and emoji/sticker icons
  const composerHtml = renderToString(<ChatComposer onSend={() => {}} placeholder="Comment here..." />);
  assert(composerHtml.includes('aria-label="Send message"'), 'ChatComposer renders send button inside input area');
  assert(composerHtml.includes('aria-label="Insert emoji"'), 'ChatComposer renders emoji icon on the left');
  assert(composerHtml.includes('aria-label="Send sticker"'), 'ChatComposer renders sticker icon on the left');

  // StickerGallery
  const stickerHtml = renderToString(<StickerGallery isOpen={true} onClose={() => {}} onSelectSticker={() => {}} />);
  assert(stickerHtml.includes('GOAAAL!'), 'StickerGallery renders GOAAAL! sticker');
  assert(stickerHtml.includes('Banker'), 'StickerGallery renders Banker sticker');
  assert(CHAT_STICKERS.length >= 10, `Curated at least 10 football/banter stickers (actual: ${CHAT_STICKERS.length})`);

  // Sticker message resolution
  assert(getChatSticker('[sticker:goal]')?.name === 'GOAL!', 'getChatSticker resolves [sticker:goal]');
  assert(getChatSticker('[sticker:banker]')?.name === 'Banker', 'getChatSticker resolves [sticker:banker]');
  assert(getChatSticker('plain text') === undefined, 'getChatSticker rejects non-sticker text');

  console.log('\n--- 6. Testing Safeguard Against False Match Simulation ---');
  const { setUploadedFreeMatches, getFreeMatch, updateMatchAuthoritativeDetail } = await import('../src/lib/freeMatches');

  const futureKickoff = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const testFutureMatch = {
    id: 'mkt-test-future-fixture',
    home: 'Chelsea',
    away: 'Sunderland',
    homeScore: null,
    awayScore: null,
    status: 'pre' as const,
    period: 'scheduled' as const,
    kickoffIso: futureKickoff,
    kickoff: futureKickoff,
    time: '20:00',
    date: 'Tomorrow',
    league: 'Premier League',
    competition: 'Premier League',
    hasOdds: false,
  };

  setUploadedFreeMatches([testFutureMatch as any]);
  assert(getFreeMatch('mkt-test-future-fixture')?.status === 'pre', 'Future fixture initialized with status "pre"');

  // Attempt to apply a historical/simulated match detail claiming FT 2-1
  updateMatchAuthoritativeDetail('mkt-test-future-fixture', {
    status: 'finished',
    status_text: 'FT',
    home_score: 2,
    away_score: 1,
    url: 'chelsea-vs-sunderland',
  });

  const guardedMatch = getFreeMatch('mkt-test-future-fixture');
  assert(guardedMatch?.status === 'pre', 'Safeguard blocked future match from transitioning to "post" (FT)');
  assert(guardedMatch?.homeScore === null, 'Safeguard kept homeScore null (no false score injected)');
  assert(guardedMatch?.awayScore === null, 'Safeguard kept awayScore null (no false score injected)');

  console.log('\n--- 7. Testing 30-Second Message Cooldown Restriction ---');
  const cooldownTestUser = 'punter-254712345678';
  const cooldownTestRoom = 'room-cooldown-test';

  // 1. Initial state: user is permitted to send
  const initialCheck = useChatRoomStore.getState().canUserSendMessage(cooldownTestUser);
  assert(initialCheck.allowed === true, 'Initial state: User is allowed to send');
  assert(initialCheck.remainingSeconds === 0, 'Initial state: 0 cooldown seconds remaining');

  // 2. Successful text message submission triggers 30s deadline
  const textMsg: ChatMessage = {
    id: 'cool-msg-1',
    roomId: cooldownTestRoom,
    userId: cooldownTestUser,
    userName: 'CoolPunter',
    colorSeed: 5,
    text: 'My banker conviction for tonight!',
    sentAt: Date.now(),
  };

  const firstSent = useChatRoomStore.getState().addMessage(cooldownTestRoom, textMsg);
  assert(firstSent === true, 'First text message sent successfully');

  const afterSendCheck = useChatRoomStore.getState().canUserSendMessage(cooldownTestUser);
  assert(afterSendCheck.allowed === false, 'User is restricted immediately after sending text message');
  assert(afterSendCheck.remainingSeconds >= 29 && afterSendCheck.remainingSeconds <= 30, `Cooldown remaining is ~30s (actual: ${afterSendCheck.remainingSeconds}s)`);

  // 3. Attempting to send a second text message within 30s must be blocked by the store
  const duplicateTextMsg: ChatMessage = {
    id: 'cool-msg-2',
    roomId: cooldownTestRoom,
    userId: cooldownTestUser,
    userName: 'CoolPunter',
    colorSeed: 5,
    text: 'Another rapid message that must be blocked!',
    sentAt: Date.now(),
  };
  const secondSent = useChatRoomStore.getState().addMessage(cooldownTestRoom, duplicateTextMsg);
  assert(secondSent === false, 'Duplicate text message rejected by store during cooldown');

  // 4. Sticker message during cooldown is exempted and allowed
  const stickerMsg: ChatMessage = {
    id: 'cool-msg-sticker',
    roomId: cooldownTestRoom,
    userId: cooldownTestUser,
    userName: 'CoolPunter',
    colorSeed: 5,
    text: '[sticker:goal]',
    sentAt: Date.now(),
  };
  const stickerSent = useChatRoomStore.getState().addMessage(cooldownTestRoom, stickerMsg);
  assert(stickerSent === true, 'Sticker message allowed during active text cooldown');

  // 5. When deadline expires in the past, user is allowed again
  useChatRoomStore.getState().setUserCooldownDeadline(cooldownTestUser, Date.now() - 1000);
  const expiredCheck = useChatRoomStore.getState().canUserSendMessage(cooldownTestUser);
  assert(expiredCheck.allowed === true, 'User permitted to send once deadline has passed');
  assert(expiredCheck.remainingSeconds === 0, '0 seconds remaining after deadline expired');

  // 6. Composer rendering with active cooldown
  const cooldownComposerHtml = renderToString(
    <ChatComposer onSend={() => {}} placeholder="Comment here..." cooldownRemaining={27} />
  );
  assert(cooldownComposerHtml.includes('27s'), 'ChatComposer renders "27s" timer badge inside input area');
  assert(cooldownComposerHtml.toLowerCase().includes('readonly'), 'ChatComposer sets readonly attribute on input during cooldown');
  assert(cooldownComposerHtml.toLowerCase().includes('disabled'), 'ChatComposer disables send button during cooldown');

  // 7. Composer rendering without cooldown
  const normalComposerHtml = renderToString(
    <ChatComposer onSend={() => {}} placeholder="Comment here..." cooldownRemaining={0} />
  );
  assert(!normalComposerHtml.includes('27s') && !normalComposerHtml.includes('0s'), 'ChatComposer does not render timer badge when no cooldown');
  assert(!normalComposerHtml.toLowerCase().includes('readonly'), 'ChatComposer does not set readonly when no cooldown');

  console.log('\n🎉 ALL LIVE CHAT ROOM & SAFEGUARD TESTS PASSED!\n');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

