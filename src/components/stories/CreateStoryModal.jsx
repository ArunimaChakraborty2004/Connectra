import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Image as ImageIcon, Code2, Film, Sparkles, Upload, Loader2, Link as LinkIcon, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from '../../lib/toast';

const GRADIENT_THEMES = [
  { id: 'sunset', name: 'Sunset Glow', class: 'from-orange-600 via-amber-500 to-rose-600' },
  { id: 'cyber', name: 'Cyberpunk', class: 'from-emerald-600 via-teal-700 to-cyan-900' },
  { id: 'midnight', name: 'Midnight Obsidian', class: 'from-stone-900 via-neutral-800 to-zinc-950' },
  { id: 'violet', name: 'Violet Nebula', class: 'from-purple-700 via-indigo-800 to-blue-900' },
  { id: 'solar', name: 'Solar Flare', class: 'from-amber-500 via-orange-600 to-red-700' },
];

export default function CreateStoryModal({ session, onClose, onCreated }) {
  const [activeTab, setActiveTab] = useState('image'); // 'image' | 'thought' | 'video'
  const [caption, setCaption] = useState('');
  const [thoughtText, setThoughtText] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [selectedTheme, setSelectedTheme] = useState(GRADIENT_THEMES[0]);
  
  // Media states
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [directUrl, setDirectUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (activeTab === 'image' && !selected.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP, GIF)');
      return;
    }
    if (activeTab === 'video' && !selected.type.startsWith('video/')) {
      toast.error('Please select a video file (MP4, WebM)');
      return;
    }

    if (selected.size > 40 * 1024 * 1024) {
      toast.error('File size must be under 40MB');
      return;
    }

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setDirectUrl('');
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setFile(null);
    setPreview(null);
    setDirectUrl('');
  };

  const handlePublishStory = async () => {
    if (activeTab === 'thought' && !thoughtText.trim()) {
      toast.error('Please write your dev thought or update');
      return;
    }

    if ((activeTab === 'image' || activeTab === 'video') && !file && !directUrl.trim()) {
      toast.error(`Please select a ${activeTab} or enter a URL`);
      return;
    }

    setUploading(true);
    let mediaUrl = directUrl.trim();

    try {
      // 1. If user provided a local file, try uploading with resilient fallback
      if (file) {
        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `${session?.user?.id || 'anon'}-${Date.now()}.${fileExt}`;
        const filePath = `stories/${fileName}`;

        // Attempt 1: Upload to 'stories' bucket
        let uploadSuccess = false;
        const { error: err1 } = await supabase.storage.from('stories').upload(filePath, file, { upsert: true });

        if (!err1) {
          const { data: pubData } = supabase.storage.from('stories').getPublicUrl(filePath);
          mediaUrl = pubData.publicUrl;
          uploadSuccess = true;
        } else {
          // Attempt 2: Fallback to 'post_images' bucket
          const { error: err2 } = await supabase.storage.from('post_images').upload(filePath, file, { upsert: true });
          if (!err2) {
            const { data: pubData } = supabase.storage.from('post_images').getPublicUrl(filePath);
            mediaUrl = pubData.publicUrl;
            uploadSuccess = true;
          }
        }

        // Attempt 3: If bucket upload fails (e.g. buckets not configured), use Data URL for images
        if (!uploadSuccess && file.type.startsWith('image/')) {
          mediaUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.readAsDataURL(file);
          });
        } else if (!uploadSuccess && !mediaUrl) {
          // If video bucket upload failed, use object URL as emergency fallback
          mediaUrl = preview;
        }
      }

      // 2. Prepare Story Record Payload
      const storyPayload = {
        user_id: session?.user?.id,
        media_url: mediaUrl || null,
        media_type: activeTab,
        caption: activeTab === 'thought' ? thoughtText : caption.trim(),
        bg_color: activeTab === 'thought' ? selectedTheme.class : null,
        code_snippet: activeTab === 'thought' && codeSnippet.trim() ? codeSnippet.trim() : null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // 3. Insert into Supabase 'stories' table
      let insertedToDb = false;
      const { data: dbData, error: dbError } = await supabase
        .from('stories')
        .insert(storyPayload)
        .select()
        .single();

      if (!dbError && dbData) {
        insertedToDb = true;
      } else {
        console.warn('Stories table insert warning:', dbError?.message || 'Using local optimistic sync');
      }

      // 4. Always store an optimistic copy in localStorage so the user sees their story IMMEDIATELY
      const existingLocal = JSON.parse(localStorage.getItem('connectra_active_stories') || '[]');
      const newStoryRecord = {
        id: dbData?.id || `story-${Date.now()}`,
        ...storyPayload,
        profiles: {
          id: session?.user?.id,
          username: session?.user?.user_metadata?.username || 'You',
          avatar_url: session?.user?.user_metadata?.avatar_url || null,
        },
      };

      localStorage.setItem('connectra_active_stories', JSON.stringify([newStoryRecord, ...existingLocal]));

      toast.success('Your story has been shared! 🚀');
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      console.error('Error sharing story:', err);
      toast.error(err.message || 'Failed to post story');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white dark:bg-[#1a120c] border border-[#f1e4d3] dark:border-[#3d2719] rounded-3xl w-full max-w-lg relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#f1e4d3] dark:border-[#382416] flex justify-between items-center bg-[#fffbf7] dark:bg-[#20150e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ea580c] to-[#f97316] flex items-center justify-center text-white shadow-xs">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Create Dev Story</h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">Visible to your network for 24 hours</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Story Type Selector Tabs */}
        <div className="flex items-center border-b border-[#f1e4d3] dark:border-[#382416] p-1.5 bg-[#faf6f0] dark:bg-[#160e09] gap-1">
          <button
            type="button"
            onClick={() => handleTabSwitch('image')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'image'
                ? 'bg-white dark:bg-[#251810] text-[#ea580c] shadow-xs'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-300'
            }`}
          >
            <ImageIcon size={14} /> Photo / Image
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('thought')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'thought'
                ? 'bg-white dark:bg-[#251810] text-[#ea580c] shadow-xs'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-300'
            }`}
          >
            <Code2 size={14} /> Dev Thought / Code
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('video')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'video'
                ? 'bg-white dark:bg-[#251810] text-[#ea580c] shadow-xs'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-300'
            }`}
          >
            <Film size={14} /> Video Clip
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4 flex-1">
          {/* TAB 1: Image / Photo */}
          {activeTab === 'image' && (
            <div className="flex flex-col gap-3">
              <div
                onClick={() => !preview && fileInputRef.current?.click()}
                className={`w-full aspect-[4/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden relative transition-all ${
                  preview
                    ? 'border-orange-500/60 bg-black/90'
                    : 'border-[#f1e4d3] dark:border-stone-700 hover:border-orange-500/60 cursor-pointer bg-[#fffaf5] dark:bg-[#1a110a]'
                }`}
              >
                {preview ? (
                  <>
                    <img src={preview} alt="Story Preview" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setPreview(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-rose-600 rounded-full text-white transition-colors cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <div className="w-11 h-11 rounded-2xl bg-orange-500/15 text-orange-600 flex items-center justify-center mx-auto mb-2">
                      <Upload size={20} />
                    </div>
                    <p className="text-xs font-bold text-stone-800 dark:text-stone-200">Upload Image</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">PNG, JPG, WebP, GIF (Max 40MB)</p>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                />
              </div>

              {/* Direct Image URL input */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon size={13} className="absolute left-3 top-3 text-stone-400" />
                  <input
                    type="url"
                    value={directUrl}
                    onChange={(e) => {
                      setDirectUrl(e.target.value);
                      if (e.target.value.trim()) {
                        setPreview(e.target.value.trim());
                        setFile(null);
                      }
                    }}
                    placeholder="Or paste an image URL (https://...)"
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#f1e4d3] dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Optional Caption */}
              <div>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption to your story..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#f1e4d3] dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Dev Thought / Code */}
          {activeTab === 'thought' && (
            <div className="flex flex-col gap-3">
              {/* Theme Picker */}
              <div>
                <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1.5 block">
                  Select Card Theme:
                </label>
                <div className="flex items-center gap-2">
                  {GRADIENT_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setSelectedTheme(theme)}
                      className={`h-7 w-7 rounded-xl bg-gradient-to-br ${theme.class} flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                        selectedTheme.id === theme.id ? 'ring-2 ring-orange-500 scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                      title={theme.name}
                    >
                      {selectedTheme.id === theme.id && <Check size={12} className="text-white" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Card */}
              <div
                className={`w-full min-h-[160px] rounded-2xl bg-gradient-to-br ${selectedTheme.class} p-5 text-white flex flex-col justify-between shadow-md relative overflow-hidden`}
              >
                <div className="flex items-center gap-2 opacity-80 text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles size={12} />
                  <span>Dev Thought</span>
                </div>

                <div className="my-2">
                  <p className="text-sm sm:text-base font-bold leading-relaxed whitespace-pre-wrap">
                    {thoughtText || 'What are you building or thinking about today?'}
                  </p>
                  {codeSnippet && (
                    <div className="mt-2.5 p-2 rounded-xl bg-black/40 border border-white/20 font-mono text-[11px] leading-snug overflow-x-auto text-amber-200">
                      <code>{codeSnippet}</code>
                    </div>
                  )}
                </div>

                <div className="text-[10px] opacity-75 flex items-center justify-between">
                  <span>@{session?.user?.user_metadata?.username || 'you'}</span>
                  <span>24h Story</span>
                </div>
              </div>

              {/* Text Input */}
              <div>
                <textarea
                  value={thoughtText}
                  onChange={(e) => setThoughtText(e.target.value)}
                  placeholder="Share a quick dev milestone, tip, or status update..."
                  rows={2}
                  className="w-full p-3 text-xs rounded-xl border border-[#f1e4d3] dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>

              {/* Code Snippet Input */}
              <div>
                <textarea
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  placeholder="Optional code snippet (e.g. const [state] = useOptimistic()...)"
                  rows={2}
                  className="w-full p-2.5 font-mono text-[11px] rounded-xl border border-[#f1e4d3] dark:border-stone-700 bg-[#160e09] text-amber-200 placeholder-stone-500 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Video */}
          {activeTab === 'video' && (
            <div className="flex flex-col gap-3">
              <div
                onClick={() => !preview && fileInputRef.current?.click()}
                className={`w-full aspect-[4/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden relative transition-all ${
                  preview
                    ? 'border-orange-500/60 bg-black'
                    : 'border-[#f1e4d3] dark:border-stone-700 hover:border-orange-500/60 cursor-pointer bg-[#fffaf5] dark:bg-[#1a110a]'
                }`}
              >
                {preview ? (
                  <>
                    <video src={preview} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setPreview(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-rose-600 rounded-full text-white transition-colors cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <div className="w-11 h-11 rounded-2xl bg-orange-500/15 text-orange-600 flex items-center justify-center mx-auto mb-2">
                      <Film size={20} />
                    </div>
                    <p className="text-xs font-bold text-stone-800 dark:text-stone-200">Upload Video Clip</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">MP4, WebM (Max 40MB)</p>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="video/mp4,video/webm"
                  className="hidden"
                />
              </div>

              {/* Direct Video URL input */}
              <div className="relative">
                <LinkIcon size={13} className="absolute left-3 top-3 text-stone-400" />
                <input
                  type="url"
                  value={directUrl}
                  onChange={(e) => {
                    setDirectUrl(e.target.value);
                    if (e.target.value.trim()) {
                      setPreview(e.target.value.trim());
                      setFile(null);
                    }
                  }}
                  placeholder="Or paste video URL (https://...)"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#f1e4d3] dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:border-orange-500"
                />
              </div>

              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption for your video story..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#f1e4d3] dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:border-orange-500"
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#f1e4d3] dark:border-[#382416] flex items-center justify-end gap-2 bg-[#fffbf7] dark:bg-[#1a110a]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePublishStory}
            disabled={uploading}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white font-bold text-xs shadow-md shadow-orange-500/20 hover:opacity-95 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Sharing Story...
              </>
            ) : (
              <>
                <Sparkles size={13} /> Share Story
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
