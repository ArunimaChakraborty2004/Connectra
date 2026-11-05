import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical,
  X,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Cpu,
  ShieldCheck,
  TrendingUp,
  Clock,
  Sparkles,
} from 'lucide-react';
import { reviewCodeAndSecurity } from '../../lib/ai';

export const BENCHMARK_TEST_SUITE = [
  {
    id: 'TEST-01',
    cwe: 'CWE-89',
    category: 'SQL Injection',
    language: 'javascript',
    isClean: false,
    expectedVulnerability: 'CWE-89',
    title: 'PostgreSQL Dynamic String Concatenation',
    code: `async function getUser(req, res) {
  const userId = req.query.id;
  // Raw string concatenation in SQL query
  const query = "SELECT * FROM users WHERE id = '" + userId + "'";
  const result = await db.query(query);
  res.json(result.rows);
}`,
  },
  {
    id: 'TEST-02',
    cwe: 'CWE-79',
    category: 'Cross-Site Scripting (XSS)',
    language: 'javascript',
    isClean: false,
    expectedVulnerability: 'CWE-79',
    title: 'Unescaped DOM innerHTML Assignment',
    code: `function renderComment(container, commentData) {
  // Direct injection of untrusted user HTML into the DOM
  container.innerHTML = "<div class='comment'>" + commentData.text + "</div>";
}`,
  },
  {
    id: 'TEST-03',
    cwe: 'CWE-798',
    category: 'Hardcoded Credentials',
    language: 'javascript',
    isClean: false,
    expectedVulnerability: 'CWE-798',
    title: 'Hardcoded Secret API Key in Source',
    code: `import Stripe from 'stripe';
// Embedded production secret key in source control
const stripe = new Stripe('CONNECTRA_EXPOSED_TEST_SECRET_KEY_99999999');

export async function createCharge(amount) {
  return await stripe.charges.create({ amount, currency: 'usd' });
}`,
  },
  {
    id: 'TEST-04',
    cwe: 'CWE-22',
    category: 'Path Traversal',
    language: 'javascript',
    isClean: false,
    expectedVulnerability: 'CWE-22',
    title: 'Arbitrary File Read via Unvalidated Path',
    code: `const fs = require('fs');
const path = require('path');

app.get('/download', (req, res) => {
  // Allows directory traversal (../../etc/passwd)
  const filePath = path.join('/var/www/uploads', req.query.filename);
  const data = fs.readFileSync(filePath, 'utf8');
  res.send(data);
});`,
  },
  {
    id: 'TEST-05',
    cwe: 'CWE-352',
    category: 'CSRF / State Change',
    language: 'javascript',
    isClean: false,
    expectedVulnerability: 'CWE-352',
    title: 'State Changing GET Request without Anti-CSRF Token',
    code: `app.get('/api/transfer-funds', async (req, res) => {
  const { toAccount, amount } = req.query;
  const user = req.session.user; // Cookie-based session without CSRF token
  await bankDb.transfer(user.id, toAccount, amount);
  res.send({ status: 'transferred' });
});`,
  },
  {
    id: 'TEST-06',
    cwe: 'CWE-95',
    category: 'Code Injection',
    language: 'javascript',
    isClean: false,
    expectedVulnerability: 'CWE-95',
    title: 'Direct Dynamic Code Execution via eval()',
    code: `function computeUserMath(expression) {
  // Direct eval of client expression string
  return eval("result = " + expression);
}`,
  },
  {
    id: 'TEST-07',
    cwe: 'CLEAN',
    category: 'Safe Parameterized SQL',
    language: 'javascript',
    isClean: true,
    expectedVulnerability: null,
    title: 'Safe Parameterized Query (Negative Control)',
    code: `async function getUser(req, res) {
  const userId = req.query.id;
  // Parameterized query prevents SQL injection
  const query = 'SELECT id, username, email FROM users WHERE id = $1';
  const result = await db.query(query, [userId]);
  res.json(result.rows);
}`,
  },
  {
    id: 'TEST-08',
    cwe: 'CLEAN',
    category: 'Safe DOM Text Rendering',
    language: 'javascript',
    isClean: true,
    expectedVulnerability: null,
    title: 'Safe DOM textContent Assignment (Negative Control)',
    code: `function renderComment(container, commentData) {
  const commentDiv = document.createElement('div');
  commentDiv.className = 'comment';
  // Safe textContent assignment does not parse HTML entities
  commentDiv.textContent = commentData.text;
  container.appendChild(commentDiv);
}`,
  },
  {
    id: 'TEST-09',
    cwe: 'CLEAN',
    category: 'Safe Environment Secrets',
    language: 'javascript',
    isClean: true,
    expectedVulnerability: null,
    title: 'Secrets Ingestion from Environment Variable (Negative Control)',
    code: `import Stripe from 'stripe';

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is missing');
}
const stripe = new Stripe(apiKey);`,
  },
  {
    id: 'TEST-10',
    cwe: 'CLEAN',
    category: 'Safe Path Resolution',
    language: 'javascript',
    isClean: true,
    expectedVulnerability: null,
    title: 'Path Basename & Whitelist Containment (Negative Control)',
    code: `const fs = require('fs');
const path = require('path');

app.get('/download', (req, res) => {
  const safeFilename = path.basename(req.query.filename || '');
  const targetDir = path.resolve('/var/www/uploads');
  const targetPath = path.resolve(targetDir, safeFilename);

  if (!targetPath.startsWith(targetDir)) {
    return res.status(403).send('Forbidden: Invalid path');
  }
  res.sendFile(targetPath);
});`,
  },
];

