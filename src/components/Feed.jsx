import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import CreatePost from './feed/CreatePost';
import PostCard from './feed/PostCard';
import Loader from './ui/Loader';
import EmptyState from './ui/EmptyState';
import { MessageSquare, Plus, X, ChevronLeft, ChevronRight, Play, Film } from 'lucide-react';
import { Link } from 'react-router-dom';
import CreateReel from './reels/CreateReel';

function StoriesRow({ session }) {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [reels, setReels] = useState([]);
  const [activeStory, setActiveStory] = useState(null);
  const [showCreateStory, setShowCreateStory] = useState(false);

  const fetchStoriesAndReels = async () => {
    try {
      // 1. Fetch reels from database
      const { data: reelsData } = await supabase
        .from('reels')
        .select('*, profiles(username, avatar_url)')
        .order('created_at', { ascending: false });

      if (reelsData) {
        setReels(reelsData);
      }

      // 2. Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio')
        .limit(10);

      if (profiles) {
        const self = profiles.find((p) => p.id === session?.user?.id);
        const others = profiles.filter((p) => p.id !== session?.user?.id);
        setCurrentUser(self);
        setUsers(others);
      }
    } catch (err) {
      console.error('Error fetching stories:', err);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchStoriesAndReels();
    }
  }, [session?.user?.id]);

  const handleOpenUserStory = (user) => {
    // Check if this user has posted reels
    const userReels = reels.filter((r) => r.user_id === user.id);
    if (userReels.length > 0) {
      setActiveStory({
        user,
        reel: userReels[0],
      });
    } else {
      // Fallback display card preview if no video reel uploaded yet
      setActiveStory({
        user,
        fallbackText: `${user.username}'s Daily Dev Update: Exploring code and building in Connectra!`,
      });
    }
  };

  const initial = currentUser?.username?.[0]?.toUpperCase() || 'U';

  const handleNextStory = () => {
    if (!activeStory) return;
    const allUsers = [currentUser, ...users].filter(Boolean);
    const currentIndex = allUsers.findIndex(u => u.id === activeStory.user.id);
    if (currentIndex >= 0 && currentIndex < allUsers.length - 1) {
      handleOpenUserStory(allUsers[currentIndex + 1]);
    } else {
      setActiveStory(null);
    }
  };

  const handlePrevStory = () => {
    if (!activeStory) return;
    const allUsers = [currentUser, ...users].filter(Boolean);
    const currentIndex = allUsers.findIndex(u => u.id === activeStory.user.id);
    if (currentIndex > 0) {
      handleOpenUserStory(allUsers[currentIndex - 1]);
    }
  };

  return (
    <>
      <div className="rounded-2xl p-4 bg-white border border-[#f1e4d3] shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#2b1f17] tracking-tight">Stories</h2>
          <button
            onClick={() => setShowCreateStory(true)}
            className="text-[11px] font-bold text-[#ea580c] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus size={13} strokeWidth={3} /> Post Story
          </button>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1">
          {/* + Add Story Button (Opens Reel/Story Creator modal directly) */}
          <button
            onClick={() => setShowCreateStory(true)}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group text-left"
          >
            <div className="w-14 h-14 rounded-full bg-[#fff7ed] border border-[#fed7aa] flex items-center justify-center text-orange-600 group-hover:scale-105 group-hover:border-orange-500 transition-all shadow-2xs">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#ea580c] to-[#f97316] flex items-center justify-center text-white shadow-xs">
                <Plus size={20} strokeWidth={2.8} />
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#8d7565] group-hover:text-[#ea580c] transition-colors">
              Add Story
            </span>
          </button>

          {/* Current User Story */}
          {currentUser && (
            <button
              onClick={() => handleOpenUserStory(currentUser)}
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
            >
              <div className="p-0.5 rounded-full bg-gradient-to-tr from-[#ea580c] via-[#f97316] to-[#facc15] group-hover:scale-105 transition-all shadow-2xs">
                <div className="w-13 h-13 rounded-full overflow-hidden p-0.5 bg-white">
                  {currentUser.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
                      alt={currentUser.username}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-[#faf6f0] flex items-center justify-center text-sm font-bold text-[#ea580c]">
                      {initial}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#8d7565] group-hover:text-[#2b1f17] transition-colors truncate max-w-[62px] text-center">
                Your Story
              </span>
            </button>
          )}

          {/* Real Users from Database */}
          {users.map((user) => {
            const userInitial = user.username?.[0]?.toUpperCase() || 'D';
            const hasReel = reels.some((r) => r.user_id === user.id);

            return (
              <button
                key={user.id}
                onClick={() => handleOpenUserStory(user)}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
              >
                <div className={`p-0.5 rounded-full ${hasReel ? 'bg-gradient-to-tr from-[#ea580c] via-[#f97316] to-[#facc15] shadow-xs' : 'bg-[#fed7aa]'} group-hover:scale-105 transition-all shadow-2xs`}>
                  <div className="w-13 h-13 rounded-full overflow-hidden p-0.5 bg-white">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.username}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-[#faf6f0] flex items-center justify-center text-sm font-bold text-[#ea580c]">
                        {userInitial}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-[#8d7565] group-hover:text-[#2b1f17] transition-colors truncate max-w-[62px] text-center">
                  {user.username}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Story Viewer Modal with Progress Bar & Arrow Navigation */}
      <AnimatePresence>
        {activeStory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            {/* Left Nav Arrow */}
            <button
              onClick={handlePrevStory}
              className="hidden sm:flex absolute left-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors z-20"
              title="Previous Story"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Right Nav Arrow */}
            <button
              onClick={handleNextStory}
              className="hidden sm:flex absolute right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors z-20"
              title="Next Story"
            >
              <ChevronRight size={24} />
            </button>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm aspect-[9/16] max-h-[85vh] rounded-3xl overflow-hidden bg-black flex flex-col justify-between shadow-2xl border border-white/15"
            >
              {/* Top Progress Bar */}
              <div className="absolute top-2 left-3 right-3 z-20 flex gap-1.5">
                <div className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 7, ease: 'linear' }}
                    onAnimationComplete={handleNextStory}
                    className="h-full bg-white rounded-full"
                  />
                </div>
              </div>

              {/* Top User Info Bar */}
              <div className="pt-5 px-4 pb-3 bg-gradient-to-b from-black/90 to-transparent flex items-center justify-between z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-white/40 bg-[#ea580c] flex items-center justify-center text-xs font-bold text-white shadow-sm">
                    {activeStory.user.avatar_url ? (
                      <img src={activeStory.user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      activeStory.user.username?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block leading-tight">@{activeStory.user.username}</span>
                    <span className="text-[10px] text-white/70">Connectra Developer Story</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveStory(null)}
                  className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Story Content (Video or fallback card) */}
              <div className="flex-1 flex items-center justify-center p-6 text-center">
                {activeStory.reel ? (
                  <video
                    src={activeStory.reel.video_url}
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-[#ea580c]/30 via-[#f97316]/20 to-amber-500/10 border border-orange-500/30 text-white flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-[#f97316]">
                      <Film size={32} />
                    </div>
                    <p className="text-sm font-semibold leading-relaxed">
                      {activeStory.fallbackText}
                    </p>
                    <Link
                      to={`/profile/${activeStory.user.username}`}
                      onClick={() => setActiveStory(null)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white font-bold text-xs mt-2 hover:opacity-95 shadow-md"
                    >
                      View Profile
                    </Link>
                  </div>
                )}
              </div>

              {/* Bottom Caption if reel */}
              {activeStory.reel?.caption && (
                <div className="p-4 bg-gradient-to-t from-black/90 to-transparent z-10 text-white text-xs">
                  {activeStory.reel.caption}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Story/Reel Modal */}
      {showCreateStory && (
        <CreateReel
          session={session}
          onClose={() => setShowCreateStory(false)}
          onCreated={fetchStoriesAndReels}
        />
      )}
    </>
  );
}

export default function Feed({ session, userIdFilter = null, communityIdFilter = null, placeholder }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = async () => {
    try {
      let query = supabase
        .from('posts')
        .select(`
          id, user_id, content, image_url, code_snippet, code_language, created_at, updated_at,
          profiles(username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (userIdFilter) {
        query = query.eq('user_id', userIdFilter);
      }

      const { data: postsData, error: postsError } = await query;
      if (postsError) {
        console.error('Posts query error:', postsError);
      }

      if (postsData && postsData.length > 0) {
        const postIds = postsData.map((p) => p.id);

        const [{ data: likesData }, { data: commentsData }] = await Promise.all([
          supabase.from('likes').select('id, post_id').in('post_id', postIds),
          supabase.from('comments').select('id, post_id, user_id, content, created_at, profiles(username, avatar_url)').in('post_id', postIds).order('created_at', { ascending: true })
        ]);

        const likesCountMap = {};
        (likesData || []).forEach((l) => {
          likesCountMap[l.post_id] = (likesCountMap[l.post_id] || 0) + 1;
        });

        const commentsGroupMap = {};
        (commentsData || []).forEach((c) => {
          if (!commentsGroupMap[c.post_id]) commentsGroupMap[c.post_id] = [];
          commentsGroupMap[c.post_id].push(c);
        });

        const formattedPosts = postsData.map((p) => ({
          ...p,
          likes: [{ count: likesCountMap[p.id] || 0 }],
          comments: commentsGroupMap[p.id] || [],
        }));

        setPosts(formattedPosts);
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error('Feed exception:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
    const filterKey = userIdFilter ? `user-${userIdFilter}` : 'all';
    const sub = supabase
      .channel('feed-channel-' + filterKey)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, loadFeed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, loadFeed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, loadFeed)
      .subscribe();
    return () => sub.unsubscribe();
  }, [userIdFilter]);

  if (loading) return <Loader />;

  return (
    <main className="flex flex-col gap-4 w-full">
      {/* Stories Carousel */}
      {!userIdFilter && !communityIdFilter && <StoriesRow session={session} />}

      {/* Create Post Form */}
      {!userIdFilter && (
        <CreatePost
          session={session}
          onPostCreated={loadFeed}
          communityId={communityIdFilter}
          placeholder={placeholder}
        />
      )}

      {/* Feed Posts */}
      <AnimatePresence>
        {posts.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={userIdFilter ? 'No posts yet' : 'Your feed is empty'}
            description={
              userIdFilter
                ? "This user hasn't posted anything yet."
                : 'Be the first to share code, ideas, or projects!'
            }
          />
        ) : (
          posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
            >
              <PostCard post={post} session={session} onUpdate={loadFeed} />
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </main>
  );
}
