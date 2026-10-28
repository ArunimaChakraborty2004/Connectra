import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderGit2, ExternalLink, GitBranch, Plus, Code2 as GithubIcon, DownloadCloud, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { callGroq } from '../lib/ai';

export default function ProjectsModal({ session, onClose }) {
  const [projects, setProjects] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [addMode, setAddMode] = useState('none'); // 'none', 'manual', 'github'
  
  // GitHub Import State
  const [githubUsername, setGithubUsername] = useState('');
  const [githubRepos, setGithubRepos] = useState([]);
  const [isFetchingGithub, setIsFetchingGithub] = useState(false);
  const [importingId, setImportingId] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [aiGeneratingDesc, setAiGeneratingDesc] = useState(false);

  const handleGenerateDescription = async () => {
    if (!title.trim()) {
      alert('Please enter a project title first.');
      return;
    }
    setAiGeneratingDesc(true);
    try {
      const generated = await callGroq({
        messages: [
          { role: 'system', content: 'You are a tech product pitch expert on GitHub/Connectra.' },
          {
            role: 'user',
            content: `Write a compelling 2-sentence elevator pitch and key technical value proposition for a project named "${title}". Be concise and exciting for software engineers.`,
          },
        ],
        temperature: 0.7,
      });
      if (generated) {
        setDescription(generated.trim());
      }
    } catch (err) {
      setDescription(`An innovative open-source project designed to streamline workflows and deliver high performance.`);
    } finally {
      setAiGeneratingDesc(false);
    }
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (data) setProjects(data);
  };

  const loadUserProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (data) {
      setCurrentUserProfile(data);
      if (data.github_url) {
        try {
          const urlParts = new URL(data.github_url).pathname.split('/');
          const username = urlParts[1];
          if (username) setGithubUsername(username);
        } catch(e) {
          console.error("Invalid github url");
        }
      }
    }
  };

  useEffect(() => {
    loadProjects();
    loadUserProfile();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    await supabase.from('projects').insert({
      user_id: session.user.id,
      title, description, repo_url: repoUrl, demo_url: demoUrl
    });
    setTitle(''); setDescription(''); setRepoUrl(''); setDemoUrl('');
    setAddMode('none');
    loadProjects();
  };

  const fetchGithubRepos = async (e) => {
    e.preventDefault();
    if (!githubUsername) return;
    setIsFetchingGithub(true);
    try {
      const res = await fetch(`https://api.github.com/users/${githubUsername}/repos?sort=updated&per_page=10`);
      if (!res.ok) throw new Error('User not found');
      const data = await res.json();
      setGithubRepos(data);
    } catch (err) {
      alert("Could not fetch repositories. Check the username.");
      setGithubRepos([]);
    }
    setIsFetchingGithub(false);
  };

  const importGithubRepo = async (repo) => {
    setImportingId(repo.id);
    await supabase.from('projects').insert({
      user_id: session.user.id,
      title: repo.name,
      description: repo.description || 'No description provided.',
      repo_url: repo.html_url,
      demo_url: repo.homepage || ''
    });
    setImportingId(null);
    loadProjects();
    
    // Remove from the list so they don't import twice
    setGithubRepos(prev => prev.filter(r => r.id !== repo.id));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl glass-panel rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#050505]">
          <div className="flex items-center gap-3">
            <div className="p-2 glass-panel text-muted rounded-lg">
              <FolderGit2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-main">My Repositories</h2>
              <p className="text-sm text-muted">Manage and showcase your projects</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-[#666] hover:text-main rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <div className="flex flex-col gap-4">
            {projects.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-xl bg-surface">
                <FolderGit2 size={48} className="mx-auto text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-main mb-2">No projects yet</h3>
                <p className="text-gray-400 text-sm">Add your first repository manually or import from GitHub.</p>
              </div>
            ) : (
              projects.map(p => (
                <div key={p.id} className="group p-5 glass-panel rounded-xl hover:border-primary/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <Link to={`/projects/${p.id}`} onClick={onClose} className="text-lg font-bold text-main hover:text-primary transition-colors cursor-pointer hover:underline block truncate max-w-[70%]">
                      {p.title}
                    </Link>
                    <div className="flex gap-2">
                      {p.repo_url && (
                        <a href={p.repo_url} target="_blank" rel="noreferrer" className="p-2 bg-surface hover:bg-surface-hover text-gray-300 hover:text-main rounded-lg transition-colors tooltip" title="Repository">
                          <GitBranch size={16} />
                        </a>
                      )}
                      {p.demo_url && (
                        <a href={p.demo_url} target="_blank" rel="noreferrer" className="p-2 bg-surface hover:bg-surface-hover text-gray-300 hover:text-main rounded-lg transition-colors tooltip" title="Live Demo">
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">{p.description}</p>
                </div>
              ))
            )}
          </div>

          <AnimatePresence mode="wait">
            {addMode === 'manual' && (
              <motion.form 
                key="manual"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={handleAdd} 
                className="flex flex-col gap-4 mt-6 p-5 glass-panel rounded-xl overflow-hidden"
              >
                <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Add Manual Project</h4>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="Project Title" 
                  required 
                  className="w-full glass-panel rounded-xl px-4 py-2.5 text-sm text-main focus:border-primary/50 outline-none transition-colors"
                />
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted font-medium">Description</span>
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={aiGeneratingDesc}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {aiGeneratingDesc ? (
                        <RefreshCw size={11} className="animate-spin text-violet-400" />
                      ) : (
                        <Sparkles size={11} className="text-violet-400" />
                      )}
                      <span>{aiGeneratingDesc ? 'Generating Pitch...' : '✨ AI Pitch'}</span>
                    </button>
                  </div>
                  <textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="Short Description or click 'AI Pitch' to generate..." 
                    rows="2" 
                    className="w-full glass-panel rounded-xl px-4 py-2.5 text-sm text-main focus:border-primary/50 outline-none transition-colors resize-none"
                  ></textarea>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input type="url" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="Repository URL" className="w-full glass-panel rounded-xl pl-10 pr-4 py-2.5 text-sm text-main focus:border-primary/50 outline-none transition-colors" />
                  </div>
                  <div className="flex-1 relative">
                    <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input type="url" value={demoUrl} onChange={e => setDemoUrl(e.target.value)} placeholder="Live Demo URL" className="w-full glass-panel rounded-xl pl-10 pr-4 py-2.5 text-sm text-main focus:border-primary/50 outline-none transition-colors" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-2">
                  <button type="button" onClick={() => setAddMode('none')} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-main transition-colors">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-gradient-to-r from-primary to-purple-600 text-main text-sm font-semibold rounded-lg shadow-lg hover:shadow-primary/25 transition-all hover:scale-105">Save Project</button>
                </div>
              </motion.form>
            )}

            {addMode === 'github' && (
              <motion.div 
                key="github"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-col gap-4 mt-6 p-5 glass-panel rounded-xl overflow-hidden"
              >
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <GithubIcon size={16} /> Import from GitHub
                  </h4>
                  <button onClick={() => setAddMode('none')} className="text-gray-400 hover:text-main"><X size={16}/></button>
                </div>
                
                <form onSubmit={fetchGithubRepos} className="flex gap-3 flex-col">
                  {currentUserProfile?.github_url ? (
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        value={githubUsername} 
                        disabled 
                        placeholder="GitHub Username" 
                        className="flex-1 glass-panel rounded-xl px-4 py-2.5 text-sm text-gray-400 bg-black/50 border-white/10 outline-none cursor-not-allowed"
                      />
                      <button 
                        type="submit" 
                        disabled={isFetchingGithub || !githubUsername}
                        className="px-6 py-2.5 bg-white text-black hover:bg-[#e5e5e5] text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors flex items-center gap-2"
                      >
                        {isFetchingGithub ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
                        Fetch Repos
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex flex-col items-start gap-3">
                      <p>Please link your GitHub profile in your account settings first to import repositories.</p>
                      <Link 
                        to={`/profile/${currentUserProfile?.username}`} 
                        onClick={onClose} 
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Go to Profile
                      </Link>
                    </div>
                  )}
                </form>

                {githubRepos.length > 0 && (
                  <div className="flex flex-col gap-3 mt-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                    {githubRepos.map(repo => (
                      <div key={repo.id} className="flex items-center justify-between p-4 glass-panel rounded-xl">
                        <div>
                          <h5 className="text-main font-bold text-sm mb-1">{repo.name}</h5>
                          <p className="text-gray-500 text-xs line-clamp-1">{repo.description || 'No description'}</p>
                        </div>
                        <button 
                          onClick={() => importGithubRepo(repo)}
                          disabled={importingId === repo.id}
                          className="px-4 py-1.5 bg-surface-hover hover:bg-white/20 text-main text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ml-4"
                        >
                          {importingId === repo.id ? <Loader2 size={14} className="animate-spin" /> : 'Import'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {addMode === 'none' && (
          <div className="p-6 border-t border-white/10 bg-[#050505] flex gap-4">
            <button 
              onClick={() => setAddMode('github')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-surface hover:bg-surface-hover text-main border border-white/10 rounded-xl font-medium transition-colors"
            >
              <GithubIcon size={18} />
              Import from GitHub
            </button>
            <button 
              onClick={() => setAddMode('manual')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-[#e5e5e5] text-black rounded-xl font-semibold transition-colors"
            >
              <Plus size={18} />
              Add Manual Project
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
