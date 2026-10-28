import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  UserPlus,
  CheckCircle2,
  Lock,
  Zap,
} from 'lucide-react';
import { toast } from '../lib/toast';

const TRENDING_TOPICS = [
  { tag: 'CyberSecurity', category: 'Security', posts: '14.2k', hot: true },
  { tag: 'GroqLlama3', category: 'AI & ML', posts: '18.9k', hot: true },
  { tag: 'ZeroTrustAuth', category: 'Security', posts: '6.4k' },
  { tag: 'BugBounty', category: 'AppSec', posts: '8.1k' },
  { tag: 'Nextjs15', category: 'Frontend', posts: '22.5k' },
];

export default function Rightbar({ profile }) {
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [connectingId, setConnectingId] = useState(null);
  const [connectedIds, setConnectedIds] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSuggested = async () => {
      if (!profile?.id) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, bio, avatar_url, tech_stack')
          .neq('id', profile.id)
          .limit(4);

        if (data) setSuggestedUsers(data);
      } catch (err) {
        // ignore
      }
    };
    fetchSuggested();
  }, [profile?.id]);

  const handleQuickConnect = async (targetId) => {
    setConnectingId(targetId);
    try {
      const { error } = await supabase.from('connections').insert({
        requester_id: profile.id,
        receiver_id: targetId,
        status: 'pending',
      });
      if (!error) {
        setConnectedIds(prev => new Set(prev).add(targetId));
        toast.success('Connection request sent!');
      } else {
        toast.info('Request already sent or already connected.');
        setConnectedIds(prev => new Set(prev).add(targetId));
      }
    } catch (e) {
      toast.error('Could not connect');
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <aside
      className="sticky top-20 flex flex-col gap-4 w-full max-w-[320px]"
      style={{ maxHeight: 'calc(100vh - 5.5rem)', overflowY: 'auto' }}
    >
      {/* CyberSec & AI Daily Brief */}
      <div
        className="glass-panel rounded-2xl p-4 flex flex-col gap-2.5 relative overflow-hidden"
        style={{ borderColor: 'rgba(139,92,246,0.2)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: '#a78bfa' }}>
            <Lock size={13} />
            <span>CyberSec & AI Intel</span>
          </div>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-color)' }}>OWASP Top Tip:</strong> Prevent Insecure Direct Object References (IDOR) by validating session ownership on all Supabase RLS row policies.
        </p>
        <Link
          to="/events"
          className="text-[11px] font-semibold flex items-center gap-1 mt-1 transition-colors"
          style={{ color: 'var(--primary-color)' }}
          onMouseEnter={e => e.target.style.color = 'var(--primary-hover)'}
          onMouseLeave={e => e.target.style.color = 'var(--primary-color)'}
        >
          Explore CTF & Security Events &rarr;
        </Link>
      </div>

      {/* Trending Topics */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-color)' }}>
            <TrendingUp size={14} style={{ color: 'var(--primary-color)' }} />
            Trending Topics
          </h3>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Live</span>
        </div>

        <div className="flex flex-col gap-1">
          {TRENDING_TOPICS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => navigate(`/search?q=${encodeURIComponent(item.tag)}`)}
              className="p-2.5 rounded-xl transition-colors text-left flex items-center justify-between group cursor-pointer"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div>
                <span
                  className="block text-xs font-bold transition-colors"
                  style={{ color: 'var(--text-color)' }}
                >
                  #{item.tag}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {item.category} · {item.posts} posts
                </span>
              </div>
              {item.hot && (
                <span
                  className="text-[9px] font-extrabold uppercase rounded"
                  style={{
                    backgroundColor: 'rgba(139,92,246,0.15)',
                    color: '#a78bfa',
                    border: '1px solid rgba(139,92,246,0.3)',
                    padding: '1px 5px',
                  }}
                >
                  HOT
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Suggested Developers */}
      {suggestedUsers.length > 0 && (
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-color)' }}>
              <Zap size={14} className="text-amber-500" />
              Suggested Developers
            </h3>
            <Link
              to="/search"
              className="text-[11px] font-semibold hover:underline"
              style={{ color: 'var(--primary-color)' }}
            >
              See All
            </Link>
          </div>

          <div className="flex flex-col gap-2">
            {suggestedUsers.map(user => {
              const isSent = connectedIds.has(user.id);
              const isConnecting = connectingId === user.id;

              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-2.5 p-2 rounded-xl transition-colors"
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Link
                    to={`/profile/${user.username}`}
                    className="flex items-center gap-2.5 min-w-0 flex-1"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden"
                      style={{
                        backgroundColor: 'var(--surface-hover)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--primary-color)',
                      }}
                    >
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        user.username?.[0]?.toUpperCase() || 'D'
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold truncate transition-colors" style={{ color: 'var(--text-color)' }}>
                        {user.username}
                      </span>
                      <span className="block text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {user.tech_stack?.split(',')[0]?.trim() || user.bio || 'Developer'}
                      </span>
                    </div>
                  </Link>

                  <button
                    onClick={() => handleQuickConnect(user.id)}
                    disabled={isSent || isConnecting}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shrink-0 cursor-pointer disabled:opacity-60"
                    style={
                      isSent
                        ? { backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }
                        : { backgroundColor: 'rgba(99,102,241,0.15)', color: 'var(--primary-color)', border: '1px solid rgba(99,102,241,0.3)' }
                    }
                  >
                    {isConnecting ? (
                      <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : isSent ? (
                      <><CheckCircle2 size={12} /> Sent</>
                    ) : (
                      <><UserPlus size={12} /> Connect</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
        <span>Connectra v2.0 · AI & Sec</span>
        <span>© 2026</span>
      </div>
    </aside>
  );
}
