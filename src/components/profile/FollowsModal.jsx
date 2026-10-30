import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, UserPlus, UserCheck, UserMinus, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import Loader from '../ui/Loader';
import { toast } from '../../lib/toast';
import { createNotification } from '../../lib/notifications';

export default function FollowsModal({
  isOpen,
  onClose,
  userId,
  username,
  initialTab = 'followers', // 'followers' | 'following'
  session,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [myFollowingMap, setMyFollowingMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isOpen && userId) {
      loadData();
    }
  }, [isOpen, userId, session?.user?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch people who follow this user
      const { data: followerRows } = await supabase
        .from('follows')
        .select('follower_id, created_at, profiles!follower_id(id, username, bio, avatar_url, tech_stack)')
        .eq('following_id', userId);

      // 2. Fetch people this user follows
      const { data: followingRows } = await supabase
        .from('follows')
        .select('following_id, created_at, profiles!following_id(id, username, bio, avatar_url, tech_stack)')
        .eq('follower_id', userId);

      // 3. Fetch current logged in user's following list to know who I already follow
      let myMap = {};
      if (session?.user?.id) {
        const { data: myFollows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', session.user.id);
        (myFollows || []).forEach(f => {
          myMap[f.following_id] = true;
        });
      }

      setFollowers((followerRows || []).map(r => r.profiles).filter(Boolean));
      setFollowing((followingRows || []).map(r => r.profiles).filter(Boolean));
      setMyFollowingMap(myMap);
    } catch (err) {
      console.warn('Error loading follow list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (targetId, targetUsername) => {
    if (!session?.user?.id || targetId === session.user.id) return;

    const isFollowing = Boolean(myFollowingMap[targetId]);

    if (isFollowing) {
      // Unfollow
      setMyFollowingMap(prev => {
        const n = { ...prev };
        delete n[targetId];
        return n;
      });
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', session.user.id)
        .eq('following_id', targetId);

      if (error) {
        toast.error(error.message);
        setMyFollowingMap(prev => ({ ...prev, [targetId]: true }));
      } else {
        toast.info(`Unfollowed @${targetUsername}`);
        window.dispatchEvent(new Event('refreshStats'));
      }
    } else {
      // Follow
      setMyFollowingMap(prev => ({ ...prev, [targetId]: true }));
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: session.user.id, following_id: targetId });

      if (error) {
        toast.error(error.message);
        setMyFollowingMap(prev => {
          const n = { ...prev };
          delete n[targetId];
          return n;
        });
      } else {
        toast.success(`Following @${targetUsername}!`);
        createNotification({
          userId: targetId,
          actorId: session.user.id,
          type: 'follow',
          entityId: targetId,
        });
        window.dispatchEvent(new Event('refreshStats'));
      }
    }
  };

  if (!isOpen) return null;

  const currentList = activeTab === 'followers' ? followers : following;
  const filteredList = currentList.filter(u => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      u.username?.toLowerCase().includes(q) ||
      u.bio?.toLowerCase().includes(q) ||
      u.tech_stack?.toLowerCase().includes(q)
    );
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          className="relative w-full max-w-md bg-white border border-[#f1e4d3] rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh]"
          style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
        >
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Users size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base text-main">
                  @{username || 'Developer'}
                </h3>
                <p className="text-[11px] text-muted">Network & Community</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-surface-hover text-muted hover:text-main transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b text-sm font-semibold" style={{ borderColor: 'var(--border-color)' }}>
            <button
              onClick={() => setActiveTab('followers')}
              className={`flex-1 py-3 text-center transition-all cursor-pointer border-b-2 ${
                activeTab === 'followers'
                  ? 'border-primary text-primary font-bold bg-primary/5'
                  : 'border-transparent text-muted hover:text-main'
              }`}
            >
              Followers ({followers.length})
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`flex-1 py-3 text-center transition-all cursor-pointer border-b-2 ${
                activeTab === 'following'
                  ? 'border-primary text-primary font-bold bg-primary/5'
                  : 'border-transparent text-muted hover:text-main'
              }`}
            >
              Following ({following.length})
            </button>
          </div>

          {/* Search filter in modal */}
          <div className="p-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${activeTab}...`}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs outline-none bg-background text-main border border-border"
              />
            </div>
          </div>

          {/* Users List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
            {loading ? (
              <div className="py-12 flex justify-center">
                <Loader />
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted">
                {search
                  ? `No ${activeTab} match "${search}"`
                  : activeTab === 'followers'
                  ? 'No followers yet.'
                  : 'Not following anyone yet.'}
              </div>
            ) : (
              filteredList.map(u => {
                const isMe = u.id === session?.user?.id;
                const iFollow = Boolean(myFollowingMap[u.id]);

                return (
                  <div
                    key={u.id}
                    className="p-2.5 rounded-2xl flex items-center justify-between gap-3 bg-surface/50 border border-border hover:border-primary/20 transition-all"
                  >
                    <Link
                      to={`/profile/${u.username}`}
                      onClick={onClose}
                      className="flex items-center gap-3 min-w-0 flex-1 group"
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0 border border-border">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                        ) : (
                          u.username?.[0]?.toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-main truncate group-hover:text-primary transition-colors">
                          @{u.username}
                        </p>
                        <p className="text-[11px] text-muted truncate">
                          {u.bio || (u.tech_stack ? u.tech_stack.split(',').slice(0, 2).join(', ') : 'Developer')}
                        </p>
                      </div>
                    </Link>

                    {!isMe && (
                      <button
                        onClick={() => handleFollowToggle(u.id, u.username)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                          iFollow
                            ? 'bg-surface text-muted border border-border hover:border-rose-400/40 hover:text-rose-400'
                            : 'bg-primary text-white hover:opacity-90 shadow-sm'
                        }`}
                      >
                        {iFollow ? (
                          <>
                            <UserCheck size={12} className="text-emerald-500" />
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <UserPlus size={12} />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
