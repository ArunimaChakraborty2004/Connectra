import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Rightbar from '../components/Rightbar';
import PostCard from '../components/feed/PostCard';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import { ArrowLeft, MessageSquare, AlertCircle } from 'lucide-react';

export default function PostPage({ session }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [stats, setStats] = useState({ followers: 0, following: 0 });

  const loadPost = async () => {
    if (!id) return;
    try {
      setLoading(true);

      // 1. Fetch Post with author profile
      const { data: postData, error } = await supabase
        .from('posts')
        .select(`
          id, user_id, content, image_url, code_snippet, code_language, poll_data, created_at, updated_at,
          profiles(id, username, avatar_url)
        `)
        .eq('id', id)
        .single();

      if (error || !postData) {
        setPost(null);
        return;
      }

      // 2. Fetch Likes and Comments for this post
      const [{ data: likesData }, { data: commentsData }] = await Promise.all([
        supabase.from('likes').select('id, user_id').eq('post_id', id),
        supabase
          .from('comments')
          .select('id, post_id, user_id, content, created_at, profiles(username, avatar_url)')
          .eq('post_id', id)
          .order('created_at', { ascending: true }),
      ]);

      setPost({
        ...postData,
        likes: [{ count: likesData?.length || 0 }],
        likes_count: likesData?.length || 0,
        user_has_liked: Boolean(likesData?.some((l) => session?.user?.id && l.user_id === session.user.id)),
        comments: commentsData || [],
      });
    } catch (err) {
      console.error('Error fetching post:', err);
      setPost(null);
    } finally {
      setLoading(false);
    }
  };

  const loadProfileAndStats = async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, bio, tech_stack, github_url, xp, level, avatar_url')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setCurrentUserProfile(data);
      }

      const { count: fCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', session.user.id);

      const { count: foCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', session.user.id);

      setStats({
        followers: fCount || 0,
        following: foCount || 0,
      });
    } catch (err) {
      console.warn('Error loading profile in PostPage:', err);
    }
  };

  useEffect(() => {
    loadPost();
    loadProfileAndStats();

    // Realtime listener for likes or comments on this post
    const channel = supabase
      .channel(`post-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `post_id=eq.${id}` }, loadPost)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${id}` }, loadPost)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, session?.user?.id]);

  return (
    <div className="min-h-screen bg-[#faf6f0] text-[#2b1f17]">
      <div className="max-w-[1380px] mx-auto px-4 py-6 flex gap-6 items-start">
        {/* Left Sidebar */}
        <div className="hidden lg:block shrink-0 w-[210px]">
          {currentUserProfile && <Sidebar profile={currentUserProfile} stats={stats} />}
        </div>

        {/* Center Content */}
        <div className="flex-1 min-w-0 max-w-[650px] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-bold text-[#8d7565] hover:text-[#ea580c] transition-colors py-1.5 px-3 rounded-xl bg-white/70 hover:bg-white border border-[#f1e4d3] shadow-2xs"
            >
              <ArrowLeft size={16} /> Back to Feed
            </Link>
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-[#ea580c] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-[#8d7565]">Loading post...</p>
            </div>
          ) : !post ? (
            <div className="p-12 bg-white rounded-2xl border border-[#f1e4d3] text-center flex flex-col items-center gap-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-[#ea580c]">
                <AlertCircle size={24} />
              </div>
              <h2 className="text-base font-bold text-[#1c130d]">Post Not Found</h2>
              <p className="text-xs text-[#8d7565] max-w-sm">
                This post may have been deleted by its author or is no longer available.
              </p>
              <Link
                to="/"
                className="mt-2 px-4 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Go to Feed
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <PostCard
                post={post}
                session={session}
                onUpdate={loadPost}
                isHighlighted={true}
                autoOpenComments={true}
              />
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="hidden xl:block shrink-0 w-[300px]">
          {currentUserProfile && <Rightbar profile={currentUserProfile} />}
        </div>
      </div>
    </div>
  );
}
