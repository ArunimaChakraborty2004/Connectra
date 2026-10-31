import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
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
  Compass,
  Plus,
  Zap,
} from 'lucide-react';
import { calculateUserStreak } from '../utils/streakHelper';

export default function Sidebar({ profile, stats: initialStats, onClose }) {
  const location = useLocation();
  const initial = profile?.username ? profile.username[0].toUpperCase() : 'U';

  const [liveStats, setLiveStats] = useState(() => ({
    followers: initialStats?.followers ?? 0,
    following: initialStats?.following ?? 0,
  }));

  const [streak, setStreak] = useState(() => calculateUserStreak(profile?.id));

  // Fetch or sync counts and streak
  useEffect(() => {
    if (!profile?.id) return;

    const fetchCountsAndActivity = async () => {
      try {
        const [
          { count: followersCount },
          { count: followingCount },
          { data: userPosts },
        ] = await Promise.all([
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
          supabase.from('posts').select('created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30),
        ]);

        const fCount = followersCount ?? initialStats?.followers ?? 0;
        const ingCount = followingCount ?? initialStats?.following ?? 0;

        setLiveStats({
          followers: fCount,
          following: ingCount,
        });

        const postDates = (userPosts || []).map(p => p.created_at);
        const computedStreak = calculateUserStreak(profile.id, postDates);
        setStreak(computedStreak);
      } catch (err) {
        console.warn('Error fetching sidebar stats:', err);
      }
    };

    fetchCountsAndActivity();
  }, [profile?.id, initialStats?.followers, initialStats?.following]);

  const followers = liveStats.followers;
  const following = liveStats.following;


  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navGroups = [
    {
      title: 'EXPLORE',
      items: [
        { label: 'Feed', path: '/', icon: Compass },
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
    <aside className="sticky top-20 flex flex-col gap-3.5 w-full max-w-[240px] select-none">
      {/* Mobile close button */}
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="absolute top-0 right-0 p-1.5 rounded-xl text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff4e6] lg:hidden cursor-pointer"
        >
          <X size={16} />
        </button>
      )}

      {/* User Profile Card */}
      <div className="bg-white border border-[#f1e4d3] shadow-xs rounded-2xl p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-[#ea580c] via-[#f97316] to-[#fbbf24] p-0.5 flex items-center justify-center text-white font-bold text-sm shadow-2xs">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover rounded-[10px]" />
              ) : (
                <span className="w-full h-full bg-[#faf6f0] rounded-[10px] flex items-center justify-center text-[#ea580c]">{initial}</span>
              )}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" title="Online" />
          </div>

          <div className="min-w-0 flex-1">
            <Link
              to={`/profile/${profile?.username || 'user'}`}
              onClick={onClose}
              className="font-bold text-xs truncate text-[#2b1f17] hover:text-[#ea580c] transition-colors block"
            >
              {profile?.username || 'Developer'}
            </Link>
            <p className="text-[10px] text-[#8d7565] truncate mt-0.5">
              {profile?.bio || 'Full-Stack Developer'}
            </p>
          </div>
        </div>

        {/* Mini Stats (Followers, Following, Streak) */}
        <div className="grid grid-cols-3 gap-1 py-1.5 px-2 rounded-xl bg-[#faf6f0] border border-[#f1e4d3] text-center">
          <Link
            to="/search?tab=followers"
            className="hover:opacity-80 transition-opacity block group cursor-pointer"
            title="View Followers"
          >
            <span className="block text-xs font-bold text-[#2b1f17] group-hover:text-[#ea580c] transition-colors">{followers}</span>
            <span className="block text-[8px] uppercase font-bold text-[#8d7565] group-hover:underline">Followers</span>
          </Link>
          <Link
            to="/search?tab=following"
            className="border-x border-[#f1e4d3] hover:opacity-80 transition-opacity block group cursor-pointer"
            title="View Following"
          >
            <span className="block text-xs font-bold text-[#2b1f17] group-hover:text-[#ea580c] transition-colors">{following}</span>
            <span className="block text-[8px] uppercase font-bold text-[#8d7565] group-hover:underline">Following</span>
          </Link>
          <div title={`${streak}-day active coding streak`}>
            <span className="text-xs font-bold text-amber-500 flex items-center justify-center gap-0.5">
              {streak} <Flame size={11} className="text-orange-500 fill-orange-500" />
            </span>
            <span className="block text-[8px] uppercase font-bold text-[#8d7565]">Streak</span>
          </div>
        </div>
      </div>

      {/* + Create Post Button */}
      <button
        onClick={() => {
          document.querySelector('textarea')?.focus();
          if (onClose) onClose();
        }}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fb923c] hover:brightness-105 text-white font-extrabold text-xs shadow-md shadow-orange-500/25 transition-all cursor-pointer active:scale-98"
      >
        <Plus size={15} strokeWidth={3} />
        <span>Create Post</span>
      </button>

      {/* Navigation Groups (Explore, Collaborate, Personal) */}
      <div className="bg-white border border-[#f1e4d3] shadow-xs rounded-2xl p-2.5 flex flex-col gap-2.5">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 uppercase text-[#8d7565]">
              {group.title}
            </span>

            {group.items.map((item, iIdx) => {
              const Icon = item.icon;
              const active = item.path ? isActive(item.path) : false;

              const content = (
                <div
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    active
                      ? 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white font-bold shadow-xs'
                      : 'text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff7ed]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon size={15} strokeWidth={active ? 2.4 : 1.8} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 border border-amber-200">
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
                >
                  {content}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Upgrade to Connectra+ Card */}
      <div className="p-3 rounded-2xl bg-gradient-to-b from-[#fff7ed] to-[#ffedd5] border border-[#fed7aa] flex flex-col items-center text-center gap-1.5 shadow-xs">
        <div className="text-xs font-bold text-[#9a3412] flex items-center gap-1.5">
          <Zap size={13} className="text-[#ea580c]" />
          <span>Connectra+ Pro</span>
        </div>
        <p className="text-[10px] text-[#8d7565] leading-tight">
          Unlock CTF badges, Repos & exclusive dev clubs.
        </p>
      </div>
    </aside>
  );
}
