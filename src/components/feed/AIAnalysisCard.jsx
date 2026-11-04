import { useState, useMemo } from 'react';
import {
  Shield,
  Sparkles,
  Check,
  Copy,
  X,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Lightbulb,
  Code2,
  Wrench,
  Percent,
  Info,
  Terminal,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Parses inline markdown:
 * - `code` -> inline code chip
 * - **bold** -> strong tag
 * - cleans stray double asterisks
 */
function renderInlineMarkdown(text) {
  if (!text) return null;

  // Split on code spans `...`
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((codePart, cIdx) => {
    if (codePart.startsWith('`') && codePart.endsWith('`') && codePart.length > 2) {
      return (
        <code
          key={cIdx}
          className="px-1.5 py-0.5 mx-0.5 rounded font-mono text-[11px] bg-black/60 text-amber-300 border border-amber-500/25 shadow-2xs inline-block align-baseline"
        >
          {codePart.slice(1, -1)}
        </code>
      );
    }

    // Split on **bold**
    const boldParts = codePart.split(/(\*\*[^*]+\*\*)/g);

    return boldParts.map((bPart, bIdx) => {
      if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length >= 4) {
        return (
          <strong key={`${cIdx}-${bIdx}`} className="font-bold text-amber-200">
            {bPart.slice(2, -2)}
          </strong>
        );
      }

      // Also clean any rogue stray double asterisks
      const cleaned = bPart.replace(/\*\*/g, '');
      return <span key={`${cIdx}-${bIdx}`}>{cleaned}</span>;
    });
  });
}

/**
 * Parses markdown text into structured semantic sections
 */
