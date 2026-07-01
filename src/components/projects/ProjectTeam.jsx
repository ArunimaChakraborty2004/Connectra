import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserPlus, Shield, User, Trash2, Search } from 'lucide-react';
import { toast } from '../../lib/toast';

export default function ProjectTeam({ projectId, userRole, ownerId, session }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const canManage = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const fetchMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_members')
      .select('*, profiles(username, avatar_url)')
      .eq('project_id', projectId);
    
    if (!error) {
      setMembers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || !canManage) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', session.user.id)
        .limit(5);
      
      // Filter out existing members
      const existingIds = members.map(m => m.user_id);
      existingIds.push(ownerId);
      
      const available = data?.filter(u => !existingIds.includes(u.id)) || [];
      setSearchResults(available);
      setIsSearching(false);
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, members, canManage, session, ownerId]);

  const inviteUser = async (userId, role = 'developer') => {
    const { error } = await supabase
      .from('project_members')
      .insert({ project_id: projectId, user_id: userId, role, status: 'active' }); // Auto active for MVP
    
    if (error) {
      toast.error('Failed to add member');
    } else {
      toast.success('Member added!');
      setSearchQuery('');
      fetchMembers();
    }
  };

  const updateRole = async (memberId, role) => {
    const { error } = await supabase
      .from('project_members')
      .update({ role })
      .eq('id', memberId);
    
    if (error) toast.error('Failed to update role');
    else {
      toast.success('Role updated');
      fetchMembers();
    }
  };

  const removeMember = async (memberId) => {
    if (!confirm('Remove this member?')) return;
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberId);
    
    if (error) toast.error('Failed to remove member');
    else {
      toast.success('Member removed');
      fetchMembers();
    }
  };

  if (loading) return <div className="animate-pulse h-64 bg-surface rounded-xl"></div>;

  return (
    <div className="space-y-8">
      {canManage && (
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <UserPlus size={20} className="text-primary" />
            Add Team Member
          </h3>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input 
              type="text" 
              placeholder="Search by username..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-3 text-main focus:border-primary/50 outline-none transition-colors"
            />
          </div>
          
          {searchQuery.trim() && (
            <div className="mt-4 bg-background border border-border rounded-xl overflow-hidden">
              {isSearching ? (
                <div className="p-4 text-center text-muted text-sm">Searching...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map(user => (
                  <div key={user.id} className="p-3 border-b border-white/5 last:border-0 flex items-center justify-between hover:bg-surface transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-surface overflow-hidden">
                        {user.avatar_url ? <img src={user.avatar_url} alt="" /> : user.username[0].toUpperCase()}
                      </div>
                      <span className="font-semibold">{user.username}</span>
                    </div>
                    <button onClick={() => inviteUser(user.id)} className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-medium">Add</button>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-muted text-sm">No users found</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="glass-panel p-0 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h3 className="text-lg font-bold">Team Members</h3>
        </div>
        
        <div className="divide-y divide-white/5">
          {members.map(member => (
            <div key={member.id} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-surface overflow-hidden border border-border flex items-center justify-center font-bold text-lg">
                  {member.profiles?.avatar_url ? <img src={member.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : member.profiles?.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-main">{member.profiles?.username}</div>
                  <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                    {member.role === 'owner' || member.role === 'admin' ? <Shield size={12} className="text-yellow-500" /> : <User size={12} />}
                    <span className="capitalize">{member.role}</span>
                  </div>
                </div>
              </div>
              
              {canManage && member.role !== 'owner' && (
                <div className="flex items-center gap-3">
                  <select 
                    value={member.role}
                    onChange={(e) => updateRole(member.id, e.target.value)}
                    className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-main outline-none focus:border-primary/50"
                  >
                    <option value="admin">Admin</option>
                    <option value="developer">Developer</option>
                    <option value="designer">Designer</option>
                    <option value="tester">Tester</option>
                  </select>
                  <button onClick={() => removeMember(member.id)} className="p-2 text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <div className="p-8 text-center text-muted">Only the project owner is in this team.</div>
          )}
        </div>
      </div>
    </div>
  );
}
