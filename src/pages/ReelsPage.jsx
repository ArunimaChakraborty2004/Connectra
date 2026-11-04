import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Heart, MessageSquare, Plus, VolumeX, Volume2, X, EyeOff, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import Loader from '../components/ui/Loader';
import CreateReel from '../components/reels/CreateReel';
import { toast } from '../lib/toast';

export default function ReelsPage({ session }) {
  const navigate = useNavigate();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeReelId, setActiveReelId] = useState(null);

  // Close / Exit on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const fetchReels = async () => {
    try {
      const { data, error } = await supabase
        .from('reels')
        .select(`
          *,
          profiles(username, avatar_url),
          reel_likes(id, user_id),
          reel_comments(id, user_id, content, created_at, profiles(username, avatar_url))
        `)
        .order('created_at', { ascending: false });

      let combined = [];
      if (data && data.length > 0) {
        combined = [...data];
      }
      // Merge optimistic locally saved reels so newly created reels always display immediately
      const localReels = JSON.parse(localStorage.getItem('connectra_active_reels') || '[]');
      localReels.forEach((lr) => {
        if (!combined.some((r) => r.id === lr.id)) {
          combined.unshift(lr);
        }
      });

      setReels(combined);
      if (combined.length > 0 && !activeReelId) {
        setActiveReelId(combined[0].id);
      }
    } catch (err) {
      console.warn('Error fetching reels, using local cache:', err);
      const localReels = JSON.parse(localStorage.getItem('connectra_active_reels') || '[]');
      setReels(localReels);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReels();
    const sub = supabase.channel('reels-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reels' }, fetchReels)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reel_likes' }, fetchReels)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reel_comments' }, fetchReels)
      .subscribe();

    const handleRefresh = () => fetchReels();
    window.addEventListener('refreshReels', handleRefresh);

    return () => {
      sub.unsubscribe();
      window.removeEventListener('refreshReels', handleRefresh);
    };
  }, []);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="h-[calc(100vh-56px)] w-full bg-black relative flex justify-center overflow-hidden">
      {/* Floating Exit / Cross Button to return to Home Feed */}
      <button 
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 z-40 h-12 w-12 bg-black/60 hover:bg-rose-600/80 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 transition-all shadow-xl hover:scale-105 cursor-pointer"
        title="Close Reels (Return to Home Feed)"
        aria-label="Close Reels"
      >
        <X size={24} />
      </button>

      <div 
        className="h-full w-full max-w-[500px] overflow-y-scroll snap-y snap-mandatory relative hide-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {reels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white">
            <p className="text-xl font-bold mb-4">No Reels yet</p>
            <button onClick={() => setShowCreate(true)} className="vibrant-btn px-6 py-2 rounded-full">
              Be the first to post
            </button>
          </div>
        ) : (
          reels.map(reel => (
            <ReelCard 
              key={reel.id} 
              reel={reel} 
              session={session} 
              isActive={activeReelId === reel.id}
              onVisible={() => setActiveReelId(reel.id)}
              onClose={() => navigate('/')}
            />
          ))
        )}
      </div>

      <button 
        onClick={() => setShowCreate(true)}
        className="absolute top-6 right-6 z-40 h-12 w-12 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 transition-all shadow-lg"
        title="Create New Reel"
      >
        <Plus size={24} />
      </button>

      <AnimatePresence>
        {showCreate && (
          <CreateReel 
            session={session} 
            onClose={() => setShowCreate(false)} 
            onCreated={fetchReels}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ReelCard({ reel, session, isActive, onVisible, onClose }) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  // Synchronized Like and Comment state
  const initialLiked = Boolean(session?.user?.id && reel.reel_likes?.some(like => like.user_id === session.user.id));
  const initialLikesCount = reel.reel_likes?.length || 0;
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [commentsList, setCommentsList] = useState(reel.reel_comments || []);

  useEffect(() => {
    setIsLiked(Boolean(session?.user?.id && reel.reel_likes?.some(like => like.user_id === session.user.id)));
    setLikesCount(reel.reel_likes?.length || 0);

    const dbComments = reel.reel_comments || [];
    let localComments = [];
    try {
      localComments = JSON.parse(localStorage.getItem(`connectra_reel_comments_${reel.id}`) || '[]');
    } catch {}
    const pendingLocal = localComments.filter(
      (lc) => !dbComments.some((dc) => dc.id === lc.id || (dc.content === lc.content && (dc.user_id === lc.user_id || dc.user_id === session?.user?.id)))
    );
    const combined = [...dbComments, ...pendingLocal];
    const unique = Array.from(new Map(combined.map((c) => [c.id || c.created_at, c])).values());
    setCommentsList(unique);
  }, [reel.reel_likes, reel.reel_comments, reel.id, session?.user?.id]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          onVisible();
        }
      });
    }, { threshold: 0.6 });

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }
    return () => observer.disconnect();
  }, [onVisible]);

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.play().catch(e => console.log('Autoplay prevented', e));
    } else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isActive]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleLike = async () => {
    if (!session?.user?.id) {
      toast.error('Please log in to like');
      return;
    }

    const nextLiked = !isLiked;
    const nextCount = nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setIsLiked(nextLiked);
    setLikesCount(nextCount);

    try {
      if (nextLiked) {
        await supabase.from('reel_likes').insert({ reel_id: reel.id, user_id: session.user.id });
        const saved = JSON.parse(localStorage.getItem(`connectra_reel_likes_${session.user.id}`) || '[]');
        localStorage.setItem(`connectra_reel_likes_${session.user.id}`, JSON.stringify([...new Set([...saved, reel.id])]));
      } else {
        await supabase.from('reel_likes').delete().eq('reel_id', reel.id).eq('user_id', session.user.id);
        const saved = JSON.parse(localStorage.getItem(`connectra_reel_likes_${session.user.id}`) || '[]');
        localStorage.setItem(`connectra_reel_likes_${session.user.id}`, JSON.stringify(saved.filter(id => id !== reel.id)));
      }
      // Broadcast to sync Feed in real time
      window.dispatchEvent(new CustomEvent('refreshFeed'));
    } catch (err) {
      console.warn('Reel like error:', err);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !session?.user?.id) return;
    const text = commentText.trim();
    setCommentText('');

    const tempComment = {
      id: `temp-${Date.now()}`,
      reel_id: reel.id,
      user_id: session.user.id,
      content: text,
      created_at: new Date().toISOString(),
      profiles: {
        username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
        avatar_url: session.user.user_metadata?.avatar_url || null,
      }
    };
    setCommentsList(prev => [...prev, tempComment]);

    try {
      const { data, error } = await supabase.from('reel_comments').insert({
        reel_id: reel.id,
        user_id: session.user.id,
        content: text
      }).select('id, reel_id, user_id, content, created_at, profiles(username, avatar_url)').single();

      if (data) {
        setCommentsList(prev => prev.map(c => c.id === tempComment.id ? data : c));
      }
      const localComments = JSON.parse(localStorage.getItem(`connectra_reel_comments_${reel.id}`) || '[]');
      const savedComment = data || tempComment;
      const filtered = localComments.filter(c => c.id !== tempComment.id && c.content !== text);
      localStorage.setItem(`connectra_reel_comments_${reel.id}`, JSON.stringify([...filtered, savedComment]));
      // Broadcast to sync Feed in real time
      window.dispatchEvent(new CustomEvent('refreshFeed'));
      toast.success('Comment posted! 💬');
    } catch (err) {
      console.warn('Reel comment error:', err);
    }
  };

  const handleDeleteReelComment = async (commentId) => {
    if (!confirm('Remove this comment?')) return;
    const commentToDelete = commentsList.find((c) => c.id === commentId);

    setCommentsList((prev) => prev.filter((c) => c.id !== commentId));
    toast.success('Comment removed');

    try {
      if (commentId && !commentId.startsWith('temp-')) {
        await supabase.from('reel_comments').delete().eq('id', commentId);
      }
      if (commentToDelete?.content) {
        await supabase
          .from('reel_comments')
          .delete()
          .eq('reel_id', reel.id)
          .eq('user_id', session?.user?.id)
          .eq('content', commentToDelete.content);
      }
      const localComments = JSON.parse(localStorage.getItem(`connectra_reel_comments_${reel.id}`) || '[]');
      const filtered = localComments.filter(
        (c) => c.id !== commentId && !(c.content === commentToDelete?.content && c.user_id === session?.user?.id)
      );
      localStorage.setItem(`connectra_reel_comments_${reel.id}`, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('refreshFeed'));
    } catch (err) {
      console.warn('Delete reel comment error:', err);
    }
  };

  return (
    <div className="h-full w-full snap-start relative bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src={reel.video_url}
        className="h-full w-full object-cover cursor-pointer"
        loop
        muted={isMuted}
        onClick={togglePlay}
        playsInline
      />
      
      {/* Top Controls: Mute + Close Cross Button */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button 
          onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
          className="p-2.5 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/75 transition border border-white/15"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose?.(); }}
          className="p-2.5 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-rose-600/80 transition border border-white/15 hover:scale-105 cursor-pointer"
          title="Close Reel (Return to Feed)"
          aria-label="Close Reel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Visibility Badge */}
      {reel.visibility !== 'public' && (
        <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2 text-white text-xs font-semibold">
          <EyeOff size={12} /> {reel.visibility}
        </div>
      )}

      {/* Info & Caption Overlay */}
      <div className="absolute bottom-0 left-0 right-16 p-4 pt-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-10">
        <Link to={`/profile/${reel.profiles?.username}`} className="flex items-center gap-2 pointer-events-auto w-max mb-2">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 bg-surface">
            {reel.profiles?.avatar_url ? (
              <img src={reel.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-bold">
                {reel.profiles?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <span className="font-bold text-white text-[15px] hover:underline shadow-sm">{reel.profiles?.username || 'developer'}</span>
        </Link>
        {reel.caption && (
          <p className="text-white text-sm line-clamp-2 w-full pr-4 pointer-events-auto">{reel.caption}</p>
        )}
      </div>

      {/* Right Sidebar Actions */}
      <div className="absolute bottom-4 right-2 flex flex-col items-center gap-6 z-20 w-14">
        <button onClick={handleLike} className="flex flex-col items-center gap-1 group cursor-pointer">
          <div className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/60 transition">
            <Heart size={26} className={isLiked ? 'fill-red-500 text-red-500' : 'text-white'} />
          </div>
          <span className="text-white text-xs font-bold shadow-sm">{likesCount}</span>
        </button>
        
        {reel.allow_comments !== false && (
          <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1 group cursor-pointer">
            <div className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/60 transition">
              <MessageSquare size={24} className="text-white" />
            </div>
            <span className="text-white text-xs font-bold shadow-sm">{commentsList.length}</span>
          </button>
        )}
      </div>

      {/* Comments Drawer */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-x-0 bottom-0 h-[60%] bg-zinc-900 rounded-t-3xl z-30 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
          >
            <div className="flex justify-between items-center p-4 border-b border-white/10">
              <h3 className="text-white font-bold text-center flex-1">{commentsList.length} Comments</h3>
              <button onClick={() => setShowComments(false)} className="text-gray-400 hover:text-white p-1 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {commentsList.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden shrink-0 border border-white/10">
                    {c.profiles?.avatar_url ? (
                      <img src={c.profiles.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-xs text-white">{c.profiles?.username?.[0] || 'U'}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-300 mr-2">{c.profiles?.username || 'developer'}</span>
                      {(c.user_id === session?.user?.id || reel.user_id === session?.user?.id) && (
                        <button
                          onClick={() => handleDeleteReelComment(c.id)}
                          className="text-zinc-500 hover:text-rose-500 p-0.5 cursor-pointer transition-colors"
                          title="Delete comment"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-white mt-0.5">{c.content}</p>
                  </div>
                </div>
              ))}
              {commentsList.length === 0 && (
                <div className="text-center text-zinc-500 text-sm mt-10">No comments yet.</div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 flex gap-2 bg-zinc-900">
              <input 
                type="text" 
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Add comment..."
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                className="flex-1 bg-zinc-800 border border-white/5 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 transition-colors"
              />
              <button 
                onClick={submitComment}
                disabled={!commentText.trim()}
                className="bg-[#ea580c] hover:bg-[#c2410c] text-white px-5 py-2.5 rounded-full font-bold text-sm disabled:opacity-50 transition-colors cursor-pointer"
              >
                Post
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

