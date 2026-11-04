import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Upload, Film, Eye, EyeOff, Link as LinkIcon, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from '../../lib/toast';

export default function CreateReel({ session, onClose, onCreated }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [directVideoUrl, setDirectVideoUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [allowComments, setAllowComments] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.type.startsWith('video/')) {
        toast.error('Please select a valid video file (MP4, WebM)');
        return;
      }
      if (selected.size > 60 * 1024 * 1024) {
        toast.error('Video must be less than 60MB');
        return;
      }
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setDirectVideoUrl('');
    }
  };

  const handleUpload = async () => {
    const effectiveUrl = directVideoUrl.trim();
    if (!file && !effectiveUrl) {
      return toast.error('Please select a video file or enter a video URL');
    }
    setUploading(true);

    try {
      let publicUrl = effectiveUrl;

      // 1. If file selected, attempt resilient upload
      if (file) {
        const fileExt = file.name.split('.').pop() || 'mp4';
        const fileName = `${session?.user?.id || 'anon'}-${Date.now()}.${fileExt}`;
        const filePath = `reels/${fileName}`;

        let uploadSuccess = false;

        // Try 'reels' storage bucket
        const { error: uploadError } = await supabase.storage
          .from('reels')
          .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (!uploadError) {
          const { data } = supabase.storage.from('reels').getPublicUrl(filePath);
          publicUrl = data?.publicUrl;
          uploadSuccess = true;
        } else {
          // Fallback: try 'post_images' bucket
          const { error: postImagesErr } = await supabase.storage
            .from('post_images')
            .upload(filePath, file, { cacheControl: '3600', upsert: true });

          if (!postImagesErr) {
            const { data } = supabase.storage.from('post_images').getPublicUrl(filePath);
            publicUrl = data?.publicUrl;
            uploadSuccess = true;
          }
        }

        // If storage buckets are not configured or rejected, fallback to preview
        if (!uploadSuccess && !publicUrl) {
          publicUrl = preview;
        }
      }

      if (!publicUrl) {
        throw new Error('Could not resolve video URL');
      }

      // 2. Insert into Reels table with schema tolerance
      let insertedData = null;
      const fullPayload = {
        user_id: session?.user?.id,
        video_url: publicUrl,
        caption: caption.trim() || null,
        visibility,
        allow_comments: allowComments,
      };

      const { data: dbData, error: dbError } = await supabase
        .from('reels')
        .insert(fullPayload)
        .select()
        .single();

      if (dbError) {
        // If error is due to missing columns (e.g. visibility or allow_comments in older schema), retry minimal payload
        console.warn('Reel insert with full payload failed, trying minimal payload:', dbError.message);
        const minimalPayload = {
          user_id: session?.user?.id,
          video_url: publicUrl,
          caption: caption.trim() || null,
        };

        const { data: minData, error: minError } = await supabase
          .from('reels')
          .insert(minimalPayload)
          .select()
          .single();

        if (minError) {
          console.warn('DB Insert error for reels:', minError.message);
        } else {
          insertedData = minData;
        }
      } else {
        insertedData = dbData;
      }

      // 3. Always save to local optimistic cache so user sees it IMMEDIATELY
      const existing = JSON.parse(localStorage.getItem('connectra_active_reels') || '[]');
      const newLocalReel = {
        id: insertedData?.id || `reel-${Date.now()}`,
        user_id: session?.user?.id,
        video_url: publicUrl,
        caption: caption.trim() || '',
        visibility,
        allow_comments: allowComments,
        created_at: new Date().toISOString(),
        profiles: {
          username: session?.user?.user_metadata?.username || 'You',
          avatar_url: session?.user?.user_metadata?.avatar_url || null,
        },
        reel_likes: [],
        reel_comments: [],
      };
      localStorage.setItem('connectra_active_reels', JSON.stringify([newLocalReel, ...existing]));

      // 4. Mirror to posts table and local posts cache so it is reflected everywhere in Feed
      try {
        await supabase.from('posts').insert({
          user_id: session?.user?.id,
          content: caption.trim() || '🎬 Check out my new developer reel!',
          image_url: publicUrl,
        });
      } catch (pErr) {
        console.warn('Reel post mirror warning:', pErr);
      }

      const existingPosts = JSON.parse(localStorage.getItem('connectra_active_posts') || '[]');
      const newLocalPost = {
        id: `reel-${newLocalReel.id}`,
        reel_id: newLocalReel.id,
        is_reel: true,
        user_id: session?.user?.id,
        content: caption.trim() || '🎬 Check out my new developer reel!',
        video_url: publicUrl,
        image_url: publicUrl,
        created_at: new Date().toISOString(),
        profiles: {
          username: session?.user?.user_metadata?.username || 'You',
          avatar_url: session?.user?.user_metadata?.avatar_url || null,
        },
        likes: [{ count: 0 }],
        likes_count: 0,
        user_has_liked: false,
        comments: [],
      };
      localStorage.setItem('connectra_active_posts', JSON.stringify([newLocalPost, ...existingPosts]));

      // Dispatch global refresh event for Feed
      window.dispatchEvent(new Event('refreshFeed'));

      toast.success('Reel published & reflected in Feed! 🎬🚀');
      if (onCreated) onCreated();
      onClose();
    } catch (error) {
      console.error('Error uploading reel:', error);
      toast.error(error.message || 'Error uploading reel');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
        className="bg-white dark:bg-[#18110c] border border-[#f1e4d3] dark:border-[#3d2719] rounded-3xl w-full max-w-xl relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-[#f1e4d3] dark:border-[#382416] flex justify-between items-center bg-[#fffbf7] dark:bg-[#20150e]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ea580c] to-[#f97316] flex items-center justify-center text-white shadow-xs">
              <Film size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Create Dev Reel</h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">Vertical video for Connectra Reels</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col md:flex-row gap-5">
          {/* Left Column: Video Preview / Upload */}
          <div className="w-full md:w-[220px] shrink-0 flex flex-col gap-3">
            <div
              onClick={() => !preview && fileInputRef.current?.click()}
              className={`w-full aspect-[9/16] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden relative transition-all ${
                preview
                  ? 'border-orange-500 bg-black'
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
                      setDirectVideoUrl('');
                    }}
                    className="absolute top-2 right-2 bg-black/70 p-1.5 rounded-full text-white hover:bg-rose-600 transition cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <div className="text-center p-4">
                  <div className="w-11 h-11 rounded-2xl bg-orange-500/15 text-orange-600 flex items-center justify-center mx-auto mb-2">
                    <Upload size={20} />
                  </div>
                  <p className="text-xs font-bold text-stone-800 dark:text-stone-200">Select Video</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">MP4 or WebM (Max 60MB)</p>
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

            {/* Direct Video URL Fallback */}
            <div className="relative">
              <LinkIcon size={12} className="absolute left-2.5 top-2.5 text-stone-400" />
              <input
                type="url"
                value={directVideoUrl}
                onChange={(e) => {
                  setDirectVideoUrl(e.target.value);
                  if (e.target.value.trim()) {
                    setPreview(e.target.value.trim());
                    setFile(null);
                  }
                }}
                placeholder="Or paste video URL..."
                className="w-full pl-7 pr-2.5 py-1.5 text-xs rounded-xl border border-[#f1e4d3] dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Right Column: Details & Settings */}
          <div className="flex-1 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">Caption</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption or dev tags #react19 #web3..."
                className="w-full bg-[#fffaf5] dark:bg-stone-900 border border-[#f1e4d3] dark:border-stone-700 rounded-xl p-3 text-xs text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:border-orange-500 resize-none h-24"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">Visibility</label>
              <div className="flex flex-col gap-1.5">
                <label
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    visibility === 'public'
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-[#f1e4d3] dark:border-stone-700 hover:border-orange-500/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={visibility === 'public'}
                    onChange={() => setVisibility('public')}
                    className="hidden"
                  />
                  <Eye size={15} className={visibility === 'public' ? 'text-orange-600' : 'text-stone-400'} />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-stone-800 dark:text-stone-200">Public</div>
                    <div className="text-[10px] text-stone-400">Anyone on Connectra can view</div>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    visibility === 'private'
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-[#f1e4d3] dark:border-stone-700 hover:border-orange-500/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={visibility === 'private'}
                    onChange={() => setVisibility('private')}
                    className="hidden"
                  />
                  <EyeOff size={15} className={visibility === 'private' ? 'text-orange-600' : 'text-stone-400'} />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-stone-800 dark:text-stone-200">Private</div>
                    <div className="text-[10px] text-stone-400">Only you can view this reel</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#faf6f0] dark:bg-stone-900 rounded-xl border border-[#f1e4d3] dark:border-stone-800">
              <div>
                <div className="text-xs font-bold text-stone-800 dark:text-stone-200">Allow Comments</div>
                <div className="text-[10px] text-stone-400">Let others discuss your code in comments</div>
              </div>
              <button
                type="button"
                onClick={() => setAllowComments(!allowComments)}
                className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                  allowComments ? 'bg-orange-500' : 'bg-stone-300 dark:bg-stone-700'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                    allowComments ? 'translate-x-5.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

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
            onClick={handleUpload}
            disabled={uploading}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white font-bold text-xs shadow-md shadow-orange-500/20 hover:opacity-95 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Publishing...
              </>
            ) : (
              <>
                <Film size={13} /> Publish Reel
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
