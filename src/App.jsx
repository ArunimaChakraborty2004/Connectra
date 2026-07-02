import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import SearchPage from './pages/SearchPage';
import ProfilePage from './pages/ProfilePage';
import ProjectDetails from './pages/ProjectDetails';
import CodingProfilePage from './pages/CodingProfilePage';
import PortfolioPage from './pages/PortfolioPage';
import CommunitiesPage from './pages/CommunitiesPage';
import EventsPage from './pages/EventsPage';
import ReelsPage from './pages/ReelsPage';
import ToastContainer from './components/ui/Toast';
import Loader from './components/ui/Loader';
import NotificationsPanel from './components/NotificationsPanel';
import Navbar from './components/Navbar';
import ProjectsModal from './components/ProjectsModal';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProjects, setShowProjects] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleToggleNotifs = () => setShowNotifications(prev => !prev);
    const handleToggleProjects = () => setShowProjects(prev => !prev);
    
    document.addEventListener('toggleNotifications', handleToggleNotifs);
    document.addEventListener('toggleProjects', handleToggleProjects);
    
    return () => {
      document.removeEventListener('toggleNotifications', handleToggleNotifs);
      document.removeEventListener('toggleProjects', handleToggleProjects);
    };
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
        <>
          <Navbar />
          <NotificationsPanel session={session} isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
          <Routes>
            <Route path="/" element={<Dashboard session={session} />} />
            <Route path="/search" element={<SearchPage session={session} />} />
            <Route path="/profile/:username" element={<ProfilePage session={session} />} />
            <Route path="/profile/:username/coding" element={<CodingProfilePage session={session} />} />
            <Route path="/profile/:username/portfolio" element={<PortfolioPage session={session} />} />
            <Route path="/projects/:id" element={<ProjectDetails session={session} />} />
            <Route path="/communities" element={<CommunitiesPage session={session} />} />
            <Route path="/events" element={<EventsPage session={session} />} />
            <Route path="/reels" element={<ReelsPage session={session} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          {showProjects && (
            <ProjectsModal session={session} onClose={() => setShowProjects(false)} />
          )}
        </>
      )}
    </>
  );
}

export default App;
