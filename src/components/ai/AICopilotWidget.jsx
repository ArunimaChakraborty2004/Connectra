import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  X,
  Send,
  Shield,
  Zap,
  Lightbulb,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  Moon,
  Sun,
  Maximize2,
  Minimize2,
  Cpu,
  Trash2,
  ChevronDown,
  Plus,
  History,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { chatWithCopilot } from '../../lib/ai';
import { supabase } from '../../lib/supabase';

const QUICK_PROMPT_CATEGORIES = {
  Cybersecurity: [
    { icon: Shield, text: 'Check my app for OWASP security vulnerabilities' },
    { icon: Zap, text: 'How do I secure JWT tokens and Supabase RLS policies?' },
  ],
  Architecture: [
    { icon: Lightbulb, text: 'Suggest an innovative project idea blending AI & Cybersecurity' },
    { icon: Terminal, text: 'Explain how to prevent SQL injection in modern Node.js' },
  ],
  'Code Review': [
    { icon: Terminal, text: 'Review my React component state management & performance' },
    { icon: Shield, text: 'How to implement rate limiting on Node API endpoints?' },
  ],
};

const AVAILABLE_MODELS = [
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', tag: 'Fast & Smart' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', tag: 'Most Capable' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', tag: 'Ultra Fast' },
];

