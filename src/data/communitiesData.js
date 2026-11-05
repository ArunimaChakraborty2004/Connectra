// Curated high-caliber developer communities & technical guilds for Connectra
export const CURATED_COMMUNITIES = [
  {
    id: 'guild-zerotrust-sec',
    name: 'Zero-Trust Security & DevSecOps',
    slug: 'zero-trust-sec',
    category: 'Security',
    icon: '🛡️',
    banner_url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
    description: 'The premier hub for vulnerability triage, automated CWE mitigation, AST fuzzing, static analysis, and zero-trust secrets scanning pipelines.',
    tags: ['DevSecOps', 'Zero-Trust', 'CWE-Audit', 'Rust', 'eBPF'],
    member_count: 2840,
    is_private: false,
    is_verified: true,
    active_now: 42,
    gradient: 'from-emerald-600/30 via-teal-600/20 to-slate-900/40',
    accent_color: '#10b981',
    creator: {
      username: 'secops_lead',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      bio: 'Principal Security Architect @ Connectra Labs'
    },
    created_at: '2024-01-15T10:00:00Z',
    rules: [
      'Zero-Trust code vetting: all pasted snippets are scanned for CWE vulnerabilities.',
      'Constructive security triage: explain exploit vectors and provide verified remediations.',
      'Responsible disclosure: never share unpatched zero-days or sensitive live credentials.',
      'Keep discussions technical, actionable, and backed by reproducible proofs.'
    ],
    resources: [
      { title: 'OWASP Top 10 Vulnerability Cheatsheet', type: 'Doc', url: 'https://owasp.org' },
      { title: 'eBPF Security Observability Architecture', type: 'Architecture', url: 'https://ebpf.io' },
      { title: 'Connectra RLS Penetration Suite', type: 'Repo', url: 'https://github.com' }
    ]
  },
  {
    id: 'guild-ai-agents',
    name: 'Autonomous AI & Multi-Agent Labs',
    slug: 'ai-agents-lab',
    category: 'AI & ML',
    icon: '🤖',
    banner_url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80',
    description: 'Architecting next-gen agentic workflows with Groq Llama 3.3, LangChain, vector retrieval (RAG), tool calling, and local small language models.',
    tags: ['Llama-3.3', 'Groq', 'LangGraph', 'PyTorch', 'RAG'],
    member_count: 3190,
    is_private: false,
    is_verified: true,
    active_now: 67,
    gradient: 'from-purple-600/30 via-indigo-600/20 to-slate-900/40',
    accent_color: '#8b5cf6',
    creator: {
      username: 'ai_architect',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      bio: 'AI Systems Engineer & LLM Pipeline Specialist'
    },
    created_at: '2024-02-01T08:30:00Z',
    rules: [
      'Share real benchmarks with tokens/sec and latency numbers.',
      'Include system prompts, temperature settings, and model versions when reporting results.',
      'Respect API rate limits and avoid spamming unverified synthetic code.'
    ],
    resources: [
      { title: 'Groq Cloud Inference Performance Benchmarks', type: 'Benchmark', url: 'https://groq.com' },
      { title: 'LangGraph Multi-Agent State Machine Patterns', type: 'Tutorial', url: 'https://langchain.com' },
      { title: 'Vector Embeddings & Hybrid Search with pgvector', type: 'Guide', url: 'https://supabase.com' }
    ]
  },
  {
    id: 'guild-rust-systems',
    name: 'Rust Core & Systems Engineering',
    slug: 'rust-systems',
    category: 'Systems',
    icon: '⚡',
    banner_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    description: 'High-performance systems programming, WebAssembly micro-engines, memory safety without GC, async concurrency with Tokio, and Linux kernel hacking.',
    tags: ['Rust', 'Wasm', 'Tokio', 'Memory-Safety', 'Linux'],
    member_count: 1940,
    is_private: false,
    is_verified: true,
    active_now: 31,
    gradient: 'from-amber-600/30 via-orange-600/20 to-slate-900/40',
    accent_color: '#f59e0b',
    creator: {
      username: 'ferris_dev',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
      bio: 'Rustacean | Distributed Database Internals'
    },
    created_at: '2024-01-20T14:15:00Z',
    rules: [
      'Prioritize safe Rust unless demonstrating low-level FFI or kernel bindings.',
      'Provide cargo-flamegraph or criterion benchmarks for performance claims.',
      'Help newcomers navigate the borrow checker with patient explanations.'
    ],
    resources: [
      { title: 'Rust Performance Book', type: 'Book', url: 'https://nnethercote.github.io/perf-book/' },
      { title: 'Tokio Async Runtime Internals', type: 'Guide', url: 'https://tokio.rs' },
      { title: 'WASM Component Model Specification', type: 'Spec', url: 'https://webassembly.org' }
    ]
  },
  {
    id: 'guild-cloud-native',
    name: 'Cloud Native & Kubernetes Crew',
    slug: 'cloud-native',
    category: 'Systems',
    icon: '☁️',
    banner_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    description: 'Container orchestration, Cilium eBPF service meshes, Terraform Infrastructure as Code, CI/CD automated deployment, and distributed resilience.',
    tags: ['Kubernetes', 'Go', 'Docker', 'eBPF', 'Terraform'],
    member_count: 1620,
    is_private: false,
    is_verified: false,
    active_now: 22,
    gradient: 'from-cyan-600/30 via-sky-600/20 to-slate-900/40',
    accent_color: '#06b6d4',
    creator: {
      username: 'k8s_commander',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      bio: 'Cloud Architect & SRE Lead'
    },
    created_at: '2024-02-10T11:00:00Z',
    rules: [
      'Sanitize all Kubernetes manifests and remove cloud credentials before sharing.',
      'Share post-mortems and RCA (Root Cause Analysis) openly for mutual learning.',
      'Highlight cost-effective cloud architectures.'
    ],
    resources: [
      { title: 'Kubernetes Hardening Guide (NSA/CISA)', type: 'Security', url: 'https://kubernetes.io' },
      { title: 'Terraform Best Practices Repository', type: 'Patterns', url: 'https://terraform.io' }
    ]
  },
  {
    id: 'guild-react-frontend',
    name: 'Next.js & Modern Web Architecture',
    slug: 'modern-web',
    category: 'Web',
    icon: '🌐',
    banner_url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80',
    description: 'Pioneering frontend frontiers with React 19 Server Components, Vite, Tailwind CSS, high-performance web vitals, and micro-interactions.',
    tags: ['React 19', 'Next.js', 'Vite', 'TypeScript', 'Tailwind'],
    member_count: 2450,
    is_private: false,
    is_verified: true,
    active_now: 49,
    gradient: 'from-blue-600/30 via-indigo-600/20 to-slate-900/40',
    accent_color: '#3b82f6',
    creator: {
      username: 'frontend_ninja',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
      bio: 'Staff Frontend Engineer | Design Systems Enthusiast'
    },
    created_at: '2024-01-08T09:00:00Z',
    rules: [
      'Provide live CodeSandbox, StackBlitz, or minimal reproduction links.',
      'Prioritize accessibility (a11y) and keyboard navigation in component demos.',
      'Focus on real browser performance metrics (LCP, INP, CLS).'
    ],
    resources: [
      { title: 'React 19 Hooks & Server Actions Deep Dive', type: 'Guide', url: 'https://react.dev' },
      { title: 'Core Web Vitals Optimization Playbook', type: 'Audit', url: 'https://web.dev' }
    ]
  },
  {
    id: 'guild-python-fastapi',
    name: 'Python Data & Async Microservices',
    slug: 'python-backend',
    category: 'Web',
    icon: '🐍',
    banner_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    description: 'High-concurrency async Python, FastAPI microservices, automated ETL pipelines, Polars dataframe acceleration, and Supabase integrations.',
    tags: ['Python', 'FastAPI', 'AsyncIO', 'Polars', 'Postgres'],
    member_count: 2110,
    is_private: false,
    is_verified: false,
    active_now: 34,
    gradient: 'from-emerald-600/30 via-green-600/20 to-slate-900/40',
    accent_color: '#10b981',
    creator: {
      username: 'py_master',
      avatar_url: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80',
      bio: 'Data Platform Engineer & Python Core Contributor'
    },
    created_at: '2024-01-25T16:20:00Z',
    rules: [
      'Write type hints using modern Python 3.10+ syntax.',
      'Benchmark async endpoints using locust or wrk before claiming throughput wins.',
      'Share clean, PEP-8 compliant code.'
    ],
    resources: [
      { title: 'FastAPI Production Checklist', type: 'Cheatsheet', url: 'https://fastapi.tiangolo.com' },
      { title: 'Polars: Lightning-Fast DataFrame Library', type: 'Doc', url: 'https://pola.rs' }
    ]
  },
  {
    id: 'guild-red-team',
    name: 'Offensive Security & Red Teaming',
    slug: 'red-team-enclave',
    category: 'Security',
    icon: '🔓',
    banner_url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
    description: 'Ethical hacking research, binary exploitation, penetration testing methodologies, CTF challenges, and hardware forensics.',
    tags: ['PenTesting', 'ReverseEng', 'ExploitDev', 'Ghidra', 'Burp'],
    member_count: 1730,
    is_private: true,
    is_verified: true,
    active_now: 19,
    gradient: 'from-rose-600/30 via-red-600/20 to-slate-900/40',
    accent_color: '#f43f5e',
    creator: {
      username: 'ghost_in_the_wire',
      avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
      bio: 'Offensive Security Certified Professional (OSCP)'
    },
    created_at: '2024-02-14T20:00:00Z',
    rules: [
      'Strictly white-hat research and sanctioned targets only.',
      'Never attack or probe live Connectra infrastructure.',
      'Include defensive countermeasures alongside every offensive demonstration.'
    ],
    resources: [
      { title: 'MITRE ATT&CK Enterprise Matrix', type: 'Framework', url: 'https://attack.mitre.org' },
      { title: 'Ghidra Reverse Engineering Masterclass', type: 'Course', url: 'https://ghidra-sre.org' }
    ]
  },
  {
    id: 'guild-crypto-zkp',
    name: 'Applied Cryptography & Zero-Knowledge',
    slug: 'crypto-zkp',
    category: 'Security',
    icon: '🔐',
    banner_url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
    description: 'Mathematical foundations of zero-knowledge SNARKs/STARKs, post-quantum lattice cryptography, homomorphic encryption, and verifier circuits.',
    tags: ['ZK-SNARKs', 'EllipticCurves', 'Circom', 'Lattices'],
    member_count: 980,
    is_private: false,
    is_verified: true,
    active_now: 14,
    gradient: 'from-violet-600/30 via-purple-600/20 to-slate-900/40',
    accent_color: '#8b5cf6',
    creator: {
      username: 'zk_sage',
      avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80',
      bio: 'Cryptography Researcher | Zero-Knowledge Protocol Designer'
    },
    created_at: '2024-02-28T13:45:00Z',
    rules: [
      'Proof soundness and formal verification must accompany circuit designs.',
      'Provide algorithmic complexity bounds for all protocol proposals.'
    ],
    resources: [
      { title: 'ZK Whitepaper & Circuit Development Handbook', type: 'Paper', url: 'https://zcash.org' },
      { title: 'Circom 2.0 Circuit Compiler', type: 'Tool', url: 'https://iden3.io' }
    ]
  },
  {
    id: 'guild-creative-dev',
    name: 'Creative Coding & WebGL Shaders',
    slug: 'creative-code',
    category: 'Creative',
    icon: '🎨',
    banner_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    description: 'Generative algorithms, Three.js 3D rendering in browser, GLSL vertex & fragment shaders, and high-performance interactive canvases.',
    tags: ['Three.js', 'WebGL', 'GLSL', 'Canvas', 'Generative'],
    member_count: 1260,
    is_private: false,
    is_verified: false,
    active_now: 25,
    gradient: 'from-pink-600/30 via-rose-600/20 to-slate-900/40',
    accent_color: '#ec4899',
    creator: {
      username: 'shader_wizard',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      bio: 'Interactive Director & WebGL Shader Artist'
    },
    created_at: '2024-03-01T15:30:00Z',
    rules: [
      'Share ShaderToy links or live WebGL canvas previews.',
      'Optimize fragment passes for 60+ FPS across varied GPU tiers.'
    ],
    resources: [
      { title: 'The Book of Shaders', type: 'Book', url: 'https://thebookofshaders.com' },
      { title: 'Three.js Official Journey Resources', type: 'Guide', url: 'https://threejs.org' }
    ]
  },
  {
    id: 'guild-indie-founders',
    name: 'Open Source Founders & Builders',
    slug: 'open-source-builders',
    category: 'Community',
    icon: '🚀',
    banner_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
    description: 'Developer-first founders building open-source tools, commercial open source (COSS), launch playbooks, GitHub growth, and developer advocacy.',
    tags: ['OpenSource', 'SaaS', 'DevTools', 'IndieHacker', 'Growth'],
    member_count: 1890,
    is_private: false,
    is_verified: true,
    active_now: 38,
    gradient: 'from-yellow-600/30 via-amber-600/20 to-slate-900/40',
    accent_color: '#eab308',
    creator: {
      username: 'oss_builder',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      bio: 'Founder @ DevTool Labs | 10k+ GitHub Stars'
    },
    created_at: '2024-01-10T12:00:00Z',
    rules: [
      'Transparent metrics: share star history, user retention, and monetization honestly.',
      'Give meaningful feedback on peer launches before asking for upvotes.',
      'Collaborate on integrations instead of aggressive marketing.'
    ],
    resources: [
      { title: 'Commercial Open Source (COSS) Playbook', type: 'Guide', url: 'https://github.com' },
      { title: 'GitHub Stars to Enterprise Pipeline Case Study', type: 'Case Study', url: 'https://connectra.dev' }
    ]
  }
];

export const COMMUNITY_CATEGORIES = [
  { id: 'all', label: 'All Guilds', icon: '🌟' },
  { id: 'Security', label: 'Security & Zero-Trust', icon: '🛡️', color: 'emerald' },
  { id: 'AI & ML', label: 'AI & Autonomous Agents', icon: '🤖', color: 'purple' },
  { id: 'Systems', label: 'Systems & Cloud', icon: '⚡', color: 'amber' },
  { id: 'Web', label: 'Web & Fullstack', icon: '🌐', color: 'blue' },
  { id: 'Creative', label: 'Creative & WebGL', icon: '🎨', color: 'pink' },
  { id: 'Community', label: 'Founders & Builders', icon: '🚀', color: 'yellow' },
  { id: 'joined', label: 'Joined by Me', icon: '👥' }
];

export function getCommunityById(idOrSlug) {
  if (!idOrSlug) return null;
  return CURATED_COMMUNITIES.find(
    c => c.id === idOrSlug || c.slug === idOrSlug || c.name.toLowerCase() === idOrSlug.toLowerCase()
  ) || null;
}
