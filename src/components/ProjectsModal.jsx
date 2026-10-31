import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderGit2, ExternalLink, GitBranch, Plus, Code2 as GithubIcon, DownloadCloud, Loader2, Sparkles, RefreshCw, CheckCircle2, ShieldAlert, Lock, UserCheck } from 'lucide-react';
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
    } catch {
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

  const extractGithubUsername = (url) => {
    if (!url) return '';
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      const parts = parsed.pathname.split('/').filter(Boolean);
      return parts[0] || '';
    } catch {
      return '';
    }
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
        const username = extractGithubUsername(data.github_url);
        if (username) setGithubUsername(username);
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
    if (e && e.preventDefault) e.preventDefault();
    
    // Determine the verified username
    const verifiedUsername = extractGithubUsername(currentUserProfile?.github_url) || githubUsername;
    if (!verifiedUsername) {
      alert("Please link your GitHub profile first.");
      return;
    }
    
    setIsFetchingGithub(true);
    try {
      const res = await fetch(`https://api.github.com/users/${verifiedUsername}/repos?sort=updated&per_page=12`);
      if (!res.ok) throw new Error("Could not find GitHub user");
      const data = await res.json();
      setGithubRepos(data);
    } catch {
      alert("Failed to fetch repositories. Please make sure the linked account exists.");
    } finally {
      setIsFetchingGithub(false);
    }
  };

  const handleImportGithubRepo = async (repo) => {
    setImportingId(repo.id);
    try {
      const { error } = await supabase.from('projects').insert({
        user_id: session.user.id,
        title: repo.name,
        description: repo.description || 'Imported from GitHub',
        repo_url: repo.html_url,
        demo_url: repo.homepage || null
      });
      if (error) throw error;
      await loadProjects();
    } catch {
      alert("Error importing repo");
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-white border border-[#f1e4d3] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#f1e4d3] bg-[#fffcf7]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#ffedd5] text-[#ea580c] rounded-xl border border-[#fed7aa]">
              <FolderGit2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1c130d]">My Repositories</h2>
              <p className="text-sm text-[#6b5546]">Manage and showcase your projects</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-[#6b5546] hover:text-[#1c130d] hover:bg-[#faf6f0] rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar bg-[#faf6f0]/50">
          <div className="flex flex-col gap-4">
            {projects.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-[#f1e4d3] rounded-2xl bg-white">
                <FolderGit2 size={48} className="mx-auto text-[#ea580c] mb-3 opacity-60" />
                <h3 className="text-lg font-bold text-[#1c130d] mb-1">No projects yet</h3>
                <p className="text-[#6b5546] text-sm">Add your first repository manually or import from GitHub.</p>
              </div>
            ) : (
              projects.map(p => (
                <div key={p.id} className="group p-5 bg-white border border-[#f1e4d3] rounded-2xl hover:border-orange-400 hover:shadow-xs transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <Link to={`/projects/${p.id}`} onClick={onClose} className="text-lg font-bold text-[#1c130d] hover:text-[#ea580c] transition-colors cursor-pointer hover:underline block truncate max-w-[70%]">
                      {p.title}
                    </Link>
                    <div className="flex gap-2">
                      {p.repo_url && (
                        <a href={p.repo_url} target="_blank" rel="noreferrer" className="p-2 bg-[#faf6f0] hover:bg-[#ffedd5] text-[#6b5546] hover:text-[#ea580c] rounded-xl transition-colors border border-[#f1e4d3]" title="Repository">
                          <GitBranch size={16} />
                        </a>
                      )}
                      {p.demo_url && (
                        <a href={p.demo_url} target="_blank" rel="noreferrer" className="p-2 bg-[#faf6f0] hover:bg-[#ffedd5] text-[#6b5546] hover:text-[#ea580c] rounded-xl transition-colors border border-[#f1e4d3]" title="Live Demo">
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-[#6b5546]">{p.description}</p>
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
                className="flex flex-col gap-4 mt-6 p-5 bg-white border border-[#f1e4d3] rounded-2xl overflow-hidden shadow-xs"
              >
                <h4 className="text-xs font-bold text-[#ea580c] uppercase tracking-wider mb-1">Add Manual Project</h4>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="Project Title" 
                  required 
                  className="w-full bg-[#faf6f0] rounded-xl px-4 py-2.5 text-sm text-[#1c130d] border border-[#f1e4d3] focus:border-[#ea580c] focus:bg-white outline-none transition-colors"
                />
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#6b5546] font-bold">Description</span>
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={aiGeneratingDesc}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-lg bg-orange-100 hover:bg-orange-200 text-[#ea580c] border border-orange-300 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {aiGeneratingDesc ? (
                        <RefreshCw size={11} className="animate-spin text-[#ea580c]" />
                      ) : (
                        <Sparkles size={11} className="text-[#ea580c]" />
                      )}
                      <span>{aiGeneratingDesc ? 'Generating Pitch...' : '✨ AI Pitch'}</span>
                    </button>
                  </div>
                  <textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="Short Description or click 'AI Pitch' to generate..." 
                    rows="2" 
                    className="w-full bg-[#faf6f0] rounded-xl px-4 py-2.5 text-sm text-[#1c130d] border border-[#f1e4d3] focus:border-[#ea580c] focus:bg-white outline-none transition-colors resize-none"
                  ></textarea>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d7565]" size={16} />
                    <input type="url" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="Repository URL" className="w-full bg-[#faf6f0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1c130d] border border-[#f1e4d3] focus:border-[#ea580c] outline-none" />
                  </div>
                  <div className="flex-1 relative">
                    <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d7565]" size={16} />
                    <input type="url" value={demoUrl} onChange={e => setDemoUrl(e.target.value)} placeholder="Demo URL" className="w-full bg-[#faf6f0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1c130d] border border-[#f1e4d3] focus:border-[#ea580c] outline-none" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-2">
                  <button type="button" onClick={() => setAddMode('none')} className="px-4 py-2 text-sm text-[#6b5546] hover:text-[#1c130d] cursor-pointer">Cancel</button>
                  <button type="submit" className="px-5 py-2 bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white font-bold text-sm rounded-xl hover:brightness-105 shadow-md shadow-orange-500/25 cursor-pointer">Save Project</button>
                </div>
              </motion.form>
            )}

            {addMode === 'github' && (
              <motion.div 
                key="github"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-col gap-4 mt-6 p-5 bg-white border border-[#f1e4d3] rounded-2xl overflow-hidden shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-[#ea580c] uppercase tracking-wider">Import from GitHub</h4>
                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock size={10} /> Authenticated User Only
                    </span>
                  </div>
                  <button onClick={() => setAddMode('none')} className="text-xs text-[#6b5546] hover:text-[#1c130d] cursor-pointer">Cancel</button>
                </div>

                {/* Security Verification & Account Card */}
                {currentUserProfile?.github_url ? (
                  <div className="flex flex-col gap-3">
                    <div className="p-3.5 bg-[#faf6f0] border border-[#f1e4d3] rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 font-bold">
                          <CheckCircle2 size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#1c130d]">Linked Account:</span>
                            <span className="text-xs font-bold text-[#ea580c] bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                              @{extractGithubUsername(currentUserProfile.github_url) || githubUsername}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6b5546] mt-0.5">
                            Verified to your account ({currentUserProfile.full_name || currentUserProfile.username || session.user.email})
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={fetchGithubRepos}
                        disabled={isFetchingGithub}
                        className="px-4 py-2 bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white hover:brightness-105 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isFetchingGithub ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        {isFetchingGithub ? "Fetching..." : "Fetch My Repos"}
                      </button>
                    </div>

                    <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                      <Lock size={14} className="shrink-0 text-amber-700 mt-0.5" />
                      <span>
                        <strong>Security & Privacy Guard:</strong> For privacy protection, arbitrary username lookups are disabled. You can only import repositories from your own verified account. Only public repositories can be fetched via GitHub API. Private repositories remain completely protected and never exposed.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-xl flex flex-col gap-3 text-center">
                    <div className="flex items-center justify-center gap-2 text-amber-800 font-bold text-sm">
                      <ShieldAlert size={18} className="text-[#ea580c]" />
                      No GitHub Account Linked Yet
                    </div>
                    <p className="text-xs text-[#6b5546] max-w-md mx-auto">
                      To prevent unauthorized access or claiming other users' repositories, you must first link and verify your GitHub account in your Profile.
                    </p>
                    <div className="flex justify-center mt-1">
                      <Link
                        to={`/profile/${currentUserProfile?.username || session.user.id}`}
                        onClick={onClose}
                        className="px-4 py-2 bg-[#ea580c] text-white font-bold text-xs rounded-xl hover:bg-[#c2410c] transition-colors inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <UserCheck size={14} /> Link GitHub in Profile Settings
                      </Link>
                    </div>
                  </div>
                )}

                {githubRepos.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 max-h-60 overflow-y-auto no-scrollbar">
                    {githubRepos.map(repo => {
                      const isImported = projects.some(p => p.title.toLowerCase() === repo.name.toLowerCase());
                      return (
                        <div key={repo.id} className="p-3 bg-[#faf6f0] border border-[#f1e4d3] rounded-xl flex flex-col justify-between">
                          <div>
                            <span className="font-bold text-sm text-[#1c130d] block truncate">{repo.name}</span>
                            <span className="text-xs text-[#6b5546] line-clamp-2 mt-0.5">{repo.description || "No description"}</span>
                          </div>
                          <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#f1e4d3]">
                            <span className="text-[10px] text-[#8d7565] font-semibold">{repo.language || 'Code'}</span>
                            <button 
                              disabled={isImported || importingId === repo.id}
                              onClick={() => handleImportGithubRepo(repo)}
                              className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors ${
                                isImported ? 'bg-emerald-100 text-emerald-800' : 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white hover:brightness-105'
                              }`}
                            >
                              {importingId === repo.id ? <Loader2 size={12} className="animate-spin" /> : <DownloadCloud size={12} />}
                              {isImported ? "Added" : "Import"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#f1e4d3] bg-[#fffcf7] flex gap-3">
          <button 
            onClick={() => setAddMode(addMode === 'manual' ? 'none' : 'manual')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              addMode === 'manual' ? 'bg-[#ffedd5] text-[#ea580c] border border-orange-300' : 'bg-[#faf6f0] border border-[#f1e4d3] text-[#1c130d] hover:bg-[#ffedd5]'
            }`}
          >
            <Plus size={16} /> Add Manually
          </button>
          <button 
            onClick={() => setAddMode(addMode === 'github' ? 'none' : 'github')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              addMode === 'github' ? 'bg-[#ffedd5] text-[#ea580c] border border-orange-300' : 'bg-[#faf6f0] border border-[#f1e4d3] text-[#1c130d] hover:bg-[#ffedd5]'
            }`}
          >
            <GithubIcon size={16} /> Import from GitHub
          </button>
        </div>
      </motion.div>
    </div>
  );
}
