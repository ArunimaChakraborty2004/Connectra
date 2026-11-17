import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore } from '../../lib/toast';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2.5 pointer-events-none w-full max-w-lg px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.94, transition: { duration: 0.18 } }}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md border max-w-md w-auto ${
              t.type === 'error'
                ? 'bg-white/95 dark:bg-[#1f1412]/95 border-rose-300 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 shadow-rose-500/10'
                : t.type === 'success'
                ? 'bg-white/95 dark:bg-[#121c15]/95 border-emerald-300 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200 shadow-emerald-500/10'
                : 'bg-white/95 dark:bg-[#1f1813]/95 border-orange-300 dark:border-orange-900/60 text-[#1c130d] dark:text-[#f4e8da] shadow-orange-500/10'
            }`}
          >
            {t.type === 'error' ? (
              <AlertCircle size={18} className="text-rose-500 shrink-0" />
            ) : t.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            ) : (
              <Info size={18} className="text-[#ea580c] shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-semibold flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer shrink-0 ml-1"
              aria-label="Dismiss toast"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