function parseMarkdownToSections(rawText) {
  if (!rawText || typeof rawText !== 'string') return { intro: '', sections: [] };

  const lines = rawText.split('\n');
  const sections = [];
  let introLines = [];
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;

    // Detect section header:
    // e.g. "1. 💡 **What it does**", "2. ⚡ **Key concepts / tricks used**", "### ⚠️ What it does", "1. What it does"
    const headerMatch = trimmed.match(/^(?:(?:\d+\.|\*|-|#+)\s*)?([💡⚡⚠️🚀🔍💡🛠️🔒]*)\s*\**([A-Za-z0-9\s/&,.\-_]+?)\**\s*$/);
    const isExplicitNumberedHeader = trimmed.match(/^\d+\.\s+([💡⚡⚠️🚀🔍💡🛠️🔒]?)\s*\**([^*]+)\**/);

    if (isExplicitNumberedHeader || (headerMatch && (trimmed.startsWith('#') || trimmed.match(/^\d+\./)))) {
      const icon = (isExplicitNumberedHeader ? isExplicitNumberedHeader[1] : headerMatch[1]) || '💡';
      const rawTitle = (isExplicitNumberedHeader ? isExplicitNumberedHeader[2] : headerMatch[2]) || 'Overview';
      const cleanTitle = rawTitle.replace(/\*\*/g, '').replace(/^[💡⚡⚠️🚀🔍💡🛠️🔒\s]+/, '').trim();

      currentSection = {
        icon,
        title: cleanTitle,
        items: [],
      };
      sections.push(currentSection);
      continue;
    }

    // Detect bullets: "* **Title**: body" or "* text" or "- text"
    const bulletMatch = trimmed.match(/^[*•-]\s+(.*)$/);
    if (bulletMatch) {
      const bulletContent = bulletMatch[1];
      // Check if bullet starts with bold title: "**useOptimistic**: body"
      const boldTitleMatch = bulletContent.match(/^\*\*([^*]+)\*\*:\s*(.*)$/);

      const bulletItem = boldTitleMatch
        ? {
            type: 'bullet_titled',
            title: boldTitleMatch[1].replace(/\*\*/g, '').trim(),
            text: boldTitleMatch[2],
          }
        : {
            type: 'bullet',
            text: bulletContent,
          };

      if (currentSection) {
        currentSection.items.push(bulletItem);
      } else {
        introLines.push(trimmed);
      }
      continue;
    }

    // Regular paragraph line
    if (currentSection) {
      currentSection.items.push({
        type: 'paragraph',
        text: trimmed,
      });
    } else {
      introLines.push(trimmed);
    }
  }

  return {
    intro: introLines.join(' ').replace(/\*\*/g, ''),
    sections,
  };
}

export default function AIAnalysisCard({ content, type = 'security', onClose, onApplyFix }) {
  const [copiedCodeIndex, setCopiedCodeIndex] = useState(null);
  const [appliedFix, setAppliedFix] = useState(false);
  const [showRefactored, setShowRefactored] = useState(false);

  if (!content) return null;

  // Determine if content is structured object (SAST JSON) or string
  const isStructured = typeof content === 'object' && content !== null && ('findings' in content || 'isClean' in content);

  const isExplainType = type === 'explain';

  const isClean = isStructured
    ? content.isClean
    : typeof content === 'string' &&
      (content.toLowerCase().includes('no critical vulnerabilities') ||
        content.toLowerCase().includes('no vulnerabilities detected') ||
        (content.toLowerCase().includes('secure') && !content.toLowerCase().includes('high vulnerability')));

  const findings = isStructured ? content.findings || [] : [];
  const refactoredCode = isStructured ? content.refactoredCode : null;
  const qualityNotes = isStructured ? content.qualityNotes || [] : [];
  const summary = isStructured ? content.summary : null;

  // Parse markdown for non-structured string responses (like code explanation)
  const parsedMarkdown = useMemo(() => {
    if (!isStructured && typeof content === 'string') {
      return parseMarkdownToSections(content);
    }
    return null;
  }, [content, isStructured]);

  const handleCopyCode = (codeText, idx) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(idx);
    setTimeout(() => setCopiedCodeIndex(null), 2200);
  };

  const handleApply = () => {
    if (onApplyFix && refactoredCode) {
      onApplyFix(refactoredCode);
      setAppliedFix(true);
      setTimeout(() => setAppliedFix(false), 3000);
    }
  };

  // Severity styling lookup
  const getSeverityBadge = (severity) => {
    const s = (severity || 'MEDIUM').toUpperCase();
    if (s === 'CRITICAL') return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
    if (s === 'HIGH') return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    if (s === 'MEDIUM') return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  };

  const getSectionTheme = (title = '', icon = '') => {
    const lower = `${title} ${icon}`.toLowerCase();
    if (lower.includes('concept') || lower.includes('trick') || lower.includes('⚡')) {
      return {
        cardBg: 'bg-blue-950/20 border-blue-500/30',
        iconBg: 'bg-blue-500/20 text-blue-400',
        dotBg: 'bg-blue-400',
        titleColor: 'text-blue-300',
      };
    }
    if (lower.includes('edge') || lower.includes('caveat') || lower.includes('⚠️') || lower.includes('risk')) {
      return {
        cardBg: 'bg-amber-950/20 border-amber-500/30',
        iconBg: 'bg-amber-500/20 text-amber-400',
        dotBg: 'bg-amber-400',
        titleColor: 'text-amber-300',
      };
    }
    return {
      cardBg: 'bg-orange-950/20 border-orange-500/30',
      iconBg: 'bg-orange-500/20 text-orange-400',
      dotBg: 'bg-orange-400',
      titleColor: 'text-orange-300',
    };
  };

  // Helper to parse diff lines into colored additions/deletions
  const renderDiffSnippet = (diffText) => {
    if (!diffText) return null;
    const lines = diffText.split('\n');
    return (
      <div className="font-mono text-[11px] p-2.5 rounded-lg bg-black/60 border border-white/10 overflow-x-auto space-y-0.5">
        {lines.map((line, idx) => {
          const isAdd = line.startsWith('+');
          const isDel = line.startsWith('-');
          return (
            <div
              key={idx}
              className={`px-1.5 py-0.5 rounded ${
                isAdd
                  ? 'bg-emerald-950/60 text-emerald-300 border-l-2 border-emerald-500'
                  : isDel
                  ? 'bg-rose-950/60 text-rose-300 border-l-2 border-rose-500 line-through opacity-85'
                  : 'text-stone-400'
              }`}
            >
              <code>{line}</code>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="mt-3 rounded-2xl overflow-hidden border border-[#4a3425] bg-gradient-to-b from-[#1c140e] via-[#160f0a] to-[#120c08] text-stone-200 shadow-xl"
    >
      {/* Header Banner */}
      <div className="px-4 py-3 bg-[#241912] border-b border-[#3d2a1d] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
              isExplainType
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : isClean
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isExplainType ? (
              <Sparkles size={15} className="text-orange-400" />
            ) : isClean ? (
              <Shield size={15} className="text-emerald-400" />
            ) : (
              <AlertTriangle size={15} className="text-amber-400" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-xs uppercase tracking-wider text-orange-400">
                {isExplainType ? 'AI Code Intelligence & Explanation' : 'LLM-SAST Vulnerability Pipeline'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30 font-mono font-bold">
                {isExplainType ? '✨ Interactive Breakdown' : 'OWASP & CWE Certified'}
              </span>
            </div>
            <div className="text-[11px] text-stone-400 flex items-center gap-2">
              <span>
                {isExplainType
                  ? 'Key concepts, idioms, and edge cases explained'
                  : 'Automated static inspection with Groq LPU acceleration'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Pill */}
          {!isExplainType && (
            <div
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-xs ${
                isClean
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/40'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-600/40'
              }`}
            >
              {isClean ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              <span>{isClean ? 'Clean / Zero Critical Flaws' : `${findings.length || 1} Security Advisory`}</span>
            </div>
          )}

          {isExplainType && (
            <div className="px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 bg-orange-950/60 text-orange-300 border border-orange-500/30 shadow-xs">
              <Lightbulb size={12} className="text-orange-400" />
              <span>Senior Dev Insights</span>
            </div>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close audit"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="p-4 space-y-3.5 text-xs">
        {/* Executive Summary (SAST mode) */}
        {summary && (
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-stone-300 leading-relaxed text-xs">
            <strong className="text-orange-400 font-bold block mb-0.5">Executive Verdict</strong>
            {summary}
          </div>
        )}

        {/* Structured SAST Findings (Security mode) */}
        {isStructured && findings.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={12} /> Vulnerability Findings & CWE Classification
              </span>
              <span className="text-[10px] text-stone-400 font-mono">
                {findings.length} issue(s) detected
              </span>
            </div>

            {findings.map((finding, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-amber-500/30 bg-[#1c120a] space-y-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${getSeverityBadge(finding.severity)}`}>
                      {finding.severity || 'HIGH'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-black/50 text-amber-300 font-mono text-[10px] border border-amber-500/20 font-bold">
                      {finding.cweId || 'CWE-Unknown'}
                    </span>
                    {finding.owaspCategory && (
                      <span className="text-[10px] text-stone-400 font-mono hidden sm:inline">
                        {finding.owaspCategory}
                      </span>
                    )}
                  </div>

                  {finding.confidence && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                      <Percent size={10} /> {Math.round(finding.confidence * 100)}% Confidence
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-stone-100 text-xs mb-1">
                    {finding.cweTitle || finding.description}
                  </h4>
                  {finding.cweTitle && (
                    <p className="text-stone-300 text-[11px] leading-relaxed">
                      {finding.description}
                    </p>
                  )}
                </div>

                {finding.remediationDiff && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-orange-400 flex items-center gap-1 uppercase tracking-wider">
                      <Wrench size={10} /> Remediation Diff
                    </span>
                    {renderDiffSnippet(finding.remediationDiff)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 1-Click Fix & Refactored Code Section */}
        {refactoredCode && !isClean && (
          <div className="p-3.5 rounded-xl bg-orange-950/20 border border-orange-500/30 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Wrench size={14} className="text-orange-400" />
                <span className="font-bold text-orange-300 text-xs">Automated Code Patch Available</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRefactored(prev => !prev)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-stone-300 transition-colors cursor-pointer"
                >
                  {showRefactored ? 'Hide Clean Code' : 'Preview Patch'}
                </button>
                {onApplyFix && (
                  <button
                    type="button"
                    onClick={handleApply}
                    className="px-3 py-1 rounded-lg text-[11px] font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    {appliedFix ? <Check size={12} /> : <Wrench size={12} />}
                    <span>{appliedFix ? 'Fix Applied!' : '1-Click Apply Fix'}</span>
                  </button>
                )}
              </div>
            </div>

            {showRefactored && (
              <pre className="p-3 text-[11px] font-mono text-emerald-200 bg-black/80 rounded-lg overflow-x-auto border border-emerald-500/30">
                <code>{refactoredCode}</code>
              </pre>
            )}
          </div>
        )}

        {/* Quality & Performance Notes */}
        {qualityNotes.length > 0 && (
          <div className="p-3 rounded-xl bg-stone-900/60 border border-stone-800 space-y-1.5">
            <span className="text-[11px] font-bold text-stone-300 flex items-center gap-1.5">
              <Zap size={11} className="text-orange-400" /> Code Quality & Best Practice Telemetry
            </span>
            <ul className="space-y-1 text-[11px] text-stone-400 list-disc list-inside">
              {qualityNotes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* BEAUTIFIED MARKDOWN RENDERER (NO RAW ASTERISKS) */}
        {!isStructured && parsedMarkdown && (
          <div className="space-y-3">
            {/* Friendly Intro Callout */}
            {parsedMarkdown.intro && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent border border-orange-500/20 text-stone-200 leading-relaxed text-xs flex items-start gap-2.5">
                <Sparkles size={16} className="text-orange-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{renderInlineMarkdown(parsedMarkdown.intro)}</p>
                </div>
              </div>
            )}

            {/* Parsed Sections rendered as sleek cards */}
            {parsedMarkdown.sections.map((section, sIdx) => {
              const theme = getSectionTheme(section.title, section.icon);

              return (
                <div
                  key={sIdx}
                  className={`p-3.5 rounded-xl border ${theme.cardBg} space-y-2.5 shadow-sm`}
                >
                  {/* Section Title Header */}
                  <div className="flex items-center gap-2 pb-1.5 border-b border-white/5">
                    <span className="text-base leading-none">{section.icon || '💡'}</span>
                    <h3 className={`font-bold text-xs uppercase tracking-wide ${theme.titleColor}`}>
                      {section.title}
                    </h3>
                  </div>

                  {/* Section Items */}
                  <div className="space-y-2">
                    {section.items.map((item, iIdx) => {
                      if (item.type === 'bullet_titled') {
                        return (
                          <div key={iIdx} className="flex items-start gap-2 text-stone-300 leading-relaxed text-[12px]">
                            <span className={`w-1.5 h-1.5 rounded-full ${theme.dotBg} shrink-0 mt-1.5`} />
                            <div className="flex-1">
                              <span className="font-bold text-amber-200 mr-1.5 inline">
                                {item.title}:
                              </span>
                              <span className="text-stone-300">
                                {renderInlineMarkdown(item.text)}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      if (item.type === 'bullet') {
                        return (
                          <div key={iIdx} className="flex items-start gap-2 text-stone-300 leading-relaxed text-[12px]">
                            <span className={`w-1.5 h-1.5 rounded-full ${theme.dotBg} shrink-0 mt-1.5`} />
                            <div className="flex-1">
                              {renderInlineMarkdown(item.text)}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <p key={iIdx} className="text-stone-300 leading-relaxed text-[12px]">
                          {renderInlineMarkdown(item.text)}
                        </p>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2.5 bg-[#170f0a] border-t border-[#2e1f15] text-[10px] text-stone-400 flex items-center justify-between flex-wrap gap-2">
        <span className="flex items-center gap-1.5">
          <Shield size={10} className="text-emerald-400" />
          <span>Connectra AppSec & Code Intelligence Engine</span>
        </span>
        <span className="opacity-75 font-mono">Powered by Groq LPUs</span>
      </div>
    </motion.div>
  );
}
