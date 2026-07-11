import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowLeft, MessageSquare, Search, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
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
  const messagesEndRef = useRef(null);
  const myId = session?.user?.id;

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

  const loadConversations = async () => {
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

    // Deduplicate into unique conversations
    const seen = new Set();
    const convos = [];
    for (const msg of data) {
      const otherId = msg.sender_id === myId ? msg.receiver_id : msg.sender_id;
      if (!seen.has(otherId)) {
        seen.add(otherId);
        const otherProfile = msg.sender_id === myId ? msg.receiver : msg.sender;
        convos.push({ ...otherProfile, lastMessage: msg.content });
      }
    }
    setConversations(convos);
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
      content: newMessage.trim()
    };
    const { data, error } = await supabase.from('messages').insert(msg).select().single();
    if (error) {
      toast.error('Failed to send message');
    } else {
      setMessages(prev => [...prev, data]);
      setNewMessage('');
      loadConversations();
    }
    setSending(false);
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

  return (
    <div className="min-h-screen pt-20 px-4 max-w-6xl mx-auto">
      <div className="flex gap-4 h-[calc(100vh-6rem)]">
        
        {/* Sidebar: Conversations */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-80 glass-panel rounded-2xl flex flex-col overflow-hidden shrink-0"
        >
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-main flex items-center gap-2 mb-3">
              <MessageSquare size={20} className="text-primary" /> Messages
            </h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search developers..."
                className="w-full bg-background border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-main outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 bg-surface border border-white/10 rounded-xl overflow-hidden">
                {searchResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => startChat(u)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {u.username[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-main">{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-muted text-sm">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                No conversations yet.<br />Search for a developer to start chatting!
              </div>
            ) : (
              conversations.map(user => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full flex items-center gap-3 p-4 transition-colors text-left border-b border-white/5 hover:bg-white/5 ${selectedUser?.id === user.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary shrink-0">
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-main">{user.username}</p>
                    {user.lastMessage && (
                      <p className="text-xs text-muted truncate">{user.lastMessage}</p>
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
          className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden"
        >
          {!selectedUser ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted gap-3">
              <MessageSquare size={48} className="opacity-20" />
              <p className="text-lg font-semibold">Select a conversation</p>
              <p className="text-sm opacity-60">Or search for a developer to message</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                  {selectedUser.username[0].toUpperCase()}
                </div>
                <div>
                  <Link to={`/profile/${selectedUser.username}`} className="text-sm font-bold text-main hover:text-primary transition-colors">
                    {selectedUser.username}
                  </Link>
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <Circle size={8} fill="currentColor" /> Online
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
                {loadingMessages ? (
                  <Loader />
                ) : messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-muted text-sm">
                    Say hello to {selectedUser.username}! 👋
                  </div>
                ) : (
                  <AnimatePresence>
                    {messages.map((msg) => {
                      const isMe = msg.sender_id === myId;
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                              isMe
                                ? 'bg-primary text-white rounded-br-sm'
                                : 'bg-surface border border-white/10 text-main rounded-bl-sm'
                            }`}
                          >
                            {msg.content}
                            <p className={`text-[10px] mt-1 ${isMe ? 'text-white/60 text-right' : 'text-muted'}`}>
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
              <div className="p-4 border-t border-white/10 flex gap-3">
                <input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={`Message ${selectedUser.username}...`}
                  className="flex-1 bg-background border border-white/10 rounded-xl px-4 py-2.5 text-sm text-main outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim()}
                  className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
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
