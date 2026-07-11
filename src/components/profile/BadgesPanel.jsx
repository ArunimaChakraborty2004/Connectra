import { useMemo } from 'react';

const BADGES = [
  {
    id: 'first_post',
    icon: '🚀',
    label: 'First Post',
    desc: 'Published your first post',
    color: 'from-violet-500/20 to-purple-500/10 border-violet-500/30',
    check: ({ postCount }) => postCount >= 1,
  },
  {
    id: 'networker',
    icon: '🤝',
    label: 'Networker',
    desc: '10+ connections made',
    color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
    check: ({ connections }) => connections >= 10,
  },
  {
    id: 'star_contributor',
    icon: '⭐',
    label: 'Star Contributor',
    desc: 'Received 50+ likes',
    color: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30',
    check: ({ totalLikes }) => totalLikes >= 50,
  },
  {
    id: 'open_source_hero',
    icon: '💻',
    label: 'Open Source Hero',
    desc: 'Imported 3+ repositories',
    color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30',
    check: ({ repoCount }) => repoCount >= 3,
  },
  {
    id: 'streak_master',
    icon: '🔥',
    label: 'Streak Master',
    desc: '7-day activity streak',
    color: 'from-orange-500/20 to-red-500/10 border-orange-500/30',
    check: ({ streak }) => streak >= 7,
  },
  {
    id: 'github_verified',
    icon: '✅',
    label: 'GitHub Verified',
    desc: 'Linked & verified GitHub',
    color: 'from-gray-500/20 to-slate-500/10 border-gray-500/30',
    check: ({ githubUrl }) => !!githubUrl,
  },
];

export default function BadgesPanel({ stats }) {
  const earnedBadges = useMemo(() =>
    BADGES.filter(b => b.check(stats || {})),
    [stats]
  );
  const lockedBadges = BADGES.filter(b => !b.check(stats || {}));

  return (
    <div className="glass-panel rounded-2xl p-6">
      <h3 className="text-sm font-bold text-main mb-4 uppercase tracking-wider">
        Badges & Achievements
      </h3>

      {earnedBadges.length === 0 && (
        <p className="text-xs text-muted mb-4">No badges earned yet — start posting!</p>
      )}

      {earnedBadges.length > 0 && (
        <div className="flex flex-col gap-2 mb-6">
          {earnedBadges.map(badge => (
            <div
              key={badge.id}
              className={`flex items-center gap-3 p-3 rounded-xl border bg-gradient-to-r ${badge.color}`}
            >
              <span className="text-2xl">{badge.icon}</span>
              <div>
                <p className="text-sm font-bold text-main">{badge.label}</p>
                <p className="text-xs text-muted">{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {lockedBadges.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Locked</p>
          <div className="flex flex-col gap-2">
            {lockedBadges.map(badge => (
              <div
                key={badge.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/2 opacity-40 grayscale"
              >
                <span className="text-2xl">{badge.icon}</span>
                <div>
                  <p className="text-sm font-bold text-main">{badge.label}</p>
                  <p className="text-xs text-muted">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
