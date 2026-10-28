import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  Users,
  User,
  FolderGit2,
  Search,
  Bell,
  Flame,
  MessageSquare,
  Briefcase,
  Settings,
  Film,
  Calendar,
  Globe,
  Code2,
  Sparkles,
  X,
} from 'lucide-react';

export default function Sidebar({ profile, stats, onClose }) {
  const location = useLocation();
  const initial = profile?.username ? profile.username[0].toUpperCase() : 'U';

  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const followers = stats?.followers || 0;
  const following = stats?.following || 0;
  const xpProgress = Math.min((xp / (level * 1000)) * 100, 100) || 12;

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navGroups = [
    {
      title: 'EXPLORE',
      items: [
        { label: 'Feed', path: '/', icon: Users },
        { label: 'Collab Board', path: '/collab', icon: Briefcase, badge: 'HOT' },
        { label: 'Search Devs', path: '/search', icon: Search },
        { label: 'Reels', path: '/reels', icon: Film },
      ],
    },
    {
      title: 'COLLABORATE',
      items: [
        {
          label: 'Repositories',
          action: () => document.dispatchEvent(new CustomEvent('toggleProjects')),
          icon: FolderGit2,
        },
        { label: 'Messages', path: '/chat', icon: MessageSquare },
        { label: 'Communities', path: '/communities', icon: Globe },
        { label: 'Events & CTF', path: '/events', icon: Calendar },
      ],
    },
    {
      title: 'PERSONAL',
      items: [
        { label: 'My Profile', path: `/profile/${profile?.username || 'user'}`, icon: User },
        {
          label: 'Notifications',
          action: () => document.dispatchEvent(new CustomEvent('toggleNotifications')),
          icon: Bell,
        },
        { label: 'Settings', path: '/settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="sticky top-20 flex flex-col gap-3.5 w-full max-w-[270px]">
      {/* User Profile Card */}
      <div
        className="glass-panel rounded-2xl p-4 flex flex-col gap-3 relative"
        style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
      >
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="absolute top-3 right-3 p-1.5 rounded-xl transition-colors cursor-pointer lg:hidden"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
              e.currentTarget.style.color = 'var(--text-color)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <X size={16} />
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(99,102,241,0.2))',
                border: '1px solid var(--border-color)',
                color: 'var(--text-color)',
              }}
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                initial
              )}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full"
              style={{ border: '2px solid var(--surface-color)' }}
              title="Online"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link
                to={`/profile/${profile?.username}`}
                onClick={onClose}
                className="font-bold text-sm truncate block transition-colors"
                style={{ color: 'var(--text-color)' }}
                onMouseEnter={e => e.target.style.color = 'var(--primary-color)'}
                onMouseLeave={e => e.target.style.color = 'var(--text-color)'}
              >
                {profile?.username || 'Developer'}
              </Link>
              <span
                className="text-[9px] font-extrabold uppercase px-1.5 rounded shrink-0"
                style={{
                  backgroundColor: 'rgba(99,102,241,0.15)',
                  color: 'var(--primary-color)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  padding: '1px 5px',
                }}
              >
                LVL {level}
              </span>
            </div>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
              {profile?.bio || 'Full-Stack Developer'}
            </p>
          </div>
        </div>

        {/* Mini Stats */}
        <div
          className="grid grid-cols-3 gap-1 py-2 px-2.5 rounded-xl text-center"
          style={{
            backgroundColor: 'var(--surface-hover)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div>
            <span className="block text-xs font-bold" style={{ color: 'var(--text-color)' }}>{followers}</span>
            <span className="block text-[9px] uppercase font-medium" style={{ color: 'var(--text-muted)' }}>Followers</span>
          </div>
          <div style={{ borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
            <span className="block text-xs font-bold" style={{ color: 'var(--text-color)' }}>{following}</span>
            <span className="block text-[9px] uppercase font-medium" style={{ color: 'var(--text-muted)' }}>Following</span>
          </div>
          <div>
            <span className="text-xs font-bold text-amber-500 flex items-center justify-center gap-0.5">
              1 <Flame size={10} />
            </span>
            <span className="block text-[9px] uppercase font-medium" style={{ color: 'var(--text-muted)' }}>Streak</span>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div>
          <div className="flex justify-between items-center text-[10px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1">
              <Code2 size={11} className="text-violet-400" /> Code XP
            </span>
            <span className="font-mono text-[10px]" style={{ color: 'var(--text-color)' }}>
              {xp} / {level * 1000}
            </span>
          </div>
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-color)' }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div
        className="glass-panel rounded-2xl p-2 flex flex-col gap-2.5"
        style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
      >
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="flex flex-col gap-0.5">
            <span
              className="text-[10px] font-bold tracking-wider px-2.5 py-1 uppercase"
              style={{ color: 'var(--text-muted)' }}
            >
              {group.title}
            </span>

            {group.items.map((item, iIdx) => {
              const Icon = item.icon;
              const active = item.path ? isActive(item.path) : false;

              const itemStyle = active
                ? {
                    backgroundColor: 'rgba(99,102,241,0.12)',
                    color: 'var(--primary-color)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    fontWeight: 700,
                  }
                : {
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid transparent',
                    fontWeight: 500,
                  };

              const content = (
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all"
                  style={itemStyle}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={16} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className="text-[9px] font-extrabold px-1.5 rounded"
                      style={{
                        backgroundColor: 'rgba(245,158,11,0.15)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245,158,11,0.3)',
                        padding: '1px 5px',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              );

              if (item.action) {
                return (
                  <button
                    key={iIdx}
                    onClick={() => {
                      item.action();
                      if (onClose) onClose();
                    }}
                    className="w-full text-left cursor-pointer"
                    onMouseEnter={e => {
                      if (!active) {
                        const inner = e.currentTarget.querySelector('div');
                        if (inner) {
                          inner.style.backgroundColor = 'var(--surface-hover)';
                          inner.style.color = 'var(--text-color)';
                        }
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        const inner = e.currentTarget.querySelector('div');
                        if (inner) {
                          inner.style.backgroundColor = 'transparent';
                          inner.style.color = 'var(--text-muted)';
                        }
                      }
                    }}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <Link
                  key={iIdx}
                  to={item.path}
                  onClick={onClose}
                  className="w-full"
                  onMouseEnter={e => {
                    if (!active) {
                      const inner = e.currentTarget.querySelector('div');
                      if (inner) {
                        inner.style.backgroundColor = 'var(--surface-hover)';
                        inner.style.color = 'var(--text-color)';
                      }
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      const inner = e.currentTarget.querySelector('div');
                      if (inner) {
                        inner.style.backgroundColor = 'transparent';
                        inner.style.color = 'var(--text-muted)';
                      }
                    }
                  }}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
