import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderGit2,
  FileCode,
  Folder,
  ArrowLeft,
  Search,
  Check,
  Loader2,
  X,
  FileText,
  ExternalLink,
  Code2,
  AlertCircle
} from 'lucide-react';
import { toast } from '../../lib/toast';

export default function ImportRepoModal({ session, isOpen, onClose, onImportFile, onImportRepoDetails }) {
  const [repos, setRepos] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [treeItems, setTreeItems] = useState([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchingFile, setFetchingFile] = useState(false);
  const [githubUser, setGithubUser] = useState('');

  useEffect(() => {
    if (!isOpen || !session?.user?.id) return;

    const fetchGithubIdentity = async () => {
      setLoadingRepos(true);
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('github_url')
          .eq('id', session.user.id)
          .maybeSingle();

        const metaUser = session.user.user_metadata?.user_name || session.user.user_metadata?.preferred_username;
        let ghName = metaUser;

        if (profile?.github_url) {
          const match = profile.github_url.match(/github\.com\/([^/]+)/i);
          if (match && match[1]) ghName = match[1];
        }

        if (!ghName) {
          setLoadingRepos(false);
          return;
        }

        setGithubUser(ghName);
        const res = await fetch(`https://api.github.com/users/${ghName}/repos?sort=updated&per_page=20`);
        if (res.ok) {
          const data = await res.json();
          setRepos(Array.isArray(data) ? data : []);
        } else {
          toast.error('Unable to load GitHub repositories.');
        }
      } catch (err) {
        console.error('Error loading GitHub repos:', err);
      } finally {
        setLoadingRepos(false);
      }
    };

    fetchGithubIdentity();
  }, [isOpen, session?.user?.id]);

  const loadDirectory = async (repo, path = '') => {
    setLoadingTree(true);
    setCurrentPath(path);
    try {
      const url = `https://api.github.com/repos/${repo.full_name}/contents/${path}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        // Sort: directories first, then files alphabetically
        const sorted = (Array.isArray(data) ? data : [data]).sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'dir' ? -1 : 1;
        });
        setTreeItems(sorted);
      } else {
        toast.error('Unable to fetch directory contents.');
      }
    } catch (err) {
      toast.error('Failed to load repository files.');
    } finally {
      setLoadingTree(false);
    }
  };

  const handleSelectRepo = (repo) => {
    setSelectedRepo(repo);
    loadDirectory(repo, '');
  };

  const handleNavigateUp = () => {
    if (!currentPath) {
      setSelectedRepo(null);
      setTreeItems([]);
      return;
    }
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = parts.join('/');
    loadDirectory(selectedRepo, parentPath);
  };

  const handleFileSelect = async (item) => {
    if (item.type === 'dir') {
      loadDirectory(selectedRepo, item.path);
      return;
    }

    // It's a file
    setFetchingFile(true);
    try {
      let rawContent = '';
      if (item.download_url) {
        const res = await fetch(item.download_url);
        rawContent = await res.text();
      } else {
        // Fallback to contents API with base64 decoding
        const res = await fetch(item.url);
        const data = await res.json();
        if (data.content) {
          rawContent = atob(data.content.replace(/\s/g, ''));
        }
      }

      toast.success(`Imported ${item.name}! 🚀`);
      onImportFile?.({
        fileName: item.name,
        filePath: item.path,
        content: rawContent,
        repo: selectedRepo,
      });
      onClose();
    } catch (err) {
      toast.error('Could not import file contents: ' + (err.message || ''));
    } finally {
      setFetchingFile(false);
    }
  };

  const handleImportEntireRepo = (repo) => {
    onImportRepoDetails?.({
      title: repo.name,
      description: repo.description || 'Imported from GitHub',
      repo_url: repo.html_url,
      language: repo.language,
      stars: repo.stargazers_count,
    });
    toast.success(`Imported ${repo.name} details! 🚀`);
    onClose();
  };

  if (!isOpen) return null;

  const filteredRepos = repos.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="w-full max-w-2xl bg-white border border-[#f1e4d3] rounded-3xl shadow-2xl overflow-hidden flex flex-col font-sans max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#f1e4d3] bg-[#fffcf7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#ffedd5] text-[#ea580c] flex items-center justify-center border border-[#fed7aa] shadow-2xs">
              <FolderGit2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#1c130d] flex items-center gap-2">
                <span>Import from GitHub Repository</span>
                {githubUser && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-orange-100 text-[#ea580c]">
                    @{githubUser}
                  </span>
                )}
              </h3>
              <p className="text-xs text-[#8d7565]">
                {selectedRepo
                  ? `Browsing ${selectedRepo.name} ${currentPath ? `• /${currentPath}` : ''}`
                  : 'Select a repository to import announcement or browse specific files'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#8d7565] hover:text-[#1c130d] hover:bg-[#faf6f0] rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Breadcrumb Bar */}
        <div className="p-3.5 bg-[#faf6f0]/60 border-b border-[#f1e4d3] flex items-center justify-between gap-3 flex-wrap">
          {selectedRepo ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8d7565]">
              <button
                onClick={handleNavigateUp}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#f1e4d3] text-[#1c130d] hover:border-orange-500 transition-colors cursor-pointer"
              >
                <ArrowLeft size={13} />
                <span>{currentPath ? 'Back' : 'All Repositories'}</span>
              </button>
              <span className="font-mono text-[#ea580c] font-bold truncate max-w-[280px]">
                {selectedRepo.name}{currentPath ? `/${currentPath}` : ''}
              </span>
            </div>
          ) : (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your repositories..."
                className="w-full bg-white border border-[#f1e4d3] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#1c130d] outline-none focus:border-orange-500"
              />
            </div>
          )}

          {selectedRepo && (
            <button
              onClick={() => handleImportEntireRepo(selectedRepo)}
              className="px-3 py-1 rounded-xl bg-orange-500 text-white font-bold text-xs hover:bg-orange-600 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <Code2 size={13} />
              <span>Import Entire Repo Pitch</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingRepos || loadingTree || fetchingFile ? (
            <div className="py-14 text-center space-y-3">
              <Loader2 size={28} className="animate-spin text-[#ea580c] mx-auto" />
              <p className="text-xs text-[#8d7565] font-medium">
                {fetchingFile
                  ? 'Fetching file contents directly from GitHub...'
                  : loadingTree
                  ? 'Loading directory contents...'
                  : 'Retrieving your GitHub repositories...'}
              </p>
            </div>
          ) : !selectedRepo ? (
            /* Repository List */
            filteredRepos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className="p-3.5 rounded-2xl bg-white border border-[#f1e4d3] hover:border-orange-400 hover:shadow-md transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-extrabold text-sm text-[#1c130d] group-hover:text-[#ea580c] transition-colors truncate">
                          {repo.name}
                        </span>
                        {repo.language && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                            {repo.language}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8d7565] line-clamp-2 leading-relaxed mb-3">
                        {repo.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#f1e4d3]/60">
                      <button
                        onClick={() => handleSelectRepo(repo)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-[#faf6f0] hover:bg-orange-100 hover:text-orange-800 text-xs font-bold text-[#1c130d] border border-[#f1e4d3] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Folder size={13} />
                        <span>Browse Files</span>
                      </button>
                      <button
                        onClick={() => handleImportEntireRepo(repo)}
                        className="py-1.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                        title="Import as Project Pitch"
                      >
                        <Code2 size={13} />
                        <span>Use Repo</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center space-y-2">
                <AlertCircle size={28} className="text-amber-500 mx-auto" />
                <p className="text-sm font-bold text-[#1c130d]">No repositories found</p>
                <p className="text-xs text-[#8d7565]">
                  Make sure your GitHub account is linked or verified in your profile.
                </p>
              </div>
            )
          ) : (
            /* Directory Tree / Files */
            <div className="space-y-1">
              {treeItems.length > 0 ? (
                treeItems.map((item) => {
                  const isDir = item.type === 'dir';
                  return (
                    <button
                      key={item.sha || item.path}
                      onClick={() => handleFileSelect(item)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-orange-50/70 border border-transparent hover:border-orange-200 transition-all text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isDir ? (
                          <Folder size={16} className="text-amber-500 shrink-0" />
                        ) : (
                          <FileCode size={16} className="text-[#ea580c] shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-[#1c130d] group-hover:text-[#ea580c] truncate">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#8d7565] font-mono shrink-0">
                        {isDir ? 'Folder' : `${(item.size ? (item.size / 1024).toFixed(1) : 0)} KB`}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="py-10 text-center text-xs text-[#8d7565]">
                  This folder is empty.
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