export default function AICopilotWidget({ session }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [copiedCodeSnippet, setCopiedCodeSnippet] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedModel, setSelectedModel] = useState('qwen/qwen3.8-27b');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // Dedicated Copilot Dark/Light Theme with persistent memory
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('connectra_copilot_theme');
      if (saved) return saved === 'dark';
      return document.documentElement.classList.contains('dark');
    } catch {
      return false;
    }
  });

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('connectra_copilot_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  // Fetch real authenticated profile info for personal context
  useEffect(() => {
    const fetchUser = async () => {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('username, tech_stack, level, xp')
        .eq('id', session.user.id)
        .single();
      if (data) setUserProfile(data);
    };
    fetchUser();
  }, [session?.user?.id]);

  const devName = userProfile?.username || session?.user?.email?.split('@')[0] || 'Developer';
  const devStack = userProfile?.tech_stack || 'Full-Stack Web & Cybersecurity';

  // Multi-session chat management (New Chat + Previous Chats)
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem(`connectra_copilot_sessions_${session?.user?.id || 'guest'}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    const initialId = `session_${Date.now()}`;
    return [
      {
        id: initialId,
        title: 'Initial Welcome',
        timestamp: new Date().toISOString(),
        messages: [
          {
            role: 'assistant',
            content: `👋 Hey **@${devName}**! I'm **Connectra Copilot**, your engineering & security wingman.\n\nI can analyze snippets, debug tricky race conditions, architect Supabase RLS policies, or design secure APIs. What are we building today?`,
          },
        ],
      },
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    return sessions[0]?.id || `session_${Date.now()}`;
  });

  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || sessions[0];
  }, [sessions, activeSessionId]);

  const messages = activeSession?.messages || [];

  // Save sessions to storage
  useEffect(() => {
    try {
      localStorage.setItem(
        `connectra_copilot_sessions_${session?.user?.id || 'guest'}`,
        JSON.stringify(sessions)
      );
    } catch {
      // ignore storage quota issues
    }
  }, [sessions, session?.user?.id]);

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Create a brand new chat session
  const handleStartNewChat = () => {
    const newId = `session_${Date.now()}`;
    const newSession = {
      id: newId,
      title: 'New Conversation',
      timestamp: new Date().toISOString(),
      messages: [
        {
          role: 'assistant',
          content: `🚀 Started a fresh conversation for **@${devName}**! Ask any full-stack question, paste code to debug, or request an AppSec audit.`,
        },
      ],
    };

    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setShowHistoryDrawer(false);
  };

  const handleSelectSession = (id) => {
    setActiveSessionId(id);
    setShowHistoryDrawer(false);
  };

  const handleDeleteSession = (e, id) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      handleStartNewChat();
      return;
    }
    const remaining = sessions.filter(s => s.id !== id);
    setSessions(remaining);
    if (activeSessionId === id) {
      setActiveSessionId(remaining[0].id);
    }
  };

  const handleSend = async (customText = null) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage = { role: 'user', content: textToSend };
    const updatedMessages = [...messages, userMessage];

    // Auto-update session title based on first user message if it's default
    const currentTitle =
      activeSession?.title === 'New Conversation' || activeSession?.title === 'Initial Welcome'
        ? textToSend.slice(0, 28) + (textToSend.length > 28 ? '...' : '')
        : activeSession?.title || 'Chat';

    setSessions(prev =>
      prev.map(s =>
        s.id === activeSession.id
          ? { ...s, title: currentTitle, timestamp: new Date().toISOString(), messages: updatedMessages }
          : s
      )
    );

    setInput('');
    setLoading(true);

    try {
      const reply = await chatWithCopilot({
        messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        context: {
          username: devName,
          techStack: devStack,
        },
      });

      setSessions(prev =>
        prev.map(s =>
          s.id === activeSession.id
            ? {
                ...s,
                messages: [...updatedMessages, { role: 'assistant', content: reply }],
              }
            : s
        )
      );
    } catch (err) {
      setSessions(prev =>
        prev.map(s =>
          s.id === activeSession.id
            ? {
                ...s,
                messages: [
                  ...updatedMessages,
                  {
                    role: 'assistant',
                    content: '⚠️ Failed to connect to AI engine. Please verify your internet connection or check VITE_GROQ_API_KEY in .env.',
                  },
                ],
              }
            : s
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Render markdown with code block syntax highlighting & copy buttons
  const renderFormattedContent = (content) => {
    if (!content) return null;

    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const lang = lines[0].trim() || 'code';
        const code = lines.slice(lang === lines[0].trim() && lines.length > 1 ? 1 : 0).join('\n');

        return (
          <div
            key={i}
            className="my-2.5 rounded-xl overflow-hidden border border-amber-500/20 bg-[#140e0a] text-amber-200 text-xs font-mono shadow-md"
          >
            <div className="px-3 py-1.5 bg-[#231812] border-b border-amber-500/10 flex items-center justify-between text-[11px] text-orange-300">
              <span className="font-semibold uppercase tracking-wider">{lang}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(code);
                  setCopiedCodeSnippet(i);
                  setTimeout(() => setCopiedCodeSnippet(null), 2000);
                }}
                className="flex items-center gap-1 text-[10px] text-amber-300/80 hover:text-amber-100 transition-colors cursor-pointer"
              >
                {copiedCodeSnippet === i ? (
                  <>
                    <Check size={11} className="text-emerald-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={11} /> Copy Code
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-[11px] leading-relaxed selection:bg-orange-500 selection:text-white">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      // Format bold markdown (**text**)
      const boldParts = part.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={i}>
          {boldParts.map((bp, j) => {
            if (bp.startsWith('**') && bp.endsWith('**')) {
              return (
                <strong key={j} className={isDark ? 'text-orange-300 font-bold' : 'text-[#ea580c] font-bold'}>
                  {bp.slice(2, -2)}
                </strong>
              );
            }
            return bp;
          })}
        </span>
      );
    });
  };

  return (
    <>
      {/* Floating Trigger Button with Pulsing Status */}
      <div className="fixed bottom-20 lg:bottom-6 right-5 lg:right-6 z-40">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsOpen(prev => !prev)}
          className="relative w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#ea580c] via-[#f97316] to-[#f59e0b] text-white shadow-xl shadow-orange-500/30 border border-orange-300/40 flex items-center justify-center cursor-pointer transition-all hover:shadow-orange-500/40"
          title="Connectra AI Copilot"
        >
          <Bot size={24} className="text-white drop-shadow-sm" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white shadow-xs"></span>
          </span>
        </motion.button>
      </div>

      {/* Floating Copilot Modal / Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed bottom-24 lg:bottom-22 right-3 lg:right-6 z-50 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 border ${
              isExpanded
                ? 'w-[96vw] sm:w-[600px] h-[82vh]'
                : 'w-[94vw] sm:w-[440px] h-[580px] max-h-[80vh]'
            } ${
              isDark
                ? 'bg-[#18110c] text-stone-100 border-[#3d2719] shadow-black/60'
                : 'bg-white text-[#1c130d] border-[#f1e4d3] shadow-orange-950/15'
            }`}
          >
            {/* Header */}
            <div
              className={`p-3.5 border-b flex items-center justify-between transition-colors ${
                isDark
                  ? 'bg-gradient-to-r from-[#211710] via-[#1a120d] to-[#211710] border-[#382416]'
                  : 'bg-gradient-to-r from-[#fff7ed] via-[#fffdfa] to-white border-[#f1e4d3]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ea580c] to-[#f97316] flex items-center justify-center text-white shadow-md shadow-orange-500/25 shrink-0">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold tracking-tight">Connectra Copilot</span>
                    <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.2 rounded-full bg-orange-500/15 text-orange-500 border border-orange-500/25">
                      v2.0 AI
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] opacity-75">
                    <span className="truncate max-w-[100px]" title={activeSession?.title}>
                      {activeSession?.title || `@${devName}`}
                    </span>
                    <span>·</span>
                    <button
                      onClick={() => setShowModelPicker(p => !p)}
                      className="flex items-center gap-1 font-mono text-[10px] text-orange-500 hover:underline cursor-pointer"
                    >
                      <Cpu size={10} />
                      {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || 'Qwen 3.8'}
                      <ChevronDown size={10} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Window Controls: New Chat, History, Dark Toggle, Expand, Close */}
              <div className="flex items-center gap-1">
                {/* + New Chat Button */}
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  className="flex items-center gap-1 px-2 py-1 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white hover:brightness-105 transition-all text-xs font-bold cursor-pointer shadow-xs"
                  title="Start New Chat"
                >
                  <Plus size={13} strokeWidth={2.8} />
                  <span className="text-[10px]">New</span>
                </button>

                {/* Previous Chats / History Drawer Toggle */}
                <button
                  type="button"
                  onClick={() => setShowHistoryDrawer(p => !p)}
                  className={`p-1.5 rounded-xl transition-colors text-xs cursor-pointer ${
                    showHistoryDrawer
                      ? 'bg-orange-500/20 text-orange-500 font-bold'
                      : isDark
                      ? 'text-stone-400 hover:bg-stone-800'
                      : 'text-stone-600 hover:bg-orange-50'
                  }`}
                  title="View Previous Chats"
                >
                  <History size={16} />
                </button>

                {/* Theme Toggle Button */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl transition-all text-xs font-bold border cursor-pointer ${
                    isDark
                      ? 'bg-amber-400/15 border-amber-400/30 text-amber-300 hover:bg-amber-400/25'
                      : 'bg-[#fff7ed] border-orange-200 text-stone-700 hover:bg-[#ffedd5]'
                  }`}
                  title={isDark ? 'Switch to Warm Cream Light' : 'Switch to Cyber Dark Mode'}
                >
                  {isDark ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} className="text-[#ea580c]" />}
                  <span className="text-[10px] hidden xs:inline">{isDark ? 'Light' : 'Dark'}</span>
                </button>

                {/* Expand / Minimize Window */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(p => !p)}
                  className={`p-1.5 rounded-xl transition-colors text-xs hidden sm:flex cursor-pointer ${
                    isDark ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-600 hover:bg-orange-50'
                  }`}
                  title={isExpanded ? 'Collapse' : 'Expand window'}
                >
                  {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className={`p-1.5 rounded-xl transition-colors text-xs cursor-pointer ${
                    isDark
                      ? 'text-stone-400 hover:text-white hover:bg-stone-800'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-orange-50'
                  }`}
                  title="Close Copilot"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Model Selector Dropdown */}
            <AnimatePresence>
              {showModelPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`border-b p-2 text-xs flex flex-col gap-1 z-20 ${
                    isDark ? 'bg-[#22160f] border-[#382416]' : 'bg-[#fff7ed] border-[#f1e4d3]'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 px-2 py-0.5">
                    Select Active LLM Engine
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {AVAILABLE_MODELS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedModel(m.id);
                          setShowModelPicker(false);
                        }}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                          selectedModel === m.id
                            ? 'border-orange-500 bg-orange-500/15 font-bold text-orange-600'
                            : isDark
                            ? 'border-stone-800 bg-stone-900/60 hover:bg-stone-800 text-stone-300'
                            : 'border-orange-200 bg-white hover:bg-orange-100/50 text-stone-700'
                        }`}
                      >
                        <div className="font-semibold truncate text-[11px]">{m.name}</div>
                        <div className="text-[9px] opacity-75">{m.tag}</div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Previous Chats Drawer Overlay */}
            <AnimatePresence>
              {showHistoryDrawer && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`border-b p-3 max-h-[220px] overflow-y-auto flex flex-col gap-2 z-20 shadow-md ${
                    isDark ? 'bg-[#1e140d] border-[#382416]' : 'bg-[#fffbf7] border-[#f1e4d3]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 flex items-center gap-1.5">
                      <Clock size={12} /> Previous Chat Sessions ({sessions.length})
                    </span>
                    <button
                      onClick={handleStartNewChat}
                      className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> New Chat
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {sessions.map(s => (
                      <div
                        key={s.id}
                        onClick={() => handleSelectSession(s.id)}
                        className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
                          s.id === activeSessionId
                            ? 'border-orange-500 bg-orange-500/15 font-bold text-orange-600'
                            : isDark
                            ? 'border-stone-800 bg-[#160e09] hover:bg-stone-800/80 text-stone-300'
                            : 'border-[#f1e4d3] bg-white hover:bg-orange-50 text-stone-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MessageSquare size={13} className="shrink-0 text-orange-500" />
                          <span className="truncate max-w-[240px]">{s.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] opacity-60">
                            {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(e, s.id)}
                            className="p-1 text-stone-400 hover:text-rose-500 transition-colors"
                            title="Delete session"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Body */}
            <div
              className={`flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar text-sm ${
                isDark ? 'bg-[#140e0a]' : 'bg-[#faf6f0]/60'
              }`}
            >
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[92%] sm:max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed relative group shadow-sm ${
                      m.role === 'user'
                        ? 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white rounded-br-none font-medium'
                        : isDark
                        ? 'bg-[#1f1610] border border-[#382416] text-stone-200 rounded-bl-none'
                        : 'bg-white border border-[#f1e4d3] text-[#2b1f17] rounded-bl-none'
                    }`}
                  >
                    <div className="whitespace-pre-wrap select-text leading-relaxed font-sans">
                      {renderFormattedContent(m.content)}
                    </div>

                    {m.role === 'assistant' && (
                      <button
                        onClick={() => copyToClipboard(m.content, idx)}
                        className={`opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 p-1.5 rounded-lg border text-xs cursor-pointer shadow-xs ${
                          isDark
                            ? 'bg-[#2b1c13] text-stone-300 hover:text-white border-[#452b1a]'
                            : 'bg-[#faf6f0] text-stone-600 hover:text-stone-900 border-[#f1e4d3]'
                        }`}
                        title="Copy reply"
                      >
                        {copiedIndex === idx ? (
                          <Check size={11} className="text-emerald-500" />
                        ) : (
                          <Copy size={11} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div
                  className={`flex items-center gap-2 p-3 max-w-[70%] rounded-2xl border text-xs font-semibold shadow-xs animate-pulse ${
                    isDark
                      ? 'bg-[#22160f] border-orange-500/30 text-orange-400'
                      : 'bg-white border-orange-200 text-[#ea580c]'
                  }`}
                >
                  <RefreshCw size={13} className="animate-spin text-orange-500" />
                  <span>Connectra Copilot is reasoning...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Starters (if conversation is fresh) */}
            {messages.length <= 2 && (
              <div
                className={`px-4 pb-2.5 pt-2 flex flex-col gap-2 border-t ${
                  isDark ? 'bg-[#18110c] border-[#382416]' : 'bg-white border-[#f1e4d3]'
                }`}
              >
                <span className="text-[10px] uppercase font-bold tracking-wider text-orange-600 flex items-center gap-1">
                  <Lightbulb size={12} /> Suggested Prompts for Developers
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(QUICK_PROMPT_CATEGORIES).flatMap(([cat, prompts]) =>
                    prompts.slice(0, 1).map((qp, i) => {
                      const Icon = qp.icon;
                      return (
                        <button
                          key={`${cat}-${i}`}
                          onClick={() => handleSend(qp.text)}
                          className={`p-2.5 rounded-xl border text-[11px] text-left transition-all flex items-start gap-2 cursor-pointer shadow-2xs ${
                            isDark
                              ? 'bg-[#22160f] hover:bg-[#2e1d14] border-[#382416] text-stone-300 hover:text-white'
                              : 'bg-[#fff7ed] hover:bg-[#ffedd5] border-orange-200/60 text-stone-700 hover:text-stone-900'
                          }`}
                        >
                          <Icon size={14} className="text-orange-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 font-medium">{qp.text}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSend();
              }}
              className={`p-3 border-t flex items-center gap-2 ${
                isDark ? 'bg-[#18110c] border-[#382416]' : 'bg-white border-[#f1e4d3]'
              }`}
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={`Ask Copilot anything, @${devName}...`}
                className={`flex-1 rounded-xl px-3.5 py-2.5 text-xs outline-none transition-colors border ${
                  isDark
                    ? 'bg-[#22160f] border-[#382416] text-white placeholder-stone-500 focus:border-orange-500 focus:bg-[#271911]'
                    : 'bg-[#faf6f0] border-[#f1e4d3] text-[#1c130d] placeholder-[#8d7565] focus:border-orange-500 focus:bg-white'
                }`}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer shadow-sm shadow-orange-500/25 active:scale-95"
                title="Send message"
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
