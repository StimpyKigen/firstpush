import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, RefreshCw } from 'lucide-react';

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
      text: "Habari! 👋 I'm **Ava**, your 24/7 AI Customer Support Specialist for MshindiRoom.\n\nAsk me anything about jackpot consensus, building custom bet slips, unlocking rooms with M-Pesa, 5-star ratings, or gameweek leaderboards!",
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
              return <strong key={pIdx} className="font-bold text-cream dark:text-[#F4F5EF]">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
              return <em key={pIdx} className="italic text-gold dark:text-[#FFC72C]">{part.slice(1, -1)}</em>;
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
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-10 lg:bottom-16 right-2 sm:right-3 z-50 flex items-center">
          <button
            onClick={() => setIsOpen(true)}
            className="relative p-1 focus:outline-none hover:scale-110 active:scale-95 transition-transform group cursor-pointer"
            title="Open 24/7 AI Support"
            aria-label="Open 24/7 Support Chat"
          >
            <AvaLogo className="w-11 h-11 sm:w-12 sm:h-12 drop-shadow-md transition-transform" />
            
            {/* Green online indicator directly on the borderless icon */}
            <span className="absolute top-1 right-1 flex h-3.5 w-3.5">
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-[#202522] shadow-xs"></span>
            </span>

            {unreadBadge && (
              <span className="absolute -bottom-0.5 -left-0.5 px-1.5 py-0.5 text-[11px] font-bold bg-rose-500 text-white rounded-full shadow-sm">
                1
              </span>
            )}
          </button>
        </div>
      )}

      {/* Floating Support Window Widget (iOS/ChatGPT Style, Adaptive to Mobile Virtual Keyboard) */}
      {isOpen && (
        <div className="fixed z-50 bottom-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-10 lg:bottom-16 right-2 left-2 sm:left-auto sm:right-6 w-auto sm:w-[380px] h-[min(480px,calc(100dvh-5.5rem))] sm:h-[520px] max-h-[calc(100dvh-1rem)] bg-[#FFFFF0] dark:bg-[#202522] border border-[#E6E6D2] dark:border-[#414A43] rounded-[24px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Top Subtle Pull Handle */}
          <div className="pt-2 pb-0.5 flex justify-center shrink-0">
            <span className="w-9 h-1 rounded-full bg-slate-300/80 dark:bg-[#414A43]" />
          </div>

          {/* Minimalist Header */}
          <div className="px-3.5 py-2.5 bg-[#FFFFF0] dark:bg-[#202522] border-b border-[#E6E6D2]/70 dark:border-[#414A43]/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              {/* Borderless Avatar */}
              <div className="relative flex items-center justify-center shrink-0">
                <AvaLogo className="w-7 h-7" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#FFFFF0] dark:border-[#202522] rounded-full"></span>
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 dark:text-[#F4F5EF] text-sm leading-tight">Ava</h3>
                <p className="text-[11px] text-emerald-600 dark:text-[#006C54] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-[#006C54]"></span>
                  Online • Mshindi Support
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-500 dark:text-[#B5BDB6]">
              <button
                onClick={handleClearChat}
                className="p-1.5 hover:opacity-75 text-slate-500 dark:text-[#B5BDB6] flex items-center justify-center transition-opacity cursor-pointer"
                title="Clear Chat History"
              >
                <RefreshCw size={14} />
              </button>
              {/* Borderless 'X' close button, ivory in darkmode */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:opacity-75 text-slate-700 dark:text-[#F4F5EF] flex items-center justify-center transition-opacity cursor-pointer"
                title="Close Chat"
                aria-label="Close Chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 min-h-0 p-3 sm:p-3.5 overflow-y-auto space-y-2.5 text-xs text-slate-700 dark:text-[#B5BDB6] scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 sm:gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Borderless Avatar beside Ava messages */}
                {msg.sender === 'ava' && (
                  <div className="flex items-center justify-center shrink-0 mt-0.5">
                    <AvaLogo className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-[20px] p-2.5 sm:p-3 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#EEAA04] text-[#0a1317] font-medium rounded-br-sm shadow-xs'
                      : 'bg-white dark:bg-[#2A312D] border border-[#E6E6D2] dark:border-[#414A43] text-slate-800 dark:text-[#F4F5EF] rounded-tl-sm shadow-2xs'
                  }`}
                >
                  <div>{renderFormattedText(msg.text)}</div>
                  <div
                    className={`mt-1 text-[11px] tabular-nums ${
                      msg.sender === 'user' ? 'text-[#0a1317]/70 text-right' : 'text-slate-400 dark:text-[#929D95] text-left'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading / Typing Indicator with proper positioning and borderless avatar */}
            {isLoading && (
              <div className="flex gap-2 sm:gap-2.5 justify-start items-center pt-0.5 pb-1">
                <div className="flex items-center justify-center shrink-0">
                  <AvaLogo className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="bg-white dark:bg-[#2A312D] border border-[#E6E6D2] dark:border-[#414A43] rounded-[18px] rounded-tl-sm px-3 py-1.5 flex items-center gap-1.5 shadow-2xs">
                  <span className="text-[11px] font-medium text-[#EEAA04] dark:text-[#FFC72C]">Ava is typing</span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#EEAA04] dark:bg-[#FFC72C] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-[#EEAA04] dark:bg-[#FFC72C] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-[#EEAA04] dark:bg-[#FFC72C] rounded-full animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}

            {/* Scroll bottom anchor */}
            <div ref={messagesEndRef} className="h-1 shrink-0" />
          </div>

          {/* Compact Input Footer Bar */}
          <div className="px-3 py-2 bg-[#FFFFF0] dark:bg-[#202522] border-t border-[#E6E6D2]/60 dark:border-[#414A43]/60 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="relative flex items-center gap-2 bg-[#FFFFF0] dark:bg-[#2A312D] border border-[#E6E6D2] dark:border-[#414A43] rounded-full pl-3.5 pr-2 py-1.5 shadow-xs focus-within:border-[#0a1317] dark:focus-within:border-[#006C54] focus-within:ring-1 focus-within:ring-[#0a1317]/10 dark:focus-within:ring-[#006C54]/20 transition-all"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                disabled={isLoading}
                className="flex-1 bg-transparent text-slate-900 dark:text-[#F4F5EF] placeholder-slate-400 dark:placeholder-[#929D95] text-xs sm:text-[13px] focus:outline-none min-w-0 py-0.5"
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
                  className="w-4.5 h-4.5 sm:w-5 sm:h-5 object-contain"
                  width="20"
                  height="20"
                  loading="eager"
                  decoding="async"
                />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
