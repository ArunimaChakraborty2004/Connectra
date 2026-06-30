import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon, Mail, Lock, User, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setStatus({ type: 'error', msg: error.message });
    } else {
      if (!username.trim()) {
        setStatus({ type: 'error', msg: 'Username is required for DevConnect' });
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setStatus({ type: 'error', msg: error.message });
      } else if (data.user) {
        await supabase.from("profiles").upsert({ id: data.user.id, username: username.trim() });
        setStatus({ type: 'success', msg: 'Welcome aboard! Please check your email to verify.' });
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Subtle Ambient Light */}
      <motion.div 
        animate={{ opacity: [0.3, 0.5, 0.3] }} 
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none"
      />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass-panel rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-14 w-14 glass-panel rounded-2xl flex items-center justify-center text-main mb-4">
              <Hexagon size={28} className="text-main" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-main mb-1.5">
              DevConnect
            </h1>
            <p className="text-muted text-sm font-medium">The network for developers.</p>
          </div>

          {/* Auth Tabs */}
          <div className="flex bg-surface rounded-xl p-1 mb-8 relative border border-white/10">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg z-10 transition-colors ${isLogin ? 'text-black' : 'text-muted hover:text-main'}`}
            >
              Log In
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg z-10 transition-colors ${!isLogin ? 'text-black' : 'text-muted hover:text-main'}`}
            >
              Sign Up
            </button>
            <motion.div 
              layout
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm"
              initial={false}
              animate={{ x: isLogin ? '4px' : '100%' }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative"
                >
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    <User size={18} />
                  </div>
                  <input 
                    type="text" 
                    required 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                    placeholder="Developer Username"
                    className="w-full glass-panel rounded-xl pl-12 pr-4 py-3 text-sm text-main focus:border-primary/50 outline-none transition-colors"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                <Mail size={18} />
              </div>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="Email Address"
                className="w-full glass-panel rounded-xl pl-12 pr-4 py-3 text-sm text-main focus:border-primary/50 outline-none transition-colors"
              />
            </div>

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                <Lock size={18} />
              </div>
              <input 
                type="password" 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Password"
                className="w-full glass-panel rounded-xl pl-12 pr-4 py-3 text-sm text-main focus:border-primary/50 outline-none transition-colors"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-white hover:bg-[#e5e5e5] text-black font-semibold py-3 px-4 rounded-xl disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
              ) : (
                <span>{isLogin ? 'Enter DevConnect' : 'Join the Network'}</span>
              )}
            </button>

            {status.msg && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-2 flex items-center gap-2 text-sm p-3 rounded-lg border ${
                  status.type === 'error' 
                    ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                    : 'bg-green-500/10 border-green-500/20 text-green-400'
                }`}
              >
                {status.type === 'error' ? <AlertCircle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" />}
                <p>{status.msg}</p>
              </motion.div>
            )}
          </form>
          
        </div>
      </motion.div>
    </div>
  );
}
