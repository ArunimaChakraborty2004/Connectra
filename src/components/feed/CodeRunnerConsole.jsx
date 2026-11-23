import { useState } from 'react';
import { Play, RotateCcw, Terminal, X, Loader2, Globe, CornerDownLeft } from 'lucide-react';

// ---------------------------------------------------------------------------
// Wandbox API – Completely free, NO API key, CORS-enabled, official public API
// Supports C, C++, Java, Python, Rust, Go, C#, PHP, Ruby, Bash, etc.
// ---------------------------------------------------------------------------
const WANDBOX_API = 'https://wandbox.org/api/compile.json';

const COMPILER_MAP = {
  // C / C++
  cpp:        { compiler: 'gcc-head',        label: 'C++' },
  'c++':      { compiler: 'gcc-head',        label: 'C++' },
  c:          { compiler: 'gcc-head-c',      label: 'C' },
  // Python - full standard library with real stdin input support
  python:     { compiler: 'cpython-3.12.16', label: 'Python 3' },
  py:         { compiler: 'cpython-3.12.16', label: 'Python 3' },
  // Java - automatically normalize 'public class' to 'class' for single-file run
  java:       { compiler: 'openjdk-jdk-22+36', label: 'Java', normalize: (c) => c.replace(/\bpublic\s+class\b/g, 'class') },
  // Rust
  rust:       { compiler: 'rust-1.100.0',    label: 'Rust' },
  rs:         { compiler: 'rust-1.100.0',    label: 'Rust' },
  // Go
  go:         { compiler: 'go-1.27.4',       label: 'Go' },
  golang:     { compiler: 'go-1.27.4',       label: 'Go' },
  // C#
  cs:         { compiler: 'mono-6.12.0.199', label: 'C#' },
  csharp:     { compiler: 'mono-6.12.0.199', label: 'C#' },
  // Ruby
  ruby:       { compiler: 'ruby-4.0.2',      label: 'Ruby' },
  rb:         { compiler: 'ruby-4.0.2',      label: 'Ruby' },
  // PHP
  php:        { compiler: 'php-8.3.12',      label: 'PHP' },
  // Swift
  swift:      { compiler: 'swift-6.0.1',     label: 'Swift' },
  // Lua
  lua:        { compiler: 'lua-5.4.7',       label: 'Lua' },
  // Haskell
  haskell:    { compiler: 'ghc-9.10.1',      label: 'Haskell' },
  hs:         { compiler: 'ghc-9.10.1',      label: 'Haskell' },
  // Shell / Bash
  bash:       { compiler: 'bash',            label: 'Bash' },
  sh:         { compiler: 'bash',            label: 'Bash' },
  shell:      { compiler: 'bash',            label: 'Bash' },
  // R
  r:          { compiler: 'r-4.4.1',         label: 'R' },
  // Scala
  scala:      { compiler: 'scala-3.5.1',     label: 'Scala' },
  // Julia
  julia:      { compiler: 'julia-1.10.5',    label: 'Julia' },
  // SQL
  sql:        { compiler: 'sqlite-3.46.1',   label: 'SQLite' },
};

function getLangConfig(lang) {
  const clean = (lang || 'javascript').toLowerCase().trim();
  if (['javascript', 'js'].includes(clean)) return { isJs: true, label: 'JavaScript' };
  if (['typescript', 'ts'].includes(clean)) return { isJs: true, label: 'TypeScript' };
  return COMPILER_MAP[clean] || null;
}

