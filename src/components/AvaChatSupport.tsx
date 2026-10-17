import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, X, Sparkles, RefreshCw, ShieldCheck } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ava';
  text: string;
  timestamp: string;
  isError?: boolean;
}

const FAQ_SUGGESTIONS = [
  '⚡ How does Jackpot Consensus work?',
  '🎲 Bet Builder vs Jackpot Rooms?',
  '💳 How do I deposit with M-Pesa?',
  '👑 How is the Gameweek Leaderboard crowned?',
  '⭐️ How do 5-Star Punter Ratings increase?',
  '🎮 How do P2P Wagers work?',
];

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

      {/* Floating Support Window Widget (Optimized Mobile Sizing) */}
      {isOpen && (
        <div className="fixed z-50 bottom-[calc(0.625rem+env(safe-area-inset-bottom))] sm:bottom-10 lg:bottom-16 right-2 left-2 sm:left-auto sm:right-6 w-auto sm:w-[370px] h-[510px] max-h-[82vh] bg-panel border border-[#E6E6D2] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="p-3 sm:p-3.5 bg-panel-2 border-b border-line flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-xl bg-[#FFFFF0] border border-[#E6E6D2] flex items-center justify-center shrink-0 shadow-sm p-1">
                <AvaLogo className="w-6 h-6" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#FFFFF0] rounded-full"></span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display font-extrabold text-cream text-sm">Ava</h3>
                  <span className="text-[10px] font-bold text-gold bg-gold/10 px-1.5 py-0.1 rounded border border-gold/20 flex items-center gap-0.5">
                    <Sparkles size={9} /> AI 24/7
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  MshindiRoom Specialist • Online
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-cream-dim">
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-lg hover:bg-ink hover:text-cream transition-colors"
                title="Clear Chat History"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-ink hover:text-cream transition-colors"
                title="Minimize Chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-3 sm:p-3.5 overflow-y-auto space-y-3 text-xs text-cream-dim scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 sm:gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ava' && (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#FFFFF0] border border-[#E6E6D2] flex items-center justify-center shrink-0 mt-0.5 p-0.5 shadow-2xs">
                    <AvaLogo className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                )}

                <div
                  className={`max-w-[86%] rounded-2xl p-2.5 sm:p-3 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gold text-ink-2 font-medium rounded-tr-none shadow-md'
                      : 'bg-panel-2 border border-line/80 text-cream rounded-tl-none shadow'
                  }`}
                >
                  <div>{renderFormattedText(msg.text)}</div>
                  <div
                    className={`mt-1 text-[9px] font-mono ${
                      msg.sender === 'user' ? 'text-ink-2/70 text-right' : 'text-cream-dim/60 text-left'
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
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#FFFFF0] border border-[#E6E6D2] flex items-center justify-center shrink-0 p-0.5 shadow-2xs">
                  <AvaLogo className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="bg-panel-2 border border-line/80 rounded-2xl rounded-tl-none px-3 py-2 flex items-center gap-1.5 text-cream-dim">
                  <span className="text-[11px] font-medium text-gold">Ava is typing</span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick FAQ Suggestion Chips */}
          {messages.length < 5 && (
            <div className="px-2.5 py-1.5 bg-ink/40 border-t border-line/50 overflow-x-auto whitespace-nowrap flex items-center gap-1.5 scrollbar-none">
              {FAQ_SUGGESTIONS.map((faq, idx) => (
                <button
                  key={idx}
                  onClick={() => void handleSendMessage(faq)}
                  disabled={isLoading}
                  className="px-2 py-1 rounded-full bg-panel-2 hover:bg-gold/15 border border-line hover:border-gold/30 text-cream-dim hover:text-gold text-[10px] font-medium transition-colors shrink-0 disabled:opacity-50"
                >
                  {faq}
                </button>
              ))}
            </div>
          )}

          {/* Input Footer Bar */}
          <div className="p-2.5 sm:p-3 bg-panel-2 border-t border-line">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="flex items-center gap-1.5 sm:gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Ava anything..."
                disabled={isLoading}
                className="flex-1 bg-ink border border-line rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs text-cream placeholder-cream-dim/50 focus:outline-none focus:border-gold/60 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-1.5 sm:p-2 rounded-xl bg-gold text-ink-2 font-bold hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-gold transition-colors shrink-0"
                title="Send Message"
              >
                <Send size={15} />
              </button>
            </form>
            <div className="mt-1 flex items-center justify-between text-[9px] text-cream-dim/60 px-0.5">
              <span className="flex items-center gap-1">
                <ShieldCheck size={10} className="text-emerald-400" />
                Verified Mshindi AI Assistant
              </span>
              <span>Gemini 3.6 • 24/7</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
