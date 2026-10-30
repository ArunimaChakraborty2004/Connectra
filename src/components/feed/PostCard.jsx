import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Heart, MessageSquare, Share2, Trash2, Edit2, Bookmark, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../../lib/toast';
import { Link } from 'react-router-dom';

export default function PostCard({ post, session, onUpdate }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [pollData, setPollData] = useState(post.poll_data || null);
  const [hasVoted, setHasVoted] = useState(
    post.poll_data?.options?.some((o) => o.votes?.includes(session.user.id)) || false
  );
  const [localLiked, setLocalLiked] = useState(false);

  const isOwner = session.user.id === post.user_id;
  const isEdited = post.updated_at && post.updated_at !== post.created_at;
  const likeCount = (post.likes?.[0]?.count || 0) + (localLiked ? 1 : 0);
  const commentCount = post.comments?.length || 0;

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}h`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const handleLike = async () => {
    setLocalLiked((l) => !l);
    const { data: existing } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', session.user.id)
      .single();
    if (existing) {
      await supabase.from('likes').delete().eq('id', existing.id);
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: session.user.id });
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    const { error } = await supabase.from('comments').insert({
      post_id: post.id,
      user_id: session.user.id,
      content: commentText,
    });
    if (error) toast.error('Failed to add comment');
    else setCommentText('');
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
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) toast.error('Failed to delete comment');
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
    <div className="rounded-2xl p-4 bg-white border border-[#f1e4d3] shadow-xs flex flex-col gap-3 hover:border-[#e6ceb5] transition-all">
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

            {/* Orange verified checkmark badge */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <circle cx="12" cy="12" r="12" fill="#ea580c" />
              <path d="M7.5 12l3 3 6-6" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

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
            <div className="absolute right-0 top-7 w-36 rounded-xl bg-white border border-[#f1e4d3] shadow-md py-1 z-20">
              {isOwner && (
                <>
                  <button
                    onClick={() => { setIsEditing(!isEditing); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff7ed] transition-colors text-left cursor-pointer"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => { handleDeletePost(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
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

      {/* Media Attachment */}
      {post.image_url && (
        <div className="rounded-xl overflow-hidden border border-[#f1e4d3] max-h-[420px] bg-[#faf6f0] shadow-2xs">
          <img
            src={post.image_url}
            alt="attachment"
            className="w-full h-full object-cover rounded-xl hover:scale-[1.01] transition-transform duration-300"
          />
        </div>
      )}

      {/* Code Snippet */}
      {post.code_snippet && (
        <div className="rounded-xl overflow-hidden border border-[#f1e4d3] bg-[#2b1f17] shadow-2xs">
          <div className="px-3 py-1.5 bg-[#3d2c20] border-b border-[#4f382a] text-[11px] font-mono text-[#fcd34d]">
            {post.code_language || 'code'}
          </div>
          <pre className="p-3 text-xs font-mono text-amber-300 overflow-x-auto">
            <code>{post.code_snippet}</code>
          </pre>
        </div>
      )}

      {/* Footer / Interaction Row */}
      <div className="flex items-center justify-between pt-1 text-xs text-[#8d7565]">
        <div className="flex items-center gap-6">
          {/* Like button in Orange */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
              localLiked ? 'text-[#ea580c]' : 'hover:text-[#ea580c]'
            }`}
          >
            <Heart size={16} fill={localLiked ? 'currentColor' : 'none'} />
            <span className="font-bold">
              {likeCount > 0 ? (likeCount >= 1000 ? `${(likeCount / 1000).toFixed(1)}K` : likeCount) : '1.2K'}
            </span>
          </button>

          {/* Comment */}
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 hover:text-[#ea580c] transition-colors cursor-pointer"
          >
            <MessageSquare size={16} />
            <span className="font-bold">{commentCount > 0 ? commentCount : '128'}</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 hover:text-[#ea580c] transition-colors cursor-pointer"
          >
            <Share2 size={16} />
            <span className="font-bold">96</span>
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
              {post.comments?.map((c) => (
                <div key={c.id} className="flex gap-2.5 text-xs">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-r from-[#ea580c] to-[#f97316] flex items-center justify-center font-bold text-white shrink-0 shadow-2xs">
                    {c.profiles?.avatar_url ? (
                      <img src={c.profiles.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      c.profiles?.username?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="flex-1 bg-[#faf6f0] p-2.5 rounded-xl border border-[#f1e4d3]">
                    <span className="font-bold text-[#2b1f17] mr-1.5">{c.profiles?.username}</span>
                    <span className="text-[#8d7565]">{c.content}</span>
                  </div>
                </div>
              ))}

              {/* Add comment input */}
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
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-[#ea580c] to-[#f97316] hover:brightness-105 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  Reply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
