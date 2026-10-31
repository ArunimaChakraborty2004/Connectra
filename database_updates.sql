-- 1. Add new columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- 2. Add updated_at to posts and comments
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

ALTER TABLE comments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. Create connections table
CREATE TABLE IF NOT EXISTS connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(requester_id, receiver_id)
);

-- RLS for connections
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Connections are viewable by everyone"
ON connections FOR SELECT
USING (true);

CREATE POLICY "Users can insert connection requests"
ON connections FOR INSERT
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update their own received requests"
ON connections FOR UPDATE
USING (auth.uid() = receiver_id OR auth.uid() = requester_id);

CREATE POLICY "Users can delete their connections"
ON connections FOR DELETE
USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- 4. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('follow', 'connection_request', 'connection_accepted', 'like', 'comment')),
    entity_id UUID, -- Can be post_id, comment_id, or connection_id
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- If notifications table already existed with older constraint, drop and update the check constraint:
DO $$
BEGIN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('follow', 'connection_request', 'connection_accepted', 'like', 'comment'));
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications (and users triggering them)"
ON notifications FOR INSERT
WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "Users can update their own notifications (mark as read)"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
ON notifications FOR DELETE
USING (auth.uid() = user_id);

-- ==============================================================================
-- 5. AI ENHANCEMENTS FOR CONNECTRA (Embeddings, Copilot History & Teammate Match)
-- ==============================================================================

-- 5.1 Enable pgvector extension for AI semantic search & recommendations (if available in Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- 5.2 Add AI Metadata & Embeddings to Profiles, Posts, and Projects
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_skills TEXT[],
ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_tags TEXT[],
ADD COLUMN IF NOT EXISTS ai_security_score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS target_roles TEXT[],
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 5.3 AI Copilot Conversations Table (Persistent developer assistant history)
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    model TEXT DEFAULT 'qwen/qwen3.8-27b',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI conversations"
ON ai_conversations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI conversations"
ON ai_conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI conversations"
ON ai_conversations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI conversations"
ON ai_conversations FOR DELETE
USING (auth.uid() = user_id);

-- 5.4 AI Copilot Messages Table
CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from their conversations"
ON ai_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert messages into their conversations"
ON ai_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their AI messages"
ON ai_messages FOR DELETE
USING (auth.uid() = user_id);

-- 5.5 AI Teammate Match Suggestions Table
CREATE TABLE IF NOT EXISTS project_ai_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    match_reason TEXT,
    suggested_role TEXT,
    status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'invited', 'declined', 'accepted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(project_id, user_id)
);

ALTER TABLE project_ai_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view AI matches"
ON project_ai_matches FOR SELECT
USING (true);

CREATE POLICY "Project owners can manage AI matches"
ON project_ai_matches FOR ALL
USING (auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_id));

-- ==============================================================================
-- 6. CHAT GROUPS, MEMBERS & ADMIN CONTROLS (Database Persistence)
-- ==============================================================================

-- 6.1 Chat Groups Table
CREATE TABLE IF NOT EXISTS chat_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    announcement TEXT,
    announcement_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Groups viewable by members or public"
ON chat_groups FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create groups"
ON chat_groups FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Admins or creators can update group settings and announcements"
ON chat_groups FOR UPDATE
USING (
    auth.uid() = creator_id OR 
    EXISTS (
        SELECT 1 FROM chat_group_members 
        WHERE group_id = chat_groups.id 
        AND user_id = auth.uid() 
        AND role = 'admin'
    )
);

CREATE POLICY "Creators can delete group"
ON chat_groups FOR DELETE
USING (auth.uid() = creator_id);

-- 6.2 Chat Group Members Table
CREATE TABLE IF NOT EXISTS chat_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(group_id, user_id)
);

ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members are viewable by everyone"
ON chat_group_members FOR SELECT
USING (true);

CREATE POLICY "Users and group creators can add group members"
ON chat_group_members FOR INSERT
WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM chat_groups WHERE id = group_id AND creator_id = auth.uid())
);

CREATE POLICY "Admins or creators can update member roles"
ON chat_group_members FOR UPDATE
USING (
    EXISTS (SELECT 1 FROM chat_groups WHERE id = group_id AND creator_id = auth.uid())
);

