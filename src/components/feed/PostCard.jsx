import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Heart, MessageSquare, Share2, Trash2, Edit2, Send, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../../lib/toast';
import { Link } from 'react-router-dom';

export default function PostCard({ post, session, onUpdate }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const isOwner = session.user.id === post.user_id;
  const isEdited = post.updated_at && post.updated_at !== post.created_at;

  const handleLike = async () => {
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
      content: commentText
    });
    if (error) toast.error('Failed to add comment');
    else {
      setCommentText('');
      // Optimistic update could happen here if we passed down a state setter
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
    
    if (error) {
      toast.error('Failed to update post');
    } else {
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

  const renderContentWithHashtags = (text) => {
    if (!text) return null;
    const parts = text.split(/(#\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return (
          <Link key={i} to={`/search?q=${part.slice(1)}`} className="text-primary hover:underline">
            {part}
          </Link>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="glass-panel rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 flex items-center gap-3">
        <Link to={`/profile/${post.profiles?.username}`} className="h-9 w-9 rounded-xl glass-panel flex items-center justify-center text-sm font-bold text-main overflow-hidden">
          {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : post.profiles?.username?.[0]?.toUpperCase() || 'U'}
        </Link>
        <div className="flex-1">
          <Link to={`/profile/${post.profiles?.username}`} className="font-semibold text-main text-[14px] hover:underline">
            {post.profiles?.username || 'Unknown Developer'}
          </Link>
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-[#666]">{new Date(post.created_at).toLocaleDateString()}</p>
            {isEdited && <span className="text-[10px] bg-surface-hover text-muted px-1.5 py-0.5 rounded">Edited</span>}
          </div>
        </div>
        
        {isOwner && (
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(!isEditing)} className="text-[#666] hover:text-main transition-colors"><Edit2 size={16} /></button>
            <button onClick={handleDeletePost} className="text-[#666] hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-5 pb-4 text-gray-300 text-[15px] leading-relaxed whitespace-pre-wrap">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea 
              value={editContent} 
              onChange={e => setEditContent(e.target.value)}
              className="w-full glass-panel rounded-lg p-3 text-main focus:outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsEditing(false)} className="text-sm px-3 py-1 bg-surface-hover rounded-md">Cancel</button>
              <button onClick={handleEditPost} className="text-sm px-3 py-1 bg-primary text-main rounded-md">Save</button>
            </div>
          </div>
        ) : (
          renderContentWithHashtags(post.content)
        )}
      </div>

      {/* Media Attachments */}
      {post.image_url && (
        <div className="px-5 pb-4">
          <img src={post.image_url} className="rounded-xl w-full object-cover max-h-[400px] border border-white/10" alt="Post attachment" />
        </div>
      )}
      
      {/* Code Snippet */}
      {post.code_snippet && (
        <div className="px-5 pb-4">
          <div className="relative group/code">
            <div className="absolute top-0 right-0 bg-surface-hover px-3 py-1 rounded-bl-lg rounded-tr-xl text-xs font-mono text-gray-400">
              {post.code_language || 'code'}
            </div>
            <pre className="glass-panel rounded-xl p-4 overflow-x-auto">
              <code className="text-sm font-mono text-green-400">{post.code_snippet}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-3 border-t border-white/10 flex gap-6">
        <button onClick={handleLike} className="flex items-center gap-2 text-gray-400 hover:text-pink-500 transition-colors group/btn">
          <Heart size={20} className="group-hover/btn:fill-pink-500/20" /> 
          <span className="font-medium text-sm">{post.likes?.[0]?.count || 0}</span>
        </button>
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors">
          <MessageSquare size={20} /> 
          <span className="font-medium text-sm">{post.comments?.length || 0}</span>
        </button>
        <button 
          onClick={() => setIsBookmarked(!isBookmarked)} 
          className={`flex items-center gap-2 transition-colors ml-auto ${isBookmarked ? 'text-primary' : 'text-gray-400 hover:text-primary'}`}
        >
          <Bookmark size={20} className={isBookmarked ? "fill-primary/20" : ""} />
        </button>
        <button onClick={handleShare} className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors">
          <Share2 size={20} />
        </button>
      </div>
      
      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-black/20 border-t border-white/10"
          >
            <div className="p-5 flex flex-col gap-4">
              {post.comments?.map(c => (
                <div key={c.id} className="flex gap-3 group/comment">
                  <Link to={`/profile/${c.profiles?.username}`} className="h-8 w-8 shrink-0 rounded-full bg-surface-hover flex items-center justify-center text-xs font-bold text-main overflow-hidden">
                    {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : c.profiles?.username?.[0]?.toUpperCase()}
                  </Link>
                  <div className="glass-panel rounded-2xl rounded-tl-sm px-4 py-2 text-sm flex-1 relative">
                    <Link to={`/profile/${c.profiles?.username}`} className="font-bold text-gray-200 mr-2 hover:underline">
                      {c.profiles?.username}
                    </Link>
                    <span className="text-gray-400">{c.content}</span>
                    {session.user.id === c.user_id && (
                      <button onClick={() => handleDeleteComment(c.id)} className="absolute -right-2 -top-2 p-1 bg-red-500/20 text-red-400 rounded-full opacity-0 group-hover/comment:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              <div className="flex items-center gap-3 mt-2">
                <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  Me
                </div>
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={commentText} 
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="w-full glass-panel rounded-full px-4 py-2 text-sm text-main focus:border-primary/50 outline-none transition-colors pr-12"
                    onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  />
                  <button 
                    onClick={handleAddComment}
                    className="absolute right-1 top-1 bottom-1 px-3 bg-primary text-main rounded-full hover:bg-primary/80 transition-colors flex items-center justify-center"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
