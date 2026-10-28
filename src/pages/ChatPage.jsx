import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageSquare, Search, Circle, ArrowLeft, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from '../lib/toast';
import Loader from '../components/ui/Loader';

export default function ChatPage({ session }) {
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const myId = session?.user?.id;
  const navigate = useNavigate();

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    loadMessages(selectedUser.id);

    const channel = supabase
      .channel(`chat-${myId}-${selectedUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${myId}`
      }, payload => {
        if (payload.new.sender_id === selectedUser.id) {
          setMessages(prev => [...prev, payload.new]);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle startChat custom event from other pages (Collab Board, Profile)
  useEffect(() => {
    const handleStartChat = (e) => {
      const { userId, username } = e.detail || {};
      if (userId && username) {
        startChat({ id: userId, username });
      }
    };
    document.addEventListener('startChat', handleStartChat);
    return () => document.removeEventListener('startChat', handleStartChat);
  }, []);

  const loadConversations = async () => {
    setLoadingConvos(true);
    try {
      const { data } = await supabase
        .from('messages')
        .select(`
          id, sender_id, receiver_id, content, created_at,
          sender:profiles!messages_sender_id_fkey(id, username, avatar_url),
          receiver:profiles!messages_receiver_id_fkey(id, username, avatar_url)
        `)
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: false });

      if (!data) return;

      const seen = new Set();
      const convos = [];
      for (const msg of data) {
        const otherId = msg.sender_id === myId ? msg.receiver_id : msg.sender_id;
        if (!seen.has(otherId)) {
          seen.add(otherId);
          const otherProfile = msg.sender_id === myId ? msg.receiver : msg.sender;
          if (otherProfile) convos.push({ ...otherProfile, lastMessage: msg.content });
        }
      }
      setConversations(convos);
    } catch (err) {
      console.error('loadConversations error:', err);
    } finally {
      setLoadingConvos(false);
    }
  };

  const loadMessages = async (otherUserId) => {
    setLoadingMessages(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoadingMessages(false);

    // Mark as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', otherUserId)
      .eq('receiver_id', myId);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    setSending(true);
    const msg = {
      sender_id: myId,
      receiver_id: selectedUser.id,
      content: newMessage.trim(),
    };
    const { data, error } = await supabase.from('messages').insert(msg).select().single();
    if (error) {
      toast.error('Failed to send message: ' + error.message);
    } else {
      setMessages(prev => [...prev, data]);
      setNewMessage('');
      loadConversations();
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${q}%`)
      .neq('id', myId)
      .limit(6);
    setSearchResults(data || []);
  };

  const startChat = (user) => {
    setSelectedUser(user);
    setSearchQuery('');
    setSearchResults([]);
    if (!conversations.find(c => c.id === user.id)) {
      setConversations(prev => [{ ...user, lastMessage: '' }, ...prev]);
    }
  };

  const cardStyle = {
    backgroundColor: 'var(--surface-color)',
    border: '1px solid var(--border-color)',
  };

  return (
    <div className="min-h-screen pt-14 px-4" style={{ backgroundColor: 'var(--bg-color)' }}>
      <div className="max-w-6xl mx-auto flex gap-4" style={{ height: 'calc(100vh - 3.5rem)', padding: '1rem 0' }}>
        
        {/* Conversations Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-80 rounded-2xl flex flex-col overflow-hidden shrink-0"
          style={cardStyle}
        >
          <div className="p-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-3" style={{ color: 'var(--text-color)' }}>
              <MessageSquare size={20} style={{ color: 'var(--primary-color)' }} /> Messages
            </h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search developers..."
                className="w-full rounded-xl pl-8 pr-3 py-2 text-sm outline-none transition-colors"
                style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div
                className="mt-2 rounded-xl overflow-hidden"
                style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
              >
                {searchResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => startChat(u)}
                    className="w-full flex items-center gap-3 p-3 transition-colors text-left"
                    style={{ color: 'var(--text-color)' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: 'var(--primary-color)' }}
                    >
                      {u.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm">{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {loadingConvos ? (
              <Loader />
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                <MessageSquare size={32} className="mx-auto mb-2" style={{ opacity: 0.3 }} />
                No conversations yet.<br />Search for a developer to start chatting!
              </div>
            ) : (
              conversations.map(user => (
                <button
                  key={user.id}
                  onClick={() => { setSelectedUser(user); }}
                  className="w-full flex items-center gap-3 p-4 transition-colors text-left"
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: selectedUser?.id === user.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                    borderLeft: selectedUser?.id === user.id ? '3px solid var(--primary-color)' : '3px solid transparent',
                  }}
                  onMouseEnter={e => { if (selectedUser?.id !== user.id) e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { if (selectedUser?.id !== user.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0"
                    style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: 'var(--primary-color)' }}
                  >
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-color)' }}>{user.username}</p>
                    {user.lastMessage && (
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user.lastMessage}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </motion.div>

        {/* Chat Area */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 rounded-2xl flex flex-col overflow-hidden"
          style={cardStyle}
        >
          {!selectedUser ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ color: 'var(--text-muted)' }}>
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-color)' }}
              >
                <MessageSquare size={36} style={{ opacity: 0.35 }} />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold" style={{ color: 'var(--text-color)' }}>Select a conversation</p>
                <p className="text-sm mt-1">Or search for a developer to message</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div
                className="p-4 flex items-center gap-3"
                style={{ borderBottom: '1px solid var(--border-color)' }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold overflow-hidden"
                  style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: 'var(--primary-color)' }}
                >
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt={selectedUser.username} className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.username[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <Link
                    to={`/profile/${selectedUser.username}`}
                    className="text-sm font-bold transition-colors"
                    style={{ color: 'var(--text-color)' }}
                    onMouseEnter={e => e.target.style.color = 'var(--primary-color)'}
                    onMouseLeave={e => e.target.style.color = 'var(--text-color)'}
                  >
                    {selectedUser.username}
                  </Link>
                  <p className="text-xs flex items-center gap-1" style={{ color: '#10b981' }}>
                    <Circle size={8} fill="currentColor" /> Online
                  </p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 rounded-xl transition-colors md:hidden"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <ArrowLeft size={18} />
                </button>
              </div>

              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
                style={{ scrollbarWidth: 'thin' }}
              >
                {loadingMessages ? (
                  <Loader />
                ) : messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    👋 Say hello to {selectedUser.username}!
                  </div>
                ) : (
                  <AnimatePresence>
                    {messages.map(msg => {
                      const isMe = msg.sender_id === myId;
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className="max-w-[72%] px-4 py-2.5 rounded-2xl text-sm"
                            style={
                              isMe
                                ? { backgroundColor: 'var(--primary-color)', color: '#fff', borderBottomRightRadius: 4 }
                                : { backgroundColor: 'var(--surface-hover)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderBottomLeftRadius: 4 }
                            }
                          >
                            {msg.content}
                            <p className="text-[10px] mt-1" style={{ opacity: 0.65, textAlign: isMe ? 'right' : 'left' }}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div
                className="p-4 flex gap-3"
                style={{ borderTop: '1px solid var(--border-color)' }}
              >
                <input
                  ref={inputRef}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={`Message ${selectedUser.username}...`}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
                  style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim()}
                  className="p-2.5 text-white rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: 'var(--primary-color)' }}
                  onMouseEnter={e => { if (!sending) e.currentTarget.style.backgroundColor = 'var(--primary-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--primary-color)'; }}
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
