import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Heart, MessageSquare, Share2, Code2, Image as ImageIcon, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Feed({ session }) {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [codeLang, setCodeLang] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [expandedComments, setExpandedComments] = useState({});

  const loadFeed = async () => {
    const { data } = await supabase
      .from('posts')
      .select(`
        id, user_id, content, image_url, code_snippet, code_language, created_at,
        profiles(username), likes(count),
        comments(id, content, created_at, profiles(username))
      `)
      .order('created_at', { ascending: false });
    if (data) setPosts(data);
  };

  useEffect(() => {
    loadFeed();
    const sub = supabase
      .channel('feed-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, loadFeed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, loadFeed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, loadFeed)
      .subscribe();
    return () => sub.unsubscribe();
  }, []);

  const handlePost = async () => {
    if (!content && !imageUrl && !codeSnippet) return;
    await supabase.from('posts').insert({
      user_id: session.user.id,
      content,
      image_url: imageUrl || null,
      code_snippet: codeSnippet || null,
      code_language: codeLang || null
    });
    setContent('');
    setImageUrl('');
    setCodeSnippet('');
    setCodeLang('');
    setShowExtras(false);
  };

  const handleLike = async (postId) => {
    const { data: existing } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', session.user.id)
      .single();

    if (existing) {
      await supabase.from('likes').delete().eq('id', existing.id);
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: session.user.id });
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    await supabase.from('comments').insert({
      post_id: postId,
      user_id: session.user.id,
      content: text
    });
    setCommentInputs(prev => ({...prev, [postId]: ''}));
  };

  const toggleComments = (postId) => {
    setExpandedComments(prev => ({...prev, [postId]: !prev[postId]}));
  };

  return (
    <main className="flex flex-col gap-8 w-full max-w-2xl mx-auto">
      
      {/* Create Post Card */}
      <motion.section 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[#0a0a0a] border border-[#222] rounded-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-[#222]">
          <textarea 
            value={content} 
            onChange={e => setContent(e.target.value)} 
            placeholder="What are you building today?" 
            className="w-full bg-transparent text-white placeholder-[#666] resize-none outline-none text-[15px] min-h-[60px]"
          />
        </div>
        
        <AnimatePresence>
          {showExtras && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 py-3 bg-black/20 flex flex-col gap-3"
            >
              <div className="flex justify-between items-center text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">
                <span>Attachments</span>
                <button onClick={() => setShowExtras(false)} className="hover:text-white"><X size={14}/></button>
              </div>
              <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Image URL (optional)" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-primary/50 outline-none transition-colors" />
              <div className="flex gap-2">
                <textarea value={codeSnippet} onChange={e => setCodeSnippet(e.target.value)} placeholder="Paste your code snippet here..." className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-sm text-green-400 font-mono focus:border-primary/50 outline-none resize-y min-h-[100px]"></textarea>
              </div>
              <input type="text" value={codeLang} onChange={e => setCodeLang(e.target.value)} placeholder="Language (e.g. javascript)" className="w-1/3 min-w-[120px] bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-primary/50 outline-none transition-colors" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-3 flex justify-between items-center bg-[#050505]">
          <div className="flex gap-1">
            <button onClick={() => setShowExtras(true)} className="p-2 text-[#666] hover:text-white rounded-lg transition-colors" title="Add Media">
              <ImageIcon size={18} />
            </button>
            <button onClick={() => setShowExtras(true)} className="p-2 text-[#666] hover:text-white rounded-lg transition-colors" title="Add Code">
              <Code2 size={18} />
            </button>
          </div>
          <button 
            onClick={handlePost} 
            disabled={!content && !imageUrl && !codeSnippet}
            className="px-5 py-1.5 bg-white text-black font-semibold rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
          >
            Post <Send size={14} />
          </button>
        </div>
      </motion.section>

      {/* Feed Stream */}
      <div className="flex flex-col gap-6">
        <AnimatePresence>
          {posts.map((post, i) => (
            <motion.div 
              key={post.id} 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#0a0a0a] border border-[#222] rounded-2xl overflow-hidden"
            >
              {/* Post Header */}
              <div className="p-5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#111] border border-[#333] flex items-center justify-center text-sm font-bold text-white">
                  {post.profiles?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="font-semibold text-white text-[14px]">{post.profiles?.username || 'Unknown Developer'}</h3>
                  <p className="text-[11px] text-[#666]">{new Date(post.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Post Content */}
              <div className="px-5 pb-4 text-gray-300 text-[15px] leading-relaxed whitespace-pre-wrap">
                {post.content}
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
                    <div className="absolute top-0 right-0 bg-white/10 px-3 py-1 rounded-bl-lg rounded-tr-xl text-xs font-mono text-gray-400">
                      {post.code_language || 'code'}
                    </div>
                    <pre className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 overflow-x-auto">
                      <code className="text-sm font-mono text-green-400">{post.code_snippet}</code>
                    </pre>
                  </div>
                </div>
              )}

              {/* Post Actions */}
              <div className="px-5 py-3 border-t border-white/5 flex gap-6">
                <button onClick={() => handleLike(post.id)} className="flex items-center gap-2 text-gray-400 hover:text-pink-500 transition-colors group/btn">
                  <Heart size={20} className="group-hover/btn:fill-pink-500/20" /> 
                  <span className="font-medium text-sm">{post.likes?.[0]?.count || 0}</span>
                </button>
                <button onClick={() => toggleComments(post.id)} className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors">
                  <MessageSquare size={20} /> 
                  <span className="font-medium text-sm">{post.comments?.length || 0}</span>
                </button>
                <button className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors ml-auto">
                  <Share2 size={20} />
                </button>
              </div>
              
              {/* Comments Section */}
              <AnimatePresence>
                {expandedComments[post.id] && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-black/20 border-t border-white/5"
                  >
                    <div className="p-5 flex flex-col gap-4">
                      {post.comments?.map(c => (
                        <div key={c.id} className="flex gap-3">
                          <div className="h-8 w-8 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                            {c.profiles?.username?.[0]?.toUpperCase()}
                          </div>
                          <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-2 text-sm">
                            <span className="font-bold text-gray-200 mr-2">{c.profiles?.username}</span>
                            <span className="text-gray-400">{c.content}</span>
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
                            value={commentInputs[post.id] || ''} 
                            onChange={e => setCommentInputs(prev => ({...prev, [post.id]: e.target.value}))}
                            placeholder="Write a comment..."
                            className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:border-primary/50 outline-none transition-colors pr-12"
                            onKeyDown={e => e.key === 'Enter' && handleAddComment(post.id)}
                          />
                          <button 
                            onClick={() => handleAddComment(post.id)}
                            className="absolute right-1 top-1 bottom-1 px-3 bg-primary text-white rounded-full hover:bg-primary/80 transition-colors flex items-center justify-center"
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
          ))}
        </AnimatePresence>
      </div>
    </main>
  );
}
