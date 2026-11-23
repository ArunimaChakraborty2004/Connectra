import { useState, useRef, useEffect } from 'react';
import { Play, RotateCcw, Terminal, X, Loader2, Send, CornerDownLeft, Zap } from 'lucide-react';

// ---------------------------------------------------------------------------
// High-Speed Godbolt API (AWS high-concurrency clusters, ~1-2s response)
// ---------------------------------------------------------------------------
const GODBOLT_MAP = {
  cpp:    { id: 'g142',      userArgs: '-std=c++20 -O2', label: 'C++' },
  'c++':  { id: 'g142',      userArgs: '-std=c++20 -O2', label: 'C++' },
  c:      { id: 'cg142',     userArgs: '-std=c17 -O2',   label: 'C'   },
  rust:   { id: 'rustc1800', userArgs: '-O',             label: 'Rust'},
  rs:     { id: 'rustc1800', userArgs: '-O',             label: 'Rust'},
  go:     { id: 'go1220',    userArgs: '',               label: 'Go'  },
  golang: { id: 'go1220',    userArgs: '',               label: 'Go'  },
};

// ---------------------------------------------------------------------------
// Wandbox API (Fallback and extended languages)
// ---------------------------------------------------------------------------
const WANDBOX_API = 'https://wandbox.org/api/compile.json';

const WANDBOX_MAP = {
  python:     { compiler: 'cpython-3.12.16', fallback: 'cpython-3.11.18', label: 'Python 3' },
  py:         { compiler: 'cpython-3.12.16', fallback: 'cpython-3.11.18', label: 'Python 3' },
  java:       { compiler: 'openjdk-jdk-22+36', label: 'Java', normalize: (c) => c.replace(/\bpublic\s+class\b/g, 'class') },
  cs:         { compiler: 'mono-6.12.0.199', label: 'C#' },
  csharp:     { compiler: 'mono-6.12.0.199', label: 'C#' },
  ruby:       { compiler: 'ruby-4.0.2',      label: 'Ruby' },
  rb:         { compiler: 'ruby-4.0.2',      label: 'Ruby' },
  php:        { compiler: 'php-8.3.12',      label: 'PHP' },
  swift:      { compiler: 'swift-6.0.1',     label: 'Swift' },
  lua:        { compiler: 'lua-5.4.7',       label: 'Lua' },
  bash:       { compiler: 'bash',            label: 'Bash' },
  sh:         { compiler: 'bash',            label: 'Bash' },
  sql:        { compiler: 'sqlite-3.46.1',   label: 'SQLite' },
};