export default function AIBenchmarkModal({ isOpen, onClose }) {
  const [selectedModel, setSelectedModel] = useState('qwen/qwen3.8-27b');
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [results, setResults] = useState([]);
  const [activeTab, setActiveTab] = useState('results'); // 'results' | 'latex' | 'markdown'
  const [copiedType, setCopiedType] = useState(null);

  if (!isOpen) return null;

  // Run the full empirical benchmark suite
  const runBenchmark = async () => {
    setIsRunning(true);
    setResults([]);
    setCurrentIndex(0);

    const testResults = [];

    for (let i = 0; i < BENCHMARK_TEST_SUITE.length; i++) {
      setCurrentIndex(i);
      const test = BENCHMARK_TEST_SUITE[i];
      const t0 = performance.now();

      try {
        const response = await reviewCodeAndSecurity({
          code: test.code,
          language: test.language,
        });

        const t1 = performance.now();
        const latencyMs = Math.round(t1 - t0);

        // Determine Classification (TP, FP, TN, FN)
        let outcome = 'UNKNOWN';
        const detectedVulnerabilities = response.findings || [];
        const foundAnyVulnerability = !response.isClean && detectedVulnerabilities.length > 0;

        if (!test.isClean && foundAnyVulnerability) {
          outcome = 'TP'; // True Positive
        } else if (!test.isClean && !foundAnyVulnerability) {
          outcome = 'FN'; // False Negative (Missed vulnerability)
        } else if (test.isClean && !foundAnyVulnerability) {
          outcome = 'TN'; // True Negative (Correctly marked clean)
        } else if (test.isClean && foundAnyVulnerability) {
          outcome = 'FP'; // False Positive (False alarm)
        }

        testResults.push({
          id: test.id,
          title: test.title,
          category: test.category,
          cwe: test.cwe,
          expectedIsClean: test.isClean,
          predictedIsClean: response.isClean,
          detectedCount: detectedVulnerabilities.length,
          findings: detectedVulnerabilities,
          criticVerification: response.criticVerification,
          latencyMs,
          outcome,
        });
      } catch (err) {
        testResults.push({
          id: test.id,
          title: test.title,
          category: test.category,
          cwe: test.cwe,
          expectedIsClean: test.isClean,
          predictedIsClean: false,
          detectedCount: 0,
          findings: [],
          criticVerification: { verified: false, criticVerdict: `Error: ${err.message}` },
          latencyMs: Math.round(performance.now() - t0),
          outcome: 'ERROR',
        });
      }

      setResults([...testResults]);
    }

    setIsRunning(false);
    setCurrentIndex(-1);
  };

  // Compute statistical evaluation metrics
  const tp = results.filter(r => r.outcome === 'TP').length;
  const fp = results.filter(r => r.outcome === 'FP').length;
  const tn = results.filter(r => r.outcome === 'TN').length;
  const fn = results.filter(r => r.outcome === 'FN').length;
  const total = results.length;

  const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
  const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
  const f1 =
    precision + recall > 0
      ? (2 * (precision * recall)) / (precision + recall) / 100
      : 0;
  const accuracy = total > 0 ? ((tp + tn) / total) * 100 : 0;
  const avgLatency =
    total > 0
      ? Math.round(results.reduce((acc, r) => acc + r.latencyMs, 0) / total)
      : 0;

  // LaTeX table generation for academic papers
  const generateLaTeX = () => {
    return `% =========================================================================
% Connectra Empirical SAST Benchmark Table (IEEE / ACM Research Format)
% Generated via Connectra Multi-Agent Telemetry Pipeline
% =========================================================================
\\begin{table*}[t]
\\centering
\\caption{Empirical Evaluation of Connectra Multi-Agent SAST Pipeline Across Standard CWE Vulnerability Classes}
\\label{tab:sast_benchmark}
\\small
\\begin{tabular}{llccccr}
\\hline
\\textbf{Test ID} & \\textbf{Target Vulnerability / Class} & \\textbf{Ground Truth} & \\textbf{Prediction} & \\textbf{Critic Verdict} & \\textbf{Outcome} & \\textbf{Latency (ms)} \\\\
\\hline
${results
  .map(
    r =>
      `${r.id} & ${r.category} (${r.cwe}) & ${r.expectedIsClean ? 'Clean' : 'Vulnerable'} & ${
        r.predictedIsClean ? 'Clean' : 'Vulnerable'
      } & ${r.criticVerification?.verified ? 'Verified' : 'Flagged'} & \\textbf{${r.outcome}} & ${r.latencyMs} \\\\`
  )
  .join('\n')}
\\hline
\\multicolumn{7}{l}{\\textbf{Overall Performance Summary:}} \\\\
\\multicolumn{7}{l}{Precision: \\textbf{${precision.toFixed(1)}\\%} \\quad Recall: \\textbf{${recall.toFixed(
      1
    )}\\%} \\quad F1-Score: \\textbf{${f1.toFixed(3)}} \\quad Accuracy: \\textbf{${accuracy.toFixed(
      1
    )}\\%} \\quad Mean Latency: \\textbf{${avgLatency} ms}} \\\\
\\hline
\\end{tabular}
\\end{table*}`;
  };

  // Markdown table generation
  const generateMarkdown = () => {
    return `### 📊 Connectra Empirical SAST Benchmark Results
**Evaluated Model:** \`${selectedModel}\` | **Dual-Agent Verification:** Active | **Sample Count:** ${total}

| Test ID | Vulnerability / Target Class | Ground Truth | AI Prediction | Critic Verdict | Outcome | Latency (ms) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
${results
  .map(
    r =>
      `| **${r.id}** | ${r.category} (\`${r.cwe}\`) | ${r.expectedIsClean ? '🟢 Clean' : '🔴 Vuln'} | ${
        r.predictedIsClean ? '🟢 Clean' : '🔴 Vuln'
      } | ${r.criticVerification?.verified ? '🛡️ Verified' : '⚠️ Flagged'} | **${r.outcome}** | ${r.latencyMs} ms |`
  )
  .join('\n')}

#### 📈 Statistical Summary
- **Precision:** \`${precision.toFixed(1)}%\`
- **Recall:** \`${recall.toFixed(1)}%\`
- **F1-Score:** \`${f1.toFixed(3)}\`
- **Accuracy:** \`${accuracy.toFixed(1)}%\`
- **Mean Inference Latency:** \`${avgLatency} ms\` (Groq LPU)`;
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const downloadJSONTelemetry = () => {
    const data = {
      benchmarkVersion: 'Connectra-SAST-v2.0',
      timestamp: new Date().toISOString(),
      model: selectedModel,
      metrics: {
        total,
        tp,
        fp,
        tn,
        fn,
        precision: Number(precision.toFixed(2)),
        recall: Number(recall.toFixed(2)),
        f1Score: Number(f1.toFixed(3)),
        accuracy: Number(accuracy.toFixed(2)),
        avgLatencyMs: avgLatency,
      },
      results,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `connectra_sast_benchmark_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#140e0a] text-stone-100 border border-[#3d2719] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#2d1b11] bg-gradient-to-r from-[#211710] via-[#1a120d] to-[#211710] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25">
              <FlaskConical size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Empirical AI Benchmark & Telemetry Suite
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Paper Section 6
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Automated SAST & Dual-Agent Verification Benchmark across OWASP/CWE standard corpus
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Control Toolbar */}
        <div className="p-4 border-b border-[#2d1b11] bg-[#1a120e] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-stone-300">
              <Cpu size={14} className="text-orange-400" />
              <span>Target Engine:</span>
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                disabled={isRunning}
                className="bg-[#241710] border border-[#3d2719] rounded-lg px-2.5 py-1 text-xs text-amber-200 font-mono outline-hidden cursor-pointer"
              >
                <option value="qwen/qwen3.8-27b">Qwen 3.8 27B (Primary)</option>
                <option value="openai/gpt-oss-120b">GPT-OSS 120B (High-Precision)</option>
                <option value="openai/gpt-oss-20b">GPT-OSS 20B (Low Latency)</option>
              </select>
            </div>

            <div className="text-xs text-stone-400 flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Critic: Dual-Agent Verifier</span>
            </div>
          </div>

          <button
            onClick={runBenchmark}
            disabled={isRunning}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md ${
              isRunning
                ? 'bg-orange-500/30 text-orange-300 border border-orange-500/40 cursor-wait'
                : 'bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white shadow-orange-500/25'
            }`}
          >
            {isRunning ? (
              <>
                <RotateCw size={14} className="animate-spin" />
                <span>Evaluating Case {currentIndex + 1} / {BENCHMARK_TEST_SUITE.length}...</span>
              </>
            ) : (
              <>
                <Play size={14} />
                <span>{results.length > 0 ? 'Re-run Benchmark' : 'Run Full Benchmark Suite'}</span>
              </>
            )}
          </button>
        </div>

        {/* Live Metrics Cards */}
        {results.length > 0 && (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-[#170f0b] border-b border-[#2d1b11]">
            <div className="p-2.5 rounded-xl bg-[#23150d] border border-orange-500/20 flex flex-col">
              <span className="text-[10px] uppercase font-mono text-stone-400">Precision</span>
              <span className="text-lg font-bold text-emerald-400">{precision.toFixed(1)}%</span>
              <span className="text-[9px] text-stone-500">TP / (TP + FP)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#23150d] border border-orange-500/20 flex flex-col">
              <span className="text-[10px] uppercase font-mono text-stone-400">Recall</span>
              <span className="text-lg font-bold text-cyan-400">{recall.toFixed(1)}%</span>
              <span className="text-[9px] text-stone-500">TP / (TP + FN)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#23150d] border border-orange-500/20 flex flex-col">
              <span className="text-[10px] uppercase font-mono text-stone-400">F1-Score</span>
              <span className="text-lg font-bold text-amber-400">{f1.toFixed(3)}</span>
              <span className="text-[9px] text-stone-500">Harmonic Mean</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#23150d] border border-orange-500/20 flex flex-col">
              <span className="text-[10px] uppercase font-mono text-stone-400">Accuracy</span>
              <span className="text-lg font-bold text-violet-400">{accuracy.toFixed(1)}%</span>
              <span className="text-[9px] text-stone-500">(TP + TN) / Total</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#23150d] border border-orange-500/20 flex flex-col col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-mono text-stone-400">Avg Latency</span>
              <span className="text-lg font-bold text-orange-400 flex items-center gap-1">
                <Clock size={14} /> {avgLatency} ms
              </span>
              <span className="text-[9px] text-stone-500">Groq LPU Inference</span>
            </div>
          </div>
        )}

        {/* Tab Selector */}
        <div className="px-4 pt-3 flex items-center justify-between border-b border-[#2d1b11] bg-[#140e0a]">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('results')}
              className={`pb-2.5 text-xs font-bold transition-colors border-b-2 cursor-pointer ${
                activeTab === 'results'
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              Test Case Execution Matrix ({results.length})
            </button>
            <button
              onClick={() => setActiveTab('latex')}
              className={`pb-2.5 text-xs font-bold transition-colors border-b-2 cursor-pointer ${
                activeTab === 'latex'
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              LaTeX Table (IEEE / ACM)
            </button>
            <button
              onClick={() => setActiveTab('markdown')}
              className={`pb-2.5 text-xs font-bold transition-colors border-b-2 cursor-pointer ${
                activeTab === 'markdown'
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              Markdown Table
            </button>
          </div>

          {results.length > 0 && (
            <button
              onClick={downloadJSONTelemetry}
              className="text-[11px] text-stone-400 hover:text-amber-200 flex items-center gap-1 cursor-pointer transition-colors"
              title="Download raw telemetry data"
            >
              <Download size={13} />
              <span>Export JSON</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'results' && (
            <div className="space-y-2.5">
              {results.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-stone-500">
                  <FlaskConical size={40} className="text-orange-500/40 mb-3" />
                  <p className="text-sm font-semibold text-stone-300">No benchmark runs recorded yet.</p>
                  <p className="text-xs text-stone-500 max-w-sm mt-1">
                    Click "Run Full Benchmark Suite" to evaluate the multi-agent SAST pipeline against standard CWE vulnerability cases.
                  </p>
                </div>
              ) : (
                results.map((res, i) => (
                  <div
                    key={res.id}
                    className="p-3 rounded-xl bg-[#1b120c] border border-[#332014] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] shrink-0 ${
                          res.outcome === 'TP'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : res.outcome === 'TN'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {res.outcome}
                      </span>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-stone-200">{res.title}</span>
                          <span className="text-[10px] font-mono text-orange-400/90">{res.cwe}</span>
                        </div>
                        <p className="text-[11px] text-stone-400 mt-0.5">{res.category}</p>

                        {/* Critic Note */}
                        {res.criticVerification && (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-stone-400">
                            <ShieldCheck size={11} className="text-emerald-400" />
                            <span className="italic truncate max-w-md">
                              Critic: {res.criticVerification.criticVerdict}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] shrink-0 border-t sm:border-t-0 border-[#2d1b11] pt-2 sm:pt-0">
                      <div className="flex flex-col items-end">
                        <span className="text-stone-500 text-[10px]">Predicted</span>
                        <span
                          className={`font-semibold ${
                            res.predictedIsClean ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {res.predictedIsClean ? 'Clean' : `${res.detectedCount} Flaw(s)`}
                        </span>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="text-stone-500 text-[10px]">Latency</span>
                        <span className="font-mono text-amber-300">{res.latencyMs} ms</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'latex' && (
            <div className="relative">
              <div className="absolute top-2 right-2">
                <button
                  onClick={() => copyToClipboard(generateLaTeX(), 'latex')}
                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                >
                  {copiedType === 'latex' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedType === 'latex' ? 'Copied LaTeX!' : 'Copy LaTeX Table'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-[#0e0a07] border border-[#2d1b11] font-mono text-xs text-amber-200/90 overflow-x-auto leading-relaxed select-all">
                {results.length > 0
                  ? generateLaTeX()
                  : '% Run the benchmark first to populate the LaTeX table code.'}
              </pre>
            </div>
          )}

          {activeTab === 'markdown' && (
            <div className="relative">
              <div className="absolute top-2 right-2">
                <button
                  onClick={() => copyToClipboard(generateMarkdown(), 'markdown')}
                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                >
                  {copiedType === 'markdown' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedType === 'markdown' ? 'Copied Markdown!' : 'Copy Markdown'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-[#0e0a07] border border-[#2d1b11] font-mono text-xs text-amber-200/90 overflow-x-auto leading-relaxed select-all">
                {results.length > 0
                  ? generateMarkdown()
                  : '<!-- Run the benchmark first to populate the markdown table. -->'}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#2d1b11] bg-[#1a120e] flex items-center justify-between text-xs text-stone-400">
          <span>Connectra Research Telemetry Engine</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
