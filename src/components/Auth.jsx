import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, User, AlertCircle, CheckCircle2,
  Key, ArrowRight, Eye, EyeOff, Sparkles, Cpu
} from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /* ── Auth logic (unchanged) ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', msg: '' });

    if (isResetPassword) {
      if (!email) { setStatus({ type: 'error', msg: 'Please enter your email.' }); setLoading(false); return; }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setStatus(error ? { type: 'error', msg: error.message } : { type: 'success', msg: 'Reset link sent! Check your inbox.' });
      setLoading(false);
      return;
    }

    if (isLogin) {
      const { data: d, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setStatus({ type: 'error', msg: error.message }); }
      else if (d.user) {
        const meta = d.user.user_metadata?.username || d.user.user_metadata?.full_name || email.split('@')[0];
        if (meta) {
          const { data: ep } = await supabase.from('profiles').select('username').eq('id', d.user.id).maybeSingle();
          if (!ep?.username) await supabase.from('profiles').upsert({ id: d.user.id, username: meta });
        }
      }
    } else {
      if (!username.trim()) { setStatus({ type: 'error', msg: 'Username is required.' }); setLoading(false); return; }
      const u = username.trim();
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username: u, full_name: u } } });
      if (error) { setStatus({ type: 'error', msg: error.message }); }
      else if (data.user) {
        await supabase.from('profiles').upsert({ id: data.user.id, username: u, full_name: u });
        setStatus({ type: 'success', msg: 'Welcome! Check your email to verify.' });
      }
    }
    setLoading(false);
  };


  const switchMode = (toLogin) => {
    setIsLogin(toLogin); setIsResetPassword(false);
    setStatus({ type: '', msg: '' }); setEmail(''); setPassword(''); setUsername('');
  };

  /* ── Input helper component ── */
  const Field = ({ label, type, value, onChange, placeholder, icon: Icon, rightEl }) => (
    <div>
      <label className="block text-[11px] font-bold text-[#8d7565] mb-1.5 ml-1">{label}</label>
      <div className="relative group">
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d4b8a8] group-focus-within:text-[#ea580c] transition-colors duration-200 pointer-events-none" size={15} />
        <input
          type={type}
          required
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-[#fdf9f6] border-2 border-[#eeddd0] hover:border-[#f8c5a0] focus:border-[#ea580c] rounded-2xl py-3 pl-10 pr-11 text-sm text-[#1c130d] placeholder-[#d4b8a8] focus:outline-none focus:bg-white transition-all duration-200 font-medium"
        />
        {rightEl}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full flex overflow-hidden" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", background: '#fdf9f6' }}>

      {/* ════════════════════════════════
          LEFT — Logo Hero Panel
      ════════════════════════════════ */}
      <div className="hidden lg:flex w-[46%] xl:w-[48%] relative flex-col items-center justify-center overflow-hidden">

        {/* Gradient background */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(155deg, #fff7f0 0%, #ffe8d6 40%, #ffd0b0 70%, #f5b080 100%)',
        }} />

        {/* Floating ambient glow orbs */}
        <motion.div
          animate={{
            x: [0, 30, -25, 0],
            y: [0, -35, 20, 0],
            scale: [1, 1.25, 0.95, 1],
            opacity: [0.45, 0.75, 0.5, 0.45]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full pointer-events-none blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.38) 0%, transparent 70%)' }}
        />
        <motion.div
          animate={{
            x: [0, -35, 25, 0],
            y: [0, 35, -20, 0],
            scale: [1, 1.2, 0.9, 1],
            opacity: [0.4, 0.7, 0.45, 0.4]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full pointer-events-none blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(234,88,12,0.32) 0%, transparent 70%)' }}
        />

        {/* Floating subtle geometric particles */}
        {[
          { size: 8, top: '16%', left: '14%', delay: 0, dur: 5 },
          { size: 12, top: '78%', left: '18%', delay: 1.5, dur: 6.5 },
          { size: 6, top: '28%', right: '14%', delay: 0.8, dur: 4.8 },
          { size: 10, top: '65%', right: '16%', delay: 2.2, dur: 5.8 }
        ].map((pt, idx) => (
          <motion.div
            key={idx}
            animate={{
              y: [0, -22, 0],
              opacity: [0.35, 0.9, 0.35],
              rotate: [0, 180, 360]
            }}
            transition={{ duration: pt.dur, repeat: Infinity, ease: 'easeInOut', delay: pt.delay }}
            className="absolute rounded-md pointer-events-none bg-gradient-to-br from-[#ea580c]/40 to-[#f97316]/50 backdrop-blur-sm border border-[#ea580c]/35 shadow-sm"
            style={{ width: pt.size, height: pt.size, top: pt.top, left: pt.left, right: pt.right }}
          />
        ))}

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center px-10 gap-7">

          {/* Perfectly Concentric Rings & Animated Logo */}
          <div className="relative flex items-center justify-center cursor-default py-8">

            {/* Ring 5 (Largest outer orbit - 640px) */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
              className="absolute w-[640px] h-[640px] rounded-full border border-[#ea580c]/25 pointer-events-none"
            />

            {/* Ring 4 (Large dashed orbit - 520px) */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
              className="absolute w-[520px] h-[520px] rounded-full border-2 border-dashed border-[#ea580c]/35 pointer-events-none"
            />

            {/* Ring 3 (Outer satellite orbit with Amber beacon - 400px) */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              className="absolute w-[400px] h-[400px] rounded-full border border-[#ea580c]/40 pointer-events-none flex items-center justify-start"
            >
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#ea580c] to-[#f59e0b] shadow-[0_0_16px_rgba(234,88,12,0.9)] -translate-x-2" />
            </motion.div>

            {/* Ring 2 (Inner satellite orbit counter-clockwise - 310px) */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
              className="absolute w-[310px] h-[310px] rounded-full border-2 border-dashed border-[#f97316]/45 pointer-events-none flex items-center justify-end"
            >
              <div className="w-3 h-3 rounded-full bg-gradient-to-tr from-[#f97316] to-[#fcd34d] shadow-[0_0_14px_rgba(249,115,22,0.95)] translate-x-1.5" />
            </motion.div>

            {/* Ring 1 (Close pulsing sonar ring - 240px) */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.25, 0.6] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute w-[240px] h-[240px] rounded-full border-2 border-[#ea580c]/50 pointer-events-none"
            />

            {/* Core Logo Container */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.05 }}
              className="w-40 h-40 xl:w-44 xl:h-44 rounded-3xl bg-white flex items-center justify-center p-6 shadow-2xl relative z-10"
              style={{
                boxShadow: '0 24px 70px rgba(234,88,12,0.32), 0 4px 20px rgba(0,0,0,0.06)',
                border: '1.5px solid rgba(238,221,208,0.9)'
              }}
            >
              <img
                src="/connectra-logo.png"
                alt="Connectra"
                className="w-full h-full object-contain filter drop-shadow-sm select-none"
              />
            </motion.div>
          </div>

          {/* Brand name + tagline */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="flex flex-col items-center gap-3 max-w-sm"
          >
            {/* Styled Brand Name with vibrant gradient & glow */}
            <div className="relative">
              <h1
                className="text-4xl xl:text-5xl font-black tracking-tight select-none"
                style={{
                  background: 'linear-gradient(135deg, #1c130d 0%, #3f2214 35%, #ea580c 80%, #f97316 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 2px 12px rgba(234,88,12,0.18))',
                  letterSpacing: '-0.03em',
                }}
              >
                Connectra
              </h1>

              {/* Subtle animated light gleam behind text */}
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-x-4 -inset-y-1 rounded-2xl pointer-events-none -z-10 blur-xl"
                style={{ background: 'radial-gradient(ellipse at center, rgba(234,88,12,0.15) 0%, transparent 70%)' }}
              />
            </div>

            {/* Elegant gradient accent bar with floating dot */}
            <div className="flex items-center gap-2 w-full justify-center">
              <div className="h-[1.5px] w-12 bg-gradient-to-r from-transparent to-[#ea580c]/50 rounded-full" />
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-1.5 h-1.5 rounded-full bg-[#ea580c] shadow-[0_0_8px_rgba(234,88,12,0.8)]"
              />
              <div className="h-[1.5px] w-12 bg-gradient-to-l from-transparent to-[#ea580c]/50 rounded-full" />
            </div>

            <p className="text-sm xl:text-base font-medium text-[#8d7565] leading-relaxed max-w-[28ch]">
              The developer network built for the <span className="font-bold text-[#ea580c]">AI era</span>.
            </p>
          </motion.div>
        </div>

        {/* Bottom attribution */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="absolute bottom-6 text-xs font-medium flex items-center gap-1.5"
          style={{ color: '#c4a090' }}
        >
          <span>© {new Date().getFullYear()} Connectra</span>
          <span>·</span>
          <span className="text-[#ea580c] font-semibold">Secure by design</span>
        </motion.p>
      </div>

      {/* ════════════════════════════════
          RIGHT — Auth Form
      ════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8 overflow-y-auto relative">

        {/* Subtle dot grid */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.35]"
          style={{ backgroundImage: 'radial-gradient(#dcc4b4 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

        {/* Ambient background glow for right side */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.28, 0.15] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute w-[450px] h-[450px] rounded-full pointer-events-none blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(234,88,12,0.18) 0%, transparent 70%)' }}
        />

        <motion.div
          initial={{ opacity: 0, y: 35, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[430px] relative z-10 py-6"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-6">
            <motion.div
              whileHover={{ rotate: 5, scale: 1.05 }}
              className="w-16 h-16 rounded-2xl bg-white p-3 shadow-lg mb-2 relative"
              style={{ boxShadow: '0 8px 30px rgba(234,88,12,0.2)' }}
            >
              <img src="/connectra-logo.png" alt="Connectra" className="w-full h-full object-contain" />
            </motion.div>
            <h2 className="text-lg font-black text-[#1c130d]">Connectra</h2>
          </div>

          {/* ═══════════════════════════════════════════
              PARCHMENT SCROLL CONTAINER
          ═══════════════════════════════════════════ */}
          <div className="relative flex flex-col items-center">

            {/* TOP WOODEN ROLLER / SPINDLE */}
            <div className="w-[104%] -mb-2 z-20 relative flex items-center justify-center filter drop-shadow-md">
              {/* Left turned knob */}
              <div className="w-4 h-7 rounded-l-md" style={{
                background: 'linear-gradient(180deg, #5c2d13 0%, #8c471c 45%, #421e0a 100%)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)'
              }} />
              {/* Left brass collar */}
              <div className="w-2 h-6" style={{
                background: 'linear-gradient(180deg, #d4af37 0%, #fff0a0 50%, #8c7322 100%)'
              }} />
              {/* Main roller cylindrical body */}
              <div className="flex-1 h-5 relative rounded-sm overflow-hidden" style={{
                background: 'linear-gradient(180deg, #4a210b 0%, #8c471c 30%, #b86b32 50%, #6e3514 75%, #341505 100%)',
                boxShadow: '0 3px 6px rgba(0,0,0,0.35)'
              }}>
                {/* Wood grain shimmer line */}
                <div className="absolute inset-0 opacity-25" style={{
                  backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(255,255,255,0.4) 19px, transparent 20px)'
                }} />
              </div>
              {/* Right brass collar */}
              <div className="w-2 h-6" style={{
                background: 'linear-gradient(180deg, #d4af37 0%, #fff0a0 50%, #8c7322 100%)'
              }} />
              {/* Right turned knob */}
              <div className="w-4 h-7 rounded-r-md" style={{
                background: 'linear-gradient(180deg, #5c2d13 0%, #8c471c 45%, #421e0a 100%)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)'
              }} />
            </div>

            {/* UNROLLING PARCHMENT BODY */}
            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? 'login-scroll' : 'signup-scroll'}
                initial={{ scaleY: 0.15, opacity: 0, transformOrigin: 'top center' }}
                animate={{ scaleY: 1, opacity: 1 }}
                exit={{ scaleY: 0.15, opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="w-full relative overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, #f5e4cb 0%, #faebd7 15%, #fdf5ea 50%, #faebd7 85%, #edd4b2 100%)',
                  boxShadow: '0 15px 45px rgba(110, 60, 20, 0.22), 0 2px 8px rgba(0,0,0,0.06)',
                  borderLeft: '2px solid #deb887',
                  borderRight: '2px solid #deb887',
                }}
              >
                {/* Aged parchment decorative borders */}
                <div className="absolute inset-x-2 inset-y-2 border border-[#d2a679]/45 rounded-sm pointer-events-none" />
                <div className="absolute inset-x-3 inset-y-3 border border-dashed border-[#b8860b]/30 rounded-sm pointer-events-none" />

                {/* Corner ornamental accents */}
                <div className="absolute top-3 left-3 text-[#b8860b]/50 text-xs pointer-events-none select-none font-serif">❖</div>
                <div className="absolute top-3 right-3 text-[#b8860b]/50 text-xs pointer-events-none select-none font-serif">❖</div>
                <div className="absolute bottom-3 left-3 text-[#b8860b]/50 text-xs pointer-events-none select-none font-serif">❖</div>
                <div className="absolute bottom-3 right-3 text-[#b8860b]/50 text-xs pointer-events-none select-none font-serif">❖</div>

                {/* Top curled paper shading overlay */}
                <div className="absolute inset-x-0 top-0 h-4 pointer-events-none"
                  style={{ background: 'linear-gradient(180deg, rgba(74,33,11,0.28) 0%, transparent 100%)' }} />

                {/* Bottom curled paper shading overlay */}
                <div className="absolute inset-x-0 bottom-0 h-4 pointer-events-none"
                  style={{ background: 'linear-gradient(0deg, rgba(74,33,11,0.28) 0%, transparent 100%)' }} />

                {/* Form Content inside parchment */}
                <div className="p-7 sm:p-8 pt-7 pb-8 relative z-10">

                  {/* Heading */}
                  <div className="mb-5 text-center">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={isResetPassword ? 'r' : isLogin ? 'l' : 's'}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.22 }}
                      >
                        <h2 className="text-xl sm:text-2xl font-black text-[#2e1708] tracking-tight font-serif">
                          {isResetPassword ? 'Forgot Password?' : isLogin ? 'Sign In to Connectra' : 'Create an Account'}
                        </h2>
                        <p className="text-xs text-[#8a5d3b] mt-1 font-medium">
                          {isResetPassword
                            ? "Enter your email address and we'll send a secure reset link"
                            : isLogin ? 'Good to have you back 👋' : 'Join thousands of developers worldwide'}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Parchment Tabs */}
                  {!isResetPassword && (
                    <div className="flex bg-[#ebd5ba]/70 rounded-2xl p-1 mb-5 border border-[#cda276] relative">
                      {[['Sign In', true], ['Sign Up', false]].map(([label, val]) => {
                        const active = isLogin === val;
                        return (
                          <button key={label} type="button" onClick={() => switchMode(val)}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl z-10 relative cursor-pointer transition-colors ${active ? 'text-[#2e1708]' : 'text-[#7d5332] hover:text-[#42220d]'}`}>
                            {label}
                          </button>
                        );
                      })}
                      <motion.div
                        className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-gradient-to-b from-[#fffbf5] to-[#f9eedc] border border-[#cda276]"
                        style={{ boxShadow: '0 2px 5px rgba(90,45,15,0.12)' }}
                        initial={false}
                        animate={{ x: isLogin ? '0%' : '100%' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    </div>
                  )}

                  {/* Reset info banner */}
                  <AnimatePresence>
                    {isResetPassword && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="mb-5 flex items-center gap-2 px-3.5 py-3 rounded-xl bg-[#faebd7] border border-[#d2a679] text-xs text-[#8c471c] font-medium">
                        <Key size={14} className="shrink-0 text-[#ea580c]" />
                        <span>Enter your registered email — link expires in 15 minutes.</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Form Fields */}
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">

                    {/* Username */}
                    <AnimatePresence mode="popLayout">
                      {!isLogin && !isResetPassword && (
                        <motion.div key="u" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}>
                          <div>
                            <label className="block text-[11px] font-bold text-[#6b4226] mb-1.5 ml-1">Developer Handle</label>
                            <div className="relative group">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#b0886a] group-focus-within:text-[#ea580c] transition-colors pointer-events-none" size={15} />
                              <input
                                type="text"
                                required
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="e.g. dev_coder99"
                                className="w-full bg-[#fcf5eb] border-2 border-[#d9ba9b] hover:border-[#b8860b] focus:border-[#ea580c] rounded-2xl py-3 pl-10 pr-4 text-sm text-[#2e1708] placeholder-[#b0886a] focus:outline-none focus:bg-white transition-all font-medium shadow-inner"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Email */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#6b4226] mb-1.5 ml-1">Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#b0886a] group-focus-within:text-[#ea580c] transition-colors pointer-events-none" size={15} />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="name@company.com"
                          className="w-full bg-[#fcf5eb] border-2 border-[#d9ba9b] hover:border-[#b8860b] focus:border-[#ea580c] rounded-2xl py-3 pl-10 pr-4 text-sm text-[#2e1708] placeholder-[#b0886a] focus:outline-none focus:bg-white transition-all font-medium shadow-inner"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <AnimatePresence mode="popLayout">
                      {!isResetPassword && (
                        <motion.div key="p" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}>
                          <div>
                            <div className="flex items-center justify-between mb-1.5 ml-1">
                              <label className="text-[11px] font-bold text-[#6b4226]">Password</label>
                              {isLogin && (
                                <button type="button" onClick={() => { setIsResetPassword(true); setStatus({ type: '', msg: '' }); }}
                                  className="text-[11px] text-[#ea580c] font-bold hover:underline cursor-pointer">
                                  Forgot password?
                                </button>
                              )}
                            </div>
                            <div className="relative group">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#b0886a] group-focus-within:text-[#ea580c] transition-colors pointer-events-none" size={15} />
                              <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••••"
                                className="w-full bg-[#fcf5eb] border-2 border-[#d9ba9b] hover:border-[#b8860b] focus:border-[#ea580c] rounded-2xl py-3 pl-10 pr-11 text-sm text-[#2e1708] placeholder-[#b0886a] focus:outline-none focus:bg-white transition-all font-medium shadow-inner"
                              />
                              <button type="button" onClick={() => setShowPassword(v => !v)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#b0886a] hover:text-[#42220d] transition-colors cursor-pointer">
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Status Alert */}
                    <AnimatePresence>
                      {status.msg && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className={`flex items-start gap-2.5 text-xs p-3.5 rounded-2xl border font-medium ${status.type === 'error' ? 'bg-red-50/90 border-red-300 text-red-800' : 'bg-emerald-50/90 border-emerald-300 text-emerald-900'}`}>
                          {status.type === 'error'
                            ? <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
                            : <CheckCircle2 size={14} className="text-emerald-700 shrink-0 mt-0.5" />}
                          <p>{status.msg}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Submit Button */}
                    <motion.button
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      type="submit"
                      disabled={loading}
                      className="mt-1 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white cursor-pointer disabled:opacity-55 transition-all shadow-md"
                      style={{
                        background: 'linear-gradient(135deg, #a73205 0%, #ea580c 50%, #f97316 100%)',
                        boxShadow: '0 4px 18px rgba(167,50,5,0.38), inset 0 1px 1px rgba(255,255,255,0.3)',
                      }}
                    >
                      {loading
                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <><span>{isResetPassword ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account'}</span><ArrowRight size={15} /></>
                      }
                    </motion.button>

                    {/* Back link for reset */}
                    {isResetPassword && (
                      <button type="button" onClick={() => { setIsResetPassword(false); setStatus({ type: '', msg: '' }); }}
                        className="text-center text-xs text-[#ea580c] font-bold hover:underline cursor-pointer mt-1">
                        ← Back to Sign In
                      </button>
                    )}
                  </form>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* BOTTOM WOODEN ROLLER / SPINDLE */}
            <div className="w-[104%] -mt-2 z-20 relative flex items-center justify-center filter drop-shadow-lg">
              {/* Left turned knob */}
              <div className="w-4 h-7 rounded-l-md" style={{
                background: 'linear-gradient(180deg, #5c2d13 0%, #8c471c 45%, #421e0a 100%)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)'
              }} />
              {/* Left brass collar */}
              <div className="w-2 h-6" style={{
                background: 'linear-gradient(180deg, #d4af37 0%, #fff0a0 50%, #8c7322 100%)'
              }} />
              {/* Main roller cylindrical body */}
              <div className="flex-1 h-5 relative rounded-sm overflow-hidden" style={{
                background: 'linear-gradient(180deg, #341505 0%, #6e3514 25%, #b86b32 50%, #8c471c 70%, #4a210b 100%)',
                boxShadow: '0 -2px 6px rgba(0,0,0,0.35)'
              }}>
                {/* Wood grain shimmer line */}
                <div className="absolute inset-0 opacity-25" style={{
                  backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(255,255,255,0.4) 19px, transparent 20px)'
                }} />
              </div>
              {/* Right brass collar */}
              <div className="w-2 h-6" style={{
                background: 'linear-gradient(180deg, #d4af37 0%, #fff0a0 50%, #8c7322 100%)'
              }} />
              {/* Right turned knob */}
              <div className="w-4 h-7 rounded-r-md" style={{
                background: 'linear-gradient(180deg, #5c2d13 0%, #8c471c 45%, #421e0a 100%)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)'
              }} />
            </div>

          </div>

          {/* Toggle hint below parchment scroll */}
          {!isResetPassword && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="text-center text-xs text-[#8a5d3b] mt-4 font-medium">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" onClick={() => switchMode(!isLogin)}
                className="text-[#ea580c] font-bold hover:underline cursor-pointer ml-1">
                {isLogin ? 'Sign up free' : 'Sign in'}
              </button>
            </motion.p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
