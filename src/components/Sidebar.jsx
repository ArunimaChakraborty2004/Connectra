import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, FolderGit2, Search, Bell, Trophy, MapPin, Calendar, Link as LinkIcon, Code, Flame, Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export default function Sidebar({ profile, stats }) {
  const initial = profile?.username ? profile.username[0].toUpperCase() : 'U';
  const techStack = profile?.tech_stack ? profile.tech_stack.split(',') : [];
  const { theme, toggleTheme } = useTheme();

  // Use real data or fallback to defaults
  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const followers = stats?.followers || 0;
  const following = stats?.following || 0;
  const streak = 1; // You can build a real streak logic based on post dates later
  const xpProgress = Math.min((xp / (level * 1000)) * 100, 100) || 5; // Minimal visual progress

  return (
    <aside className="sticky top-24 flex flex-col gap-6 w-full max-w-[320px]">
      {/* Sleek Monochromatic Profile Card */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative overflow-hidden rounded-2xl glass-panel group shadow-sm hover:shadow-md transition-shadow"
      >
        {/* Subtle Header Banner */}
        <div className="h-24 w-full bg-gradient-to-br from-primary/10 to-transparent relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
        </div>
        
        <div className="px-6 pb-6 relative">
          {/* Avatar Area */}
          <div className="flex justify-between items-end -mt-10 mb-4 relative z-10">
            <div className="relative inline-block">
              <div className="h-20 w-20 rounded-2xl bg-surface border border-white/10 flex items-center justify-center text-3xl font-bold text-main shadow-lg">
                {initial}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full" title="Online">
              </div>
            </div>
            
            {/* Level Badge */}
            <div className="flex flex-col items-center mb-2">
              <div className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <Trophy size={10} /> LVL {level}
              </div>
            </div>
          </div>
          
          {/* User Info */}
          <div className="mb-5">
            <h2 className="text-lg font-bold text-main flex items-center gap-2">
              {profile?.username || 'Developer'}
              <span className="bg-primary/20 text-primary text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded">PRO</span>
            </h2>
            <p className="text-xs text-muted mt-1 leading-relaxed">{profile?.bio || 'Software Engineer building minimal and fast web applications.'}</p>
          </div>

          {/* Location & Links */}
          <div className="flex flex-col gap-2.5 mb-6 text-xs text-[#666]">
            <div className="flex items-center gap-2"><MapPin size={14} /> Remote</div>
            <div className="flex items-center gap-2"><Calendar size={14} /> Joined 2026</div>
            {profile?.github_url && (
              <a href={profile.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-main transition-colors">
                <LinkIcon size={14} /> {profile.github_url.replace('https://', '')}
              </a>
            )}
          </div>
          
          {/* Network Stats */}
          <div className="grid grid-cols-3 gap-4 py-4 border-y border-white/10 mb-6">
            <div className="flex flex-col items-center group cursor-default">
              <span className="text-lg font-bold text-main">{followers}</span>
              <span className="text-[10px] uppercase tracking-wider text-[#666]">Followers</span>
            </div>
            <div className="flex flex-col items-center group cursor-default">
              <span className="text-lg font-bold text-main">{following}</span>
              <span className="text-[10px] uppercase tracking-wider text-[#666]">Following</span>
            </div>
            <div className="flex flex-col items-center group cursor-default">
              <span className="text-lg font-bold text-main flex items-center gap-1">
                {streak} <Flame size={14} className="text-muted" />
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#666]">Day Streak</span>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-[10px] font-bold mb-2 uppercase tracking-wide">
              <span className="text-muted flex items-center gap-1"><Code size={12}/> Code XP</span>
              <span className="text-main">{xp} / {level * 1000}</span>
            </div>
            <div className="h-1.5 w-full bg-surface-hover rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ duration: 1, delay: 0.5, type: 'spring' }}
                className="h-full bg-primary rounded-full relative"
              >
              </motion.div>
            </div>
          </div>
          
          {/* Tech Stack */}
          {techStack.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-3">Technologies</h3>
              <div className="flex flex-wrap gap-2">
                {techStack.map((tech, i) => (
                  <span key={i} className="px-2.5 py-1 text-xs font-medium glass-panel rounded-md text-[#aaa]">
                    {tech.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
      
      {/* Action Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col gap-2"
      >
        <Link to="/" className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-hover transition-colors group border border-transparent hover:border-white/5">
          <div className="flex items-center gap-3">
            <div className="text-muted group-hover:text-primary transition-colors">
              <Users size={18} />
            </div>
            <div className="text-left">
              <span className="block font-medium text-main text-sm">Feed</span>
              <span className="block text-[11px] text-muted">Home timeline</span>
            </div>
          </div>
          <div className="text-muted group-hover:text-primary transition-colors transform group-hover:translate-x-1 duration-300">
            &rarr;
          </div>
        </Link>
        <Link to="/reels" className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-hover transition-colors group border border-transparent hover:border-white/5">
          <div className="flex items-center gap-3">
            <div className="text-muted group-hover:text-primary transition-colors">
              <Code size={18} />
            </div>
            <div className="text-left">
              <span className="block font-medium text-main text-sm">Reels</span>
              <span className="block text-[11px] text-muted">Short-form videos</span>
            </div>
          </div>
          <div className="text-muted group-hover:text-primary transition-colors transform group-hover:translate-x-1 duration-300">
            &rarr;
          </div>
        </Link>
        <Link to="/search" className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-hover transition-colors group border border-transparent hover:border-white/5">
          <div className="flex items-center gap-3">
            <div className="text-muted group-hover:text-primary transition-colors">
              <Search size={18} />
            </div>
            <div className="text-left">
              <span className="block font-medium text-main text-sm">Search</span>
              <span className="block text-[11px] text-muted">Find developers</span>
            </div>
          </div>
          <div className="text-muted group-hover:text-primary transition-colors transform group-hover:translate-x-1 duration-300">
            &rarr;
          </div>
        </Link>
        <button onClick={() => document.dispatchEvent(new CustomEvent('toggleProjects'))} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-hover transition-colors group border border-transparent hover:border-white/5">
          <div className="flex items-center gap-3">
            <div className="text-muted group-hover:text-primary transition-colors">
              <FolderGit2 size={18} />
            </div>
            <div className="text-left">
              <span className="block font-medium text-main text-sm">Repositories</span>
              <span className="block text-[11px] text-muted">Manage open source work</span>
            </div>
          </div>
          <div className="text-muted group-hover:text-primary transition-colors transform group-hover:translate-x-1 duration-300">
            &rarr;
          </div>
        </button>

        <button onClick={() => document.dispatchEvent(new CustomEvent('toggleNotifications'))} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-hover transition-colors group border border-transparent hover:border-white/5">
          <div className="flex items-center gap-3">
            <div className="text-muted group-hover:text-primary transition-colors">
              <Bell size={18} />
            </div>
            <div className="text-left">
              <span className="block font-medium text-main text-sm">Notifications</span>
              <span className="block text-[11px] text-muted">Recent activity</span>
            </div>
          </div>
          <div className="text-muted group-hover:text-primary transition-colors transform group-hover:translate-x-1 duration-300">
            &rarr;
          </div>
        </button>
      </motion.div>
    </aside>
  );
}