CREATE POLICY "Members can leave or creators can remove members"
ON chat_group_members FOR DELETE
USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM chat_groups WHERE id = group_id AND creator_id = auth.uid())
);


-- 6.3 Chat Group Messages Table
CREATE TABLE IF NOT EXISTS chat_group_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_announcement BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE chat_group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view group messages"
ON chat_group_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM chat_group_members 
        WHERE group_id = chat_group_messages.group_id 
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Members can send messages"
ON chat_group_messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM chat_group_members 
        WHERE group_id = chat_group_messages.group_id 
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Senders or admins can delete messages"
ON chat_group_messages FOR DELETE
USING (
    auth.uid() = sender_id OR
    EXISTS (
        SELECT 1 FROM chat_groups 
        WHERE id = group_id AND creator_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM chat_group_members 
        WHERE group_id = chat_group_messages.group_id 
        AND user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- 6.4 Additional Group & Messaging Columns (Privacy, Invite Codes, Attachments)
ALTER TABLE chat_groups
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS invite_code TEXT;

ALTER TABLE chat_group_messages
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT;

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT;

-- ==============================================================================
-- 8. COMPREHENSIVE SEED DATA (11 Developers, Technical Posts, Images & Comments)
-- ==============================================================================
-- Also available in dedicated file: seed_data.sql

-- 8.0 Ensure Required Extensions, Columns & RLS Exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS code_snippet TEXT,
ADD COLUMN IF NOT EXISTS code_language TEXT,
ADD COLUMN IF NOT EXISTS poll_data JSONB,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS tech_stack TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS github_url TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (follower_id, following_id)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert profile" ON profiles;
CREATE POLICY "Anyone can insert profile" ON profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id OR auth.uid() IS NULL);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All can view posts" ON posts;
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
CREATE POLICY "Posts are viewable by everyone" ON posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert their own posts" ON posts;
DROP POLICY IF EXISTS "Users can insert posts" ON posts;
CREATE POLICY "Users can insert posts" ON posts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
CREATE POLICY "Users can update their own posts" ON posts FOR UPDATE USING (auth.uid() = user_id OR auth.uid() IS NULL);
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
CREATE POLICY "Users can delete their own posts" ON posts FOR DELETE USING (auth.uid() = user_id OR auth.uid() IS NULL);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON likes;
CREATE POLICY "Likes are viewable by everyone" ON likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert likes" ON likes;
CREATE POLICY "Users can insert likes" ON likes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can delete likes" ON likes;
CREATE POLICY "Users can delete likes" ON likes FOR DELETE USING (auth.uid() = user_id OR auth.uid() IS NULL);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert comments" ON comments;
CREATE POLICY "Users can insert comments" ON comments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can delete comments" ON comments;
CREATE POLICY "Users can delete comments" ON comments FOR DELETE USING (auth.uid() = user_id OR auth.uid() IS NULL);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON follows;
CREATE POLICY "Follows are viewable by everyone" ON follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert follows" ON follows;
CREATE POLICY "Users can insert follows" ON follows FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can delete follows" ON follows;
CREATE POLICY "Users can delete follows" ON follows FOR DELETE USING (auth.uid() = follower_id OR auth.uid() IS NULL);

DO $$
DECLARE
    u RECORD;
BEGIN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    FOR u IN (
        SELECT * FROM (VALUES
            ('b0000000-0000-4000-a000-000000000001'::uuid, 'alex@connectra.dev', 'Alex Rivers', 'alex_rivers'),
            ('b0000000-0000-4000-a000-000000000002'::uuid, 'elena@connectra.dev', 'Elena Rostova', 'elena_sec'),
            ('b0000000-0000-4000-a000-000000000003'::uuid, 'marcus@connectra.dev', 'Marcus Vance', 'marcus_cloud'),
            ('b0000000-0000-4000-a000-000000000004'::uuid, 'sarah@connectra.dev', 'Sarah Chen', 'sarah_ai'),
            ('b0000000-0000-4000-a000-000000000005'::uuid, 'devon@connectra.dev', 'Devon Miles', 'devon_fullstack'),
            ('b0000000-0000-4000-a000-000000000006'::uuid, 'priya@connectra.dev', 'Priya Sharma', 'priya_dev'),
            ('b0000000-0000-4000-a000-000000000007'::uuid, 'kai@connectra.dev', 'Kai Takahashi', 'kai_systems'),
            ('b0000000-0000-4000-a000-000000000008'::uuid, 'maya@connectra.dev', 'Maya Lin', 'maya_ux'),
            ('b0000000-0000-4000-a000-000000000009'::uuid, 'liam@connectra.dev', 'Liam O''Connor', 'liam_devops'),
            ('b0000000-0000-4000-a000-000000000010'::uuid, 'aisha@connectra.dev', 'Aisha Al-Mansoor', 'aisha_web3'),
            ('b0000000-0000-4000-a000-000000000011'::uuid, 'jordan@connectra.dev', 'Jordan Blake', 'jordan_backend')
        ) AS t(id, email, full_name, username)
    ) LOOP
        BEGIN
            INSERT INTO auth.users (
                id,
                instance_id,
                aud,
                role,
                email,
                encrypted_password,
                email_confirmed_at,
                raw_app_meta_data,
                raw_user_meta_data,
                created_at,
                updated_at,
                confirmation_token,
                recovery_token
            ) VALUES (
                u.id,
                '00000000-0000-0000-0000-000000000000',
                'authenticated',
                'authenticated',
                u.email,
                crypt('abc@123', gen_salt('bf')),
                now(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                jsonb_build_object('full_name', u.full_name, 'username', u.username),
                now(),
                now(),
                '',
                ''
            )
            ON CONFLICT (id) DO UPDATE SET
                encrypted_password = crypt('abc@123', gen_salt('bf')),
                email = EXCLUDED.email,
                email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
                raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
                raw_user_meta_data = jsonb_build_object('full_name', u.full_name, 'username', u.username);

            BEGIN
                INSERT INTO auth.identities (
                    id,
                    user_id,
                    identity_data,
                    provider,
                    provider_id,
                    last_sign_in_at,
                    created_at,
                    updated_at
                ) VALUES (
                    u.id::text,
                    u.id,
                    jsonb_build_object('sub', u.id::text, 'email', u.email),
                    'email',
                    u.email,
                    now(),
                    now(),
                    now()
                )
                ON CONFLICT DO NOTHING;
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;

        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping user %: %', u.email, SQLERRM;
        END;
    END LOOP;
END $$;

INSERT INTO profiles (
    id, username, full_name, bio, tech_stack, avatar_url, github_url, linkedin_url, website_url, portfolio_url, xp, level
) VALUES
(
    'b0000000-0000-4000-a000-000000000001',
    'alex_rivers',
    'Alex Rivers',
    'Staff Frontend Architect @ Vercel ecosystem ⚛️ | React 19, Server Components & Micro-frontends evangelist | Speaker & open-source builder',
    'React, Next.js, TypeScript, TailwindCSS, GraphQL, Turbopack',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    'https://github.com/alexrivers',
    'https://linkedin.com/in/alexrivers',
    'https://alexrivers.dev',
    'https://alexrivers.dev/portfolio',
    3850,
    8
),
(
    'b0000000-0000-4000-a000-000000000002',
    'elena_sec',
    'Elena Rostova',
    'Principal AppSec & Cryptography Engineer 🛡️ | Zero-Trust architecture, Rust, eBPF & Web3 security auditor | Ex-CrowdStrike',
    'Rust, eBPF, Cybersecurity, Linux, Go, Cryptography',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    'https://github.com/elenarostova',
    'https://linkedin.com/in/elenarostova',
    'https://elenasec.io',
    'https://elenasec.io/audits',
    4920,
    9
),
(
    'b0000000-0000-4000-a000-000000000003',
    'marcus_cloud',
    'Marcus Vance',
    'Cloud Native & Platform Engineer ☁️ | Kubernetes, Terraform, ArgoCD | Building resilient multi-region infrastructure at scale',
    'Kubernetes, Docker, Go, Terraform, AWS, Prometheus',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    'https://github.com/marcusvance',
    'https://linkedin.com/in/marcusvance',
    'https://cloudvance.net',
    'https://cloudvance.net/projects',
    3100,
    7
),
(
    'b0000000-0000-4000-a000-000000000004',
    'sarah_ai',
    'Sarah Chen',
    'Founding AI Researcher @ SynthAI 🧠 | LLM fine-tuning, RAG evaluation, LangGraph & agentic workflows | Stanford AI Lab alum',
    'Python, PyTorch, LangChain, OpenAI, HuggingFace, FastAPI',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    'https://github.com/sarahchen-ai',
    'https://linkedin.com/in/sarahchen',
    'https://sarahchen.ai',
    'https://sarahchen.ai/papers',
    6200,
    10
),
(
    'b0000000-0000-4000-a000-000000000005',
    'devon_fullstack',
    'Devon Miles',
    'Full-Stack Product Hacker 🚀 | Building micro-SaaS with Supabase, Next.js 15 & Stripe | 3x indie founder sharing the journey',
    'TypeScript, Supabase, Next.js, PostgreSQL, Node.js, TailwindCSS',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    'https://github.com/devonmiles',
    'https://linkedin.com/in/devonmiles',
    'https://devonbuilds.com',
    'https://devonbuilds.com/apps',
    2450,
    6
),
(
    'b0000000-0000-4000-a000-000000000006',
    'priya_dev',
    'Priya Sharma',
    'Senior Mobile & Flutter Lead 📱 | Crafting pixel-perfect 120fps cross-platform mobile apps | Open-source UI kit creator & speaker',
    'Flutter, Dart, React Native, Swift, Kotlin, Firebase',
    'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=400&q=80',
    'https://github.com/priyasharma-dev',
    'https://linkedin.com/in/priyasharmadev',
    'https://priyadev.codes',
    'https://priyadev.codes/showcase',
    3400,
    7
),
(
    'b0000000-0000-4000-a000-000000000007',
    'kai_systems',
    'Kai Takahashi',
    'Low-Level Systems Tinkerer ⚡ | High-frequency trading pipelines in C++23 & Rust | Distributed consensus, SIMD & cache-line tuning',
    'Rust, C++, WebAssembly, Linux, Zig, SIMD',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    'https://github.com/kaitakahashi',
    'https://linkedin.com/in/kaitakahashi',
    'https://kaiperf.org',
    'https://kaiperf.org/benchmarks',
    5120,
    9
),
(
    'b0000000-0000-4000-a000-000000000008',
    'maya_ux',
    'Maya Lin',
    'Design Systems Architect & Creative Technologist ✨ | Bridging Figma design tokens with React code | Accessible design, micro-interactions & WebGL',
    'CSS, Figma, Three.js, React, WebGL, Design Systems',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    'https://github.com/mayalin-ux',
    'https://linkedin.com/in/mayalin',
    'https://mayalin.design',
    'https://mayalin.design/work',
    2890,
    6
),
(
    'b0000000-0000-4000-a000-000000000009',
    'liam_devops',
    'Liam O''Connor',
    'Site Reliability Engineer @ Datadog ecosystem | Observability, OpenTelemetry, Chaos Engineering & Incident Management 🚨',
    'Go, OpenTelemetry, Docker, Grafana, Linux, Python',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    'https://github.com/liamoconnor',
    'https://linkedin.com/in/liamoconnor',
    'https://sre-notes.io',
    'https://sre-notes.io/dashboard',
    4100,
    8
),
(
    'b0000000-0000-4000-a000-000000000010',
    'aisha_web3',
    'Aisha Al-Mansoor',
    'Smart Contract Architect & DeFi Researcher ⛓️ | EVM internals, Solidity formal verification, Foundry & ZK-SNARKs',
    'Solidity, Foundry, TypeScript, Web3, Python, Ethereum',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80',
    'https://github.com/aisha-web3',
    'https://linkedin.com/in/aishaalmansoor',
    'https://aishadefi.xyz',
    'https://aishadefi.xyz/research',
    3670,
    7
),
(
    'b0000000-0000-4000-a000-000000000011',
    'jordan_backend',
    'Jordan Blake',
    'Staff Distributed Systems Engineer | Event-driven microservices, Kafka streaming, PostgreSQL partitioning & high-throughput APIs',
    'Java, Go, Kafka, PostgreSQL, Spring Boot, Docker',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80',
    'https://github.com/jordanblake',
    'https://linkedin.com/in/jordanblake',
    'https://jordanbackend.dev',
    'https://jordanbackend.dev/articles',
    4300,
    8
)
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    bio = EXCLUDED.bio,
    tech_stack = EXCLUDED.tech_stack,
    avatar_url = EXCLUDED.avatar_url,
    github_url = EXCLUDED.github_url,
    linkedin_url = EXCLUDED.linkedin_url,
    website_url = EXCLUDED.website_url,
    portfolio_url = EXCLUDED.portfolio_url,
    xp = EXCLUDED.xp,
    level = EXCLUDED.level;

-- 8.1 Rich Technical Posts
INSERT INTO posts (
    id, user_id, content, image_url, code_snippet, code_language, poll_data, created_at
) VALUES
(
    'c0000000-0000-4000-a000-000000000001',
    'b0000000-0000-4000-a000-000000000001',
    '🚀 React 19 Server Actions & `useActionState` have completely redefined how we build forms and mutations! No more manual `isSubmitting` tracking or messy `useEffect` cascades.

Here is a clean pattern we just shipped into production for zero-layout-shift optimistic updates:

#react #nextjs #typescript #webdev #frontend',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
    '// Optimistic profile update with React 19 useActionState
import { useActionState, useOptimistic } from "react";
import { updateProfileName } from "@/actions/profile";

export function ProfileEditor({ currentName }) {
  const [optimisticName, setOptimisticName] = useOptimistic(
    currentName,
    (current, update) => update
  );

  const [state, formAction, isPending] = useActionState(
    async (previousState, formData) => {
      const newName = formData.get("name");
      setOptimisticName(newName);
      return await updateProfileName(newName);
    },
    null
  );

  return (
    <form action={formAction} className="flex gap-2">
      <input name="name" defaultValue={optimisticName} className="border p-2 rounded" />
      <button disabled={isPending}>{isPending ? "Saving..." : "Update"}</button>
    </form>
  );
}',
    'javascript',
    NULL,
    now() - INTERVAL '15 minutes'
),
(
    'c0000000-0000-4000-a000-000000000002',
    'b0000000-0000-4000-a000-000000000004',
    '🧠 We evaluated 6 agentic workflow patterns across 10,000 multi-turn coding queries. The verdict? Single-prompt zero-shot reasoning fails on 41% of edge cases, whereas a dual-agent "Generator + Critic" loop with automated linter feedback scored 94.2% accuracy!

What is your go-to agentic framework for production right now?

#ai #python #langchain #machinelearning #rag',
    NULL,
    'from pydantic import BaseModel, Field
from typing import List

class CodeReviewAudit(BaseModel):
    has_vulnerabilities: bool = Field(description="Detects OWASP Top 10 or memory bugs")
    security_score: int = Field(ge=0, le=100, description="0-100 security index")
    suggestions: List[str] = Field(description="Actionable remediation steps")

def run_critic_loop(llm_client, generated_code: str) -> CodeReviewAudit:
    return llm_client.beta.chat.completions.parse(
        model="gpt-4o",
        response_format=CodeReviewAudit,
        messages=[
            {"role": "system", "content": "You are a ruthless AppSec Auditor."},
            {"role": "user", "content": f"Audit this code:\n{generated_code}"}
        ]
    )',
    'python',
    '{"question": "Which agentic orchestration framework are you using in production?", "options": [{"text": "LangGraph / LangChain", "votes": 38}, {"text": "LlamaIndex Workflows", "votes": 22}, {"text": "Custom Python / AsyncIO", "votes": 45}, {"text": "CrewAI / AutoGen", "votes": 14}]}'::jsonb,
    now() - INTERVAL '1 hour'
),
(
    'c0000000-0000-4000-a000-000000000003',
    'b0000000-0000-4000-a000-000000000002',
    '🛡️ eBPF + Rust is the ultimate cheat code for zero-overhead runtime security. By hooking directly into `sys_enter_execve`, we can catch reverse shells and unauthorized binaries before they even execute in user-space.

Setup telemetry from today''s live demo session in the cyber lab! 💻🔒

#cybersecurity #rust #ebpf #linux #security',
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
    '// Aya eBPF Kernel Probe in Rust
#![no_std]
#![no_main]

use aya_bpf::{macros::kprobe, programs::ProbeContext};
use aya_log_ebpf::info;

#[kprobe]
pub fn audit_execve(ctx: ProbeContext) -> u32 {
    match try_audit_execve(ctx) {
        Ok(ret) => ret,
        Err(_) => 1,
    }
}

fn try_audit_execve(ctx: ProbeContext) -> Result<u32, i64> {
    info!(&ctx, "ALERT: Binary execution intercepted at sys_enter_execve!");
    Ok(0)
}',
    'rust',
    NULL,
    now() - INTERVAL '3 hours'
),
(
    'c0000000-0000-4000-a000-000000000004',
    'b0000000-0000-4000-a000-000000000003',
    '☁️ We just migrated our core microservices cluster from ALB ingress to Cilium eBPF Service Mesh with mTLS enabled out of the box. 

Results after 48 hours:
- Inter-pod latency dropped from 2.8ms to 0.7ms (-75%)
- AWS cross-AZ data transfer fees decreased by 42%
- Full L7 cryptographic tracing with zero sidecar overhead

#kubernetes #cloud #devops #docker #aws #infrastructure',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
    NULL,
    NULL,
    NULL,
    now() - INTERVAL '5 hours'
),
(
    'c0000000-0000-4000-a000-000000000005',
    'b0000000-0000-4000-a000-000000000005',
    '⚡ Built a real-time collaborative workspace powered entirely by Supabase Database Webhooks and Edge Functions in under 3 days!

Postgres RLS + Row Level Subscriptions is easily the most underrated superpower for solo founders. You literally don''t need a separate WebSocket server.

#supabase #fullstack #indiehackers #nextjs #webdev',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    '// Supabase Realtime Channel Subscription
import { supabase } from "@/lib/supabase";

export function listenToActiveCollaborators(projectId, onUserUpdate) {
  const channel = supabase
    .channel(`project-presence-${projectId}`)
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      onUserUpdate(Object.values(state).flat());
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

  return () => channel.unsubscribe();
}',
    'javascript',
    '{"question": "What is your primary backend database choice for new apps in 2026?", "options": [{"text": "Supabase (PostgreSQL)", "votes": 64}, {"text": "MongoDB Atlas", "votes": 12}, {"text": "PlanetScale / Neon", "votes": 28}, {"text": "Self-hosted PostgreSQL", "votes": 19}]}'::jsonb,
    now() - INTERVAL '7 hours'
),
(
    'c0000000-0000-4000-a000-000000000006',
    'b0000000-0000-4000-a000-000000000008',
    '✨ Dark Mode Glassmorphism with dynamic ambient light refraction. 

A lot of CSS glass designs look flat because they only use `backdrop-filter: blur()`. If you add a subtle 1px dual-tone gradient border with `radial-gradient` tracking the mouse position, the UI feels physical and tactile.

Check out the interactive canvas preview! 👇

#css #ui #designsystems #react #frontend #webdesign',
    'https://images.unsplash.com/photo-1581291518655-9523c932edcf?auto=format&fit=crop&w=1200&q=80',
    '/* Dynamic Glass Card with Ambient Edge Reflection */
.glass-cyber-card {
  background: rgba(18, 22, 34, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 
    0 8px 32px 0 rgba(0, 0, 0, 0.37),
    inset 0 1px 1px rgba(255, 255, 255, 0.15);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.glass-cyber-card:hover {
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 12px 40px -10px rgba(99, 102, 241, 0.3);
  transform: translateY(-2px);
}',
    'css',
    NULL,
    now() - INTERVAL '9 hours'
),
(
    'c0000000-0000-4000-a000-000000000007',
    'b0000000-0000-4000-a000-000000000007',
    '⚡ Benchmarking zero-copy memory deserialization: `rkyv` in Rust vs `FlatBuffers` vs standard `serde_json`.

Results on a 500MB telemetry dataset:
- `serde_json`: 1,420 ms (CPU pegged at 100%)
- `FlatBuffers`: 48 ms
- `rkyv` (Rust zero-copy): 0.12 ms (! Literally pointer cast into mmap)

If you are building low-latency systems or high-frequency stream processors, you cannot afford serialization overhead.

#rust #systems #performance #cpp #backend',
    NULL,
    'use rkyv::{Archive, Deserialize, Serialize};

#[derive(Archive, Deserialize, Serialize, Debug, PartialEq)]
#[archive(compare(PartialEq))]
#[archive_attr(derive(Debug))]
struct OrderBookSnapshot {
    timestamp_ns: u64,
    bids: Vec<(u64, u32)>,
    asks: Vec<(u64, u32)>,
}

fn read_instant_snapshot(buffer: &[u8]) -> &ArchivedOrderBookSnapshot {
    unsafe { rkyv::archived_root::<OrderBookSnapshot>(buffer) }
}',
    'rust',
    NULL,
    now() - INTERVAL '12 hours'
),
(
    'c0000000-0000-4000-a000-000000000008',
    'b0000000-0000-4000-a000-000000000006',
    '📱 60fps is good, but 120fps ProMotion on mobile is pure butter! 🧈

We just refactored our Flutter navigation animations to isolate layer repaints using `RepaintBoundary` and compiled shaders ahead of time with Impeller. No more shader compilation jank on first run!

#flutter #mobile #dart #ios #android #appdev',
    'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80',
    NULL,
    NULL,
    NULL,
    now() - INTERVAL '16 hours'
),
(
    'c0000000-0000-4000-a000-000000000009',
    'b0000000-0000-4000-a000-000000000010',
    '⛓️ Audited a DeFi protocol today that nearly lost $4.2M due to unchecked storage slot collision in an upgradeable UUPS proxy.

Remember: When using upgradeable smart contracts, ALWAYS reserve storage gaps (`uint256[50] __gap;`) at the end of each base contract to prevent state variable shifting when adding new inheritance!

#web3 #solidity #ethereum #defi #cybersecurity',
    NULL,
    '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract SecureVaultStorage is Initializable {
    uint256 public totalLockedValue;
    mapping(address => uint256) public userBalances;

    uint256[48] private __gap;
}',
    'solidity',
    NULL,
    now() - INTERVAL '20 hours'
),
(
    'c0000000-0000-4000-a000-000000000010',
    'b0000000-0000-4000-a000-000000000011',
    '🚨 The Outbox Pattern is non-negotiable for distributed microservices.

If you write to your primary database and then send an event to Kafka in the same controller without a transactional outbox table, you WILL eventually drop messages when the network hiccup occurs between the two.

Two-phase commit is dead; Outbox + Debezium CDC is king.

#kafka #architecture #postgresql #microservices #backend',
    NULL,
    '// Reliable Outbox Producer Pattern in TypeScript
export async function emitTransactionalEvent(tx, aggregateType, aggregateId, eventType, payload) {
  return await tx.from("outbox").insert({
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    event_type: eventType,
    payload: JSON.stringify(payload),
    status: "pending"
  });
}',
    'typescript',
    NULL,
    now() - INTERVAL '1 day'
),
(
    'c0000000-0000-4000-a000-000000000011',
    'b0000000-0000-4000-a000-000000000009',
    '📈 Chaos Engineering reminder: If you haven''t tested killing your leader node during peak traffic, you don''t have high availability—you just have hope!

Ran a Chaos Mesh partition test today on our Redis Sentinel failover. Failover took 1.4 seconds with zero dropped connections thanks to client-side retry buffers with exponential backoff.

#devops #sre #observability #cloud #reliability',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
    NULL,
    NULL,
    NULL,
    now() - INTERVAL '1 day 4 hours'
)
ON CONFLICT (id) DO UPDATE SET
    content = EXCLUDED.content,
    image_url = EXCLUDED.image_url,
    code_snippet = EXCLUDED.code_snippet,
    code_language = EXCLUDED.code_language,
    poll_data = EXCLUDED.poll_data,
    created_at = EXCLUDED.created_at;

-- 8.2 Follow Relationships
INSERT INTO follows (follower_id, following_id, created_at)
VALUES
('b0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000004', now()),
('b0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000005', now()),
('b0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000008', now()),
('b0000000-0000-4000-a000-000000000002', 'b0000000-0000-4000-a000-000000000007', now()),
('b0000000-0000-4000-a000-000000000002', 'b0000000-0000-4000-a000-000000000010', now()),
('b0000000-0000-4000-a000-000000000003', 'b0000000-0000-4000-a000-000000000009', now()),
('b0000000-0000-4000-a000-000000000004', 'b0000000-0000-4000-a000-000000000001', now()),
('b0000000-0000-4000-a000-000000000004', 'b0000000-0000-4000-a000-000000000007', now()),
('b0000000-0000-4000-a000-000000000008', 'b0000000-0000-4000-a000-000000000001', now()),
('b0000000-0000-4000-a000-000000000008', 'b0000000-0000-4000-a000-000000000006', now()),
('b0000000-0000-4000-a000-000000000007', 'b0000000-0000-4000-a000-000000000002', now()),
('b0000000-0000-4000-a000-000000000007', 'b0000000-0000-4000-a000-000000000011', now()),
('b0000000-0000-4000-a000-000000000010', 'b0000000-0000-4000-a000-000000000002', now())
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- 8.3 Likes & Comments
INSERT INTO likes (post_id, user_id)
VALUES
('c0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000004'),
('c0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000005'),
('c0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000008'),
('c0000000-0000-4000-a000-000000000002', 'b0000000-0000-4000-a000-000000000001'),
('c0000000-0000-4000-a000-000000000002', 'b0000000-0000-4000-a000-000000000007'),
('c0000000-0000-4000-a000-000000000002', 'b0000000-0000-4000-a000-000000000002'),
('c0000000-0000-4000-a000-000000000003', 'b0000000-0000-4000-a000-000000000007'),
('c0000000-0000-4000-a000-000000000003', 'b0000000-0000-4000-a000-000000000003'),
('c0000000-0000-4000-a000-000000000003', 'b0000000-0000-4000-a000-000000000010'),
('c0000000-0000-4000-a000-000000000006', 'b0000000-0000-4000-a000-000000000001'),
('c0000000-0000-4000-a000-000000000006', 'b0000000-0000-4000-a000-000000000006')
ON CONFLICT DO NOTHING;

INSERT INTO comments (post_id, user_id, content, created_at)
VALUES
(
    'c0000000-0000-4000-a000-000000000001',
    'b0000000-0000-4000-a000-000000000005',
    'This pattern is so much cleaner than our old React Hook Form + Zod boilerplate. Are you handling rollback on network errors with `setOptimisticName` automatically?',
    now() - INTERVAL '10 minutes'
),
(
    'c0000000-0000-4000-a000-000000000001',
    'b0000000-0000-4000-a000-000000000001',
    '@devon_fullstack Yes! React 19 automatically rolls back `useOptimistic` to the previous server state if the form action throws or rejects. It''s flawless!',
    now() - INTERVAL '5 minutes'
),
(
    'c0000000-0000-4000-a000-000000000002',
    'b0000000-0000-4000-a000-000000000002',
    'Spot on Sarah! Dual-agent verification with a dedicated security critic catches subtle prompt injections that single passes completely ignore.',
    now() - INTERVAL '40 minutes'
),
(
    'c0000000-0000-4000-a000-000000000003',
    'b0000000-0000-4000-a000-000000000007',
    'Aya is incredible. How does memory usage compare when loading maps into BTF-enabled Linux kernels 6.x?',
    now() - INTERVAL '2 hours'
),
(
    'c0000000-0000-4000-a000-000000000006',
    'b0000000-0000-4000-a000-000000000001',
    'That 1px dual-tone gradient border really gives it that Apple VisionOS depth. Gorgeous work Maya!',
    now() - INTERVAL '6 hours'
)
ON CONFLICT DO NOTHING;




