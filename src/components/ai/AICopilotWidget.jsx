import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, X, Send, Shield, Zap, Lightbulb, Terminal, Copy, Check, RefreshCw } from 'lucide-react';
import { chatWithCopilot } from '../../lib/ai';

const QUICK_PROMPTS = [
  { icon: Shield, text: 'Check my app for OWASP security vulnerabilities' },
  { icon: Zap, text: 'How do I secure JWT tokens and Supabase RLS policies?' },
  { icon: Lightbulb, text: 'Suggest an innovative project idea blending AI & Cybersecurity' },
  { icon: Terminal, text: 'Explain how to prevent SQL injection in modern Node.js' },
];

export default function AICopilotWidget({ session }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "👋 Hey! I'm **Connectra Copilot**, powered by **Groq Llama 3**.\n\nAsk me anything about full-stack engineering, secure architecture, or debugging code!",
    },
  ]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (customText = null) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage = { role: 'user', content: textToSend };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const reply = await chatWithCopilot({
        messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        context: {
          username: session?.user?.email?.split('@')[0] || 'developer',
        },
      });

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ Failed to connect to Groq. Please check your network and VITE_GROQ_API_KEY in .env.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-20 lg:bottom-6 right-5 lg:right-6 z-40">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsOpen(prev => !prev)}
          className="relative w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#ea580c] via-[#f97316] to-[#f59e0b] text-white shadow-xl shadow-orange-500/30 border border-orange-300/40 flex items-center justify-center cursor-pointer transition-all"
          title="Connectra AI Copilot"
        >
          <Bot size={24} className="text-white drop-shadow-sm" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white shadow-xs"></span>
          </span>
        </motion.button>
      </div>

      {/* Floating Copilot Modal/Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-36 lg:bottom-22 right-3 lg:right-6 z-50 w-[94vw] sm:w-[420px] h-[540px] max-h-[78vh] rounded-3xl bg-white border border-[#f1e4d3] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#f1e4d3] flex items-center justify-between bg-gradient-to-r from-[#fff7ed] via-[#fffdfa] to-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ea580c] to-[#f97316] flex items-center justify-center text-white shadow-md shadow-orange-500/20">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[#1c130d]">Connectra Copilot</span>
                    <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.2 rounded-full bg-[#ffedd5] text-[#ea580c] border border-orange-200">
                      AI CORE
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6b5546]">Dev & Cybersecurity Assistant</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMessages([messages[0]])}
                  className="p-1.5 text-[#6b5546] hover:text-[#1c130d] rounded-xl hover:bg-[#faf6f0] transition-colors text-xs flex items-center gap-1 cursor-pointer"
                  title="Clear conversation"
                >
                  <RefreshCw size={13} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-[#6b5546] hover:text-[#1c130d] rounded-xl hover:bg-[#faf6f0] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar text-sm bg-[#faf6f0]/40">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed relative group shadow-2xs ${
                      m.role === 'user'
                        ? 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white rounded-br-none font-medium'
                        : 'bg-white border border-[#f1e4d3] text-[#2b1f17] rounded-bl-none'
                    }`}
                  >
                    <div className="whitespace-pre-wrap select-text">{m.content}</div>

                    {m.role === 'assistant' && (
                      <button
                        onClick={() => copyToClipboard(m.content, idx)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 p-1 rounded-lg bg-[#faf6f0] text-[#6b5546] hover:text-[#1c130d] border border-[#f1e4d3]"
                        title="Copy to clipboard"
                      >
                        {copiedIndex === idx ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 p-3 max-w-[70%] rounded-2xl bg-white border border-orange-200 text-xs text-[#ea580c] font-semibold shadow-2xs">
                  <RefreshCw size={13} className="animate-spin text-[#ea580c]" />
                  <span>Connectra AI is thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Starters (if conversation is short) */}
            {messages.length <= 2 && (
              <div className="px-4 pb-2 pt-1 flex flex-col gap-1.5 bg-white border-t border-[#f1e4d3]">
                <span className="text-[10px] uppercase font-bold text-[#8d7565] tracking-wider">
                  Suggested Prompts
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_PROMPTS.map((qp, i) => {
                    const Icon = qp.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => handleSend(qp.text)}
                        className="p-2.5 rounded-xl bg-[#fff7ed] hover:bg-[#ffedd5] border border-orange-200/60 text-[11px] text-[#6b5546] hover:text-[#1c130d] text-left transition-colors flex items-start gap-1.5 cursor-pointer"
                      >
                        <Icon size={14} className="text-[#ea580c] shrink-0 mt-0.5" />
                        <span className="line-clamp-2 font-medium">{qp.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSend();
              }}
              className="p-3 border-t border-[#f1e4d3] bg-white flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about security, bugs, or code..."
                className="flex-1 bg-[#faf6f0] border border-[#f1e4d3] rounded-xl px-3.5 py-2.5 text-xs text-[#1c130d] placeholder-[#8d7565] outline-none focus:border-orange-500 focus:bg-white transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white hover:opacity-95 disabled:opacity-40 transition-opacity cursor-pointer shadow-sm shadow-orange-500/25"
              >
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
