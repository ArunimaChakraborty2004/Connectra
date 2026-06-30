import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, UserPlus, Heart, MessageSquare, Check, XCircle } from 'lucide-react';
import { toast } from '../lib/toast';
import { Link } from 'react-router-dom';

export default function NotificationsPanel({ session, isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    // Also include pending connection requests where this user is the recipient
    const { data: notifs } = await supabase
      .from('notifications')
      .select('id, type, is_read, created_at, actor_id, profiles!actor_id(username, avatar_url)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    
    const { data: requests } = await supabase
      .from('connections')
      .select('id, created_at, status, requester_id, profiles!requester_id(username, avatar_url)')
      .eq('receiver_id', session.user.id)
      .eq('status', 'pending');

    const formattedRequests = (requests || []).map(r => ({
      id: r.id,
      type: 'connection_request',
      is_read: false,
      created_at: r.created_at,
      actor_id: r.requester_id,
      profiles: r.profiles,
      connection_id: r.id
    }));

    const all = [...(notifs || []), ...formattedRequests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setNotifications(all);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, session.user.id]);

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleAcceptRequest = async (connId) => {
    const { error } = await supabase.from('connections').update({ status: 'accepted' }).eq('id', connId);
    if (error) toast.error('Failed to accept request');
    else {
      toast.success('Connection accepted!');
      setNotifications(prev => prev.filter(n => n.connection_id !== connId));
    }
  };

  const handleRejectRequest = async (connId) => {
    const { error } = await supabase.from('connections').delete().eq('id', connId);
    if (error) toast.error('Failed to reject request');
    else {
      setNotifications(prev => prev.filter(n => n.connection_id !== connId));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <motion.div 
            initial={{ x: '100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-[#0a0a0a] border-l border-[#222] shadow-2xl z-50 flex flex-col"
          >
            <div className="p-4 border-b border-[#222] flex items-center justify-between bg-[#111]">
              <div className="flex items-center gap-2">
                <Bell size={20} className="text-white" />
                <h2 className="text-lg font-bold text-white">Notifications</h2>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={markAllRead} className="text-xs text-[#888] hover:text-white transition-colors">Mark all read</button>
                <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors"><X size={20} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-3">
              {loading ? (
                <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>
              ) : notifications.length === 0 ? (
                <div className="text-center text-[#666] py-12 text-sm">No new notifications.</div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`p-4 rounded-xl border flex gap-3 ${!n.is_read ? 'bg-[#111] border-[#333]' : 'bg-[#0a0a0a] border-[#222]'}`}>
                    <div className="pt-1">
                      {n.type === 'connection_request' && <UserPlus size={18} className="text-blue-400" />}
                      {n.type === 'like' && <Heart size={18} className="text-pink-500" />}
                      {n.type === 'comment' && <MessageSquare size={18} className="text-green-400" />}
                      {n.type === 'connection_accepted' && <Check size={18} className="text-green-400" />}
                    </div>
                    <div className="flex-1 text-sm text-[#ccc]">
                      <span className="font-semibold text-white mr-1">{n.profiles?.username}</span>
                      {n.type === 'connection_request' && 'sent you a connection request.'}
                      {n.type === 'like' && 'liked your post.'}
                      {n.type === 'comment' && 'commented on your post.'}
                      {n.type === 'connection_accepted' && 'accepted your connection request.'}
                      
                      <div className="text-xs text-[#666] mt-1">{new Date(n.created_at).toLocaleDateString()}</div>
                      
                      {n.type === 'connection_request' && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleAcceptRequest(n.connection_id)} className="flex-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 py-1.5 rounded-md font-semibold transition-colors flex items-center justify-center gap-1">
                            <Check size={14} /> Accept
                          </button>
                          <button onClick={() => handleRejectRequest(n.connection_id)} className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 py-1.5 rounded-md font-semibold transition-colors flex items-center justify-center gap-1">
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
