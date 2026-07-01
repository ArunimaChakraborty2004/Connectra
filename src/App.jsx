import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import SearchPage from './pages/SearchPage';
import ProfilePage from './pages/ProfilePage';
import ProjectDetails from './pages/ProjectDetails';
import ToastContainer from './components/ui/Toast';
import Loader from './components/ui/Loader';
import NotificationsPanel from './components/NotificationsPanel';
import Navbar from './components/Navbar';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);

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
    const handleToggle = () => setShowNotifications(prev => !prev);
    document.addEventListener('toggleNotifications', handleToggle);
    return () => document.removeEventListener('toggleNotifications', handleToggle);
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
            <Route path="/projects/:id" element={<ProjectDetails session={session} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </>
      )}
    </>
  );
}

export default App;
