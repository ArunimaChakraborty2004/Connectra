import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Heart, MessageSquare, Share2, Trash2, Edit2, Bookmark, MoreHorizontal, Sparkles, Shield, Loader2, Eye, EyeOff, MessageCircleOff, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../../lib/toast';
import { Link } from 'react-router-dom';
import { explainCodeSnippet, reviewCodeAndSecurity } from '../../lib/ai';
import AIAnalysisCard from './AIAnalysisCard';
import { createNotification } from '../../lib/notifications';

export default function PostCard({ post, session, onUpdate, isHighlighted = false, autoOpenComments = false }) {
  const [showComments, setShowComments] = useState(autoOpenComments);

  useEffect(() => {
    if (autoOpenComments) {
      setShowComments(true);
    }
  }, [autoOpenComments]);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(post.comments || []);

  useEffect(() => {
    setComments(post.comments || []);
  }, [post.comments]);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [pollData, setPollData] = useState(post.poll_data || null);
  const [hasVoted, setHasVoted] = useState(
    Boolean(session?.user?.id && post.poll_data?.options?.some((o) => o.votes?.includes(session.user.id)))
  );
  const [isLiked, setIsLiked] = useState(() => Boolean(post.user_has_liked));
  const [likeCount, setLikeCount] = useState(() => post.likes?.[0]?.count ?? post.likes_count ?? 0);
  const [isLiking, setIsLiking] = useState(false);

  // Synchronize like state when post prop updates from database
  useEffect(() => {
    if (post.user_has_liked !== undefined) {
      setIsLiked(Boolean(post.user_has_liked));
    }
    const freshLikes = post.likes?.[0]?.count ?? post.likes_count;
    if (freshLikes !== undefined) {
      setLikeCount(freshLikes);
    }
  }, [post.user_has_liked, post.likes, post.likes_count]);

  // Fallback initial check if user_has_liked wasn't pre-computed
  useEffect(() => {
    if (post.user_has_liked === undefined && session?.user?.id && post.id) {
      supabase
        .from('likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setIsLiked(true);
        });
    }
  }, [post.id, session?.user?.id, post.user_has_liked]);

  // Post privacy / display controls
  const [hideLikes, setHideLikes] = useState(() => {
    if (post.hide_likes !== undefined && post.hide_likes !== null) return Boolean(post.hide_likes);
    return localStorage.getItem(`post_hide_likes_${post.id}`) === 'true';
  });

  const [commentsDisabled, setCommentsDisabled] = useState(() => {
    if (post.comments_disabled !== undefined && post.comments_disabled !== null) return Boolean(post.comments_disabled);
    return localStorage.getItem(`post_disable_comments_${post.id}`) === 'true';
  });

  const [hideCommentCount, setHideCommentCount] = useState(() => {
    if (post.hide_comment_count !== undefined && post.hide_comment_count !== null) return Boolean(post.hide_comment_count);
    return localStorage.getItem(`post_hide_comment_count_${post.id}`) === 'true';
  });

  const handleToggleHideLikes = async () => {
    const newVal = !hideLikes;
    setHideLikes(newVal);
    localStorage.setItem(`post_hide_likes_${post.id}`, String(newVal));
    toast.success(newVal ? 'Like count hidden for this post' : 'Like count visible');
    setShowMenu(false);
    try {
      await supabase.from('posts').update({ hide_likes: newVal }).eq('id', post.id);
    } catch (e) {
      // Ignored if column not in schema cache
    }
  };

  const handleToggleDisableComments = async () => {
    const newVal = !commentsDisabled;
    setCommentsDisabled(newVal);
    localStorage.setItem(`post_disable_comments_${post.id}`, String(newVal));
    toast.success(newVal ? 'Commenting turned off' : 'Commenting turned on');
    setShowMenu(false);
    try {
      await supabase.from('posts').update({ comments_disabled: newVal }).eq('id', post.id);
    } catch (e) {
      // Ignored if column not in schema cache
    }
  };

  const handleToggleHideCommentCount = async () => {
    const newVal = !hideCommentCount;
    setHideCommentCount(newVal);
    localStorage.setItem(`post_hide_comment_count_${post.id}`, String(newVal));
    toast.success(newVal ? 'Comment count hidden' : 'Comment count visible');
    setShowMenu(false);
    try {
      await supabase.from('posts').update({ hide_comment_count: newVal }).eq('id', post.id);
    } catch (e) {
      // Ignored if column not in schema cache
    }
  };
  
  // AI snippet analysis state
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisType, setAiAnalysisType] = useState(null); // 'explain' | 'security'

  const handleExplainCode = async () => {
    if (aiAnalysisType === 'explain' && aiAnalysis) {
      setAiAnalysis(null);
      setAiAnalysisType(null);
      return;
    }
    setAiAnalysisLoading(true);
    setAiAnalysisType('explain');
    try {
      const explanation = await explainCodeSnippet({
        code: post.code_snippet,
        language: post.code_language || 'javascript',
      });
      setAiAnalysis(explanation);
    } catch {
      toast.error('AI explanation failed');
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  const handleSecurityCheck = async () => {
    if (aiAnalysisType === 'security' && aiAnalysis) {
      setAiAnalysis(null);
      setAiAnalysisType(null);
      return;
    }
    setAiAnalysisLoading(true);
    setAiAnalysisType('security');
    try {
      const review = await reviewCodeAndSecurity({
        code: post.code_snippet,
        language: post.code_language || 'javascript',
      });
      setAiAnalysis(review);
    } catch {
      toast.error('AI security scan failed');
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  const isOwner = session?.user?.id === post.user_id;
  const isEdited = post.updated_at && post.updated_at !== post.created_at;

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const isReelItem = Boolean(post.is_reel || post.video_url || post.reel_id || (typeof post.id === 'string' && post.id.startsWith('reel-')));
  const targetReelId = post.reel_id || (typeof post.id === 'string' && post.id.startsWith('reel-') ? post.id.replace('reel-', '') : post.id);

  const handleLike = async () => {
    if (!session?.user?.id || isLiking) return;
    setIsLiking(true);

    const prevLiked = isLiked;
    const prevCount = likeCount;

    // Optimistic toggle
    const nextLiked = !prevLiked;
    const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);
    setIsLiked(nextLiked);
    setLikeCount(nextCount);

    try {
      if (isReelItem) {
        // 1. Reel like handling
        if (nextLiked) {
          try {
            await supabase
              .from('reel_likes')
              .insert({ reel_id: targetReelId, user_id: session.user.id });
          } catch (e) {
            console.warn('DB reel like fallback:', e);
          }
          const savedReelLikes = JSON.parse(localStorage.getItem(`connectra_reel_likes_${session.user.id}`) || '[]');
          localStorage.setItem(`connectra_reel_likes_${session.user.id}`, JSON.stringify([...new Set([...savedReelLikes, targetReelId])]));
        } else {
          try {
            await supabase
              .from('reel_likes')
              .delete()
              .eq('reel_id', targetReelId)
              .eq('user_id', session.user.id);
          } catch (e) {
            console.warn('DB reel unlike fallback:', e);
          }
          const savedReelLikes = JSON.parse(localStorage.getItem(`connectra_reel_likes_${session.user.id}`) || '[]');
          localStorage.setItem(`connectra_reel_likes_${session.user.id}`, JSON.stringify(savedReelLikes.filter(id => id !== targetReelId)));
        }
      } else {
        // 2. Post like handling
        if (nextLiked) {
          const { error } = await supabase
            .from('likes')
            .insert({ post_id: post.id, user_id: session.user.id });

          if (error && error.code !== '23505') {
            console.warn('Post like fallback:', error);
          }
          const savedPostLikes = JSON.parse(localStorage.getItem(`connectra_post_likes_${session.user.id}`) || '[]');
          localStorage.setItem(`connectra_post_likes_${session.user.id}`, JSON.stringify([...new Set([...savedPostLikes, post.id])]));

          if (post.user_id && post.user_id !== session.user.id) {
            createNotification({
              userId: post.user_id,
              actorId: session.user.id,
              type: 'like',
              entityId: post.id,
            });
          }
        } else {
          const { error } = await supabase
            .from('likes')
            .delete()
            .eq('post_id', post.id)
            .eq('user_id', session.user.id);

          if (error) {
            console.warn('Post unlike fallback:', error);
          }
          const savedPostLikes = JSON.parse(localStorage.getItem(`connectra_post_likes_${session.user.id}`) || '[]');
          localStorage.setItem(`connectra_post_likes_${session.user.id}`, JSON.stringify(savedPostLikes.filter(id => id !== post.id)));
        }
      }
    } catch (err) {
      console.warn('Like toggle error:', err);
    } finally {
      setIsLiking(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || commentsDisabled) return;
    const text = commentText.trim();
    setCommentText('');

    // Optimistic comment addition
    const tempId = `temp-${Date.now()}`;
    const newCommentObj = {
      id: tempId,
      post_id: post.id,
      reel_id: targetReelId,
      user_id: session.user.id,
      content: text,
      created_at: new Date().toISOString(),
      profiles: {
        username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
        avatar_url: session.user.user_metadata?.avatar_url || null,
      },
    };
    setComments((prev) => [...prev, newCommentObj]);

    try {
      if (isReelItem) {
        // 1. Reel comment handling
        try {
          const { data } = await supabase
            .from('reel_comments')
            .insert({
              reel_id: targetReelId,
              user_id: session.user.id,
              content: text,
            })
            .select('id, reel_id, user_id, content, created_at, profiles(username, avatar_url)')
            .single();

          if (data) {
            setComments((prev) => prev.map((c) => (c.id === tempId ? data : c)));
          }
        } catch (e) {
          console.warn('DB reel comment fallback:', e);
        }
        const localComments = JSON.parse(localStorage.getItem(`connectra_reel_comments_${targetReelId}`) || '[]');
        localStorage.setItem(`connectra_reel_comments_${targetReelId}`, JSON.stringify([...localComments, newCommentObj]));
        toast.success('Comment posted on reel! 💬');
      } else {
        // 2. Post comment handling
        const { data, error } = await supabase
          .from('comments')
          .insert({
            post_id: post.id,
            user_id: session.user.id,
            content: text,
          })
          .select('id, post_id, user_id, content, created_at, profiles(username, avatar_url)')
          .single();

        if (error) {
          console.warn('Post comment fallback to local storage:', error);
        } else if (data) {
          setComments((prev) => prev.map((c) => (c.id === tempId ? data : c)));
          if (post.user_id && post.user_id !== session.user.id) {
            createNotification({
              userId: post.user_id,
              actorId: session.user.id,
              type: 'comment',
              entityId: post.id,
            });
          }
        }
        const localComments = JSON.parse(localStorage.getItem(`connectra_post_comments_${post.id}`) || '[]');
        localStorage.setItem(`connectra_post_comments_${post.id}`, JSON.stringify([...localComments, newCommentObj]));
        toast.success('Comment posted! 💬');
      }
    } catch (err) {
      console.warn('Comment submit error:', err);
    }
  };

  const handleDeletePost = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (error) toast.error('Failed to delete post');
    else {
      toast.success('Post deleted');
      if (onUpdate) onUpdate();
    }
  };

  const handleEditPost = async () => {
    const { error } = await supabase
      .from('posts')
      .update({ content: editContent, updated_at: new Date().toISOString() })
      .eq('id', post.id);
    if (error) toast.error('Failed to update post');
    else {
      toast.success('Post updated');
      setIsEditing(false);
      if (onUpdate) onUpdate();
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Remove this comment?')) return;
    setComments(prev => prev.filter(c => c.id !== commentId));
    toast.success('Comment removed');
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      toast.error('Failed to remove comment');
      if (onUpdate) onUpdate();
    } else {
      if (onUpdate) onUpdate();
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${post.profiles?.username}`,
          text: post.content,
          url: `${window.location.origin}/post/${post.id}`,
        });
      } else {
        await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
        toast.success('Link copied to clipboard!');
      }
    } catch (err) {
      console.log('Share failed:', err);
    }
  };

  const handleVote = async (optionIndex) => {
    if (hasVoted || !pollData) return;
    const updated = { ...pollData };
    updated.options = pollData.options.map((opt, i) => ({
      ...opt,
      votes: i === optionIndex ? [...(opt.votes || []), session.user.id] : opt.votes || [],
    }));
    setPollData(updated);
    setHasVoted(true);
    await supabase.from('posts').update({ poll_data: updated }).eq('id', post.id);
  };

  const renderContent = (text) => {
    if (!text) return null;
    const parts = text.split(/(#\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return (
          <Link key={i} to={`/search?q=${part.slice(1)}`} className="text-[#ea580c] hover:underline font-bold">
            {part}
          </Link>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const authorName = post.profiles?.username || 'Sophia Lee';
  const authorHandle = `@${authorName.toLowerCase().replace(/\s+/g, '')}`;
  const initial = authorName[0]?.toUpperCase() || 'U';

  return (
    <div
      id={`post-${post.id}`}
      className={`rounded-2xl p-4 bg-white border transition-all duration-500 flex flex-col gap-3 ${
        isHighlighted
          ? 'border-[#ea580c] ring-4 ring-[#ea580c]/25 shadow-xl bg-orange-50/20'
          : 'border-[#f1e4d3] shadow-xs hover:border-[#e6ceb5]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.profiles?.username || ''}`} className="shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#ea580c] via-[#f97316] to-[#facc15] p-0.5 shadow-2xs">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-sm font-bold text-[#2b1f17] overflow-hidden">
                {post.profiles?.avatar_url ? (
                  <img src={post.profiles.avatar_url} alt={authorName} className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              to={`/profile/${post.profiles?.username || ''}`}
              className="font-bold text-sm text-[#2b1f17] hover:text-[#ea580c] transition-colors"
            >
              {authorName}
            </Link>

            <span className="text-xs text-[#8d7565]">{authorHandle}</span>
            <span className="text-xs text-[#8d7565]">·</span>
            <span className="text-xs text-[#8d7565]">{timeAgo(post.created_at)}</span>

            {isEdited && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#faf6f0] text-[#8d7565] border border-[#f1e4d3]">
                Edited
              </span>
            )}
          </div>
        </div>

        {/* Options 3-dots */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowMenu((m) => !m)}
            className="p-1 rounded-lg text-[#8d7565] hover:text-[#2b1f17] transition-colors cursor-pointer"
          >
            <MoreHorizontal size={18} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-7 w-52 rounded-xl bg-white border border-[#f1e4d3] shadow-xl py-1 z-20">
              {isOwner && (
                <>
                  <button
                    onClick={() => { setIsEditing(!isEditing); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff7ed] transition-colors text-left cursor-pointer"
                  >
                    <Edit2 size={13} /> Edit Post
                  </button>
                  <button
                    onClick={handleToggleHideLikes}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff7ed] transition-colors text-left cursor-pointer"
                  >
                    {hideLikes ? <Eye size={13} /> : <EyeOff size={13} />}
                    {hideLikes ? 'Unhide like count' : 'Hide like count'}
                  </button>
                  <button
                    onClick={handleToggleHideCommentCount}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff7ed] transition-colors text-left cursor-pointer"
                  >
                    {hideCommentCount ? <MessageSquare size={13} /> : <EyeOff size={13} />}
                    {hideCommentCount ? 'Unhide comment count' : 'Hide comment count'}
                  </button>
                  <button
                    onClick={handleToggleDisableComments}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff7ed] transition-colors text-left cursor-pointer"
                  >
                    {commentsDisabled ? <MessageSquare size={13} /> : <MessageCircleOff size={13} />}
                    {commentsDisabled ? 'Turn on commenting' : 'Turn off commenting'}
                  </button>
                  <div className="border-t border-[#f1e4d3] my-1" />
                  <button
                    onClick={() => { handleDeletePost(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                  >
                    <Trash2 size={13} /> Delete Post
                  </button>
                  <div className="border-t border-[#f1e4d3] my-1" />
                </>
              )}
              <button
                onClick={() => { handleShare(); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff7ed] transition-colors text-left cursor-pointer"
              >
                <Share2 size={13} /> Copy link
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Post text content */}
      <div className="text-sm text-[#2b1f17] leading-relaxed">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#faf6f0] border border-[#f1e4d3] text-sm text-[#2b1f17] outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 rounded-lg text-xs font-semibold text-[#8d7565] bg-[#faf6f0] hover:text-[#2b1f17]"
              >
                Cancel
              </button>
              <button
                onClick={handleEditPost}
                className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#ea580c] to-[#f97316]"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{renderContent(post.content)}</p>
        )}
      </div>

      {/* Poll */}
      {pollData && (
        <div className="rounded-xl p-3 bg-[#fff7ed] border border-[#fed7aa] flex flex-col gap-2">
          <p className="text-sm font-bold text-[#2b1f17]">{pollData.question}</p>
          {pollData.options.map((opt, i) => {
            const totalVotes = pollData.options.reduce((s, o) => s + (o.votes?.length || 0), 0);
            const pct = totalVotes > 0 ? Math.round(((opt.votes?.length || 0) / totalVotes) * 100) : 0;
            const voted = opt.votes?.includes(session.user.id);
            return (
              <button
                key={i}
                onClick={() => handleVote(i)}
                disabled={hasVoted}
                className="w-full text-left rounded-xl overflow-hidden relative border border-[#fed7aa] bg-white p-2.5 flex items-center justify-between text-xs transition-all shadow-2xs"
              >
                {hasVoted && (
                  <div
                    className="absolute inset-y-0 left-0 bg-orange-100 rounded-xl"
                    style={{ width: `${pct}%` }}
                  />
                )}
                <span className="relative z-10 text-[#2b1f17] font-semibold">{opt.text}</span>
                {hasVoted && <span className="relative z-10 text-[#ea580c] font-bold">{pct}%</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Media Attachment (Video / Reel or Image) */}
      {(post.video_url || post.image_url) && (() => {
        const mediaSource = post.video_url || post.image_url;
        const isVideo = Boolean(
          post.is_reel ||
          post.video_url ||
          (mediaSource && (
            mediaSource.endsWith('.mp4') ||
            mediaSource.endsWith('.webm') ||
            mediaSource.endsWith('.mov') ||
            mediaSource.includes('/reels/') ||
            mediaSource.startsWith('blob:') ||
            mediaSource.startsWith('data:video')
          ))
        );

        if (isVideo) {
          return (
            <div className="rounded-2xl overflow-hidden border border-[#f1e4d3] dark:border-stone-800 bg-black shadow-md relative group mt-1">
              {post.is_reel && (
                <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                  <Film size={12} className="text-orange-400" />
                  <span>Developer Reel</span>
                </div>
              )}
              <video
                src={mediaSource}
                controls
                playsInline
                preload="metadata"
                className="w-full max-h-[500px] object-contain rounded-2xl mx-auto"
              />
            </div>
          );
        }

        return (
          <div className="rounded-xl overflow-hidden border border-[#f1e4d3] max-h-[420px] bg-[#faf6f0] shadow-2xs mt-1">
            <img
              src={mediaSource}
              alt="attachment"
              className="w-full h-full object-cover rounded-xl hover:scale-[1.01] transition-transform duration-300"
            />
          </div>
        );
      })()}

      {/* Code Snippet */}
      {post.code_snippet && (
        <div className="rounded-xl overflow-hidden border border-[#f1e4d3] bg-[#2b1f17] shadow-2xs">
          <div className="px-3 py-1.5 bg-[#3d2c20] border-b border-[#4f382a] text-[11px] font-mono text-[#fcd34d] flex items-center justify-between">
            <span>{post.code_language || 'code'}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExplainCode}
                disabled={aiAnalysisLoading}
                className="flex items-center gap-1 text-[11px] font-sans font-bold px-2 py-0.5 rounded-md bg-[#ea580c]/20 hover:bg-[#ea580c]/30 text-orange-300 border border-orange-500/30 transition-all cursor-pointer"
                title="Explain this code with AI"
              >
                {aiAnalysisLoading && aiAnalysisType === 'explain' ? (
                  <Loader2 size={11} className="animate-spin text-orange-400" />
                ) : (
                  <Sparkles size={11} className="text-orange-400" />
                )}
                AI Explain
              </button>
              <button
                type="button"
                onClick={handleSecurityCheck}
                disabled={aiAnalysisLoading}
                className="flex items-center gap-1 text-[11px] font-sans font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
                title="Audit code for security issues"
              >
                {aiAnalysisLoading && aiAnalysisType === 'security' ? (
                  <Loader2 size={11} className="animate-spin text-emerald-400" />
                ) : (
                  <Shield size={11} className="text-emerald-400" />
                )}
                AI Security
              </button>
            </div>
          </div>
          <pre className="p-3 text-xs font-mono text-amber-300 overflow-x-auto">
            <code>{post.code_snippet}</code>
          </pre>

          {/* AI Analysis Dropdown Card */}
          <AnimatePresence>
            {aiAnalysis && (
              <div className="p-3 pt-0">
                <AIAnalysisCard
                  content={aiAnalysis}
                  type={aiAnalysisType}
                  onClose={() => { setAiAnalysis(null); setAiAnalysisType(null); }}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      )}


      {/* Footer / Interaction Row */}
      <div className="flex items-center justify-between pt-1 text-xs text-[#8d7565]">
        <div className="flex items-center gap-6">
          {/* Like button in Orange */}
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
              isLiked ? 'text-[#ea580c]' : 'hover:text-[#ea580c]'
            }`}
          >
            <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
            <span className="font-bold">
              {hideLikes ? (isLiked ? 'Liked' : 'Like') : likeCount}
            </span>
          </button>

          {/* Comment */}
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 hover:text-[#ea580c] transition-colors cursor-pointer"
          >
            <MessageSquare size={16} />
            <span className="font-bold">
              {hideCommentCount ? 'Comments' : comments.length}
            </span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 hover:text-[#ea580c] transition-colors cursor-pointer"
          >
            <Share2 size={16} />
            <span className="font-medium">Share</span>
          </button>
        </div>

        {/* Bookmark */}
        <button
          onClick={() => setIsBookmarked(!isBookmarked)}
          className={`transition-colors cursor-pointer ${
            isBookmarked ? 'text-[#ea580c]' : 'hover:text-[#2b1f17]'
          }`}
        >
          <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Comments section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 border-t border-[#f1e4d3] flex flex-col gap-2.5">
              {comments.length === 0 ? (
                <p className="text-xs text-[#8d7565] italic py-1">No comments yet. Start the discussion!</p>
              ) : (
                comments.map((c) => {
                  const canDelete = isOwner || c.user_id === session?.user?.id || session?.user?.user_metadata?.is_admin;
                  return (
                    <div key={c.id} className="flex gap-2.5 text-xs group">
                      <Link to={`/profile/${c.profiles?.username || ''}`} className="shrink-0">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-r from-[#ea580c] to-[#f97316] flex items-center justify-center font-bold text-white shrink-0 shadow-2xs overflow-hidden">
                          {c.profiles?.avatar_url ? (
                            <img src={c.profiles.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            c.profiles?.username?.[0]?.toUpperCase() || 'U'
                          )}
                        </div>
                      </Link>
                      <div className="flex-1 bg-[#faf6f0] p-2.5 rounded-xl border border-[#f1e4d3] relative">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <Link to={`/profile/${c.profiles?.username || ''}`} className="font-bold text-[#2b1f17] hover:text-[#ea580c]">
                            @{c.profiles?.username || 'user'}
                          </Link>
                          <div className="flex items-center gap-2">
                            {c.created_at && (
                              <span className="text-[10px] text-[#8d7565]">{timeAgo(c.created_at)}</span>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(c.id)}
                                title={isOwner ? "Remove comment (Post Author / Admin)" : "Delete your comment"}
                                className="text-stone-400 hover:text-rose-600 transition-colors p-0.5 rounded cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        <span className="text-[#2b1f17] break-words">{c.content}</span>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Add comment input OR disabled message */}
              {commentsDisabled ? (
                <div className="p-2.5 bg-orange-50/60 border border-orange-200/60 rounded-xl text-center text-xs text-[#8d7565] font-medium">
                  🔒 Commenting has been turned off for this post by author.
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    placeholder="Write a comment..."
                    className="flex-1 bg-[#faf6f0] border border-[#f1e4d3] rounded-full px-4 py-2 text-xs text-[#2b1f17] outline-none focus:border-orange-500 focus:bg-white"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!commentText.trim()}
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-[#ea580c] to-[#f97316] hover:brightness-105 disabled:opacity-40 text-white text-xs font-bold cursor-pointer shadow-xs transition-all"
                  >
                    Reply
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