export default function CodeRunnerConsole({ code, language = 'javascript' }) {
  const [output, setOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [executionTime, setExTime] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [stdin, setStdin] = useState('');
  const [showStdin, setShowStdin] = useState(false);

  const langConfig = getLangConfig(language);
  if (!langConfig) return null;

  // -------------------------------------------------------------------------
  // Run JavaScript / TypeScript client-side in-browser
  // -------------------------------------------------------------------------
  const runClientJs = async (logs) => {
    let executableJs = code
      .replace(/export\s+(default\s+)?/g, '')
      .replace(/import\s+.*?(\n|;)/g, '')
      .replace(/:\s*[A-Za-z][A-Za-z0-9_<>\[\]|&?]*(?=\s*[=,);])/g, '');

    const customConsole = {
      log: (...a) => logs.push({ type: 'log', text: a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ') }),
      error: (...a) => logs.push({ type: 'error', text: a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ') }),
      warn: (...a) => logs.push({ type: 'warn', text: a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ') }),
      info: (...a) => logs.push({ type: 'info', text: a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ') }),
    };

    const hasAwait = /\bawait\b/.test(executableJs);
    const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
    const FuncCtor = hasAwait ? AsyncFn : Function;

    const runner = new FuncCtor('console', `
      "use strict";
      try {
        ${executableJs}
      } catch(e) {
        console.error(e.message || String(e));
      }
    `);
    await runner(customConsole);

    if (logs.length === 0) {
      logs.push({ type: 'info', text: 'Executed with no console output.' });
    }
  };

  // -------------------------------------------------------------------------
  // Run multi-language compiler via Wandbox
  // -------------------------------------------------------------------------
  const runWandbox = async (logs) => {
    logs.push({ type: 'info', text: `Compiling & running ${langConfig.label}...` });
    setOutput([...logs]);

    let sourceCode = code;
    if (langConfig.normalize) {
      sourceCode = langConfig.normalize(sourceCode);
    }

    const payload = {
      compiler: langConfig.compiler,
      code: sourceCode,
    };

    if (stdin.trim()) {
      payload.stdin = stdin.endsWith('\n') ? stdin : `${stdin}\n`;
    }

    const res = await fetch(WANDBOX_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Compiler service error (${res.status})`);
    }

    const data = await res.json();

    if (data.compiler_error) {
      data.compiler_error.trimEnd().split('\n').forEach(line => logs.push({ type: 'error', text: line }));
    }
    if (data.compiler_message && !data.compiler_error) {
      data.compiler_message.trimEnd().split('\n').forEach(line => logs.push({ type: 'warn', text: line }));
    }
    if (data.program_output) {
      data.program_output.trimEnd().split('\n').forEach(line => logs.push({ type: 'log', text: line }));
    }
    if (data.program_error) {
      data.program_error.trimEnd().split('\n').forEach(line => logs.push({ type: 'error', text: line }));
    }

    if (logs.filter(l => l.type !== 'info').length === 0) {
      logs.push({ type: 'info', text: 'Program completed with no output (Exit status: 0).' });
    }
  };

  // -------------------------------------------------------------------------
  // Main execution dispatcher
  // -------------------------------------------------------------------------
  const runCode = async () => {
    setIsRunning(true);
    setIsOpen(true);
    setOutput([]);
    const start = performance.now();
    const logs = [];

    try {
      if (langConfig.isJs) {
        await runClientJs(logs);
      } else {
        await runWandbox(logs);
      }
    } catch (err) {
      logs.push({ type: 'error', text: `Execution Error: ${err.message || String(err)}` });
    } finally {
      setExTime((performance.now() - start).toFixed(0));
      setOutput([...logs]);
      setIsRunning(false);
    }
  };

  return (
    <div className="mt-2 border-t border-[#4f382a]/70 pt-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runCode}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 size={12} className="animate-spin text-white" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play size={12} className="fill-white" />
                <span>Run {langConfig.label}</span>
              </>
            )}
          </button>

          {!langConfig.isJs && (
            <button
              type="button"
              onClick={() => setShowStdin(!showStdin)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                showStdin || stdin
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Provide standard input (stdin) for programs that ask for input"
            >
              <CornerDownLeft size={10} />
              <span>Input / Stdin{stdin ? ' (set)' : ''}</span>
            </button>
          )}
        </div>

        {isOpen && (
          <div className="flex items-center gap-2 ml-auto">
            {executionTime && (
              <span className="text-[10px] font-mono text-stone-400">
                {executionTime}ms
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
              title="Close console"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {showStdin && (
        <div className="mt-2 p-2 rounded-lg bg-stone-900 border border-stone-800">
          <div className="text-[11px] text-stone-400 font-mono mb-1 flex items-center justify-between">
            <span>Standard Input (stdin for input(), cin &gt;&gt;, Scanner, etc.):</span>
            {stdin && (
              <button
                type="button"
                onClick={() => setStdin('')}
                className="text-stone-500 hover:text-stone-300 text-[10px]"
              >
                Clear
              </button>
            )}
          </div>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Type input here (e.g. numbers, words on each line)..."
            rows={2}
            className="w-full bg-black/60 border border-stone-800 rounded p-1.5 font-mono text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-emerald-600/60"
          />
        </div>
      )}

      {isOpen && (
        <div className="mt-2 rounded-xl bg-black/90 border border-stone-800 p-3 font-mono text-xs overflow-hidden shadow-inner">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-stone-800 text-[11px] text-stone-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Terminal size={12} />
              <span>Console Output ({langConfig.label})</span>
            </span>
            <button
              type="button"
              onClick={() => setOutput([])}
              className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            >
              <RotateCcw size={10} /> Clear
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 select-text">
            {output.length === 0 && !isRunning && (
              <span className="text-stone-500 text-[11px] italic">
                Console ready. Click Run to compile and execute.
              </span>
            )}
            {isRunning && output.length === 0 && (
              <span className="text-stone-400 text-[11px] italic flex items-center gap-1.5">
                <Loader2 size={10} className="animate-spin" /> Compiling & executing...
              </span>
            )}
            {output.map((line, idx) => (
              <div
                key={idx}
                className={`whitespace-pre-wrap leading-relaxed ${
                  line.type === 'error'
                    ? 'text-rose-400 font-semibold bg-rose-950/30 px-1 py-0.5 rounded'
                    : line.type === 'warn'
                    ? 'text-amber-300'
                    : line.type === 'info'
                    ? 'text-blue-300/80 italic text-[11px]'
                    : 'text-emerald-300'
                }`}
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
