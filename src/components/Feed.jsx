import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import CreatePost from './feed/CreatePost';
import PostCard from './feed/PostCard';
import Loader from './ui/Loader';
import EmptyState from './ui/EmptyState';
import { MessageSquare, Plus, X, ChevronLeft, ChevronRight, Play, Film } from 'lucide-react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import CreateStoryModal from './stories/CreateStoryModal';
import CreateReel from './reels/CreateReel';
import { Trash2 } from 'lucide-react';

function StoriesRow({ session }) {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [stories, setStories] = useState([]);
  const [reels, setReels] = useState([]);
  const [activeStory, setActiveStory] = useState(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showCreateReel, setShowCreateReel] = useState(false);

  const fetchStoriesAndReels = async () => {
    try {
      // 1. Fetch real stories from database
      const nowIso = new Date().toISOString();
      let dbStories = [];
      try {
        const { data: storiesData } = await supabase
          .from('stories')
          .select('*, profiles(username, avatar_url)')
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: false });

        if (storiesData) dbStories = storiesData;
      } catch (err) {
        console.warn('Stories table query fallback:', err);
      }

      // Merge with locally cached stories (so optimistic stories appear instantly)
      const localStories = JSON.parse(localStorage.getItem('connectra_active_stories') || '[]');
      const validLocalStories = localStories.filter(s => new Date(s.expires_at) > new Date());
      validLocalStories.forEach(ls => {
        if (!dbStories.some(s => s.id === ls.id)) {
          dbStories.unshift(ls);
        }
      });
      setStories(dbStories);

      // 2. Fetch reels as fallback media
      const { data: reelsData } = await supabase
        .from('reels')
        .select('*, profiles(username, avatar_url)')
        .order('created_at', { ascending: false });

      if (reelsData) {
        setReels(reelsData);
      }

      // 3. Fetch user profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio')
        .limit(12);

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
    // 1. Check if user has an active Story
    const userStories = stories.filter((s) => s.user_id === user.id);
    if (userStories.length > 0) {
      setActiveStory({
        user,
        story: userStories[0],
      });
      return;
    }

    // 2. Check if user has a Reel
    const userReels = reels.filter((r) => r.user_id === user.id);
    if (userReels.length > 0) {
      setActiveStory({
        user,
        reel: userReels[0],
      });
      return;
    }

    // 3. Fallback display card preview if no story posted yet
    setActiveStory({
      user,
      fallbackText: `${user.username}'s Daily Dev Update: Exploring code and building in Connectra!`,
    });
  };

  const handleDeleteActiveStory = async (storyId) => {
    try {
      await supabase.from('stories').delete().eq('id', storyId);
    } catch (e) {
      console.warn('DB delete story error:', e);
    }
    // Remove from local storage
    const local = JSON.parse(localStorage.getItem('connectra_active_stories') || '[]');
    const updated = local.filter(s => s.id !== storyId);
    localStorage.setItem('connectra_active_stories', JSON.stringify(updated));
    setActiveStory(null);
    fetchStoriesAndReels();
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

  const userHasStory = (userId) => {
    return stories.some(s => s.user_id === userId) || reels.some(r => r.user_id === userId);
  };

  return (
    <>
      <div className="rounded-2xl p-4 bg-white border border-[#f1e4d3] shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#2b1f17] tracking-tight">Stories</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20">
              24h
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateStory(true)}
              className="text-[11px] font-bold text-[#ea580c] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus size={13} strokeWidth={3} /> Post Story
            </button>
          </div>
        </div>

        <div className="flex items-start gap-4 overflow-x-auto no-scrollbar pb-1 pt-1">
          {/* + Add Story Button */}
          <button
            onClick={() => setShowCreateStory(true)}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group text-center w-16"
          >
            <div className="w-14 h-14 rounded-full bg-[#fff7ed] border border-[#fed7aa] flex items-center justify-center text-orange-600 group-hover:scale-105 group-hover:border-orange-500 transition-all shadow-2xs">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#ea580c] to-[#f97316] flex items-center justify-center text-white shadow-xs">
                <Plus size={20} strokeWidth={2.8} />
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#8d7565] group-hover:text-[#ea580c] transition-colors truncate w-full block">
              Add Story
            </span>
          </button>

          {/* Current User Story */}
          {currentUser && (
            <button
              onClick={() => {
                if (userHasStory(currentUser.id)) {
                  handleOpenUserStory(currentUser);
                } else {
                  setShowCreateStory(true);
                }
              }}
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group text-center w-16"
            >
              <div
                className={`w-14 h-14 rounded-full p-0.5 ${
                  userHasStory(currentUser.id)
                    ? 'bg-gradient-to-tr from-[#ea580c] via-[#f97316] to-[#facc15] shadow-xs'
                    : 'bg-[#fed7aa]'
                } group-hover:scale-105 transition-all shadow-2xs flex items-center justify-center`}
              >
                <div className="w-full h-full rounded-full overflow-hidden p-0.5 bg-white flex items-center justify-center">
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
              <span className="text-[11px] font-semibold text-[#8d7565] group-hover:text-[#2b1f17] transition-colors truncate w-full block">
                Your Story
              </span>
            </button>
          )}

          {/* Real Users from Database */}
          {users.map((user) => {
            const userInitial = user.username?.[0]?.toUpperCase() || 'D';
            const hasActiveStory = userHasStory(user.id);

            return (
              <button
                key={user.id}
                onClick={() => handleOpenUserStory(user)}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group text-center w-16"
              >
                <div
                  className={`w-14 h-14 rounded-full p-0.5 ${
                    hasActiveStory
                      ? 'bg-gradient-to-tr from-[#ea580c] via-[#f97316] to-[#facc15] shadow-xs'
                      : 'bg-stone-200 dark:bg-stone-700'
                  } group-hover:scale-105 transition-all shadow-2xs flex items-center justify-center`}
                >
                  <div className="w-full h-full rounded-full overflow-hidden p-0.5 bg-white flex items-center justify-center">
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
                <span className="text-[11px] font-semibold text-[#8d7565] group-hover:text-[#2b1f17] transition-colors truncate w-full block">
                  {user.username}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Story Viewer Modal with Progress Bar, Arrow Navigation, and Rich Media Types */}
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
                    <span className="text-[10px] text-white/70">
                      {activeStory.story ? 'Active Dev Story (24h)' : activeStory.reel ? 'Connectra Reel' : 'Developer Status'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Delete button if viewing your own story */}
                  {activeStory.story && activeStory.story.user_id === session?.user?.id && (
                    <button
                      onClick={() => handleDeleteActiveStory(activeStory.story.id)}
                      className="p-1.5 rounded-full bg-white/15 hover:bg-rose-600/80 text-white cursor-pointer transition-colors"
                      title="Delete Story"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}

                  <button
                    onClick={() => setActiveStory(null)}
                    className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Story Content (Image, Dev Thought/Code, or Video) */}
              <div className="flex-1 flex items-center justify-center p-4 text-center overflow-hidden">
                {/* 1. Real Story: Image */}
                {activeStory.story?.media_type === 'image' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <img
                      src={activeStory.story.media_url}
                      alt="Dev Story"
                      className="w-full h-full object-contain rounded-2xl"
                    />
                  </div>
                )}

                {/* 2. Real Story: Dev Thought / Code */}
                {activeStory.story?.media_type === 'thought' && (
                  <div
                    className={`w-full h-full rounded-2xl p-6 bg-gradient-to-br ${
                      activeStory.story.bg_color || 'from-orange-600 via-amber-500 to-rose-600'
                    } text-white flex flex-col justify-center items-center shadow-lg text-center`}
                  >
                    <div className="my-auto max-w-[90%]">
                      <p className="text-base sm:text-lg font-bold leading-relaxed whitespace-pre-wrap">
                        {activeStory.story.caption}
                      </p>
                      {activeStory.story.code_snippet && (
                        <div className="mt-4 p-3 rounded-xl bg-black/50 border border-white/20 font-mono text-xs text-amber-200 text-left overflow-x-auto max-h-[160px]">
                          <code>{activeStory.story.code_snippet}</code>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Real Story: Video */}
                {activeStory.story?.media_type === 'video' && (
                  <video
                    src={activeStory.story.media_url}
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover rounded-2xl"
                  />
                )}

                {/* 4. Fallback to Reel if story has reel */}
                {!activeStory.story && activeStory.reel && (
                  <video
                    src={activeStory.reel.video_url}
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover rounded-2xl"
                  />
                )}

                {/* 5. Fallback Status Card */}
                {!activeStory.story && !activeStory.reel && (
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

              {/* Bottom Caption for stories or reels */}
              {(activeStory.story?.caption && activeStory.story?.media_type !== 'thought') && (
                <div className="p-4 bg-gradient-to-t from-black/95 to-transparent z-10 text-white text-xs text-left">
                  {activeStory.story.caption}
                </div>
              )}
              {activeStory.reel?.caption && (
                <div className="p-4 bg-gradient-to-t from-black/95 to-transparent z-10 text-white text-xs text-left">
                  {activeStory.reel.caption}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dedicated Create Story Modal */}
      {showCreateStory && (
        <CreateStoryModal
          session={session}
          onClose={() => setShowCreateStory(false)}
          onCreated={fetchStoriesAndReels}
        />
      )}

      {/* Create Reel Modal (if triggered) */}
      {showCreateReel && (
        <CreateReel
          session={session}
          onClose={() => setShowCreateReel(false)}
          onCreated={fetchStoriesAndReels}
        />
      )}
    </>
  );
}

export default function Feed({ session, userIdFilter = null, communityIdFilter = null, placeholder }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const routeParams = useParams();
  const targetPostId = searchParams.get('postId') || routeParams.id;
  const autoOpenComments = searchParams.get('comments') === 'open';
  const [highlightedPostId, setHighlightedPostId] = useState(null);

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
          supabase.from('likes').select('id, post_id, user_id').in('post_id', postIds),
          supabase.from('comments').select('id, post_id, user_id, content, created_at, profiles(username, avatar_url)').in('post_id', postIds).order('created_at', { ascending: true })
        ]);

        const likesCountMap = {};
        const userLikedMap = {};
        (likesData || []).forEach((l) => {
          likesCountMap[l.post_id] = (likesCountMap[l.post_id] || 0) + 1;
          if (session?.user?.id && l.user_id === session.user.id) {
            userLikedMap[l.post_id] = true;
          }
        });

        const commentsGroupMap = {};
        (commentsData || []).forEach((c) => {
          if (!commentsGroupMap[c.post_id]) commentsGroupMap[c.post_id] = [];
          commentsGroupMap[c.post_id].push(c);
        });

        const formattedPosts = postsData.map((p) => ({
          ...p,
          likes: [{ count: likesCountMap[p.id] || 0 }],
          likes_count: likesCountMap[p.id] || 0,
          user_has_liked: Boolean(userLikedMap[p.id]),
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

  // Handle post redirection from notifications (scroll to post, highlight, open comments)
  useEffect(() => {
    if (!targetPostId) return;

    let isMounted = true;

    const handleTargetPost = async () => {
      // If the post is not in current posts list and feed is finished loading, fetch it specifically
      const exists = posts.some((p) => p.id === targetPostId);
      if (!exists && !loading) {
        try {
          const { data: pData } = await supabase
            .from('posts')
            .select(`
              id, user_id, content, image_url, code_snippet, code_language, created_at, updated_at,
              profiles(username, avatar_url)
            `)
            .eq('id', targetPostId)
            .single();

          if (pData && isMounted) {
            const [{ data: likesData }, { data: commentsData }] = await Promise.all([
              supabase.from('likes').select('id, post_id, user_id').eq('post_id', targetPostId),
              supabase
                .from('comments')
                .select('id, post_id, user_id, content, created_at, profiles(username, avatar_url)')
                .eq('post_id', targetPostId)
                .order('created_at', { ascending: true }),
            ]);

            const formatted = {
              ...pData,
              likes: [{ count: likesData?.length || 0 }],
              likes_count: likesData?.length || 0,
              user_has_liked: Boolean(likesData?.some(l => session?.user?.id && l.user_id === session.user.id)),
              comments: commentsData || [],
            };

            setPosts((prev) => {
              if (prev.some((p) => p.id === targetPostId)) return prev;
              return [formatted, ...prev];
            });
          }
        } catch (err) {
          console.warn('Target post fetch failed:', err);
        }
      }

      setHighlightedPostId(targetPostId);

      // Scroll into view smoothly
      setTimeout(() => {
        const el = document.getElementById(`post-${targetPostId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 400);
    };

    handleTargetPost();

    return () => {
      isMounted = false;
    };
  }, [targetPostId, loading, posts.length]);

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
              <PostCard
                post={post}
                session={session}
                onUpdate={loadFeed}
                isHighlighted={post.id === highlightedPostId}
                autoOpenComments={post.id === highlightedPostId && autoOpenComments}
              />
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </main>
  );
}
