import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import SearchPage from './pages/SearchPage';
import ProfilePage from './pages/ProfilePage';
import ProjectDetails from './pages/ProjectDetails';
import CodingProfilePage from './pages/CodingProfilePage';
import PortfolioPage from './pages/PortfolioPage';
import CommunitiesPage from './pages/CommunitiesPage';
import CommunityDetailsPage from './pages/CommunityDetailsPage';
import EventsPage from './pages/EventsPage';
import ReelsPage from './pages/ReelsPage';
import ChatPage from './pages/ChatPage';
import CollabBoardPage from './pages/CollabBoardPage';
import ToastContainer from './components/ui/Toast';
import Loader from './components/ui/Loader';
import NotificationsPanel from './components/NotificationsPanel';
import Navbar from './components/Navbar';
import ProjectsModal from './components/ProjectsModal';
import SettingsPage from './pages/SettingsPage';
import AICopilotWidget from './components/ai/AICopilotWidget';
import MobileBottomNav from './components/MobileBottomNav';
import Sidebar from './components/Sidebar';
import { motion, AnimatePresence } from 'framer-motion';

function AppInner({ session }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, bio, tech_stack, github_url, xp, level, avatar_url')
          .eq('id', session.user.id)
          .single();
        if (data) {
          if (!data.username) {
            const fallbackName = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'developer';
            supabase.from('profiles').update({ username: fallbackName }).eq('id', session.user.id).then(() => {});
            data.username = fallbackName;
          }
          setProfile(data);
        } else {
          const fallbackName = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User';
          supabase.from('profiles').upsert({ id: session.user.id, username: fallbackName }).then(() => {});
          setProfile({ id: session.user.id, username: fallbackName, xp: 0, level: 1 });
        }

        const { count: fCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', session.user.id);
        const { count: foCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', session.user.id);
        const { count: accCount } = await supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .or(`requester_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
          .eq('status', 'accepted');

        const netConns = accCount || 0;
        setStats({
          followers: (fCount || 0) + netConns,
          following: (foCount || 0) + netConns,
          connections: netConns,
        });
      } catch (err) {
        setProfile({ id: session.user.id, username: 'User', xp: 0, level: 1 });
      }
    };
    loadProfile();
  }, [session.user.id]);

  useEffect(() => {
    const handleToggleNotifs = () => setShowNotifications(prev => !prev);
    const handleToggleProjects = () => setShowProjects(prev => !prev);
    const handleToggleSidebar = () => setShowMobileSidebar(prev => !prev);
    const handleStartChat = () => navigate('/chat');

    document.addEventListener('toggleNotifications', handleToggleNotifs);
    document.addEventListener('toggleProjects', handleToggleProjects);
    document.addEventListener('toggleSidebar', handleToggleSidebar);
    document.addEventListener('startChat', handleStartChat);

    return () => {
      document.removeEventListener('toggleNotifications', handleToggleNotifs);
      document.removeEventListener('toggleProjects', handleToggleProjects);
      document.removeEventListener('toggleSidebar', handleToggleSidebar);
      document.removeEventListener('startChat', handleStartChat);
    };
  }, [navigate]);

  return (
    <>
      <Navbar onOpenSidebar={() => setShowMobileSidebar(true)} />
      <NotificationsPanel session={session} isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
      <div className="pb-16 lg:pb-0">
        <Routes>
          <Route path="/" element={<Dashboard session={session} />} />
          <Route path="/search" element={<SearchPage session={session} />} />
          <Route path="/profile/:username" element={<ProfilePage session={session} />} />
          <Route path="/profile/:username/coding" element={<CodingProfilePage session={session} />} />
          <Route path="/profile/:username/portfolio" element={<PortfolioPage session={session} />} />
          <Route path="/projects/:id" element={<ProjectDetails session={session} />} />
          <Route path="/communities" element={<CommunitiesPage session={session} />} />
          <Route path="/communities/:id" element={<CommunityDetailsPage session={session} />} />
          <Route path="/events" element={<EventsPage session={session} />} />
          <Route path="/reels" element={<ReelsPage session={session} />} />
          <Route path="/chat" element={<ChatPage session={session} />} />
          <Route path="/collab" element={<CollabBoardPage session={session} />} />
          <Route path="/settings" element={<SettingsPage session={session} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {showProjects && (
        <ProjectsModal session={session} onClose={() => setShowProjects(false)} />
      )}

      {/* Mobile Sidebar Slide-over Drawer */}
      <AnimatePresence>
        {showMobileSidebar && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowMobileSidebar(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              className="relative w-[300px] max-w-[85vw] h-full overflow-y-auto p-4 z-10 shadow-2xl"
              style={{
                backgroundColor: 'var(--bg-color)',
                borderRight: '1px solid var(--border-color)',
              }}
            >
              <Sidebar
                profile={profile}
                stats={stats}
                onClose={() => setShowMobileSidebar(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        profile={profile}
        onOpenSidebar={() => setShowMobileSidebar(true)}
      />

      <AICopilotWidget session={session} />
    </>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <>
      <div className="grain-overlay"></div>
      <div className="ambient-light"></div>
      <ToastContainer />
      {!session ? (
        <Auth />
      ) : (
        <AppInner session={session} />
      )}
    </>
  );
}

export default App;
