import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import CreatePost from './feed/CreatePost';
import PostCard from './feed/PostCard';
import Loader from './ui/Loader';
import EmptyState from './ui/EmptyState';
import { MessageSquare, Plus, X, ChevronLeft, ChevronRight, Play, Film, Clock, Trash2 } from 'lucide-react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import CreateStoryModal from './stories/CreateStoryModal';
import CreateReel from './reels/CreateReel';

function StoriesRow({ session }) {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [stories, setStories] = useState([]);
  const [reels, setReels] = useState([]);
  const [activeStory, setActiveStory] = useState(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showCreateReel, setShowCreateReel] = useState(false);

  // Helper to calculate elapsed time and remaining hours/minutes until 24-hour auto-removal
  const getStoryTimeInfo = (story) => {
    if (!story) return null;
    const createdAt = new Date(story.created_at || Date.now()).getTime();
    const expiresAt = new Date(story.expires_at || (createdAt + 24 * 3600 * 1000)).getTime();
    const now = Date.now();

    const diffPastMs = Math.max(0, now - createdAt);
    const diffFutureMs = Math.max(0, expiresAt - now);

    const pastHours = Math.floor(diffPastMs / (1000 * 60 * 60));
    const pastMinutes = Math.floor((diffPastMs % (1000 * 60 * 60)) / (1000 * 60));
    const timeAgo = pastHours > 0 ? `${pastHours}h ago` : `${Math.max(1, pastMinutes)}m ago`;

    const remainingHours = Math.floor(diffFutureMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((diffFutureMs % (1000 * 60 * 60)) / (1000 * 60));
    const timeLeft = remainingHours > 0 ? `${remainingHours}h left` : `${Math.max(1, remainingMinutes)}m left`;

    return { timeAgo, timeLeft, isExpired: diffFutureMs <= 0 };
  };

  const fetchStoriesAndReels = async () => {
    try {
      // 1. Fetch real stories from database that haven't expired
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

      // Merge with locally cached stories (so optimistic stories appear instantly and auto-clear at expiry)
      const nowMs = Date.now();
      const localStories = JSON.parse(localStorage.getItem('connectra_active_stories') || '[]');
      const validLocalStories = localStories.filter(s => new Date(s.expires_at).getTime() > nowMs);
      validLocalStories.forEach(ls => {
        if (!dbStories.some(s => s.id === ls.id)) {
          dbStories.unshift(ls);
        }
      });
      // Save purged local list
      localStorage.setItem('connectra_active_stories', JSON.stringify(validLocalStories));
      setStories(dbStories);

      // 2. Fetch reels as fallback media
      const { data: reelsData } = await supabase
        .from('reels')
        .select('*, profiles(username, avatar_url), reel_likes(id, user_id), reel_comments(id, user_id, content, created_at, profiles(username, avatar_url))')
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

  // Realtime subscription for stories & reels
  useEffect(() => {
    const sub = supabase.channel('stories-live-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, fetchStoriesAndReels)
      .subscribe();

    // Auto-Expiration Poller: Every 15 seconds, automatically removes stories older than 24h
    const timer = setInterval(() => {
      const nowMs = Date.now();
      setStories(prev => {
        const activeOnly = prev.filter(s => new Date(s.expires_at).getTime() > nowMs);
        if (activeOnly.length !== prev.length) {
          const local = JSON.parse(localStorage.getItem('connectra_active_stories') || '[]');
          const valid = local.filter(s => new Date(s.expires_at).getTime() > nowMs);
          localStorage.setItem('connectra_active_stories', JSON.stringify(valid));
        }
        return activeOnly;
      });
    }, 15000);

    return () => {
      sub.unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleOpenUserStory = (user, storyIndex = 0) => {
    // 1. Check if user has active Stories
    const userStories = stories.filter((s) => s.user_id === user.id);
    if (userStories.length > 0) {
      const validIndex = Math.max(0, Math.min(storyIndex, userStories.length - 1));
      setActiveStory({
        user,
        story: userStories[validIndex],
        storyIndex: validIndex,
        userStories,
      });
      return;
    }

    // 2. Check if user has a Reel
    const userReels = reels.filter((r) => r.user_id === user.id);
    if (userReels.length > 0) {
      setActiveStory({
        user,
        reel: userReels[0],
        storyIndex: 0,
        userStories: [],
      });
      return;
    }

    // 3. Fallback display card preview if no story posted yet
    setActiveStory({
      user,
      fallbackText: `${user.username}'s Daily Dev Update: Exploring code and building in Connectra!`,
      storyIndex: 0,
      userStories: [],
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
    // 1. Advance within current user's stories if multiple exist
    if (activeStory.userStories && activeStory.userStories.length > 0 && activeStory.storyIndex < activeStory.userStories.length - 1) {
      const nextIndex = activeStory.storyIndex + 1;
      setActiveStory({
        ...activeStory,
        storyIndex: nextIndex,
        story: activeStory.userStories[nextIndex],
      });
      return;
    }

    // 2. Otherwise advance to the next user in the list
    const allUsers = [currentUser, ...users].filter(Boolean);
    const currentIndex = allUsers.findIndex(u => u.id === activeStory.user.id);
    if (currentIndex >= 0 && currentIndex < allUsers.length - 1) {
      handleOpenUserStory(allUsers[currentIndex + 1], 0);
    } else {
      setActiveStory(null);
    }
  };

  const handlePrevStory = () => {
    if (!activeStory) return;
    // 1. Go back within current user's stories if not on first
    if (activeStory.userStories && activeStory.storyIndex > 0) {
      const prevIndex = activeStory.storyIndex - 1;
      setActiveStory({
        ...activeStory,
        storyIndex: prevIndex,
        story: activeStory.userStories[prevIndex],
      });
      return;
    }

    // 2. Otherwise go back to the previous user's last story
    const allUsers = [currentUser, ...users].filter(Boolean);
    const currentIndex = allUsers.findIndex(u => u.id === activeStory.user.id);
    if (currentIndex > 0) {
      const prevUser = allUsers[currentIndex - 1];
      const prevUserStories = stories.filter((s) => s.user_id === prevUser.id);
      const lastIndex = Math.max(0, prevUserStories.length - 1);
      handleOpenUserStory(prevUser, lastIndex);
    }
  };

  // Keyboard navigation for prior/next story and Escape to exit
  useEffect(() => {
    if (!activeStory) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNextStory();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStory();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setActiveStory(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStory, users, currentUser, stories, reels]);

  // Touch swipe gesture handlers (mobile & tablet swipe navigation)
  const handleTouchStart = (e) => {
    if (!e.touches?.[0]) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (!e.changedTouches?.[0]) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Horizontal swipe threshold: 45px
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 45) {
      if (deltaX < 0) {
        // Swiped Left -> Next Story
        handleNextStory();
      } else {
        // Swiped Right -> Prior Story
        handlePrevStory();
      }
    } else if (deltaY > 90 && Math.abs(deltaX) < 60) {
      // Swiped Down -> Close Story
      setActiveStory(null);
    }
  };

  const userHasStory = (userId) => {
    return stories.some(s => s.user_id === userId) || reels.some(r => r.user_id === userId);
  };

  const getUserStory = (userId) => {
    return stories.find(s => s.user_id === userId) || null;
  };

  const currentUserStory = currentUser ? getUserStory(currentUser.id) : null;
  const currentUserTimeInfo = currentUserStory ? getStoryTimeInfo(currentUserStory) : null;

  const allNavUsers = [currentUser, ...users].filter(Boolean);
  const currentActiveUserIndex = allNavUsers.findIndex(u => u.id === activeStory?.user?.id);
  const hasPrior = Boolean(
    activeStory && (
      (activeStory.userStories && activeStory.storyIndex > 0) ||
      currentActiveUserIndex > 0
    )
  );
  const hasNext = Boolean(
    activeStory && (
      (activeStory.userStories && activeStory.storyIndex < activeStory.userStories.length - 1) ||
      currentActiveUserIndex < allNavUsers.length - 1
    )
  );

  return (
    <>
      <div className="rounded-2xl p-4 bg-white border border-[#f1e4d3] shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#2b1f17] tracking-tight">Stories</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 flex items-center gap-1">
              <Clock size={10} /> 24h Timeline
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
              {currentUserTimeInfo && (
                <span className="text-[9px] font-bold text-orange-600 block -mt-1 truncate w-full">
                  {currentUserTimeInfo.timeLeft}
                </span>
              )}
            </button>
          )}

          {/* Real Users from Database */}
          {users.map((user) => {
            const userInitial = user.username?.[0]?.toUpperCase() || 'D';
            const hasActiveStory = userHasStory(user.id);
            const userStory = getUserStory(user.id);
            const timeInfo = userStory ? getStoryTimeInfo(userStory) : null;

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
                {timeInfo && (
                  <span className="text-[9px] font-bold text-orange-600 block -mt-1 truncate w-full">
                    {timeInfo.timeLeft}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Story Viewer Modal with Swipe Gestures, Prior & Next Navigation, and Segmented Progress */}
      <AnimatePresence>
        {activeStory && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md select-none"
            onClick={() => setActiveStory(null)}
          >
            {/* Prior Navigation Arrow Button (Visible on both mobile & desktop) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevStory();
              }}
              disabled={!hasPrior}
              className={`flex absolute left-2 sm:left-6 p-2.5 sm:p-3.5 rounded-full z-40 items-center justify-center transition-all ${
                hasPrior
                  ? 'bg-black/60 hover:bg-black/85 text-white cursor-pointer hover:scale-110 active:scale-95 shadow-2xl border border-white/20 backdrop-blur-md'
                  : 'bg-black/20 text-white/25 cursor-not-allowed border border-white/5 opacity-40'
              }`}
              title="Prior Story (← or swipe right)"
              aria-label="Prior Story"
            >
              <ChevronLeft size={22} />
            </button>

            {/* Next Navigation Arrow Button (Visible on both mobile & desktop) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNextStory();
              }}
              className="flex absolute right-2 sm:right-6 p-2.5 sm:p-3.5 rounded-full bg-black/60 hover:bg-black/85 text-white cursor-pointer hover:scale-110 active:scale-95 transition-all z-40 shadow-2xl border border-white/20 backdrop-blur-md items-center justify-center"
              title="Next Story (→ or swipe left)"
              aria-label="Next Story"
            >
              <ChevronRight size={22} />
            </button>

            {/* Story Card Container with Framer-Motion Drag & Native Touch Swipe */}
            <motion.div
              key={`story-modal-${activeStory.user.id}-${activeStory.storyIndex || 0}`}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.35}
              onDragEnd={(_e, info) => {
                const swipeThreshold = 45;
                if (info.offset.x < -swipeThreshold || info.velocity.x < -250) {
                  // Swiped Left -> Next Story
                  handleNextStory();
                } else if (info.offset.x > swipeThreshold || info.velocity.x > 250) {
                  // Swiped Right -> Prior Story
                  handlePrevStory();
                }
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm aspect-[9/16] max-h-[85vh] rounded-3xl overflow-hidden bg-black flex flex-col justify-between shadow-2xl border border-white/20 cursor-grab active:cursor-grabbing touch-pan-y"
            >
              {/* Top Progress Bar - Segmented for Multi-Story Support */}
              <div className="absolute top-2 left-3 right-3 z-30 flex gap-1.5">
                {activeStory.userStories && activeStory.userStories.length > 1 ? (
                  activeStory.userStories.map((s, idx) => (
                    <div key={s.id || idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                      {idx < activeStory.storyIndex ? (
                        <div className="h-full w-full bg-white rounded-full" />
                      ) : idx === activeStory.storyIndex ? (
                        <motion.div
                          key={`prog-${activeStory.user.id}-${idx}`}
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 7, ease: 'linear' }}
                          onAnimationComplete={handleNextStory}
                          className="h-full bg-white rounded-full"
                        />
                      ) : (
                        <div className="h-full w-0 bg-white rounded-full" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                    <motion.div
                      key={`prog-${activeStory.user.id}-${activeStory.story?.id || 'single'}`}
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 7, ease: 'linear' }}
                      onAnimationComplete={handleNextStory}
                      className="h-full bg-white rounded-full"
                    />
                  </div>
                )}
              </div>

              {/* Tap-to-Navigate Edge Zones (Prior on Left 25%, Next on Right 25%) */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevStory();
                }}
                className="absolute left-0 top-16 bottom-20 w-1/4 z-20 cursor-pointer group"
                title="Tap for Prior Story"
                aria-label="Tap for Prior Story"
              >
                <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-start pl-2">
                  <div className="p-1 rounded-full bg-black/40 text-white/80 backdrop-blur-xs">
                    <ChevronLeft size={16} />
                  </div>
                </div>
              </div>

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextStory();
                }}
                className="absolute right-0 top-16 bottom-20 w-1/4 z-20 cursor-pointer group"
                title="Tap for Next Story"
                aria-label="Tap for Next Story"
              >
                <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end pr-2">
                  <div className="p-1 rounded-full bg-black/40 text-white/80 backdrop-blur-xs">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>

              {/* Top User Info Bar with exact Timeline & Story Count */}
              <div className="pt-5 px-4 pb-3 bg-gradient-to-b from-black/95 via-black/70 to-transparent flex items-center justify-between z-30">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-white/40 bg-[#ea580c] flex items-center justify-center text-xs font-bold text-white shadow-sm">
                    {activeStory.user.avatar_url ? (
                      <img src={activeStory.user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      activeStory.user.username?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white block leading-tight">@{activeStory.user.username}</span>
                      {activeStory.userStories && activeStory.userStories.length > 1 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                          {activeStory.storyIndex + 1}/{activeStory.userStories.length}
                        </span>
                      )}
                    </div>
                    {activeStory.story ? (
                      (() => {
                        const tInfo = getStoryTimeInfo(activeStory.story);
                        return (
                          <div className="flex items-center gap-1 text-[10px] text-amber-300 font-semibold mt-0.5">
                            <Clock size={10} className="text-amber-400 shrink-0" />
                            <span>Posted {tInfo?.timeAgo} · ⏳ {tInfo?.timeLeft}</span>
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-[10px] text-white/70">
                        {activeStory.reel ? 'Connectra Reel' : 'Developer Status'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 z-40">
                  {/* Delete button if viewing your own story */}
                  {activeStory.story && activeStory.story.user_id === session?.user?.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteActiveStory(activeStory.story.id);
                      }}
                      className="p-1.5 rounded-full bg-white/15 hover:bg-rose-600/80 text-white cursor-pointer transition-colors"
                      title="Delete Story"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveStory(null);
                    }}
                    className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer transition-colors"
                    title="Close (Esc)"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Story Content (Image, Dev Thought/Code, or Video) */}
              <div className="flex-1 flex items-center justify-center p-4 text-center overflow-hidden z-10 pointer-events-auto">
                {/* 1. Real Story: Image */}
                {activeStory.story?.media_type === 'image' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <img
                      src={activeStory.story.media_url}
                      alt="Dev Story"
                      className="w-full h-full object-contain rounded-2xl"
                      draggable={false}
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
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white font-bold text-xs mt-2 hover:opacity-95 shadow-md z-30"
                    >
                      View Profile
                    </Link>
                  </div>
                )}
              </div>

              {/* Bottom Caption and Swipe / Navigation Controls */}
              <div className="p-3.5 bg-gradient-to-t from-black/95 via-black/85 to-transparent z-30 flex flex-col gap-1.5 text-center">
                {activeStory.story?.caption && activeStory.story?.media_type !== 'thought' && (
                  <div className="text-white text-xs text-left line-clamp-2">
                    {activeStory.story.caption}
                  </div>
                )}
                {activeStory.reel?.caption && (
                  <div className="text-white text-xs text-left line-clamp-2">
                    {activeStory.reel.caption}
                  </div>
                )}

                {/* Swipe Guidance & Prior/Next Controls */}
                <div className="flex items-center justify-between text-[11px] text-white/70 pt-1.5 border-t border-white/10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevStory();
                    }}
                    disabled={!hasPrior}
                    className={`flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                      hasPrior ? 'text-white hover:bg-white/15' : 'text-white/30 cursor-not-allowed'
                    }`}
                    title="Prior Story (←)"
                  >
                    <ChevronLeft size={13} /> Prior
                  </button>

                  <span className="text-[10px] text-white/50 tracking-wider font-medium flex items-center gap-1">
                    <span>Swipe ↔ or tap sides</span>
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextStory();
                    }}
                    className="flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md text-white hover:bg-white/15 transition-colors cursor-pointer"
                    title="Next Story (→)"
                  >
                    Next <ChevronRight size={13} />
                  </button>
                </div>
              </div>
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
      // 1. Fetch Posts from Supabase
      let postsQuery = supabase
        .from('posts')
        .select(`
          id, user_id, content, image_url, code_snippet, code_language, created_at, updated_at,
          profiles(username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (userIdFilter) {
        postsQuery = postsQuery.eq('user_id', userIdFilter);
      }

      const { data: postsData, error: postsError } = await postsQuery;
      if (postsError) {
        console.warn('Posts query notice:', postsError);
      }

      let allPosts = postsData || [];

      // 2. Safely Fetch Reels with Likes and Comments
      let reelsData = [];
      try {
        let rQ = supabase
          .from('reels')
          .select(`
            id, user_id, video_url, caption, visibility, allow_comments, created_at, updated_at,
            profiles(username, avatar_url),
            reel_likes(id, user_id),
            reel_comments(id, user_id, content, created_at, profiles(username, avatar_url))
          `)
          .order('created_at', { ascending: false });

        if (userIdFilter) {
          rQ = rQ.eq('user_id', userIdFilter);
        }
        const { data: rData } = await rQ;
        if (rData) reelsData = rData;
      } catch (err) {
        console.warn('Reels query notice:', err);
      }

      // Merge with locally persisted posts
      try {
        const localPosts = JSON.parse(localStorage.getItem('connectra_active_posts') || '[]');
        const filteredLocalPosts = userIdFilter ? localPosts.filter((p) => p.user_id === userIdFilter) : localPosts;
        filteredLocalPosts.forEach((lp) => {
          if (!allPosts.some((p) => p.id === lp.id)) {
            allPosts.unshift(lp);
          }
        });
      } catch {}

      // Merge with locally persisted reels
      try {
        const localReels = JSON.parse(localStorage.getItem('connectra_active_reels') || '[]');
        const filteredLocalReels = userIdFilter ? localReels.filter((r) => r.user_id === userIdFilter) : localReels;
        filteredLocalReels.forEach((lr) => {
          if (!reelsData.some((r) => r.id === lr.id)) {
            reelsData.unshift(lr);
          }
        });
      } catch {}

      // 3. Fetch Likes and Comments for Posts
      const postIds = allPosts.map((p) => p.id).filter(Boolean);
      let likesData = [];
      let commentsData = [];
      if (postIds.length > 0) {
        try {
          const [{ data: lData }, { data: cData }] = await Promise.all([
            supabase.from('likes').select('id, post_id, user_id').in('post_id', postIds),
            supabase
              .from('comments')
              .select('id, post_id, user_id, content, created_at, profiles(username, avatar_url)')
              .in('post_id', postIds)
              .order('created_at', { ascending: true }),
          ]);
          if (lData) likesData = lData;
          if (cData) commentsData = cData;
        } catch (e) {
          console.warn('Posts likes/comments fallback:', e);
        }
      }

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

      // Format Posts
      const formattedPosts = allPosts.map((p) => {
        let localComments = [];
        try {
          localComments = JSON.parse(localStorage.getItem(`connectra_post_comments_${p.id}`) || '[]');
        } catch {}
        const dbComments = commentsGroupMap[p.id] || p.comments || [];
        // Reconcile: ignore local optimistic comments that have already been persisted to the DB
        const pendingLocalComments = localComments.filter((lc) => {
          return !dbComments.some(
            (dc) =>
              dc.id === lc.id ||
              (dc.content === lc.content && (dc.user_id === lc.user_id || dc.user_id === session?.user?.id))
          );
        });
        const combinedComments = [...dbComments, ...pendingLocalComments];
        const uniqueComments = Array.from(new Map(combinedComments.map((c) => [c.id || c.created_at, c])).values());

        return {
          ...p,
          likes: [{ count: likesCountMap[p.id] || p.likes_count || 0 }],
          likes_count: likesCountMap[p.id] || p.likes_count || 0,
          user_has_liked: Boolean(userLikedMap[p.id] || p.user_has_liked),
          comments: uniqueComments,
        };
      });

      // 4. Format Reels into Feed items with synced Likes and Comments
      const formattedReels = reelsData.map((r) => {
        let localComments = [];
        try {
          localComments = JSON.parse(localStorage.getItem(`connectra_reel_comments_${r.id}`) || '[]');
        } catch {}
        const dbComments = r.reel_comments || [];
        // Reconcile: ignore local optimistic comments that have already been persisted to the DB
        const pendingLocalComments = localComments.filter((lc) => {
          return !dbComments.some(
            (dc) =>
              dc.id === lc.id ||
              (dc.content === lc.content && (dc.user_id === lc.user_id || dc.user_id === session?.user?.id))
          );
        });
        const combinedComments = [...dbComments, ...pendingLocalComments];
        const uniqueComments = Array.from(new Map(combinedComments.map((c) => [c.id || c.created_at, c])).values());

        const reelLikes = r.reel_likes || [];
        const localReelLikes = JSON.parse(localStorage.getItem(`connectra_reel_likes_${session?.user?.id}`) || '[]');
        const userHasLiked = Boolean(
          (session?.user?.id && reelLikes.some((l) => l.user_id === session.user.id)) ||
          localReelLikes.includes(r.id)
        );
        const totalLikes = Math.max(reelLikes.length, userHasLiked && reelLikes.length === 0 ? 1 : reelLikes.length);

        return {
          id: `reel-${r.id}`,
          reel_id: r.id,
          is_reel: true,
          user_id: r.user_id,
          content: r.caption || '',
          video_url: r.video_url,
          image_url: r.video_url,
          created_at: r.created_at || new Date().toISOString(),
          profiles: r.profiles || { username: 'developer', avatar_url: null },
          likes: [{ count: totalLikes }],
          likes_count: totalLikes,
          user_has_liked: userHasLiked,
          comments: uniqueComments,
        };
      });

      // 5. Merge Posts and Reels into Unified Feed
      const combinedFeed = [...formattedPosts, ...formattedReels];
      const seenMedia = new Set();
      const dedupedFeed = combinedFeed.filter((item) => {
        const key = item.video_url || item.id;
        if (seenMedia.has(key)) return false;
        seenMedia.add(key);
        return true;
      });

      dedupedFeed.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      setPosts(dedupedFeed);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reels' }, loadFeed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, loadFeed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reel_likes' }, loadFeed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, loadFeed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reel_comments' }, loadFeed)
      .subscribe();

    const handleRefresh = () => loadFeed();
    window.addEventListener('refreshFeed', handleRefresh);
    window.addEventListener('refreshReels', handleRefresh);

    return () => {
      sub.unsubscribe();
      window.removeEventListener('refreshFeed', handleRefresh);
      window.removeEventListener('refreshReels', handleRefresh);
    };
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
