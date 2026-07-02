import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Heart, MessageSquare, Plus, VolumeX, Volume2, X, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import Loader from '../components/ui/Loader';
import CreateReel from '../components/reels/CreateReel';
import { toast } from '../lib/toast';

export default function ReelsPage({ session }) {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeReelId, setActiveReelId] = useState(null);

  const fetchReels = async () => {
    const { data, error } = await supabase
      .from('reels')
      .select(`
        *,
        profiles(username, avatar_url),
        reel_likes(id, user_id),
        reel_comments(id, user_id, content, created_at, profiles(username, avatar_url))
      `)
      .order('created_at', { ascending: false });
    
    if (data) {
      setReels(data);
      if (data.length > 0 && !activeReelId) {
        setActiveReelId(data[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReels();
    const sub = supabase.channel('reels-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reels' }, fetchReels)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reel_likes' }, fetchReels)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reel_comments' }, fetchReels)
      .subscribe();
    return () => sub.unsubscribe();
  }, []);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="h-[calc(100vh-56px)] w-full bg-black relative flex justify-center overflow-hidden">
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
            />
          ))
        )}
      </div>

      <button 
        onClick={() => setShowCreate(true)}
        className="absolute top-6 right-6 z-40 h-12 w-12 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 transition-all shadow-lg"
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

function ReelCard({ reel, session, isActive, onVisible }) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const hasLiked = reel.reel_likes?.some(like => like.user_id === session.user.id);
  const likesCount = reel.reel_likes?.length || 0;
  const commentsCount = reel.reel_comments?.length || 0;

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
    if (hasLiked) {
      const like = reel.reel_likes.find(l => l.user_id === session.user.id);
      await supabase.from('reel_likes').delete().eq('id', like.id);
    } else {
      await supabase.from('reel_likes').insert({ reel_id: reel.id, user_id: session.user.id });
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    const { error } = await supabase.from('reel_comments').insert({
      reel_id: reel.id,
      user_id: session.user.id,
      content: commentText
    });
    if (!error) setCommentText('');
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
      
      {/* Top Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button 
          onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
          className="p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition"
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
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
        <Link to={`/profile/${reel.profiles.username}`} className="flex items-center gap-2 pointer-events-auto w-max mb-2">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 bg-surface">
            {reel.profiles.avatar_url ? (
              <img src={reel.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-bold">
                {reel.profiles.username[0].toUpperCase()}
              </div>
            )}
          </div>
          <span className="font-bold text-white text-[15px] hover:underline shadow-sm">{reel.profiles.username}</span>
        </Link>
        {reel.caption && (
          <p className="text-white text-sm line-clamp-2 w-full pr-4 pointer-events-auto">{reel.caption}</p>
        )}
      </div>

      {/* Right Sidebar Actions */}
      <div className="absolute bottom-4 right-2 flex flex-col items-center gap-6 z-20 w-14">
        <button onClick={handleLike} className="flex flex-col items-center gap-1 group">
          <div className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/60 transition">
            <Heart size={26} className={hasLiked ? 'fill-red-500 text-red-500' : 'text-white'} />
          </div>
          <span className="text-white text-xs font-bold shadow-sm">{likesCount}</span>
        </button>
        
        {reel.allow_comments && (
          <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1 group">
            <div className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/60 transition">
              <MessageSquare size={24} className="text-white" />
            </div>
            <span className="text-white text-xs font-bold shadow-sm">{commentsCount}</span>
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
              <h3 className="text-white font-bold text-center flex-1">{commentsCount} Comments</h3>
              <button onClick={() => setShowComments(false)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {reel.reel_comments?.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden shrink-0 border border-white/10">
                    {c.profiles.avatar_url ? (
                      <img src={c.profiles.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-xs text-white">{c.profiles.username[0]}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-300 mr-2">{c.profiles.username}</span>
                    <p className="text-sm text-white mt-0.5">{c.content}</p>
                  </div>
                </div>
              ))}
              {reel.reel_comments?.length === 0 && (
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
                className="bg-primary text-white px-5 py-2.5 rounded-full font-bold text-sm disabled:opacity-50 transition-colors"
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
