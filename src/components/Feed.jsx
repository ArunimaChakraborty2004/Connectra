import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import CreatePost from './feed/CreatePost';
import PostCard from './feed/PostCard';
import Loader from './ui/Loader';
import EmptyState from './ui/EmptyState';
import { MessageSquare } from 'lucide-react';

export default function Feed({ session, userIdFilter = null }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = async () => {
    let query = supabase
      .from('posts')
      .select(`
        id, user_id, content, image_url, code_snippet, code_language, created_at, updated_at, poll_data,
        profiles(username, avatar_url), likes(count),
        comments(id, user_id, content, created_at, profiles(username, avatar_url))
      `)
      .order('created_at', { ascending: false });

    if (userIdFilter) {
      query = query.eq('user_id', userIdFilter);
    }

    const { data, error } = await query;
    if (error) console.error('Feed error:', error);
    if (data) setPosts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadFeed();
    const sub = supabase
      .channel('feed-channel-' + (userIdFilter || 'all'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, loadFeed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, loadFeed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, loadFeed)
      .subscribe();
    return () => sub.unsubscribe();
  }, [userIdFilter]);

  if (loading) return <Loader />;

  return (
    <main className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {!userIdFilter && <CreatePost session={session} onPostCreated={loadFeed} />}

      <AnimatePresence>
        {posts.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={userIdFilter ? 'No posts yet' : 'Your feed is empty'}
            description={
              userIdFilter
                ? "This user hasn't posted anything yet."
                : 'Be the first to post something exciting!'
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
