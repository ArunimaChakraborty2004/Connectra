import { useState } from 'react';
import { Bot, Sparkles, Check, Copy, ChevronDown, ChevronUp, Trash2, Clock, HardDrive, ShieldCheck, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AIPeerReviewCommentCard({ comment, onDelete, canDelete, timeAgo }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const rawContent = comment.content || '';

  // Extract score if present in markdown
  const scoreMatch = rawContent.match(/(?:Quality Score|Score):\s*\*?([0-9\.]+\s*\/\s*10[^\*\n]*)\*?/i);
  const scoreText = scoreMatch ? scoreMatch[1].trim() : null;

  // Extract Time Complexity if present
  const timeMatch = rawContent.match(/(?:Time Complexity|Asymptotic Bound:)\s*\*?([O0]\([^)]+\))\*?/i);
  const timeComplexity = timeMatch ? timeMatch[1].trim() : null;

  // Extract Space Complexity if present
  const spaceMatch = rawContent.match(/(?:Memory & Space|Auxiliary Space:)\s*\*?([O0]\([^)]+\))\*?/i);
  const spaceComplexity = spaceMatch ? spaceMatch[1].trim() : null;

  // Extract refactored code block if present
  const codeBlockMatch = rawContent.match(/```([a-zA-Z]*)\n([\s\S]*?)```/);
  const refactoredLang = codeBlockMatch ? (codeBlockMatch[1] || 'code') : 'code';
  const refactoredCode = codeBlockMatch ? codeBlockMatch[2].trim() : null;

  const handleCopyRefactored = () => {
    if (!refactoredCode) return;
    navigator.clipboard.writeText(refactoredCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex gap-2.5 text-xs group my-2">
      {/* Bot Avatar */}
      <div className="shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-600 via-amber-500 to-amber-300 p-0.5 shadow-xs flex items-center justify-center">
          <div className="w-full h-full rounded-full bg-[#1c130d] flex items-center justify-center text-amber-400">
            <Bot size={15} />
          </div>
        </div>
      </div>

      {/* Bot Review Body */}
      <div className="flex-1 rounded-2xl bg-gradient-to-b from-orange-50/70 to-amber-50/30 dark:from-[#24170f] dark:to-[#1a110a] border border-orange-200/80 dark:border-orange-900/50 p-3.5 shadow-xs relative">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-orange-200/50 dark:border-orange-950/60">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-[#1c130d] dark:text-white flex items-center gap-1">
              Connectra AI Peer Reviewer
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/80 text-[#ea580c] dark:text-orange-400 border border-orange-300/60 dark:border-orange-800/40">
              <Sparkles size={9} /> Verified Bot
            </span>
            {comment.created_at && (
              <span className="text-[10px] text-[#8d7565]">
                · {timeAgo ? timeAgo(comment.created_at) : 'Just now'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {scoreText && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/40">
                <Award size={10} />
                {scoreText}
              </span>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                title="Remove bot review"
                className="text-stone-400 hover:text-rose-600 transition-colors p-0.5 rounded cursor-pointer"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Complexity Metadata Badges */}
        {(timeComplexity || spaceComplexity) && (
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            {timeComplexity && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-[#2b1f17] border border-orange-200 dark:border-orange-900/60 text-[11px] font-medium text-[#2b1f17] dark:text-orange-200 shadow-2xs">
                <Clock size={12} className="text-orange-500" />
                <span>Time:</span>
                <span className="font-mono font-bold text-[#ea580c] dark:text-orange-400">{timeComplexity}</span>
              </div>
            )}
            {spaceComplexity && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-[#2b1f17] border border-orange-200 dark:border-orange-900/60 text-[11px] font-medium text-[#2b1f17] dark:text-orange-200 shadow-2xs">
                <HardDrive size={12} className="text-amber-500" />
                <span>Memory:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{spaceComplexity}</span>
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-[#2b1f17] border border-orange-200 dark:border-orange-900/60 text-[11px] font-medium text-[#2b1f17] dark:text-orange-200 shadow-2xs">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span>OWASP & Edge Cases Audited</span>
            </div>
          </div>
        )}

        {/* Review Prose Content */}
        <div className="text-[12px] text-[#2b1f17] dark:text-stone-200 leading-relaxed space-y-2">
          {rawContent.split('\n\n').map((paragraph, pIdx) => {
            const trimmed = paragraph.trim();
            // Skip headers already displayed in badges
            if (trimmed.startsWith('### 🤖') || trimmed.startsWith('**Review for')) return null;

            // Heading 4
            if (trimmed.startsWith('####')) {
              return (
                <h5 key={pIdx} className="font-bold text-xs text-[#ea580c] dark:text-orange-400 pt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  {trimmed.replace(/^####\s*/, '')}
                </h5>
              );
            }

            // If it's a code block
            if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
              return null; // Handled separately below in clean viewer
            }

            return (
              <p key={pIdx} className="whitespace-pre-wrap">
                {trimmed}
              </p>
            );
          })}
        </div>

        {/* Refactored Code Dropdown */}
        {refactoredCode && (
          <div className="mt-3 rounded-xl overflow-hidden border border-amber-500/20 bg-[#140e0a] text-amber-200">
            <div className="px-3 py-1.5 bg-[#231812] border-b border-amber-500/10 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-orange-400 text-[10px]">
                  {refactoredLang} • Suggested Refactor
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyRefactored}
                  className="flex items-center gap-1 text-[10px] text-amber-300 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check size={11} className="text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={11} /> Copy Clean Code
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="text-stone-400 hover:text-white transition-colors p-0.5 cursor-pointer"
                >
                  {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {expanded && (
                <motion.pre
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-3 text-[11px] font-mono leading-relaxed overflow-x-auto text-amber-200/90"
                >
                  <code>{refactoredCode}</code>
                </motion.pre>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
