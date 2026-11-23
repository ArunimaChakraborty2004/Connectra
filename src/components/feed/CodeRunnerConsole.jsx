import { useState, useRef } from 'react';
import { Play, RotateCcw, Terminal, X, Check, Loader2 } from 'lucide-react';

export default function CodeRunnerConsole({ code, language = 'javascript' }) {
  const [output, setOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [executionTime, setExecutionTime] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const pyodideRef = useRef(null);

  const cleanLang = (language || 'javascript').toLowerCase();
  const isExecutable = ['javascript', 'js', 'typescript', 'ts', 'python', 'py'].includes(cleanLang);

  const runCode = async () => {
    setIsRunning(true);
    setIsOpen(true);
    setOutput([]);
    const start = performance.now();

    const logs = [];
    const customConsole = {
      log: (...args) => logs.push({ type: 'log', text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
      error: (...args) => logs.push({ type: 'error', text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
      warn: (...args) => logs.push({ type: 'warn', text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
      info: (...args) => logs.push({ type: 'info', text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }),
    };

    try {
      if (['javascript', 'js', 'typescript', 'ts'].includes(cleanLang)) {
        // Strip TypeScript types or export/import keywords safely for browser evaluation
        let executableJs = code
          .replace(/export\s+(default\s+)?/g, '')
          .replace(/import\s+.*?;/g, '')
          .replace(/:\s*([A-Za-z0-9_<>\[\]]+)/g, ''); // basic type annotation stripping

        // Sandboxed AsyncFunction execution — supports await, const/let at top level
        const hasAwait = /\bawait\b/.test(executableJs);
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const FuncCtor = hasAwait ? AsyncFunction : Function;

        const runner = new FuncCtor('console', `
          try {
            ${executableJs}
          } catch(err) {
            console.error(err.message || String(err));
          }
        `);

        await runner(customConsole);

        if (logs.length === 0) {
          logs.push({ type: 'info', text: 'Program completed with no console output.' });
        }
      } else if (['python', 'py'].includes(cleanLang)) {
        // Dynamic loading of official Pyodide WebAssembly Python runtime
        logs.push({ type: 'info', text: 'Initializing WebAssembly Python 3.11 runtime (Pyodide)...' });
        setOutput([...logs]);

        if (!window.loadPyodide) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Pyodide runtime script'));
            document.head.appendChild(script);
          });
        }

        if (!pyodideRef.current) {
          logs.push({ type: 'info', text: 'Loading Python packages and stdlib...' });
          setOutput([...logs]);
          pyodideRef.current = await window.loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
          });
        }

        const pyodide = pyodideRef.current;

        // Redirect sys.stdout/stderr to pure-Python io.StringIO buffers BEFORE running code.
        // This is the ONLY reliable way — setStdout/setStderr still triggers OSError [Errno 29]
        // because Pyodide's underlying C file descriptor is broken in the browser.
        // io.StringIO is 100% in-memory Python, no OS file descriptors involved at all.
        pyodide.runPython(
`import sys, io
_cstdout_save = sys.stdout
_cstderr_save = sys.stderr
_cstdout = io.StringIO()
_cstderr = io.StringIO()
sys.stdout = _cstdout
sys.stderr = _cstderr`
        );

        try {
          await pyodide.runPythonAsync(code);
        } catch (pyErr) {
          // runPythonAsync throws a JS error when Python raises an exception.
          // Format the error message cleanly (strip "PythonError: " prefix if present).
          const raw = pyErr.message || String(pyErr);
          const clean = raw.startsWith('PythonError: ') ? raw.slice(13) : raw;
          logs.push({ type: 'error', text: clean });
        } finally {
          // Retrieve captured output then restore original streams
          const captured    = pyodide.runPython('_cstdout.getvalue()');
          const capturedErr = pyodide.runPython('_cstderr.getvalue()');

          pyodide.runPython(
`sys.stdout = _cstdout_save
sys.stderr = _cstderr_save`
          );

          if (captured && captured.trim()) {
            captured.trimEnd().split('\n').forEach(line => logs.push({ type: 'log', text: line }));
          }
          if (capturedErr && capturedErr.trim()) {
            capturedErr.trimEnd().split('\n').forEach(line => logs.push({ type: 'error', text: line }));
          }
        }

        if (logs.filter(l => l.type !== 'info').length === 0) {
          logs.push({ type: 'info', text: 'Python executed with no output.' });
        }
      }
    } catch (err) {
      logs.push({ type: 'error', text: `Runtime Error: ${err.message || String(err)}` });
    } finally {
      const end = performance.now();
      setExecutionTime((end - start).toFixed(1));
      setOutput([...logs]);
      setIsRunning(false);
    }
  };

  if (!isExecutable) return null;

  return (
    <div className="mt-2 border-t border-[#4f382a]/80 pt-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={runCode}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <Loader2 size={12} className="animate-spin text-white" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play size={12} className="fill-white" />
              <span>Run Code ({cleanLang === 'python' || cleanLang === 'py' ? 'Python' : 'JS'})</span>
            </>
          )}
        </button>

        {isOpen && (
          <div className="flex items-center gap-2">
            {executionTime && (
              <span className="text-[10px] font-mono text-stone-400">
                Executed in {executionTime}ms
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

      {isOpen && (
        <div className="mt-2 rounded-xl bg-black/90 border border-stone-800 p-3 font-mono text-xs overflow-hidden shadow-inner">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-stone-800 text-[11px] text-stone-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Terminal size={12} />
              <span>Console Output</span>
            </span>
            <button
              type="button"
              onClick={() => setOutput([])}
              className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            >
              <RotateCcw size={10} /> Clear
            </button>
          </div>

          <div className="max-h-44 overflow-y-auto space-y-1 select-text">
            {output.length === 0 && !isRunning && (
              <span className="text-stone-500 text-[11px] italic">Console is ready. Click Run to execute snippet.</span>
            )}
            {output.map((line, idx) => (
              <div
                key={idx}
                className={`whitespace-pre-wrap leading-relaxed ${
                  line.type === 'error'
                    ? 'text-rose-400 font-semibold bg-rose-950/30 p-1 rounded'
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
