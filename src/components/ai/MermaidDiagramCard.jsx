import { useState, useEffect, useRef } from 'react';
import { Download, Image as ImageIcon, Copy, Check, Maximize2, Minimize2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { getMermaid, exportSvgToFile, exportSvgToPng } from '../../lib/mermaidRenderer';

export default function MermaidDiagramCard({ code, isDark = false }) {
  const containerRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  // Clean code string
  const cleanedCode = (code || '')
    .replace(/^```(?:mermaid)?/i, '')
    .replace(/```$/, '')
    .trim();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const renderDiagram = async () => {
      if (!cleanedCode) {
        setLoading(false);
        return;
      }

      try {
        const mermaid = await getMermaid(isDark);
        if (!mermaid) {
          throw new Error('Mermaid renderer unavailable');
        }

        const id = `mermaid-diag-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(id, cleanedCode);

        if (isMounted) {
          setSvgContent(svg);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Mermaid rendering notice:', err.message);
        if (isMounted) {
          setError(err.message || 'Syntax error in Mermaid diagram');
          setLoading(false);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [cleanedCode, isDark]);

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleExportSvg = () => {
    const svgEl = containerRef.current?.querySelector('svg');
    if (svgEl) {
      exportSvgToFile(svgEl, 'connectra-architecture.svg');
    }
  };

  const handleExportPng = () => {
    const svgEl = containerRef.current?.querySelector('svg');
    if (svgEl) {
      exportSvgToPng(svgEl, 'connectra-architecture.png');
    }
  };

  return (
    <div className={`my-3 rounded-2xl overflow-hidden border shadow-md transition-all ${
      isDark
        ? 'bg-[#120c08] border-orange-500/20 text-orange-200'
        : 'bg-[#fffaf5] border-orange-200 text-[#2b1f17]'
    }`}>
      {/* Card Header & Export Controls */}
      <div className={`px-3.5 py-2 flex items-center justify-between gap-2 border-b text-xs flex-wrap ${
        isDark ? 'bg-[#1f150f] border-orange-500/10' : 'bg-orange-50/80 border-orange-200/80'
      }`}>
        <div className="flex items-center gap-1.5 font-bold">
          <Layers size={14} className="text-[#ea580c]" />
          <span className="text-[11px] uppercase tracking-wider font-mono text-[#ea580c]">
            Interactive Architecture Diagram
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleCopy}
            className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer ${
              isDark
                ? 'bg-stone-800/80 hover:bg-stone-800 text-stone-200 border border-stone-700/50'
                : 'bg-white hover:bg-orange-50 text-[#8d7565] border border-[#f1e4d3]'
            }`}
            title="Copy Mermaid source code"
          >
            {copiedCode ? (
              <>
                <Check size={11} className="text-emerald-500" /> Copied
              </>
            ) : (
              <>
                <Copy size={11} /> Copy Code
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportSvg}
            disabled={!svgContent}
            className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer disabled:opacity-40 ${
              isDark
                ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30'
                : 'bg-orange-100 hover:bg-orange-200/80 text-[#ea580c] border border-orange-300/60'
            }`}
            title="Export as vector SVG"
          >
            <Download size={11} /> Export SVG
          </button>

          <button
            type="button"
            onClick={handleExportPng}
            disabled={!svgContent}
            className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-md bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white hover:brightness-105 transition-all cursor-pointer shadow-2xs disabled:opacity-40"
            title="Export high-resolution PNG (2x Scale)"
          >
            <ImageIcon size={11} /> Export PNG (2x HD)
          </button>

          <button
            type="button"
            onClick={() => setIsZoomed(!isZoomed)}
            className={`p-1 rounded-md transition-all cursor-pointer ${
              isDark ? 'text-stone-400 hover:text-white' : 'text-[#8d7565] hover:text-[#2b1f17]'
            }`}
            title={isZoomed ? 'Shrink diagram' : 'Expand full width'}
          >
            {isZoomed ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Diagram Canvas Body */}
      <div
        ref={containerRef}
        className={`p-4 overflow-x-auto flex items-center justify-center transition-all ${
          isZoomed ? 'min-h-[480px] max-h-[800px]' : 'min-h-[220px] max-h-[440px]'
        } ${isDark ? 'bg-[#100a06]' : 'bg-[#fcf8f3]'}`}
      >
        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-xs text-[#8d7565]">
            <RefreshCw size={18} className="animate-spin text-[#ea580c]" />
            <span>Rendering live vector architecture...</span>
          </div>
        )}

        {!loading && error && (
          <div className="w-full text-left space-y-2">
            <div className="flex items-center gap-2 text-rose-500 text-xs font-semibold">
              <AlertCircle size={14} />
              <span>Diagram Rendering Notice</span>
            </div>
            <pre className="p-3 text-[11px] font-mono bg-stone-900 text-amber-300 rounded-xl overflow-x-auto">
              <code>{cleanedCode}</code>
            </pre>
          </div>
        )}

        {!loading && !error && svgContent && (
          <div
            className="w-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto transition-transform"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
      </div>

      {/* Footer Hint */}
      <div className={`px-3 py-1.5 border-t text-[10px] flex items-center justify-between ${
        isDark ? 'bg-[#180f0a] border-orange-500/10 text-stone-400' : 'bg-orange-50/40 border-orange-200/50 text-[#8d7565]'
      }`}>
        <span>Rendered live via Mermaid.js Vector Engine</span>
        <span>Ready for export</span>
      </div>
    </div>
  );
}
