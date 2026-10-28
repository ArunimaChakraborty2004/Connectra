import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon, Mail, Lock, User, AlertCircle, CheckCircle2, Key, Code, Globe } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });

    if (isResetPassword) {
      if (!email) {
        setStatus({ type: 'error', msg: 'Please enter your email to reset password.' });
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setStatus({ type: 'error', msg: error.message });
      } else {
        setStatus({ type: 'success', msg: 'Password reset instructions sent to your email.' });
      }
      setLoading(false);
      return;
    }

    if (isLogin) {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus({ type: 'error', msg: error.message });
      } else if (signInData.user) {
        // Ensure profile has username populated from metadata if empty
        const metaUsername = signInData.user.user_metadata?.username || signInData.user.user_metadata?.full_name || email.split('@')[0];
        if (metaUsername) {
          const { data: existingProfile } = await supabase.from('profiles').select('username').eq('id', signInData.user.id).maybeSingle();
          if (!existingProfile?.username) {
            await supabase.from('profiles').upsert({ id: signInData.user.id, username: metaUsername });
          }
        }
      }
    } else {
      if (!username.trim()) {
        setStatus({ type: 'error', msg: 'Username is required for Connectra' });
        setLoading(false);
        return;
      }
      const cleanUsername = username.trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: cleanUsername,
            full_name: cleanUsername,
          }
        }
      });
      if (error) {
        setStatus({ type: 'error', msg: error.message });
      } else if (data.user) {
        // Try upserting directly into profiles table as well
        await supabase.from("profiles").upsert({
          id: data.user.id,
          username: cleanUsername,
          full_name: cleanUsername,
        });
        setStatus({ type: 'success', msg: 'Welcome aboard! Please check your email to verify.' });
      }
    }
    setLoading(false);
  };

  const handleOAuth = async (provider) => {
    setLoading(true);
    setStatus({ type: '', msg: '' });
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      }
    });
    if (error) {
      setStatus({ type: 'error', msg: error.message });
      setLoading(false);
    }
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
        <div className="w-full max-w-md p-8 glass-panel rounded-3xl relative z-10 shadow-2xl border border-white/10">
          
          {/* Header */}
          <div className="flex flex-col items-center mb-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="h-16 w-16 bg-gradient-to-br from-primary to-primary-hover rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-primary/30"
            >
              <Hexagon size={32} fill="currentColor" strokeWidth={1.5} />
            </motion.div>
            <h1 className="text-3xl font-extrabold tracking-tight text-main mb-2">
              Connectra
            </h1>
            <p className="text-muted text-sm font-medium">The network for developers.</p>
          </div>

          {/* Auth Tabs */}
          <div className="flex bg-surface rounded-xl p-1 mb-6 relative border border-white/10">
            <button 
              onClick={() => { setIsLogin(true); setIsResetPassword(false); setStatus({type:'',msg:''}); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg z-10 transition-colors ${isLogin && !isResetPassword ? 'text-black' : 'text-muted hover:text-main'}`}
            >
              Log In
            </button>
            <button 
              onClick={() => { setIsLogin(false); setIsResetPassword(false); setStatus({type:'',msg:''}); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg z-10 transition-colors ${!isLogin && !isResetPassword ? 'text-black' : 'text-muted hover:text-main'}`}
            >
              Sign Up
            </button>
            <motion.div 
              layout
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm"
              initial={false}
              animate={{ x: (isLogin && !isResetPassword) ? '4px' : (!isLogin && !isResetPassword ? '100%' : '50%'), opacity: isResetPassword ? 0 : 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          </div>

          <AnimatePresence mode="wait">
            {isResetPassword && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 text-center text-sm text-muted"
              >
                <Key className="mx-auto mb-2 text-primary" size={24} />
                Enter your email address and we'll send you a link to reset your password.
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {!isLogin && !isResetPassword && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={20} />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Developer Username"
                      className="w-full bg-surface/50 border border-border hover:border-border-hover rounded-xl py-3 pl-12 pr-4 text-main placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={20} />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-surface/50 border border-border hover:border-border-hover rounded-xl py-3 pl-12 pr-4 text-main placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>

            <AnimatePresence mode="popLayout">
              {!isResetPassword && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={20} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full bg-surface/50 border border-border hover:border-border-hover rounded-xl py-3 pl-12 pr-4 text-main placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {isLogin && !isResetPassword && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-right mt-1"
                >
                  <button
                    type="button"
                    onClick={() => { setIsResetPassword(true); setStatus({type:'',msg:''}); }}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit" 
              disabled={loading}
              className="mt-4 w-full flex items-center justify-center gap-2 vibrant-btn py-3 px-4 rounded-xl disabled:opacity-50 font-bold tracking-wide"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <span>{isResetPassword ? 'Send Reset Link' : isLogin ? 'Enter Connectra' : 'Join the Network'}</span>
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

            {!isResetPassword && (
              <div className="mt-6 flex flex-col gap-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-xs text-muted uppercase">
                    <span className="bg-background px-4 font-semibold">Or continue with</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => handleOAuth('github')}
                    className="w-full flex items-center justify-center gap-2 glass-panel hover:bg-white/5 py-3 rounded-xl text-sm font-semibold transition-colors border border-white/10"
                  >
                    <Code size={18} />
                    GitHub
                  </button>
                </div>
                <p className="text-[10px] text-muted text-center mt-2">
                  Note: Email auth may be rate-limited by the Supabase free plan. 
                  If you encounter an error, please use GitHub.
                </p>
              </div>
            )}
            
            {isResetPassword && (
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setIsResetPassword(false)}
                  className="text-sm text-muted hover:text-main transition-colors"
                >
                  Back to login
                </button>
              </div>
            )}
          </form>
          
        </div>
      </motion.div>
    </div>
  );
}
