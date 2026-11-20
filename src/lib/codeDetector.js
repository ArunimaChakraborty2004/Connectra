/**
 * Intelligent Code Language Detector & Normalizer for Connectra
 * Automatically detects languages from code snippets and provides canonical SaaS names.
 */

export const SUPPORTED_LANGUAGES = [
  { id: 'markdown', label: 'Markdown', ext: '.md' },
  { id: 'json', label: 'JSON', ext: '.json' },
  { id: 'html', label: 'HTML', ext: '.html' },
  { id: 'css', label: 'CSS', ext: '.css' },
  { id: 'yaml', label: 'YAML', ext: '.yaml' },
  { id: 'python', label: 'Python', ext: '.py' },
  { id: 'rust', label: 'Rust', ext: '.rs' },
  { id: 'javascript', label: 'JavaScript', ext: '.js' },
  { id: 'typescript', label: 'TypeScript', ext: '.ts' },
  { id: 'go', label: 'Go', ext: '.go' },
  { id: 'sql', label: 'SQL', ext: '.sql' },
  { id: 'solidity', label: 'Solidity', ext: '.sol' },
  { id: 'cpp', label: 'C++', ext: '.cpp' },
  { id: 'java', label: 'Java', ext: '.java' },
  { id: 'bash', label: 'Bash', ext: '.sh' },
  { id: 'plaintext', label: 'Plain Text', ext: '.txt' },
];

export function getLanguageFromFileName(filename = '') {
  if (!filename || typeof filename !== 'string') return null;
  const lower = filename.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.css') || lower.endsWith('.scss')) return 'css';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.rs')) return 'rust';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs')) return 'javascript';
  if (lower.endsWith('.go')) return 'go';
  if (lower.endsWith('.sql')) return 'sql';
  if (lower.endsWith('.sol')) return 'solidity';
  if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.hpp') || lower.endsWith('.h')) return 'cpp';
  if (lower.endsWith('.java')) return 'java';
  if (lower.endsWith('.sh') || lower.endsWith('.bash')) return 'bash';
  if (lower.endsWith('.txt')) return 'plaintext';
  return null;
}

export function getLanguageDisplayName(langId = '') {
  const match = SUPPORTED_LANGUAGES.find(l => l.id.toLowerCase() === (langId || '').toLowerCase());
  return match ? match.label : langId.toUpperCase() || 'Code';
}

/**
 * Detects programming language with high confidence from syntax heuristics
 */
