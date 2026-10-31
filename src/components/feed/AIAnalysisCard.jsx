import { useState } from 'react';
import { Shield, Sparkles, Check, Copy, X, AlertTriangle, CheckCircle2, Zap, Lightbulb, Code2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AIAnalysisCard({ content, type = 'security', onClose }) {
  const [copiedCodeIndex, setCopiedCodeIndex] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'security' | 'quality' | 'fix'

  if (!content) return null;

  // Determine overall security status
  const isClean =
    content.toLowerCase().includes('no critical vulnerabilities') ||
    content.toLowerCase().includes('no vulnerabilities detected') ||
    content.toLowerCase().includes('secure') && !content.toLowerCase().includes('high vulnerability');

  const handleCopyCode = (codeText, idx) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(idx);
    setTimeout(() => setCopiedCodeIndex(null), 2200);
  };

  // Helper to parse markdown-like bolding, inline code, and lists
  const renderInlineFormatted = (text) => {
    if (!text) return null;

    // Split on inline code `...`
    const codeParts = text.split(/(`[^`]+`)/g);

    return codeParts.map((cPart, cIdx) => {
      if (cPart.startsWith('`') && cPart.endsWith('`') && cPart.length > 2) {
        return (
          <code
            key={cIdx}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-black/40 text-amber-300 font-mono text-[11px] border border-amber-500/20"
          >
            {cPart.slice(1, -1)}
          </code>
        );
      }

      // Split on **bold**
      const boldParts = cPart.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, bIdx) => {
        if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length > 4) {
          return (
            <strong key={`${cIdx}-${bIdx}`} className="font-bold text-amber-100">
              {bPart.slice(2, -2)}
            </strong>
          );
        }
        return bPart;
      });
    });
  };

  // Parse structured blocks from AI output
  const parseBlocks = (rawText) => {
    const lines = rawText.split('\n');
    const blocks = [];
    let currentBlock = null;
    let codeBuffer = [];
    let inCode = false;
    let codeLang = 'code';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle Code Block start/end
      if (line.trim().startsWith('```')) {
        if (!inCode) {
          inCode = true;
          codeLang = line.trim().replace(/^```/, '').trim() || 'code';
          codeBuffer = [];
        } else {
          inCode = false;
          if (currentBlock) {
            currentBlock.items.push({
              type: 'code',
              lang: codeLang,
              code: codeBuffer.join('\n'),
            });
          } else {
            blocks.push({
              title: 'Code Snippet',
              icon: 'code',
              items: [{ type: 'code', lang: codeLang, code: codeBuffer.join('\n') }],
            });
          }
          codeBuffer = [];
        }
        continue;
      }

      if (inCode) {
        codeBuffer.push(line);
        continue;
      }

      // Headings: #, ##, ###
      if (line.trim().startsWith('#')) {
        const cleanTitle = line.replace(/^#+\s*/, '').trim();
        let iconType = 'info';
        if (cleanTitle.toLowerCase().includes('security') || cleanTitle.toLowerCase().includes('safety')) iconType = 'security';
        else if (cleanTitle.toLowerCase().includes('quality') || cleanTitle.toLowerCase().includes('performance')) iconType = 'quality';
        else if (cleanTitle.toLowerCase().includes('fix') || cleanTitle.toLowerCase().includes('refactor') || cleanTitle.toLowerCase().includes('suggested')) iconType = 'fix';

        currentBlock = {
          title: cleanTitle,
          icon: iconType,
          items: [],
        };
        blocks.push(currentBlock);
        continue;
      }

      // Bullets: *, -, •
      if (line.trim().match(/^[*•-]\s+/)) {
        const bulletContent = line.trim().replace(/^[*•-]\s+/, '').trim();
        if (currentBlock) {
          currentBlock.items.push({ type: 'bullet', text: bulletContent });
        } else {
          currentBlock = {
            title: 'Key Findings',
            icon: 'info',
            items: [{ type: 'bullet', text: bulletContent }],
          };
          blocks.push(currentBlock);
        }
        continue;
      }

      // Regular text / paragraph
      if (line.trim().length > 0) {
        if (!currentBlock) {
          currentBlock = {
            title: type === 'security' ? 'Executive Summary' : 'Overview',
            icon: 'info',
            items: [],
          };
          blocks.push(currentBlock);
        }
        currentBlock.items.push({ type: 'text', text: line.trim() });
      }
    }

    return blocks;
  };

  const sections = parseBlocks(content);

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
              type === 'security'
                ? isClean
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
            }`}
          >
            {type === 'security' ? (
              isClean ? (
                <Shield size={15} className="text-emerald-400" />
              ) : (
                <AlertTriangle size={15} className="text-amber-400" />
              )
            ) : (
              <Sparkles size={15} className="text-orange-400" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs uppercase tracking-wider text-orange-400">
                {type === 'security' ? 'AI Security & Vulnerability Audit' : 'AI Code Intelligence Breakdown'}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-500/10 text-orange-400/90 border border-orange-500/20 font-mono">
                AppSec v2
              </span>
            </div>
            <div className="text-[11px] text-stone-400 flex items-center gap-2">
              <span>Automated static inspection & runtime telemetry</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Security Status Pill */}
          {type === 'security' && (
            <div
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-xs ${
                isClean
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/40'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-600/40'
              }`}
            >
              {isClean ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              <span>{isClean ? 'Clean / No Critical Bugs' : 'Security Advisory'}</span>
            </div>
          )}

          {/* Close button */}
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

      {/* Main Content Body */}
      <div className="p-4 space-y-4 text-xs">
        {sections.length === 0 ? (
          <div className="text-stone-400 py-2">{content}</div>
        ) : (
          sections.map((section, sIdx) => {
            const isSecuritySection = section.icon === 'security';
            const isQualitySection = section.icon === 'quality';
            const isFixSection = section.icon === 'fix';

            return (
              <div
                key={sIdx}
                className={`p-3.5 rounded-xl border transition-all ${
                  isSecuritySection
                    ? isClean
                      ? 'bg-emerald-950/20 border-emerald-800/30 shadow-xs'
                      : 'bg-amber-950/20 border-amber-800/30 shadow-xs'
                    : isQualitySection
                    ? 'bg-[#221710]/70 border-[#3d2a1d]'
                    : isFixSection
                    ? 'bg-[#1a110a] border-orange-500/30'
                    : 'bg-[#20150e]/60 border-[#38261a]'
                }`}
              >
                {/* Section Header */}
                <div className="flex items-center justify-between gap-2 mb-2.5 pb-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`p-1 rounded-md text-[13px] ${
                        isSecuritySection
                          ? isClean
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                          : isQualitySection
                          ? 'bg-blue-500/20 text-blue-400'
                          : isFixSection
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-stone-500/20 text-stone-300'
                      }`}
                    >
                      {isSecuritySection ? (
                        <Shield size={13} />
                      ) : isQualitySection ? (
                        <Zap size={13} />
                      ) : isFixSection ? (
                        <Lightbulb size={13} />
                      ) : (
                        <Code2 size={13} />
                      )}
                    </span>
                    <h4 className="font-bold text-[12px] text-stone-100 tracking-wide">
                      {section.title}
                    </h4>
                  </div>
                </div>

                {/* Section Items */}
                <div className="space-y-2">
                  {section.items.map((item, iIdx) => {
                    if (item.type === 'code') {
                      return (
                        <div
                          key={iIdx}
                          className="rounded-xl overflow-hidden border border-orange-500/20 bg-[#0c0906] shadow-md my-2"
                        >
                          <div className="px-3 py-1.5 bg-[#17100b] border-b border-orange-500/10 flex items-center justify-between text-[11px] text-orange-300">
                            <span className="font-mono uppercase font-bold text-[10px] tracking-wider text-orange-400/90 flex items-center gap-1.5">
                              <Code2 size={11} /> {item.lang || 'code'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(item.code, `${sIdx}-${iIdx}`)}
                              className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 transition-colors cursor-pointer"
                            >
                              {copiedCodeIndex === `${sIdx}-${iIdx}` ? (
                                <>
                                  <Check size={11} className="text-emerald-400" /> Copied!
                                </>
                              ) : (
                                <>
                                  <Copy size={11} /> Copy Code
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="p-3 text-xs font-mono text-amber-200 overflow-x-auto leading-relaxed">
                            <code>{item.code}</code>
                          </pre>
                        </div>
                      );
                    }

                    if (item.type === 'bullet') {
                      return (
                        <div key={iIdx} className="flex items-start gap-2.5 text-stone-300 leading-relaxed text-[12px]">
                          <span
                            className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                              isSecuritySection
                                ? isClean
                                  ? 'bg-emerald-400'
                                  : 'bg-amber-400'
                                : isQualitySection
                                ? 'bg-orange-400'
                                : 'bg-stone-400'
                            }`}
                          />
                          <div className="flex-1">{renderInlineFormatted(item.text)}</div>
                        </div>
                      );
                    }

                    return (
                      <p key={iIdx} className="text-stone-300 leading-relaxed text-[12px]">
                        {renderInlineFormatted(item.text)}
                      </p>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-[#170f0a] border-t border-[#2e1f15] text-[10px] text-stone-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Shield size={10} className="text-emerald-400" />
          <span>Verified by Connectra AppSec Auditor</span>
        </span>
        <span className="opacity-75">AI Security Agent • Continuous Scan</span>
      </div>
    </motion.div>
  );
}
