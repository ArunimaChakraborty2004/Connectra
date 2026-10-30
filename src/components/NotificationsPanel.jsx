import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, UserPlus, Heart, MessageSquare, Check, XCircle } from 'lucide-react';
import { toast } from '../lib/toast';

export default function NotificationsPanel({ session, isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div 
            initial={{ x: '100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-white border-l border-[#f1e4d3] shadow-2xl z-50 flex flex-col"
          >
            <div className="p-4 border-b border-[#f1e4d3] flex items-center justify-between bg-[#fffcf7]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#ffedd5] text-[#ea580c] rounded-xl">
                  <Bell size={18} />
                </div>
                <h2 className="text-base font-bold text-[#1c130d]">Notifications</h2>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={markAllRead} className="text-xs font-bold text-[#ea580c] hover:underline cursor-pointer">Mark all read</button>
                <button onClick={onClose} className="p-1.5 hover:bg-[#faf6f0] rounded-xl text-[#6b5546] hover:text-[#1c130d] transition-colors cursor-pointer"><X size={18} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-3 bg-[#faf6f0]/40">
              {loading ? (
                <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-[#ea580c] border-t-transparent rounded-full animate-spin"></div></div>
              ) : notifications.length === 0 ? (
                <div className="text-center text-[#6b5546] py-12 text-sm font-semibold">No new notifications.</div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`p-4 rounded-2xl border flex gap-3 ${!n.is_read ? 'bg-[#fff7ed] border-orange-200 shadow-2xs' : 'bg-white border-[#f1e4d3]'}`}>
                    <div className="pt-0.5">
                      {n.type === 'connection_request' && <UserPlus size={18} className="text-blue-500" />}
                      {n.type === 'like' && <Heart size={18} className="text-rose-500" fill="#f43f5e" />}
                      {n.type === 'comment' && <MessageSquare size={18} className="text-[#ea580c]" />}
                      {n.type === 'connection_accepted' && <Check size={18} className="text-emerald-500" />}
                    </div>
                    <div className="flex-1 text-xs text-[#6b5546] leading-relaxed">
                      <span className="font-bold text-[#1c130d] mr-1">{n.profiles?.username || 'Someone'}</span>
                      {n.type === 'connection_request' && 'sent you a connection request.'}
                      {n.type === 'like' && 'liked your post.'}
                      {n.type === 'comment' && 'commented on your post.'}
                      {n.type === 'connection_accepted' && 'accepted your connection request.'}
                      
                      <div className="text-[10px] text-[#8d7565] font-semibold mt-1">{new Date(n.created_at).toLocaleDateString()}</div>
                      
                      {n.type === 'connection_request' && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleAcceptRequest(n.connection_id)} className="flex-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 py-1.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer">
                            <Check size={14} /> Accept
                          </button>
                          <button onClick={() => handleRejectRequest(n.connection_id)} className="flex-1 bg-rose-100 hover:bg-rose-200 text-rose-800 py-1.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer">
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
