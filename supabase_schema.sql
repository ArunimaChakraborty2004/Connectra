-- Run this in your Supabase SQL Editor

-- 1. Update profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS tech_stack TEXT,
ADD COLUMN IF NOT EXISTS github_url TEXT;

-- 2. Update posts table
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS code_snippet TEXT,
  ADD COLUMN IF NOT EXISTS code_language TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All can view posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert their own posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    repo_url TEXT,
    demo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS and setup policies for projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Projects are viewable by everyone." 
ON projects FOR SELECT 
USING ( true );

CREATE POLICY "Users can insert their own projects." 
ON projects FOR INSERT 
WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can update their own projects." 
ON projects FOR UPDATE 
USING ( auth.uid() = user_id );

CREATE POLICY "Users can delete their own projects." 
ON projects FOR DELETE 
USING ( auth.uid() = user_id );

-- 5. Add Stats to Profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- 6. Create Follows Table
CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (follower_id, following_id)
);

-- Enable RLS for Follows
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are viewable by everyone." 
ON follows FOR SELECT 
USING ( true );

CREATE POLICY "Users can follow others." 
ON follows FOR INSERT 
WITH CHECK ( auth.uid() = follower_id );

CREATE POLICY "Users can unfollow." 
ON follows FOR DELETE 
USING ( auth.uid() = follower_id );