function stripAnsi(text) {
  if (!text) return '';
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

function getLangConfig(lang) {
  const clean = (lang || 'javascript').toLowerCase().trim();
  if (['javascript', 'js'].includes(clean)) return { isJs: true, label: 'JavaScript' };
  if (['typescript', 'ts'].includes(clean)) return { isJs: true, label: 'TypeScript' };
  if (GODBOLT_MAP[clean]) return { isGodbolt: true, ...GODBOLT_MAP[clean] };
  if (WANDBOX_MAP[clean]) return { isWandbox: true, ...WANDBOX_MAP[clean] };
  return null;
}

export default function CodeRunnerConsole({ code, language = 'javascript' }) {
  const [output, setOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [executionTime, setExTime] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [stdin, setStdin] = useState('');
  const [interactiveInput, setInteractiveInput] = useState('');
  const [showStdinPanel, setShowStdinPanel] = useState(false);

  const consoleEndRef = useRef(null);
  const inputRef = useRef(null);

  const langConfig = getLangConfig(language);
  if (!langConfig) return null;

  useEffect(() => {
    if (isOpen && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output, isOpen]);

  const codeExpectsInput =
    /\b(cin\s*>>|scanf\s*\(|getline\s*\(|input\s*\(|Scanner\b|BufferedReader\b|System\.in\b|gets\s*\()/i.test(code || '');

  const lastLine = output.length > 0 ? output[output.length - 1]?.text || '' : '';
  const waitingForInput = codeExpectsInput || /(:|\?|>)\s*$/.test(lastLine.trim());

  // -------------------------------------------------------------------------
  // 1. Client-Side JavaScript / TypeScript (Instant ~5ms)
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
      try { ${executableJs} } catch(e) { console.error(e.message || String(e)); }
    `);
    await runner(customConsole);

    if (logs.length === 0) logs.push({ type: 'info', text: 'Executed with no console output.' });
  };

  // -------------------------------------------------------------------------
  // 2. High-Speed Godbolt Engine (C++, C, Rust, Go — ~1-2s response)
  // -------------------------------------------------------------------------
  const runGodbolt = async (logs, currentStdin) => {
    logs.push({ type: 'info', text: `Fast compiling ${langConfig.label} (Godbolt Cloud)...` });
    setOutput([...logs]);

    const endpoint = `https://godbolt.org/api/compiler/${langConfig.id}/compile`;
    const payload = {
      source: code,
      options: {
        userArguments: langConfig.userArgs || '',
        executeParameters: {
          args: [],
          stdin: currentStdin ? (currentStdin.endsWith('\n') ? currentStdin : `${currentStdin}\n`) : '',
        },
        filters: { execute: true },
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Godbolt API returned ${res.status}`);
    const data = await res.json();

    // Compiler errors
    if (data.stderr && data.stderr.length > 0) {
      data.stderr.forEach(item => {
        const clean = stripAnsi(item.text || item);
        if (clean.trim()) logs.push({ type: 'error', text: clean });
      });
    }

    // Program stdout
    if (data.execResult?.stdout && data.execResult.stdout.length > 0) {
      data.execResult.stdout.forEach(item => {
        const clean = stripAnsi(item.text || item);
        if (clean !== '') logs.push({ type: 'log', text: clean });
      });
    }

    // Program stderr (runtime errors)
    if (data.execResult?.stderr && data.execResult.stderr.length > 0) {
      data.execResult.stderr.forEach(item => {
        const clean = stripAnsi(item.text || item);
        if (clean.trim()) logs.push({ type: 'error', text: clean });
      });
    }

    if (logs.filter(l => l.type !== 'info').length === 0) {
      logs.push({ type: 'info', text: 'Program completed with no output (Exit: 0).' });
    }
  };

  // -------------------------------------------------------------------------
  // 3. Wandbox Multi-Language Engine (Python, Java, etc.)
  // -------------------------------------------------------------------------
  const runWandbox = async (logs, currentStdin) => {
    logs.push({ type: 'info', text: `Compiling & running ${langConfig.label}...` });
    setOutput([...logs]);

    let sourceCode = code;
    if (langConfig.normalize) sourceCode = langConfig.normalize(sourceCode);

    const compileWith = async (compilerName) => {
      const payload = { compiler: compilerName, code: sourceCode };
      if (currentStdin && currentStdin.trim()) {
        payload.stdin = currentStdin.endsWith('\n') ? currentStdin : `${currentStdin}\n`;
      }
      const res = await fetch(WANDBOX_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Service status (${res.status})`);
      return res.json();
    };

    let data = await compileWith(langConfig.compiler);
    const hasOciError = (data.compiler_error || '').includes('OCI runtime error') ||
                        (data.compiler_error || '').includes('Resource temporarily unavailable');

    if (hasOciError && langConfig.fallback) {
      logs.push({ type: 'warn', text: `Compiler busy, retrying with ${langConfig.fallback}...` });
      setOutput([...logs]);
      data = await compileWith(langConfig.fallback);
    }

    if (data.compiler_error) {
      data.compiler_error.trimEnd().split('\n').forEach(l => logs.push({ type: 'error', text: l }));
    }
    if (data.program_output) {
      data.program_output.trimEnd().split('\n').forEach(l => logs.push({ type: 'log', text: l }));
    }
    if (data.program_error) {
      data.program_error.trimEnd().split('\n').forEach(l => logs.push({ type: 'error', text: l }));
    }

    if (logs.filter(l => l.type !== 'info').length === 0) {
      logs.push({ type: 'info', text: 'Program completed with no output (Exit: 0).' });
    }
  };

  // -------------------------------------------------------------------------
  // Execution Dispatcher
  // -------------------------------------------------------------------------
  const executeCode = async (stdinToUse = stdin) => {
    setIsRunning(true);
    setIsOpen(true);
    setOutput([]);
    const start = performance.now();
    const logs = [];

    try {
      if (langConfig.isJs) {
        await runClientJs(logs);
      } else if (langConfig.isGodbolt) {
        await runGodbolt(logs, stdinToUse);
      } else {
        await runWandbox(logs, stdinToUse);
      }
    } catch (err) {
      logs.push({ type: 'error', text: `Execution Error: ${err.message || String(err)}` });
    } finally {
      setExTime((performance.now() - start).toFixed(0));
      setOutput([...logs]);
      setIsRunning(false);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
    }
  };

  // -------------------------------------------------------------------------
  // Interactive Terminal Input Handler
  // -------------------------------------------------------------------------
  const handleSendInput = (e) => {
    e.preventDefault();
    if (!interactiveInput.trim()) return;

    const value = interactiveInput.trim();
    const nextStdin = stdin ? `${stdin}\n${value}` : value;
    setStdin(nextStdin);
    setInteractiveInput('');
    executeCode(nextStdin);
  };

  return (
    <div className="mt-2 border-t border-[#4f382a]/70 pt-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => executeCode(stdin)}
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

          {langConfig.isGodbolt && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400/90 font-mono">
              <Zap size={10} /> Fast Cloud
            </span>
          )}

          {!langConfig.isJs && (
            <button
              type="button"
              onClick={() => setShowStdinPanel(!showStdinPanel)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                showStdinPanel || stdin
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Configure multi-line standard input"
            >
              <CornerDownLeft size={10} />
              <span>Multi-line Stdin{stdin ? ' (active)' : ''}</span>
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

      {showStdinPanel && (
        <div className="mt-2 p-2.5 rounded-xl bg-stone-900/90 border border-stone-800">
          <div className="text-[11px] text-stone-300 font-mono mb-1.5 flex items-center justify-between">
            <span className="font-semibold text-amber-300">Preset Input (cin, input(), Scanner):</span>
            {stdin && (
              <button
                type="button"
                onClick={() => setStdin('')}
                className="text-stone-400 hover:text-rose-400 text-[10px] cursor-pointer"
              >
                Clear Preset
              </button>
            )}
          </div>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Enter all inputs here ahead of time (one value per line)..."
            rows={2}
            className="w-full bg-black/70 border border-stone-800 rounded-lg p-2 font-mono text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-emerald-600/60"
          />
        </div>
      )}

      {isOpen && (
        <div className="mt-2 rounded-xl bg-black/95 border border-stone-800 p-3 font-mono text-xs overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-stone-800 text-[11px] text-stone-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Terminal size={12} />
              <span>Console Output ({langConfig.label})</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setOutput([]);
                setStdin('');
              }}
              className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            >
              <RotateCcw size={10} /> Reset & Clear
            </button>
          </div>

          {/* Terminal Output Area */}
          <div className="max-h-60 overflow-y-auto space-y-1 select-text pr-1">
            {output.length === 0 && !isRunning && (
              <span className="text-stone-500 text-[11px] italic">
                Console ready. Click Run to compile and execute.
              </span>
            )}
            {isRunning && output.length === 0 && (
              <span className="text-stone-400 text-[11px] italic flex items-center gap-1.5">
                <Loader2 size={10} className="animate-spin text-emerald-400" /> Compiling & executing...
              </span>
            )}
            {output.map((line, idx) => (
              <div
                key={idx}
                className={`whitespace-pre-wrap leading-relaxed ${
                  line.type === 'error'
                    ? 'text-rose-400 font-semibold bg-rose-950/30 px-1.5 py-0.5 rounded'
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
            <div ref={consoleEndRef} />
          </div>

          {/* Interactive Input Prompt Bar */}
          {!langConfig.isJs && (
            <form
              onSubmit={handleSendInput}
              className={`mt-2.5 pt-2 border-t flex items-center gap-2 transition-colors ${
                waitingForInput
                  ? 'border-amber-500/50 bg-amber-500/5 -mx-3 -mb-3 p-3 rounded-b-xl'
                  : 'border-stone-800'
              }`}
            >
              <span className="text-emerald-400 font-bold select-none text-xs flex items-center gap-1">
                <span>&gt;</span>
              </span>
              <input
                ref={inputRef}
                type="text"
                value={interactiveInput}
                onChange={(e) => setInteractiveInput(e.target.value)}
                disabled={isRunning}
                placeholder={
                  waitingForInput
                    ? 'Type your input here and press Enter (↵)...'
                    : 'Type input value and press Enter...'
                }
                className="flex-1 bg-black/60 border border-stone-800 focus:border-emerald-500/70 rounded px-2 py-1 text-emerald-300 placeholder-stone-600 font-mono text-xs focus:outline-none transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isRunning || !interactiveInput.trim()}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-mono text-xs font-semibold cursor-pointer transition-all"
                title="Send input to program"
              >
                <span>Enter</span>
                <Send size={10} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
