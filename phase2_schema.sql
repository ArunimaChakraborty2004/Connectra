-- Phase 2 Database Schema Additions for Collaboration Platform

-- 1. Extend the existing 'projects' table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS tech_stack TEXT,
ADD COLUMN IF NOT EXISTS difficulty TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS screenshots TEXT[],
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- 2. Create Project Members table
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'developer', 'designer', 'tester')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(project_id, user_id)
);

-- RLS for project_members
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members viewable by everyone" ON project_members FOR SELECT USING (true);
CREATE POLICY "Project owners/admins can insert members" ON project_members FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = project_members.project_id 
    AND pm.user_id = auth.uid() 
    AND pm.role IN ('owner', 'admin')
  ) 
  OR 
  (SELECT user_id FROM projects WHERE id = project_id) = auth.uid()
);
CREATE POLICY "Users can update their own membership (accept invite)" ON project_members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Project owners/admins can update roles" ON project_members FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = project_members.project_id 
    AND pm.user_id = auth.uid() 
    AND pm.role IN ('owner', 'admin')
  )
);
CREATE POLICY "Members can be deleted by themselves or admins" ON project_members FOR DELETE 
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = project_members.project_id 
    AND pm.user_id = auth.uid() 
    AND pm.role IN ('owner', 'admin')
  )
);

-- 3. Create Milestones table
CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Milestones viewable by everyone" ON milestones FOR SELECT USING (true);
CREATE POLICY "Project members can insert/update/delete milestones" ON milestones FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = milestones.project_id 
    AND pm.user_id = auth.uid() 
    AND pm.status = 'active'
  )
);

-- 4. Create Tasks table (Kanban)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
    assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'review', 'completed')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tasks viewable by everyone" ON tasks FOR SELECT USING (true);
CREATE POLICY "Project members can manage tasks" ON tasks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = tasks.project_id 
    AND pm.user_id = auth.uid() 
    AND pm.status = 'active'
  )
);

-- 5. Create Project Files table
CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project files viewable by everyone" ON project_files FOR SELECT USING (true);
CREATE POLICY "Project members can manage files" ON project_files FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = project_files.project_id 
    AND pm.user_id = auth.uid() 
    AND pm.status = 'active'
  )
);
