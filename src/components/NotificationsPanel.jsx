import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  X,
  UserPlus,
  Heart,
  MessageSquare,
  Check,
  XCircle,
  ChevronRight,
  Megaphone,
  Briefcase,
  Users,
  ExternalLink,
  Sparkles,
  FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../lib/toast';
import { createNotification } from '../lib/notifications';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsPanel({ session, isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    if (!session?.user?.id) return;
    try {
      // 1. Fetch notifications for current user
      let rawNotifs = [];
      const { data: notifsData, error: notifErr } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (notifErr) {
        console.warn('Notifications fetch notice:', notifErr.message);
      } else if (notifsData) {
        rawNotifs = notifsData;
      }

      // 2. Fetch pending connection requests for current user
      let rawConns = [];
      const { data: connsData, error: connErr } = await supabase
        .from('connections')
        .select('*')
        .eq('receiver_id', session.user.id)
        .eq('status', 'pending');

      if (connErr) {
        console.warn('Connections fetch notice:', connErr.message);
      } else if (connsData) {
        rawConns = connsData;
      }

      // 3. Collect unique actor and requester IDs to batch fetch user profiles
      const userIds = new Set();
      rawNotifs.forEach((n) => {
        if (n.actor_id) userIds.add(n.actor_id);
      });
      rawConns.forEach((c) => {
        if (c.requester_id) userIds.add(c.requester_id);
      });

      let profilesMap = {};
      if (userIds.size > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', Array.from(userIds));

        (profilesData || []).forEach((p) => {
          profilesMap[p.id] = p;
        });
      }

      // 4. Format notifications with profile info
      const formattedNotifs = rawNotifs.map((n) => {
        const userProfile = profilesMap[n.actor_id] || { username: 'developer', avatar_url: null };
        return {
          ...n,
          profiles: userProfile,
        };
      });

      // 5. Format connections with profile info
      const formattedRequests = rawConns.map((r) => {
        const userProfile = profilesMap[r.requester_id] || { username: 'developer', avatar_url: null };
        return {
          id: r.id,
          type: 'connection_request',
          entity_id: r.requester_id,
          is_read: false,
          created_at: r.created_at,
          actor_id: r.requester_id,
          profiles: userProfile,
          connection_id: r.id,
        };
      });

      const all = [...formattedNotifs, ...formattedRequests].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      setNotifications(all);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }

    if (!session?.user?.id) return;

    // Realtime subscription for incoming notifications and connections
    const channel = supabase
      .channel(`notifs-live-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => loadNotifications()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
          filter: `receiver_id=eq.${session.user.id}`,
        },
        () => loadNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, session?.user?.id]);

  const markAllRead = async () => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      window.dispatchEvent(new Event('refreshStats'));
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const getDestination = (n) => {
    const rawUsername = n.profiles?.username;
    const actorId = n.actor_id;

    switch (n.type) {
      case 'follow':
      case 'connection_request':
      case 'connection_accepted':
        if (rawUsername && rawUsername !== 'developer') {
          return `/profile/${encodeURIComponent(rawUsername)}`;
        }
        if (actorId) {
          return `/profile/${actorId}`;
        }
        return '/search';

      case 'like':
      case 'post':
        if (n.entity_id) {
          return `/post/${n.entity_id}`;
        }
        if (rawUsername && rawUsername !== 'developer') {
          return `/profile/${encodeURIComponent(rawUsername)}`;
        }
        return '/';

      case 'story':
        return '/';

      case 'comment':
        if (n.entity_id) {
          return `/post/${n.entity_id}?comments=open`;
        }
        if (rawUsername && rawUsername !== 'developer') {
          return `/profile/${encodeURIComponent(rawUsername)}`;
        }
        return '/';

      case 'message':
      case 'chat':
        if (actorId) {
          return `/chat?user=${actorId}`;
        }
        return '/chat';

      case 'group_announcement':
      case 'group':
        if (n.entity_id) {
          return `/chat?group=${n.entity_id}`;
        }
        return '/chat';

      case 'project':
        if (n.entity_id) {
          return `/projects/${n.entity_id}`;
        }
        return '/';

      case 'community':
        if (n.entity_id) {
          return `/communities/${n.entity_id}`;
        }
        return '/communities';

      default:
        if (rawUsername && rawUsername !== 'developer') {
          return `/profile/${encodeURIComponent(rawUsername)}`;
        }
        if (actorId) {
          return `/profile/${actorId}`;
        }
        return '/';
    }
  };

  const getViewLabel = (n) => {
    switch (n.type) {
      case 'like':
      case 'comment':
      case 'post':
        return 'View post';
      case 'story':
        return 'View story';
      case 'follow':
      case 'connection_request':
      case 'connection_accepted':
        return 'View profile';
      case 'message':
      case 'chat':
        return 'Open chat';
      case 'group_announcement':
      case 'group':
        return 'Open group';
      case 'project':
        return 'View project';
      case 'community':
        return 'View community';
      default:
        return 'View';
    }
  };

  const handleNotificationClick = async (n) => {
    // 1. Mark as read immediately in Supabase
    if (!n.is_read && n.id && !n.connection_id) {
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', n.id)
        .then(() => {});
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
      window.dispatchEvent(new Event('refreshStats'));
    }

    // 2. Compute exact destination URL
    const destination = getDestination(n);

    // 3. Close drawer
    onClose();

    // 4. Perform direct redirect
    try {
      navigate(destination);
    } catch {
      window.location.assign(destination);
    }
  };

  const handleAcceptRequest = async (e, connId, requesterId) => {
    e.stopPropagation();
    const { error } = await supabase.from('connections').update({ status: 'accepted' }).eq('id', connId);
    if (error) {
      toast.error('Failed to accept request');
    } else {
      // Also add follower to follows table
      if (requesterId && session?.user?.id) {
        try {
          await supabase.from('follows').insert({
            follower_id: requesterId,
            following_id: session.user.id,
          });
        } catch (followErr) {
          console.warn('Note on follow insert:', followErr);
        }
      }
      toast.success('Follow request accepted!');
      setNotifications((prev) => prev.filter((n) => n.connection_id !== connId));
      if (requesterId) {
        createNotification({
          userId: requesterId,
          actorId: session.user.id,
          type: 'connection_accepted',
          entityId: connId,
        });
      }
      window.dispatchEvent(new Event('refreshStats'));
    }
  };

  const handleRejectRequest = async (e, connId) => {
    e.stopPropagation();
    const { error } = await supabase.from('connections').delete().eq('id', connId);
    if (error) {
      toast.error('Failed to decline request');
    } else {
      toast.success('Follow request declined');
      setNotifications((prev) => prev.filter((n) => n.connection_id !== connId));
      window.dispatchEvent(new Event('refreshStats'));
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-full max-w-sm sm:max-w-md bg-white border-l border-[#f1e4d3] shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#f1e4d3] flex items-center justify-between bg-[#fffcf7]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-tr from-[#ea580c] to-[#f97316] text-white rounded-xl shadow-xs">
                  <Bell size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#1c130d]">Notifications</h2>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-[11px] font-extrabold bg-[#ea580c] text-white rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#8d7565]">Click any notification to open it directly</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-bold text-[#ea580c] hover:underline cursor-pointer px-2 py-1"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-[#faf6f0] rounded-xl text-[#6b5546] hover:text-[#1c130d] transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 flex flex-col gap-2.5 bg-[#faf6f0]/40">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-12 gap-3">
                  <div className="w-7 h-7 border-3 border-[#ea580c] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold text-[#8d7565]">Loading notifications...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-16 px-6 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-orange-100/70 flex items-center justify-center text-[#ea580c]">
                    <Bell size={24} />
                  </div>
                  <div className="font-bold text-[#1c130d] text-sm">All caught up!</div>
                  <p className="text-xs text-[#8d7565] max-w-xs leading-relaxed">
                    You have no new notifications right now. Activity and interactions will show up here.
                  </p>
                </div>
              ) : (
                notifications.map((n) => {
                  const username = n.profiles?.username || 'developer';
                  const avatarUrl = n.profiles?.avatar_url;
                  const initial = username[0]?.toUpperCase() || 'U';
                  const viewLabel = getViewLabel(n);

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                        !n.is_read
                          ? 'bg-[#fff8f0] border-orange-200/90 shadow-2xs hover:border-orange-400 hover:bg-[#fff3e4]'
                          : 'bg-white border-[#f1e4d3] hover:border-[#e2cbaf] hover:bg-[#fffcf7]'
                      }`}
                    >
                      {/* Unread Glowing Dot */}
                      {!n.is_read && (
                        <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-[#ea580c] ring-4 ring-orange-200" />
                      )}

                      <div className="flex gap-3 items-start">
                        {/* Avatar with Badged Action Icon */}
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#ea580c] via-[#f97316] to-[#facc15] p-0.5">
                            <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#2b1f17] overflow-hidden">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                              ) : (
                                initial
                              )}
                            </div>
                          </div>

                          {/* Corner Action Icon */}
                          <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-white shadow-xs border border-[#f1e4d3]">
                            {n.type === 'follow' && <UserPlus size={12} className="text-indigo-600" />}
                            {n.type === 'connection_request' && <UserPlus size={12} className="text-blue-500" />}
                            {n.type === 'connection_accepted' && <Check size={12} className="text-emerald-500" />}
                            {n.type === 'like' && <Heart size={12} className="text-rose-500 fill-rose-500" />}
                            {n.type === 'comment' && <MessageSquare size={12} className="text-[#ea580c]" />}
                            {n.type === 'post' && <FileText size={12} className="text-[#ea580c]" />}
                            {n.type === 'story' && <Sparkles size={12} className="text-amber-500" />}
                            {(n.type === 'message' || n.type === 'chat') && (
                              <MessageSquare size={12} className="text-blue-600" />
                            )}
                            {(n.type === 'group_announcement' || n.type === 'group') && (
                              <Megaphone size={12} className="text-purple-600" />
                            )}
                            {n.type === 'project' && <Briefcase size={12} className="text-amber-600" />}
                            {n.type === 'community' && <Users size={12} className="text-teal-600" />}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-xs text-[#6b5546] leading-relaxed">
                            <span className="font-bold text-[#1c130d] mr-1 group-hover:text-[#ea580c] transition-colors">
                              @{username}
                            </span>
                            {n.type === 'follow' && 'started following you.'}
                            {n.type === 'connection_request' && 'requested to follow you.'}
                            {n.type === 'connection_accepted' && 'accepted your follow request.'}
                            {n.type === 'like' && 'liked your post.'}
                            {n.type === 'comment' && 'commented on your post.'}
                            {n.type === 'post' && 'published a new post.'}
                            {n.type === 'story' && 'shared a new dev story.'}
                            {(n.type === 'message' || n.type === 'chat') && 'sent you a direct message.'}
                            {(n.type === 'group_announcement' || n.type === 'group') &&
                              'posted an announcement in the group.'}
                            {n.type === 'project' && 'invited you to a project.'}
                            {n.type === 'community' && 'invited you to join a community.'}
                            {!['follow', 'connection_request', 'connection_accepted', 'like', 'comment', 'message', 'chat', 'group_announcement', 'group', 'project', 'community'].includes(n.type) &&
                              'sent you a notification.'}
                          </p>

                          <div className="flex items-center justify-between gap-2 mt-2">
                            <span className="text-[10px] text-[#8d7565] font-semibold">{timeAgo(n.created_at)}</span>

                            {/* Clickable View Action Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNotificationClick(n);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#ea580c] bg-orange-100/70 hover:bg-[#ea580c] hover:text-white rounded-lg transition-all cursor-pointer shadow-2xs active:scale-95"
                            >
                              {viewLabel} <ChevronRight size={12} />
                            </button>
                          </div>

                          {/* Connection Request Quick Action Buttons */}
                          {n.type === 'connection_request' && (
                            <div className="flex gap-2 mt-2.5">
                              <button
                                onClick={(e) => handleAcceptRequest(e, n.connection_id, n.actor_id)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1.5 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                              >
                                <Check size={14} /> Accept
                              </button>
                              <button
                                onClick={(e) => handleRejectRequest(e, n.connection_id)}
                                className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs py-1.5 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-rose-200 active:scale-95"
                              >
                                <XCircle size={14} /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
