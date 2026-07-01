import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Loader from '../components/ui/Loader';
import ProjectKanban from '../components/projects/ProjectKanban';
import ProjectTeam from '../components/projects/ProjectTeam';
import ProjectFiles from '../components/projects/ProjectFiles';
import ProjectMilestones from '../components/projects/ProjectMilestones';
import { LayoutDashboard, CheckSquare, Users, FolderOpen, Flag, ExternalLink, Github } from 'lucide-react';
import { toast } from '../lib/toast';

export default function ProjectDetails({ session }) {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      // Fetch project details
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('id', id)
        .single();
      
      if (error) {
        toast.error('Failed to load project details');
      } else {
        setProject(data);
        
        // Check user role in project (owner or member)
        if (data.user_id === session?.user?.id) {
          setUserRole('owner');
        } else {
          const { data: memberData } = await supabase
            .from('project_members')
            .select('role')
            .eq('project_id', id)
            .eq('user_id', session?.user?.id)
            .eq('status', 'active')
            .single();
          
          if (memberData) {
            setUserRole(memberData.role);
          }
        }
      }
      setLoading(false);
    };

    if (session) {
      fetchProject();
    }
  }, [id, session]);

  if (loading) return <Loader fullScreen />;
  if (!project) return <div className="text-center mt-20 text-main">Project not found</div>;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'kanban', label: 'Tasks', icon: CheckSquare },
    { id: 'milestones', label: 'Milestones', icon: Flag },
    { id: 'files', label: 'Files', icon: FolderOpen },
    { id: 'team', label: 'Team', icon: Users }
  ];

  return (
    <div className="min-h-screen bg-background text-main font-sans">
      <div className="max-w-[1400px] mx-auto px-6 py-8 relative z-10">
        
        {/* Project Header */}
        <div className="glass-panel rounded-2xl p-8 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{project.title}</h1>
                {project.status && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    project.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  }`}>
                    {project.status.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-muted text-lg max-w-2xl">{project.description}</p>
              
              <div className="flex items-center gap-4 mt-6">
                {project.repo_url && (
                  <a href={project.repo_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-main hover:text-primary transition-colors">
                    <Github size={16} /> Repository
                  </a>
                )}
                {project.demo_url && (
                  <a href={project.demo_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-main hover:text-primary transition-colors">
                    <ExternalLink size={16} /> Live Demo
                  </a>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted uppercase tracking-wider mb-1">Created By</p>
                <Link to={`/profile/${project.profiles?.username}`} className="flex items-center gap-2 hover:opacity-80">
                  <div className="h-8 w-8 rounded-full glass-panel flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                    {project.profiles?.avatar_url ? <img src={project.profiles.avatar_url} alt="" /> : project.profiles?.username[0].toUpperCase()}
                  </div>
                  <span className="font-semibold">{project.profiles?.username}</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto gap-2 mb-8 border-b border-white/5 pb-px no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-all ${
                activeTab === tab.id 
                  ? 'text-primary border-b-2 border-primary' 
                  : 'text-muted hover:text-main hover:bg-surface-hover rounded-t-lg'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[500px]">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="glass-panel p-6 rounded-2xl">
                  <h3 className="text-lg font-bold mb-4">About this project</h3>
                  <p className="text-muted leading-relaxed whitespace-pre-wrap">{project.description}</p>
                </div>
                
                {project.screenshots && project.screenshots.length > 0 && (
                  <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-lg font-bold mb-4">Screenshots</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {project.screenshots.map((img, i) => (
                        <img key={i} src={img} alt={`Screenshot ${i+1}`} className="rounded-xl w-full h-48 object-cover border border-white/10" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-6">
                <div className="glass-panel p-6 rounded-2xl">
                  <h3 className="text-sm text-muted font-bold uppercase tracking-wider mb-3">Tech Stack</h3>
                  <div className="flex flex-wrap gap-2">
                    {project.tech_stack ? project.tech_stack.split(',').map((tech, i) => (
                      <span key={i} className="px-3 py-1 bg-surface border border-white/5 rounded-lg text-sm text-main">
                        {tech.trim()}
                      </span>
                    )) : <span className="text-muted text-sm">Not specified</span>}
                  </div>
                </div>
                
                <div className="glass-panel p-6 rounded-2xl">
                  <h3 className="text-sm text-muted font-bold uppercase tracking-wider mb-3">Difficulty</h3>
                  <span className="px-3 py-1 bg-surface border border-white/5 rounded-lg text-sm text-main capitalize">
                    {project.difficulty || 'Not specified'}
                  </span>
                </div>

                <div className="glass-panel p-6 rounded-2xl">
                  <h3 className="text-sm text-muted font-bold uppercase tracking-wider mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {project.tags && project.tags.length > 0 ? project.tags.map((tag, i) => (
                      <span key={i} className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-semibold">
                        #{tag}
                      </span>
                    )) : <span className="text-muted text-sm">No tags</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'kanban' && <ProjectKanban projectId={project.id} userRole={userRole} session={session} />}
          {activeTab === 'milestones' && <ProjectMilestones projectId={project.id} userRole={userRole} session={session} />}
          {activeTab === 'files' && <ProjectFiles projectId={project.id} userRole={userRole} session={session} />}
          {activeTab === 'team' && <ProjectTeam projectId={project.id} userRole={userRole} ownerId={project.user_id} session={session} />}
        </div>

      </div>
    </div>
  );
}
