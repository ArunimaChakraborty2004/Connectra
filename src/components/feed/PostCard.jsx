import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Heart, MessageSquare, Share2, Trash2, Edit2, Bookmark, MoreHorizontal, Sparkles, Shield, Loader2, Eye, EyeOff, MessageCircleOff, Film, Copy, Check, BarChart3, CheckCircle2, Bot, Layers, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../../lib/toast';
import { Link } from 'react-router-dom';
import { explainCodeSnippet, reviewCodeAndSecurity, generatePeerCodeReviewBotCritique } from '../../lib/ai';
import AIAnalysisCard from './AIAnalysisCard';
import AIPeerReviewCommentCard from './AIPeerReviewCommentCard';
import MermaidDiagramCard from '../ai/MermaidDiagramCard';
import { createNotification } from '../../lib/notifications';

export default function PostCard({ post, session, onUpdate, isHighlighted = false, autoOpenComments = false, isCommunityAdmin = false }) {
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
  const [hasVoted, setHasVoted] = useState(() => {
    if (!session?.user?.id || !post.poll_data?.options || !Array.isArray(post.poll_data.options)) return false;
    return post.poll_data.options.some((o) => Array.isArray(o?.votes) && o.votes.includes(session.user.id));
  });
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

  const [codeCopied, setCodeCopied] = useState(false);
  const handleCopyCode = () => {
    if (navigator.clipboard && post.code_snippet) {
      navigator.clipboard.writeText(post.code_snippet);
      setCodeCopied(true);
      toast.success('Code copied to clipboard! 📋');
      setTimeout(() => setCodeCopied(false), 2000);
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

  const [aiReviewLoading, setAiReviewLoading] = useState(false);

  const handleRequestAIReview = async () => {
    if (!post.code_snippet) {
      toast.error('No code snippet found to review.');
      return;
    }
    if (aiReviewLoading) return;
    setAiReviewLoading(true);
    setShowComments(true);
    toast.info('Connectra AI Peer Review bot is auditing code... 🤖');

    try {
      const critique = await generatePeerCodeReviewBotCritique({
        code: post.code_snippet,
        language: post.code_language || 'javascript',
        authorUsername: post.profiles?.username || 'developer',
      });

      const tempId = `ai-review-${Date.now()}`;
      const botCommentObj = {
        id: tempId,
        post_id: post.id,
        user_id: session?.user?.id || 'connectra-ai-bot',
        content: critique,
        created_at: new Date().toISOString(),
        profiles: {
          username: 'connectra-ai-bot',
          avatar_url: null,
        },
      };

      setComments((prev) => [...prev, botCommentObj]);

      // Try inserting into Supabase comments
      let inserted = botCommentObj;
      try {
        if (session?.user?.id) {
          const { data, error } = await supabase
            .from('comments')
            .insert({
              post_id: post.id,
              user_id: session.user.id,
              content: critique,
            })
            .select('id, post_id, user_id, content, created_at, profiles(username, avatar_url)')
            .single();

          if (!error && data) {
            inserted = data;
            setComments((prev) => prev.map((c) => (c.id === tempId ? data : c)));
          }
        }
      } catch (dbErr) {
        console.warn('DB AI review comment warning:', dbErr);
      }

      // Persist to local comments
      const localComments = JSON.parse(localStorage.getItem(`connectra_post_comments_${post.id}`) || '[]');
      localStorage.setItem(`connectra_post_comments_${post.id}`, JSON.stringify([...localComments, inserted]));

      // Also persist to connectra_active_posts in localStorage so it stays attached across reloads
      try {
        const activePosts = JSON.parse(localStorage.getItem('connectra_active_posts') || '[]');
        const updatedPosts = activePosts.map((p) => {
          if (p.id === post.id) {
            return {
              ...p,
              comments: [...(p.comments || []), inserted],
              comments_count: (p.comments_count || 0) + 1,
            };
          }
          return p;
        });
        localStorage.setItem('connectra_active_posts', JSON.stringify(updatedPosts));
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('refreshFeed'));
      toast.success('AI Peer Review bot delivered structured critique! 🤖🚀');
    } catch (err) {
      console.error('AI peer review error:', err);
      toast.error('AI review generation failed: ' + (err.message || 'Service busy'));
    } finally {
      setAiReviewLoading(false);
    }
  };

  const isOwner = session?.user?.id === post.user_id;
  const isEdited = post.updated_at && post.updated_at !== post.created_at;

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    // Ensure UTC parsing: append 'Z' if no timezone suffix present
    const normalized = /Z|[+-]\d{2}:\d{2}$/.test(dateStr)
      ? dateStr
      : dateStr.replace(' ', 'T') + 'Z';
    const diff = (Date.now() - new Date(normalized)) / 1000;
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
        window.dispatchEvent(new CustomEvent('refreshReels'));
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
        const filteredOld = localComments.filter((c) => c.id !== tempId && c.content !== text);
        localStorage.setItem(`connectra_reel_comments_${targetReelId}`, JSON.stringify([...filteredOld, newCommentObj]));
        window.dispatchEvent(new CustomEvent('refreshReels'));
        window.dispatchEvent(new CustomEvent('refreshFeed'));
        toast.success('Comment posted on reel! 💬');
      } else {
        // 2. Post comment handling
        let insertedComment = newCommentObj;
        try {
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
            insertedComment = data;
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
        } catch (e) {
          console.warn('DB post comment error:', e);
        }
        const localComments = JSON.parse(localStorage.getItem(`connectra_post_comments_${post.id}`) || '[]');
        const filteredOld = localComments.filter((c) => c.id !== tempId && c.content !== text);
        localStorage.setItem(`connectra_post_comments_${post.id}`, JSON.stringify([...filteredOld, insertedComment]));
        window.dispatchEvent(new CustomEvent('refreshFeed'));
        toast.success('Comment posted! 💬');
      }
    } catch (err) {
      console.warn('Comment submit error:', err);
    }
  };

  const handleDeletePost = async () => {
    const confirmMsg = isCommunityAdmin && !isOwner
      ? 'Delete this post as community admin?'
      : 'Are you sure you want to delete this post?';
    if (!confirm(confirmMsg)) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (error) {
      toast.error('Failed to delete post: ' + error.message);
    } else {
      toast.success(isCommunityAdmin && !isOwner ? 'Post removed by community admin' : 'Post deleted');
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
    const commentToDelete = comments.find((c) => c.id === commentId);

    // Optimistically update UI
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    toast.success('Comment removed');

    try {
      if (isReelItem) {
        // 1. Delete from reel_comments in Supabase
        if (commentId && !commentId.startsWith('temp-')) {
          const { error } = await supabase.from('reel_comments').delete().eq('id', commentId);
          if (error) console.warn('Supabase reel comment delete notice:', error);
        }
        if (commentToDelete?.content) {
          // Clean up any matching record by content & user
          await supabase
            .from('reel_comments')
            .delete()
            .eq('reel_id', targetReelId)
            .eq('user_id', session?.user?.id)
            .eq('content', commentToDelete.content);
        }

        // 2. Clear from localStorage
        const localComments = JSON.parse(localStorage.getItem(`connectra_reel_comments_${targetReelId}`) || '[]');
        const updatedLocal = localComments.filter(
          (c) => c.id !== commentId && !(c.content === commentToDelete?.content && (c.user_id === session?.user?.id || c.user_id === commentToDelete?.user_id))
        );
        localStorage.setItem(`connectra_reel_comments_${targetReelId}`, JSON.stringify(updatedLocal));

        // 3. Notify all listeners
        window.dispatchEvent(new CustomEvent('refreshReels'));
        window.dispatchEvent(new CustomEvent('refreshFeed'));
        if (onUpdate) onUpdate();
      } else {
        // 1. Delete from comments in Supabase
        if (commentId && !commentId.startsWith('temp-')) {
          const { error } = await supabase.from('comments').delete().eq('id', commentId);
          if (error) console.warn('Supabase post comment delete notice:', error);
        }
        if (commentToDelete?.content) {
          await supabase
            .from('comments')
            .delete()
            .eq('post_id', post.id)
            .eq('user_id', session?.user?.id)
            .eq('content', commentToDelete.content);
        }

        // 2. Clear from localStorage
        const localComments = JSON.parse(localStorage.getItem(`connectra_post_comments_${post.id}`) || '[]');
        const updatedLocal = localComments.filter(
          (c) => c.id !== commentId && !(c.content === commentToDelete?.content && (c.user_id === session?.user?.id || c.user_id === commentToDelete?.user_id))
        );
        localStorage.setItem(`connectra_post_comments_${post.id}`, JSON.stringify(updatedLocal));

        // 3. Notify all listeners
        window.dispatchEvent(new CustomEvent('refreshFeed'));
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      console.warn('Comment delete error:', err);
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
    if (hasVoted || !pollData || !Array.isArray(pollData.options)) return;
    const userId = session?.user?.id || 'anon';
    const updated = { ...pollData };
    updated.options = pollData.options.map((opt, i) => {
      const currentVotes = Array.isArray(opt.votes) ? opt.votes : [];
      return {
        ...opt,
        votes: i === optionIndex ? [...currentVotes, userId] : currentVotes,
      };
    });
    setPollData(updated);
    setHasVoted(true);
    await supabase.from('posts').update({ poll_data: updated }).eq('id', post.id);
  };

  const renderContent = (text) => {
    if (!text) return null;

    // Pattern matching URLs (http/https) and Hashtags (#tag)
    const tokenRegex = /(https?:\/\/[^\s]+|#\w+)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, i) => {
      if (!part) return null;

      // Handle URLs (like GitHub repositories or demos)
      if (part.startsWith('http://') || part.startsWith('https://')) {
        const isGitHub = part.includes('github.com');
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1 font-bold underline underline-offset-2 transition-all cursor-pointer ${
              isGitHub
                ? 'text-[#ea580c] hover:text-[#c2410c] hover:bg-orange-50/70 px-1.5 py-0.5 rounded-lg border border-orange-200/50'
                : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50/70 px-1 py-0.5 rounded-lg'
            }`}
          >
            <span>{part}</span>
            <ExternalLink size={12} className="shrink-0 inline opacity-70" />
          </a>
        );
      }

      // Handle Hashtags
      if (part.startsWith('#')) {
        return (
          <Link
            key={i}
            to={`/search?q=${part.slice(1)}`}
            className="text-[#ea580c] hover:underline font-bold"
          >
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

            {post.community_slug && (
              <>
                <span className="text-xs text-[#8d7565]">in</span>
                <Link
                  to={`/communities?community=${post.community_id || post.community_slug}`}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/50 text-[#ea580c] hover:bg-orange-100 transition-colors border border-orange-200/60 dark:border-orange-900/40"
                  title={`View in #${post.community_slug}`}
                >
                  <span>#{post.community_slug}</span>
                </Link>
              </>
            )}

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
              {(isOwner || isCommunityAdmin) && (
                <>
                  {isOwner && (
                    <button
                      onClick={() => { setIsEditing(!isEditing); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff7ed] transition-colors text-left cursor-pointer"
                    >
                      <Edit2 size={13} /> Edit Post
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={handleToggleHideLikes}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff7ed] transition-colors text-left cursor-pointer"
                    >
                      {hideLikes ? <Eye size={13} /> : <EyeOff size={13} />}
                      {hideLikes ? 'Unhide like count' : 'Hide like count'}
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={handleToggleHideCommentCount}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff7ed] transition-colors text-left cursor-pointer"
                    >
                      {hideCommentCount ? <MessageSquare size={13} /> : <EyeOff size={13} />}
                      {hideCommentCount ? 'Unhide comment count' : 'Hide comment count'}
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={handleToggleDisableComments}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff7ed] transition-colors text-left cursor-pointer"
                    >
                      {commentsDisabled ? <MessageSquare size={13} /> : <MessageCircleOff size={13} />}
                      {commentsDisabled ? 'Turn on commenting' : 'Turn off commenting'}
                    </button>
                  )}
                  <div className="border-t border-[#f1e4d3] my-1" />
                  <button
                    onClick={() => { handleDeletePost(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                  >
                    <Trash2 size={13} /> {isCommunityAdmin && !isOwner ? 'Delete Post (Admin)' : 'Delete Post'}
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
        ) : (() => {
          const mermaidRegex = /```mermaid\n([\s\S]*?)```/i;
          const mermaidMatch = post.content ? post.content.match(mermaidRegex) : null;
          const diagramCode = post.poll_data?.diagram_code || (mermaidMatch ? mermaidMatch[1] : null);
          const textWithoutMermaid = post.content ? post.content.replace(mermaidRegex, '').trim() : '';

          return (
            <div className="space-y-2.5">
              {textWithoutMermaid && (
                <p className="whitespace-pre-wrap">{renderContent(textWithoutMermaid)}</p>
              )}
              {diagramCode && (
                <div className="mt-1">
                  <MermaidDiagramCard code={diagramCode} />
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* SaaS Developer Poll */}
      {pollData && Array.isArray(pollData.options) && pollData.options.length > 0 && (() => {
        const totalVotes = pollData.options.reduce(
          (sum, opt) => sum + (Array.isArray(opt?.votes) ? opt.votes.length : (typeof opt?.votes === 'number' ? opt.votes : 0)),
          0
        );

        return (
          <div className="rounded-2xl p-4 bg-[#faf6f0]/70 dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#382b22] space-y-3 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-[#ea580c] flex items-center justify-center shrink-0">
                  <BarChart3 size={13} />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-[#1c130d] dark:text-white">
                  {pollData.question}
                </h4>
              </div>
              <span className="text-[10px] font-mono text-[#8d7565] shrink-0 font-semibold">
                {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-2">
              {pollData.options.map((opt, i) => {
                const optVotes = Array.isArray(opt.votes) ? opt.votes.length : (typeof opt.votes === 'number' ? opt.votes : 0);
                const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                const votedForThis = Boolean(session?.user?.id && Array.isArray(opt.votes) && opt.votes.includes(session.user.id));

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleVote(i)}
                    disabled={hasVoted}
                    className={`w-full text-left rounded-xl overflow-hidden relative border transition-all p-3 flex items-center justify-between text-xs ${
                      hasVoted
                        ? votedForThis
                          ? 'border-orange-400 dark:border-orange-700 bg-white dark:bg-[#251a14] shadow-xs'
                          : 'border-[#f1e4d3] dark:border-[#33261d] bg-white/70 dark:bg-[#1f1813]'
                        : 'border-[#f1e4d3] dark:border-[#382b22] bg-white dark:bg-[#1f1813] hover:border-orange-400 hover:shadow-xs cursor-pointer'
                    }`}
                  >
                    {/* Progress Bar Fill when Voted */}
                    {hasVoted && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                        className={`absolute inset-y-0 left-0 ${
                          votedForThis
                            ? 'bg-gradient-to-r from-orange-500/20 to-orange-500/10 dark:from-orange-500/30 dark:to-orange-500/15'
                            : 'bg-[#f1e4d3]/40 dark:bg-[#2e231b]'
                        }`}
                      />
                    )}

                    <div className="relative z-10 flex items-center gap-2 min-w-0 pr-2">
                      {votedForThis ? (
                        <CheckCircle2 size={14} className="text-[#ea580c] shrink-0" />
                      ) : !hasVoted ? (
                        <div className="w-3.5 h-3.5 rounded-full border border-[#8d7565] shrink-0" />
                      ) : null}
                      <span className={`font-semibold truncate ${votedForThis ? 'text-[#ea580c] font-bold' : 'text-[#1c130d] dark:text-white'}`}>
                        {opt.text}
                      </span>
                    </div>

                    {hasVoted && (
                      <div className="relative z-10 flex items-center gap-2 shrink-0 font-mono text-[11px]">
                        <span className="text-[#8d7565] text-[10px]">({optVotes})</span>
                        <span className={`font-bold ${votedForThis ? 'text-[#ea580c]' : 'text-[#1c130d] dark:text-white'}`}>
                          {pct}%
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#8d7565] pt-0.5 px-0.5 font-medium">
              <span>{hasVoted ? '✓ Your vote is recorded in database' : 'Click an option to cast your vote'}</span>
              <span>Live Synced</span>
            </div>
          </div>
        );
      })()}

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
          <div
            className="rounded-xl overflow-hidden border border-[#f1e4d3] dark:border-stone-800 max-h-[520px] bg-stone-900/5 dark:bg-stone-950 flex items-center justify-center shadow-2xs mt-1 relative group cursor-zoom-in"
            onClick={() => window.open(mediaSource, '_blank')}
            title="Click to view full image in a new tab"
          >
            <img
              src={mediaSource}
              alt="attachment"
              className="w-full max-h-[520px] object-contain rounded-xl hover:scale-[1.008] transition-transform duration-200"
            />
            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-xs rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Click to expand ↗
            </div>
          </div>
        );
      })()}

      {/* Code Snippet */}
      {post.code_snippet && (
        <div className="rounded-xl overflow-hidden border border-[#f1e4d3] dark:border-stone-800 bg-[#2b1f17] shadow-2xs">
          <div className="px-3 py-1.5 bg-[#3d2c20] border-b border-[#4f382a] text-[11px] font-mono text-[#fcd34d] flex items-center justify-between">
            <span className="font-bold uppercase tracking-wider text-[10px] text-amber-400/90">{post.code_language || 'code'}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-[11px] font-sans font-medium px-2 py-0.5 rounded-md bg-stone-700/60 hover:bg-stone-700 text-stone-200 border border-stone-600/40 transition-all cursor-pointer"
                title="Copy code to clipboard"
              >
                {codeCopied ? (
                  <>
                    <Check size={11} className="text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} className="text-stone-300" />
                    <span>Copy</span>
                  </>
                )}
              </button>
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
              <button
                type="button"
                onClick={handleRequestAIReview}
                disabled={aiReviewLoading || aiAnalysisLoading}
                className="flex items-center gap-1 text-[11px] font-sans font-bold px-2 py-0.5 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-all cursor-pointer"
                title="Request an in-depth AI Peer Review (Time/Space Complexity, Edge Cases & Refactor)"
              >
                {aiReviewLoading ? (
                  <Loader2 size={11} className="animate-spin text-purple-400" />
                ) : (
                  <Bot size={11} className="text-purple-400" />
                )}
                AI Review
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
                  const isBotReview = Boolean(
                    (c.content && c.content.includes('Connectra AI Peer Review')) ||
                    c.profiles?.username === 'connectra-ai-bot'
                  );
                  const canDelete = isOwner || isCommunityAdmin || c.user_id === session?.user?.id || session?.user?.user_metadata?.is_admin;

                  if (isBotReview) {
                    return (
                      <AIPeerReviewCommentCard
                        key={c.id}
                        comment={c}
                        onDelete={handleDeleteComment}
                        canDelete={canDelete}
                        timeAgo={timeAgo}
                      />
                    );
                  }

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
