import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { generateProfileReview } from '../../lib/ai';

export default function AIReviewPanel({ profile, repoCount }) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const generateReview = async () => {
    setLoading(true);
    try {
      const result = await generateProfileReview(profile, repoCount || 0);
      setReview(result);
      setExpanded(true);
    } catch (error) {
      console.error(error);
      setReview(`⚠️ **Error**\n\nFailed to generate AI review. Please ensure VITE_GEMINI_API_KEY is set in your .env file.`);
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  };

  const formatReview = (text) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('🌟') || line.startsWith('🔍')) {
        return <p key={i} className="text-base font-bold text-main mb-2">{line}</p>;
      }
      if (line.startsWith('💡') || line.startsWith('📈') || line.startsWith('✅') || line.startsWith('⚠️') || line.startsWith('🏗️') || line.startsWith('💼') || line.startsWith('🚀')) {
        return <p key={i} className="text-sm font-bold text-primary mt-3 mb-1">{line}</p>;
      }
      if (line.startsWith('- ')) {
        return (
          <p key={i} className="text-sm text-muted pl-4 before:content-['•'] before:mr-2 before:text-primary">
            {line.slice(2).replace(/\*\*(.*?)\*\*/g, (_, m) => m)}
          </p>
        );
      }
      if (line.trim() === '') return <div key={i} className="h-1" />;
      const parsed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return <p key={i} className="text-sm text-muted" dangerouslySetInnerHTML={{ __html: parsed }} />;
    });
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      <button
        onClick={() => { if (!review) generateReview(); else setExpanded(e => !e); }}
        disabled={loading}
        className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-purple-500/20 flex items-center justify-center">
            <Sparkles size={20} className="text-violet-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-main">AI Profile Review</p>
            <p className="text-xs text-muted">Get instant AI feedback on your dev profile</p>
          </div>
        </div>
        {loading ? (
          <RefreshCw size={16} className="text-muted animate-spin" />
        ) : review ? (
          expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />
        ) : (
          <span className="text-xs font-bold text-violet-400 bg-violet-500/10 px-2 py-1 rounded-lg">Analyze →</span>
        )}
      </button>

      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 pt-0">
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 text-violet-400 text-sm font-semibold mb-3">
                  <Sparkles size={14} className="animate-pulse" />
                  AI is analyzing your profile...
                </div>
                <div className="flex flex-col gap-2">
                  {[90, 70, 80, 55].map((w, i) => (
                    <div
                      key={i}
                      className="h-3 bg-violet-500/20 rounded animate-pulse"
                      style={{ width: `${w}%`, animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {review && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 pt-0">
              <div className="bg-violet-500/5 border border-violet-500/15 rounded-xl p-4 flex flex-col gap-1">
                {formatReview(review)}
              </div>
              <button
                onClick={generateReview}
                className="mt-3 flex items-center gap-1 text-xs text-muted hover:text-violet-400 transition-colors"
              >
                <RefreshCw size={12} /> Regenerate
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
