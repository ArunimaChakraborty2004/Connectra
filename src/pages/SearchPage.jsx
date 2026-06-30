import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import { Search, UserPlus, UserCheck, Clock } from 'lucide-react';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import { toast } from '../lib/toast';
import { Link } from 'react-router-dom';

export default function SearchPage({ session }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // Load current user profile for Sidebar
    const loadProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(data || { id: session.user.id, username: 'User' });
    };
    loadProfile();
  }, [session]);

  useEffect(() => {
    const searchUsers = async () => {
      if (!query.trim()) {
        setUsers([]);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, bio, avatar_url')
        .ilike('username', `%${query}%`)
        .neq('id', session.user.id)
        .limit(20);

      if (error) {
        toast.error('Failed to search users');
      } else {
        // Also fetch connection statuses for these users
        // This is a simplification; a real app might do this in a single query or a DB function
        const userIds = data.map(u => u.id);
        if (userIds.length > 0) {
          const { data: connData } = await supabase
            .from('connections')
            .select('*')
            .or(`requester_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`);
          
          const enhancedUsers = data.map(user => {
            const conn = connData?.find(c => c.requester_id === user.id || c.receiver_id === user.id);
            return { ...user, connection: conn };
          });
          setUsers(enhancedUsers);
        } else {
          setUsers([]);
        }
      }
      setLoading(false);
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [query, session.user.id]);

  const handleConnect = async (targetId, currentStatus, connectionId) => {
    if (!currentStatus) {
      // Send request
      const { error } = await supabase.from('connections').insert({
        requester_id: session.user.id,
        receiver_id: targetId,
        status: 'pending'
      });
      if (error) toast.error(error.message);
      else toast.success('Connection request sent!');
    } else if (currentStatus === 'pending' || currentStatus === 'accepted') {
      // Cancel/Remove connection
      const { error } = await supabase.from('connections').delete().eq('id', connectionId);
      if (error) toast.error(error.message);
      else toast.info('Connection removed.');
    }
    // Refresh the specific user's status manually to avoid full reload
    // In a real scenario, realtime subscriptions on connections table would handle this
    setQuery(q => q + ' '); // hacky re-trigger
    setTimeout(() => setQuery(q => q.trim()), 0);
  };

  return (
    <div className="min-h-screen bg-background text-main font-sans">
      <div className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8 relative items-start justify-center z-10">
        <div className="hidden lg:block w-full max-w-[300px] shrink-0">
          {profile ? <Sidebar profile={profile} stats={{followers:0,following:0}} /> : <Loader />}
        </div>
        
        <div className="flex-1 w-full max-w-2xl shrink-0">
          <div className="glass-panel rounded-2xl p-6 mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666]" size={20} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search developers by username..."
                className="w-full glass-panel rounded-xl pl-12 pr-4 py-3 text-main focus:border-primary/50 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {loading ? (
              <Loader />
            ) : query.trim() && users.length === 0 ? (
              <EmptyState title="No developers found" description={`No users match "${query}"`} />
            ) : !query.trim() ? (
              <EmptyState title="Search for connections" description="Type a username above to find other developers." icon={Search} />
            ) : (
              users.map(user => (
                <div key={user.id} className="glass-panel rounded-2xl p-5 flex items-center gap-4 hover:border-white/10 transition-colors">
                  <Link to={`/profile/${user.username}`} className="h-12 w-12 rounded-xl glass-panel flex items-center justify-center text-lg font-bold text-main shrink-0 overflow-hidden">
                    {user.avatar_url ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" /> : user.username[0].toUpperCase()}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${user.username}`} className="font-semibold text-main text-[15px] hover:underline block truncate">
                      {user.username}
                    </Link>
                    <p className="text-muted text-sm truncate">{user.bio || 'Developer'}</p>
                  </div>
                  
                  <button 
                    onClick={() => handleConnect(user.id, user.connection?.status, user.connection?.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors ${
                      user.connection?.status === 'accepted' 
                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        : user.connection?.status === 'pending'
                        ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                        : 'bg-white text-black hover:bg-gray-200'
                    }`}
                  >
                    {user.connection?.status === 'accepted' ? (
                      <><UserCheck size={16} /> Connected</>
                    ) : user.connection?.status === 'pending' ? (
                      <><Clock size={16} /> Pending</>
                    ) : (
                      <><UserPlus size={16} /> Connect</>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