export function detectCodeLanguage(code) {
  if (!code || typeof code !== 'string') return null;
  const c = code.trim();
  if (c.length < 5) return null;

  // Markdown Indicators (# heading, ## heading, ```codeblock, [link](url), - list, * list)
  if (
    /(?:^|\n)#{1,6}\s+[^\n]+/.test(c) ||
    /```[\s\S]*?```/.test(c) ||
    /\[[^\]]+\]\([^)]+\)/.test(c) ||
    /(?:^|\n)\s*[-*+]\s+[^\n]+(?:\n\s*[-*+]\s+[^\n]+)/.test(c) ||
    /(?:^|\n)>\s+[^\n]+/.test(c)
  ) {
    return 'markdown';
  }

  // JSON Indicators ({ "key": ... } or [ { "key": ... } ])
  if (/^\{[\s\S]*"[\w-]+"\s*:[\s\S]*\}$/.test(c) || /^\[[\s\S]*\{[\s\S]*\}[\s\S]*\]$/.test(c)) {
    try {
      JSON.parse(c);
      return 'json';
    } catch {}
  }

  // 1. Python Indicators (def, elif, self., import, class Name:, print(), __init__, for..in:, except:)
  if (
    /(?:^|\n)\s*(?:async\s+)?def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(/.test(c) ||
    /(?:^|\n)\s*import\s+[a-zA-Z_][a-zA-Z0-9_]*/.test(c) ||
    /(?:^|\n)\s*from\s+[a-zA-Z_][a-zA-Z0-9_]*\s+import/.test(c) ||
    /(?:^|\n)\s*class\s+[a-zA-Z_][a-zA-Z0-9_]*.*:/.test(c) ||
    /(?:^|\n)\s*elif\s+.*:/.test(c) ||
    /(?:^|\n)\s*except(?:\s+[a-zA-Z0-9_.]*(?:\s+as\s+[a-zA-Z_][a-zA-Z0-9_]*)?)?\s*:/.test(c) ||
    /(?:^|\n)\s*for\s+[a-zA-Z_][a-zA-Z0-9_,\s]+\s+in\s+.*:/.test(c) ||
    /\bself\.[a-zA-Z_]/.test(c) ||
    /\bprint\s*\(/.test(c) ||
    /\b__init__\b/.test(c) ||
    /\bwith\s+open\s*\(/.test(c) ||
    /\braise\s+[A-Z][a-zA-Z0-9_]*Error\b/.test(c) ||
    /if\s+__name__\s*==\s*['"]__main__['"]/.test(c) ||
    /#!\/usr\/bin\/(?:env\s+)?python/.test(c)
  ) {
    return 'python';
  }

  // 2. Rust Indicators (fn name(), let mut, println!, impl, Result<>, Option<>, pub struct)
  if (
    /\bfn\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(/.test(c) ||
    /\blet\s+mut\s+/.test(c) ||
    /\bprintln!\s*\(/.test(c) ||
    /\beprintln!\s*\(/.test(c) ||
    /\bpub\s+struct\s+/.test(c) ||
    /\bimpl\s+[a-zA-Z_]/.test(c) ||
    /#\[derive\(/.test(c) ||
    /\bmatch\s+[a-zA-Z0-9_]+\s*\{/.test(c)
  ) {
    return 'rust';
  }

  // 3. Go Indicators (package name, func Name(), fmt.Print, chan, defer)
  if (
    /(?:^|\n)\s*package\s+[a-zA-Z_][a-zA-Z0-9_]*/.test(c) ||
    /(?:^|\n)\s*func\s+(?:\([a-zA-Z_*\s]+\)\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\(/.test(c) ||
    /\bfmt\.(?:Print|Println|Printf|Sprintf)\s*\(/.test(c) ||
    /\bgo\s+func\s*\(/.test(c) ||
    /\bchan\s+[a-zA-Z_]/.test(c)
  ) {
    return 'go';
  }

  // 4. SQL Indicators (SELECT, INSERT, UPDATE, CREATE TABLE, etc.)
  if (
    /(?:^|\n)\s*(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|EXPLAIN\s+ANALYZE)\b/i.test(c)
  ) {
    return 'sql';
  }

  // 5. Solidity Indicators (pragma solidity, contract Name, mapping, uint256)
  if (
    /\bpragma\s+solidity\b/.test(c) ||
    /\bcontract\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\{/.test(c) ||
    /\bmapping\s*\([a-zA-Z0-9_]+/.test(c) ||
    /\buint(?:256|128|64|32|8)\b/.test(c)
  ) {
    return 'solidity';
  }

  // 6. C++ Indicators (#include <...>, std::cout, std::vector, int main)
  if (
    /#include\s*<[a-zA-Z0-9_.]+>/.test(c) ||
    /\bstd::(?:cout|cin|endl|vector|string|map|shared_ptr)\b/.test(c) ||
    /(?:^|\n)\s*int\s+main\s*\([^)]*\)\s*\{/.test(c)
  ) {
    return 'cpp';
  }

  // 7. Java Indicators (public class, public static void main, System.out.println)
  if (
    /\bpublic\s+(?:static\s+)?class\s+[a-zA-Z_]/.test(c) ||
    /\bpublic\s+static\s+void\s+main\s*\(/.test(c) ||
    /\bSystem\.(?:out|err)\.println\s*\(/.test(c)
  ) {
    return 'java';
  }

  // 8. TypeScript Indicators (interface Name, type Name =, : string[], : number)
  if (
    /(?:^|\n)\s*interface\s+[A-Z][a-zA-Z0-9_]*\s*\{/.test(c) ||
    /(?:^|\n)\s*type\s+[A-Z][a-zA-Z0-9_]*\s*=/.test(c) ||
    /:\s*(?:string|number|boolean|any|Record<|Array<)[;,\s)]/.test(c) ||
    /\bas\s+const\b/.test(c)
  ) {
    return 'typescript';
  }

  // 9. JavaScript Indicators (const, let, var, console.log, document., window.)
  if (
    /\b(?:const|let|var)\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=/.test(c) ||
    /\bconsole\.(?:log|error|warn|info)\s*\(/.test(c) ||
    /(?:^|\n)\s*function\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(/.test(c) ||
    /\bexport\s+(?:default\s+)?function\b/.test(c)
  ) {
    return 'javascript';
  }

  return null;
}
