import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings2, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Rightbar({ profile, onProfileUpdate }) {
  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [techStack, setTechStack] = useState(profile.tech_stack || '');
  const [githubUrl, setGithubUrl] = useState(profile.github_url || '');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('profiles')
      .update({ username, bio, tech_stack: techStack, github_url: githubUrl })
      .eq('id', user.id);

    setLoading(false);
    if (error) {
      setStatus({ type: 'error', msg: error.message });
    } else {
      setStatus({ type: 'success', msg: 'Profile updated!' });
      onProfileUpdate();
      setTimeout(() => setStatus({ type: '', msg: '' }), 3000);
    }
  };

  return (
    <aside className="sticky top-24 w-full">
      <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6 relative overflow-hidden group">
        
        <div className="flex items-center gap-2 mb-6 text-white">
          <Settings2 size={20} className="text-[#888]" />
          <h3 className="font-semibold text-sm">Profile Settings</h3>
        </div>

        <form onSubmit={handleUpdate} className="flex flex-col gap-4 relative z-10">
          <div>
            <label className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-1.5 block">Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
              className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-sm text-white focus:border-[#444] outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-1.5 block">Bio</label>
            <textarea 
              rows="2" 
              value={bio} 
              onChange={e => setBio(e.target.value)} 
              placeholder="Tell us about yourself..."
              className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-sm text-white focus:border-[#444] outline-none transition-colors resize-none"
            ></textarea>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-1.5 block">Tech Stack</label>
            <input 
              type="text" 
              value={techStack} 
              onChange={e => setTechStack(e.target.value)} 
              placeholder="React, Node, Python..." 
              className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-sm text-white focus:border-[#444] outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-1.5 block">GitHub Profile</label>
            <input 
              type="url" 
              value={githubUrl} 
              onChange={e => setGithubUrl(e.target.value)} 
              placeholder="https://github.com/..." 
              className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-sm text-white focus:border-[#444] outline-none transition-colors"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-[#fff] hover:bg-[#e5e5e5] text-black font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <Save size={18} className="group-hover/btn:scale-110 transition-transform" />
                <span>Save Changes</span>
              </>
            )}
          </button>

          {status.msg && (
            <div className={`mt-2 flex items-center gap-2 text-sm p-3 rounded-lg border ${
              status.type === 'error' 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-green-500/10 border-green-500/20 text-green-400'
            }`}>
              {status.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              {status.msg}
            </div>
          )}
        </form>
      </div>
    </aside>
  );
}
