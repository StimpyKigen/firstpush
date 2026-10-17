import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, RefreshCw, ShieldCheck } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ava';
  text: string;
  timestamp: string;
  isError?: boolean;
}

// Clean AI Assistant Chat Icon
function AvaLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <img
      src="/images/chat-icon.png"
      alt="Support Chat"
      className={`${className} object-contain`}
      width="32"
      height="32"
      loading="eager"
      decoding="async"
    />
  );
}

export default function AvaChatSupport() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      sender: 'ava',
      text: "Habari! 👋 I'm **Ava**, your 24/7 AI Customer Support Specialist for MshindiRoom.\n\nAsk me anything about jackpot consensus, building custom bet slips, unlocking rooms with M-Pesa, 5-star ratings, P2P bets, or gameweek leaderboards!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unreadBadge, setUnreadBadge] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadBadge(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  async function handleSendMessage(textToSend?: string) {
    const queryText = (textToSend || input).trim();
    if (!queryText || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      // Send chat request to backend API
      const res = await fetch('/api/gemini/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText,
          history: messages,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Unable to connect to support assistant.');
      }

      const avaMsg: ChatMessage = {
        id: `ava-${Date.now()}`,
        sender: 'ava',
        text: data.text || "I'm Ava! How else can I assist you with your MshindiRoom experience?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, avaMsg]);
    } catch (err: any) {
      console.error('Ava support error:', err);
      // Fallback response if API key is missing or network fails
      let fallbackText = "I'm experiencing a brief connection hiccup. For urgent assistance, you can email our human support team directly at **support@mshindiroom.co.ke**!";
      
      if (queryText.toLowerCase().includes('builder') || queryText.toLowerCase().includes('bet builder')) {
        fallbackText = "🎲 **Bet Builder vs Jackpot Rooms**:\n\n• **Jackpot Rooms**: Pre-set 13-17 match pools (SportPesa Mega, Betika Midweek) for the Gameweek Leaderboard Crown. Unlocking costs **KSh 10** for live consensus stats.\n\n• **Bet Builder**: 100% **FREE** tool to create custom multi-leg accumulators from daily matches, aggregate odds, and generate copyable bookie slip codes!";
      } else if (queryText.toLowerCase().includes('consensus') || queryText.toLowerCase().includes('jackpot')) {
        fallbackText = "⚡ **Jackpot Consensus**: Unlocking a jackpot room for a flat fee of **KSh 10** via M-Pesa reveals live community picks, consensus breakdown across all 17 legs, and qualifies your slip for the Gameweek Leaderboard!";
      } else if (queryText.toLowerCase().includes('mpesa') || queryText.toLowerCase().includes('deposit')) {
        fallbackText = "💳 **M-Pesa Top-Up**: Go to your Wallet screen, enter your amount and phone number, and confirm the instant STK Push prompt on your phone. Balances update immediately!";
      } else if (queryText.toLowerCase().includes('leaderboard') || queryText.toLowerCase().includes('crown')) {
        fallbackText = "👑 **Gameweek Leaderboard**: The eligible punter whose submitted slip lands closest to the actual winning jackpot results takes #1! Ties are settled strictly by earliest submission time.";
      }

      const avaErrorMsg: ChatMessage = {
        id: `ava-err-${Date.now()}`,
        sender: 'ava',
        text: fallbackText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };

      setMessages((prev) => [...prev, avaErrorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  }

  function handleClearChat() {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'ava',
        text: "Chat cleared! How can I help you next?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }

  // Format simple markdown bold text (*text* or **text**)
  function renderFormattedText(text: string) {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
      return (
        <p key={idx} className={idx > 0 ? 'mt-1.5' : ''}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-bold text-cream">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
              return <em key={pIdx} className="italic text-gold">{part.slice(1, -1)}</em>;
            }
            return part;
          })}
        </p>
      );
    });
  }

  // Chatbot icon should only appear on the homepage
  if (location.pathname !== '/') {
    return null;
  }

  return (
    <>
      {/* Floating Toggle Button (Borderless Icon with Green Online Indicator) */}
      {!isOpen && (
        <div className="fixed bottom-[calc(6.75rem+env(safe-area-inset-bottom))] sm:bottom-10 lg:bottom-16 right-2 sm:right-3 z-50 flex items-center">
          <button
            onClick={() => setIsOpen(true)}
            className="relative p-1 focus:outline-none hover:scale-110 active:scale-95 transition-transform group"
            title="Open 24/7 AI Support"
            aria-label="Open 24/7 Support Chat"
          >
            <AvaLogo className="w-11 h-11 sm:w-12 sm:h-12 drop-shadow-md transition-transform" />
            
            {/* Green online indicator directly on the borderless icon */}
            <span className="absolute top-1 right-1 flex h-3.5 w-3.5">
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white shadow-xs"></span>
            </span>

            {unreadBadge && (
              <span className="absolute -bottom-0.5 -left-0.5 px-1.5 py-0.5 text-[9px] font-extrabold bg-rose-500 text-white rounded-full shadow-sm">
                1
              </span>
            )}
          </button>
        </div>
      )}

      {/* Floating Support Window Widget (Modern iOS/ChatGPT Style Redesign) */}
      {isOpen && (
        <div className="fixed z-50 bottom-[calc(0.625rem+env(safe-area-inset-bottom))] sm:bottom-10 lg:bottom-16 right-2 left-2 sm:left-auto sm:right-6 w-auto sm:w-[380px] h-[530px] max-h-[85vh] bg-[#FFFFF0] border border-[#E6E6D2] rounded-[28px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Top Subtle Pull Handle */}
          <div className="pt-2 pb-0.5 flex justify-center shrink-0">
            <span className="w-9 h-1 rounded-full bg-slate-300/80" />
          </div>

          {/* Minimalist Header */}
          <div className="px-3.5 py-2.5 bg-[#FFFFF0] border-b border-[#E6E6D2]/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-full bg-white border border-[#E6E6D2] flex items-center justify-center shrink-0 shadow-2xs p-1">
                <AvaLogo className="w-5 h-5" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#FFFFF0] rounded-full"></span>
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 text-sm leading-tight">Ava</h3>
                <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Online • Mshindi Support
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-500">
              <button
                onClick={handleClearChat}
                className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
                title="Clear Chat History"
              >
                <RefreshCw size={13} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300/80 text-slate-700 flex items-center justify-center transition-colors"
                title="Close Chat"
                aria-label="Close Chat"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 text-xs text-slate-700 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 sm:gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ava' && (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border border-[#E6E6D2] flex items-center justify-center shrink-0 mt-0.5 p-0.5 shadow-2xs">
                    <AvaLogo className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-[20px] p-3 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#EEAA04] text-[#0a1317] font-medium rounded-br-sm shadow-xs'
                      : 'bg-white border border-[#E6E6D2] text-slate-800 rounded-tl-sm shadow-2xs'
                  }`}
                >
                  <div>{renderFormattedText(msg.text)}</div>
                  <div
                    className={`mt-1 text-[9px] font-mono ${
                      msg.sender === 'user' ? 'text-[#0a1317]/70 text-right' : 'text-slate-400 text-left'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-2 sm:gap-2.5 justify-start items-center">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border border-[#E6E6D2] flex items-center justify-center shrink-0 p-0.5 shadow-2xs">
                  <AvaLogo className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="bg-white border border-[#E6E6D2] rounded-[18px] rounded-tl-sm px-3.5 py-2 flex items-center gap-1.5 shadow-2xs">
                  <span className="text-[11px] font-medium text-[#EEAA04]">Ava is typing</span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#EEAA04] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-[#EEAA04] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-[#EEAA04] rounded-full animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Floating Capsule Input Footer Bar (Ivory Background + Borderless Send Icon) */}
          <div className="p-3 bg-[#FFFFF0] border-t border-[#E6E6D2]/60">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="relative flex items-center gap-2 bg-[#FFFFF0] border border-[#E6E6D2] rounded-full pl-4 pr-2.5 py-2 shadow-xs focus-within:border-[#0a1317] focus-within:ring-2 focus-within:ring-[#0a1317]/10 transition-all"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                disabled={isLoading}
                className="flex-1 bg-transparent text-slate-900 placeholder-slate-400 text-xs sm:text-[13px] focus:outline-none min-w-0"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-1 focus:outline-none hover:scale-110 active:scale-95 transition-transform disabled:opacity-25 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                title="Send Message"
                aria-label="Send Message"
              >
                <img
                  src="/images/send-icon.png"
                  alt="Send"
                  className="w-5 h-5 sm:w-5.5 sm:h-5.5 object-contain"
                  width="22"
                  height="22"
                  loading="eager"
                  decoding="async"
                />
              </button>
            </form>
            <div className="mt-1.5 flex items-center justify-center text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck size={11} className="text-emerald-500" />
                Verified Mshindi AI Assistant
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
