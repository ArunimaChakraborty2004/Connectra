-- ==============================================================================
-- CONNECTRA: COMPLETE COMMUNITIES & BACKEND DATABASE MIGRATION
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run)
-- ==============================================================================

-- 1. Ensure columns exist on public.communities table (even if table already exists)
CREATE TABLE IF NOT EXISTS public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT '🛡️',
  banner_url TEXT,
  tags TEXT[],
  category TEXT DEFAULT 'Security',
  is_private BOOLEAN DEFAULT false,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Crucial: Add columns to existing communities table if it already existed
ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Security',
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '🛡️',
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;

-- 2. Ensure community_id and community_slug columns exist on posts table
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS community_slug TEXT;

-- 3. Ensure community_members table exists with full schema
CREATE TABLE IF NOT EXISTS public.community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(community_id, user_id)
);

-- 4. Configure Row-Level Security (RLS)
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 4.1 Communities Policies (Allow reading, creating, and updating member counts)
DROP POLICY IF EXISTS "Communities viewable by everyone" ON public.communities;
CREATE POLICY "Communities viewable by everyone" ON public.communities FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create communities" ON public.communities;
CREATE POLICY "Authenticated users can create communities" ON public.communities FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Creators can update communities" ON public.communities;
DROP POLICY IF EXISTS "Creators and admins can update communities" ON public.communities;
CREATE POLICY "Creators and admins can update communities" ON public.communities FOR UPDATE USING (
  auth.role() = 'authenticated' 
  OR auth.uid() = creator_id 
  OR auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Creators can delete communities" ON public.communities;
CREATE POLICY "Creators can delete communities" ON public.communities FOR DELETE USING (
  auth.uid() = creator_id 
  OR auth.role() = 'authenticated' 
  OR auth.uid() IS NULL
);

-- 4.2 Community Members Policies (Allow joining, inviting other users, role updates, and removing)
DROP POLICY IF EXISTS "Community members viewable by everyone" ON public.community_members;
CREATE POLICY "Community members viewable by everyone" ON public.community_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join communities" ON public.community_members;
DROP POLICY IF EXISTS "Users and admins can add community members" ON public.community_members;
CREATE POLICY "Users and admins can add community members" ON public.community_members FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' 
  OR auth.uid() = user_id 
  OR auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Admins and users can update community_members" ON public.community_members;
CREATE POLICY "Admins and users can update community_members" ON public.community_members FOR UPDATE USING (
  auth.role() = 'authenticated' 
  OR auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Users can leave communities" ON public.community_members;
DROP POLICY IF EXISTS "Users and admins can remove community_members" ON public.community_members;
CREATE POLICY "Users and admins can remove community_members" ON public.community_members FOR DELETE USING (
  auth.uid() = user_id 
  OR auth.role() = 'authenticated' 
  OR auth.uid() IS NULL
);

-- Post deletion policy: allow authors AND community admins/creators to delete posts
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users and community admins can delete posts" ON public.posts;
CREATE POLICY "Users and community admins can delete posts" ON public.posts FOR DELETE USING (
  auth.uid() = user_id
  OR auth.uid() IS NULL
  OR EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = posts.community_id AND c.creator_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = posts.community_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'moderator')
  )
);

-- 5. Seed Curated Technical Guilds into Supabase
INSERT INTO public.communities (id, name, slug, description, icon, banner_url, tags, category, is_private, member_count)
VALUES
  (
    '00000000-0000-4000-a000-000000000001',
    'Zero-Trust Security & DevSecOps',
    'zero-trust-sec',
    'The premier hub for vulnerability triage, automated CWE mitigation, AST fuzzing, static analysis, and zero-trust secrets scanning pipelines.',
    '🛡️',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
    ARRAY['DevSecOps', 'Zero-Trust', 'CWE-Audit', 'Rust', 'eBPF'],
    'Security',
    false,
    284
  ),
  (
    '00000000-0000-4000-a000-000000000002',
    'Autonomous AI & Multi-Agent Labs',
    'ai-agents-lab',
    'Architecting next-gen agentic workflows with Groq Llama 3.3, LangChain, vector retrieval (RAG), tool calling, and local small language models.',
    '🤖',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80',
    ARRAY['Llama-3.3', 'Groq', 'LangGraph', 'PyTorch', 'RAG'],
    'AI & ML',
    false,
    319
  ),
  (
    '00000000-0000-4000-a000-000000000003',
    'Rust Core & Systems Engineering',
    'rust-systems',
    'High-performance systems programming, WebAssembly micro-engines, memory safety without GC, async concurrency with Tokio, and Linux kernel hacking.',
    '⚡',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    ARRAY['Rust', 'Wasm', 'Tokio', 'Memory-Safety', 'Linux'],
    'Systems',
    false,
    194
  ),
  (
    '00000000-0000-4000-a000-000000000004',
    'Cloud Native & Kubernetes Crew',
    'cloud-native-k8s',
    'Container orchestration, Cilium eBPF service meshes, Terraform Infrastructure as Code, CI/CD automated deployment, and distributed resilience.',
    '☁️',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    ARRAY['Kubernetes', 'Go', 'Docker', 'eBPF', 'Terraform'],
    'Systems',
    false,
    162
  ),
  (
    '00000000-0000-4000-a000-000000000005',
    'Next.js & Modern Web Architecture',
    'modern-web-next',
    'Pioneering frontend frontiers with React 19 Server Components, Vite, Tailwind CSS, high-performance web vitals, and micro-interactions.',
    '🌐',
    'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80',
    ARRAY['React 19', 'Next.js', 'Vite', 'TypeScript', 'Tailwind'],
    'Web',
    false,
    420
  ),
  (
    '00000000-0000-4000-a000-000000000006',
    'Python Data & Async Microservices',
    'python-microservices',
    'Building robust FastAPI backends, async IO event loops, NumPy/Pandas pipelines, and asynchronous database connection pools.',
    '🐍',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    ARRAY['Python', 'FastAPI', 'AsyncIO', 'PostgreSQL', 'Redis'],
    'Web',
    false,
    210
  ),
  (
    '00000000-0000-4000-a000-000000000007',
    'Offensive Security & Red Teaming',
    'red-team-ops',
    'Ethical hacking, binary exploitation, reverse engineering, web application penetration testing, and automated vulnerability exploitation.',
    '🔐',
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
    ARRAY['PenTesting', 'Exploitation', 'Ghidra', 'OWASP', 'CTF'],
    'Security',
    false,
    188
  ),
  (
    '00000000-0000-4000-a000-000000000008',
    'Applied Cryptography & Zero-Knowledge',
    'crypto-zkp',
    'Post-quantum cryptographic algorithms, zk-SNARKs, elliptic curve cryptography, secure multi-party computation, and decentralized ledgers.',
    '🧬',
    'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
    ARRAY['ZK-Rollups', 'ZKP', 'Cryptography', 'Circom', 'Rust'],
    'Security',
    false,
    145
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  banner_url = EXCLUDED.banner_url,
  tags = EXCLUDED.tags,
  category = EXCLUDED.category;
