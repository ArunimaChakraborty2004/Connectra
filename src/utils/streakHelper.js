/**
 * Connectra Developer Gamification Engine
 * Dynamically computes developer streak, XP, and Level based on live activity.
 */

export function calculateUserStreak(userId, postDates = []) {
  if (!userId) return 1;

  const storageKey = `connectra_streak_${userId}`;
  const lastActiveKey = `connectra_last_active_${userId}`;

  const todayStr = new Date().toISOString().slice(0, 10);
  const lastActiveStr = localStorage.getItem(lastActiveKey);
  let savedStreak = parseInt(localStorage.getItem(storageKey), 10) || 1;

  if (!lastActiveStr) {
    // First time recording activity
    localStorage.setItem(lastActiveKey, todayStr);
    localStorage.setItem(storageKey, '1');
    savedStreak = 1;
  } else if (lastActiveStr === todayStr) {
    // Already active today, streak maintained
  } else {
    const lastDate = new Date(lastActiveStr);
    const todayDate = new Date(todayStr);
    const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day! Increment streak
      savedStreak += 1;
    } else if (diffDays > 1) {
      // Missed a day, reset streak to 1
      savedStreak = 1;
    }

    localStorage.setItem(lastActiveKey, todayStr);
    localStorage.setItem(storageKey, savedStreak.toString());
  }

  // If user has consecutive post dates, ensure streak is at least as high as post streak
  if (Array.isArray(postDates) && postDates.length > 0) {
    const uniqueDays = Array.from(
      new Set(postDates.map(d => new Date(d).toISOString().slice(0, 10)))
    ).sort().reverse();

    let postStreak = 0;
    let checkDate = new Date();

    for (const day of uniqueDays) {
      const targetStr = checkDate.toISOString().slice(0, 10);
      if (day === targetStr) {
        postStreak += 1;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    if (postStreak > savedStreak) {
      savedStreak = postStreak;
      localStorage.setItem(storageKey, savedStreak.toString());
    }
  }

  return Math.max(1, savedStreak);
}
