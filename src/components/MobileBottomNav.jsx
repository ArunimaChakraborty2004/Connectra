import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Briefcase, MessageSquare, User, Menu } from 'lucide-react';

export default function MobileBottomNav({ profile, onOpenSidebar }) {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navItems = [
    { label: 'Feed', path: '/', icon: Home },
    { label: 'Search', path: '/search', icon: Search },
    { label: 'Collab', path: '/collab', icon: Briefcase },
    { label: 'Chat', path: '/chat', icon: MessageSquare },
    { label: 'Profile', path: `/profile/${profile?.username || 'user'}`, icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden px-3 py-2 border-t"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--surface-color) 92%, transparent)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.label}
              to={item.path}
              className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all"
              style={{
                color: active ? 'var(--primary-color)' : 'var(--text-muted)',
              }}
            >
              <div
                className="p-1 rounded-lg transition-transform active:scale-95"
                style={{
                  backgroundColor: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.3 : 1.8} />
              </div>
              <span className="text-[10px] font-medium mt-0.5 tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More/Sidebar menu button */}
        <button
          onClick={onOpenSidebar}
          aria-label="Open full menu"
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer"
          style={{ color: 'var(--text-muted)' }}
        >
          <div className="p-1 rounded-lg active:scale-95 transition-transform">
            <Menu size={20} strokeWidth={1.8} />
          </div>
          <span className="text-[10px] font-medium mt-0.5 tracking-tight">
            Menu
          </span>
        </button>
      </div>
    </nav>
  );
}
