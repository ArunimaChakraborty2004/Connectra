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
          className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-xl shadow-violet-500/30 border border-white/20 flex items-center justify-center cursor-pointer transition-all"
          title="Connectra AI Copilot"
        >
          <Bot size={22} className="text-white" />
          <span className="absolute top-0 right-0 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
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
            className="fixed bottom-36 lg:bottom-22 right-3 lg:right-6 z-50 w-[94vw] sm:w-[400px] h-[520px] max-h-[75vh] rounded-2xl glass-panel bg-surface/98 backdrop-blur-xl border border-border shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-3.5 border-b border-border flex items-center justify-between bg-surface-hover/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-main">Connectra Copilot</span>
                    <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-violet-500/15 text-violet-500 border border-violet-500/25">
                      GROQ
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">Dev & Cybersecurity Assistant</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMessages([messages[0]])}
                  className="p-1.5 text-muted hover:text-main rounded-lg hover:bg-white/5 transition-colors text-xs flex items-center gap-1"
                  title="Clear conversation"
                >
                  <RefreshCw size={13} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-muted hover:text-main rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar text-sm">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] p-3 rounded-2xl text-xs sm:text-[13px] leading-relaxed relative group ${
                      m.role === 'user'
                        ? 'bg-primary text-white rounded-br-none'
                        : 'bg-surface/80 border border-white/10 text-muted rounded-bl-none shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap select-text">{m.content}</div>

                    {m.role === 'assistant' && (
                      <button
                        onClick={() => copyToClipboard(m.content, idx)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 p-1 rounded bg-black/50 text-white/70 hover:text-white"
                        title="Copy to clipboard"
                      >
                        {copiedIndex === idx ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 p-3 max-w-[70%] rounded-2xl bg-surface/80 border border-white/10 text-xs text-violet-400">
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Thinking with Llama 3...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Starters (if conversation is short) */}
            {messages.length <= 2 && (
              <div className="px-4 pb-2 pt-1 flex flex-col gap-1.5">
                <span className="text-[10px] uppercase font-bold text-muted tracking-wider">
                  Suggested Prompts
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_PROMPTS.map((qp, i) => {
                    const Icon = qp.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => handleSend(qp.text)}
                        className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-violet-500/30 text-[11px] text-muted hover:text-main text-left transition-colors flex items-start gap-1.5"
                      >
                        <Icon size={13} className="text-violet-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{qp.text}</span>
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
              className="p-3 border-t border-border bg-surface-hover/50 flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about security, bugs, or code..."
                className="flex-1 bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-main placeholder-muted outline-none focus:border-violet-500/50 transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
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
