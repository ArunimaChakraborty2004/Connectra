-- Create Reels table
CREATE TABLE reels (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  caption TEXT,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'followers')),
  allow_comments BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for Reels
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;

-- Policies for Reels
CREATE POLICY "Public reels are viewable by everyone" 
  ON reels FOR SELECT 
  USING (visibility = 'public');

CREATE POLICY "Users can view their own reels regardless of visibility" 
  ON reels FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reels" 
  ON reels FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reels" 
  ON reels FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reels" 
  ON reels FOR DELETE 
  USING (auth.uid() = user_id);

-- Create Reel Likes table
CREATE TABLE reel_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reel_id UUID REFERENCES reels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(reel_id, user_id)
);

-- Enable RLS for Reel Likes
ALTER TABLE reel_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reel likes are viewable by everyone" 
  ON reel_likes FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own likes" 
  ON reel_likes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" 
  ON reel_likes FOR DELETE 
  USING (auth.uid() = user_id);

-- Create Reel Comments table
CREATE TABLE reel_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reel_id UUID REFERENCES reels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for Reel Comments
ALTER TABLE reel_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reel comments are viewable by everyone" 
  ON reel_comments FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own comments" 
  ON reel_comments FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" 
  ON reel_comments FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" 
  ON reel_comments FOR DELETE 
  USING (auth.uid() = user_id);
