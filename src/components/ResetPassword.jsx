import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, KeyRound } from 'lucide-react';

export default function ResetPassword({ onComplete }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [success, setSuccess] = useState(false);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setStatus({ type: '', msg: '' });

    if (!newPassword || newPassword.length < 6) {
      setStatus({ type: 'error', msg: 'Password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', msg: 'Passwords do not match.' });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setStatus({ type: 'error', msg: error.message });
        setLoading(false);
        return;
      }

      setSuccess(true);
      setStatus({ type: 'success', msg: 'Your password has been updated successfully!' });

      // Clean hash parameters from URL
      if (window.history.replaceState) {
        window.history.replaceState(null, null, window.location.pathname);
      }

      setTimeout(() => {
        if (onComplete) {
          onComplete();
        } else {
          window.location.href = '/';
        }
      }, 1600);
    } catch (err) {
      setStatus({ type: 'error', msg: err.message || 'Failed to update password.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-5 sm:p-8 bg-[#fdfbf9] relative">
      {/* Subtle dot grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.35]"
        style={{ backgroundImage: 'radial-gradient(#dcc4b4 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      />

      {/* Ambient background glow */}
      <div
        className="absolute w-[450px] h-[450px] rounded-full pointer-events-none blur-3xl opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(234,88,12,0.2) 0%, transparent 70%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 25, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px] relative z-10"
      >
        <div className="relative">
          <div className="absolute -inset-1.5 bg-gradient-to-r from-orange-500/20 via-amber-500/15 to-orange-600/20 rounded-[32px] blur-xl opacity-70 pointer-events-none" />

          <div className="w-full relative bg-white/95 backdrop-blur-xl border border-[#eeddd0] rounded-3xl p-7 sm:p-9 shadow-[0_20px_50px_-12px_rgba(234,88,12,0.14),0_0_0_1px_rgba(238,221,208,0.5)] overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fb923c]" />

            <div className="mb-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200/60 mx-auto mb-3 flex items-center justify-center text-[#ea580c] shadow-sm">
                <KeyRound size={22} />
              </div>
              <h2 className="text-2xl font-black text-[#1c130d] tracking-tight">Set New Password</h2>
              <p className="text-xs text-[#8c705f] mt-1.5 font-medium">
                Please enter a secure new password for your account.
              </p>
            </div>

            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="w-14 h-14 bg-emerald-50 rounded-full border border-emerald-200 flex items-center justify-center mx-auto mb-3 text-emerald-600">
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="text-base font-bold text-emerald-800 mb-1">Password Changed!</h3>
                <p className="text-xs text-[#8c705f]">Redirecting you to Connectra now...</p>
              </motion.div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
                {/* New Password */}
                <div>
                  <label className="block text-[11px] font-bold text-[#634f43] mb-1.5 ml-1">New Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a88d7d] group-focus-within:text-[#ea580c] transition-colors pointer-events-none" size={16} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-[#faf7f4] border border-[#e5d4c5] hover:border-[#cfb6a3] focus:border-[#ea580c] focus:bg-white focus:ring-4 focus:ring-orange-500/10 rounded-2xl py-3 pl-10 pr-11 text-sm text-[#1c130d] placeholder-[#b59e90] focus:outline-none transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#a88d7d] hover:text-[#1c130d] transition-colors cursor-pointer p-1"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-[11px] font-bold text-[#634f43] mb-1.5 ml-1">Confirm New Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a88d7d] group-focus-within:text-[#ea580c] transition-colors pointer-events-none" size={16} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full bg-[#faf7f4] border border-[#e5d4c5] hover:border-[#cfb6a3] focus:border-[#ea580c] focus:bg-white focus:ring-4 focus:ring-orange-500/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-[#1c130d] placeholder-[#b59e90] focus:outline-none transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Status Message */}
                <AnimatePresence>
                  {status.msg && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`flex items-start gap-2.5 text-xs p-3.5 rounded-2xl border font-medium ${
                        status.type === 'error'
                          ? 'bg-red-50/90 border-red-200 text-red-800'
                          : 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      {status.type === 'error' ? (
                        <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 size={14} className="text-emerald-700 shrink-0 mt-0.5" />
                      )}
                      <p>{status.msg}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.012 }}
                  whileTap={{ scale: 0.988 }}
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
                  style={{
                    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)',
                    boxShadow: '0 4px 18px rgba(234,88,12,0.32), inset 0 1px 1px rgba(255,255,255,0.25)',
                  }}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Update Password</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </motion.button>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
