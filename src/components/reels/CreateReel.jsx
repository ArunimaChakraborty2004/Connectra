import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Upload, Film, Eye, EyeOff, Users, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from '../../lib/toast';

export default function CreateReel({ session, onClose, onCreated }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [allowComments, setAllowComments] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.size > 50 * 1024 * 1024) { // 50MB limit
        toast.error('Video must be less than 50MB');
        return;
      }
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleUpload = async () => {
    if (!file) return toast.error('Please select a video');
    setUploading(true);

    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `reels/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('reels')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('reels')
        .getPublicUrl(filePath);

      // 3. Insert into Reels table
      const { error: dbError } = await supabase.from('reels').insert({
        user_id: session.user.id,
        video_url: publicUrl,
        caption,
        visibility,
        allow_comments: allowComments
      });

      if (dbError) throw dbError;

      toast.success('Reel published successfully!');
      onCreated();
      onClose();
    } catch (error) {
      console.error(error);
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
        className="bg-background border border-white/10 rounded-3xl w-full max-w-xl relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-surface/50">
          <h2 className="text-xl font-bold text-main flex items-center gap-2">
            <Film size={24} className="text-primary" /> Create Reel
          </h2>
          <button onClick={onClose} className="p-2 text-muted hover:text-main hover:bg-white/5 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto hide-scrollbar flex flex-col md:flex-row gap-6">
          {/* Left Column: Video Preview / Upload */}
          <div className="w-full md:w-[250px] shrink-0 flex flex-col gap-4">
            <div 
              onClick={() => !file && fileInputRef.current?.click()}
              className={`w-full aspect-[9/16] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden relative transition-colors ${file ? 'border-primary/50' : 'border-white/10 hover:border-primary/50 cursor-pointer bg-surface/30'}`}
            >
              {preview ? (
                <>
                  <video src={preview} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                  <button 
                    onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                    className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white hover:bg-red-500/80 transition"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <div className="text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto mb-3">
                    <Upload size={24} />
                  </div>
                  <p className="text-sm font-semibold text-main mb-1">Select Video</p>
                  <p className="text-[11px] text-muted">MP4 or WebM (Max 50MB)</p>
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
          </div>

          {/* Right Column: Details & Settings */}
          <div className="flex-1 flex flex-col gap-6">
            <div>
              <label className="block text-sm font-semibold text-main mb-2">Caption</label>
              <textarea 
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Write a caption..."
                className="w-full bg-surface border border-white/10 rounded-xl p-4 text-sm text-main placeholder-muted focus:outline-none focus:border-primary/50 resize-none h-28"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-main mb-3">Visibility</label>
              <div className="flex flex-col gap-2">
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${visibility === 'public' ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-white/20'}`}>
                  <input type="radio" name="visibility" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} className="hidden" />
                  <Eye size={18} className={visibility === 'public' ? 'text-primary' : 'text-muted'} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-main">Public</div>
                    <div className="text-[11px] text-muted">Anyone can view this reel</div>
                  </div>
                </label>
                
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${visibility === 'private' ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-white/20'}`}>
                  <input type="radio" name="visibility" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} className="hidden" />
                  <EyeOff size={18} className={visibility === 'private' ? 'text-primary' : 'text-muted'} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-main">Private</div>
                    <div className="text-[11px] text-muted">Only you can view this reel</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-white/5">
              <div>
                <div className="text-sm font-semibold text-main">Allow Comments</div>
                <div className="text-[11px] text-muted">Let others comment on this reel</div>
              </div>
              <button 
                onClick={() => setAllowComments(!allowComments)}
                className={`w-11 h-6 rounded-full transition-colors relative ${allowComments ? 'bg-primary' : 'bg-surface-hover border border-white/10'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${allowComments ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-surface/50 flex justify-end gap-3">
          <button onClick={onClose} disabled={uploading} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-main hover:bg-white/5 transition">
            Cancel
          </button>
          <button 
            onClick={handleUpload} 
            disabled={!file || uploading} 
            className="vibrant-btn px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {uploading ? (
              <><Loader2 size={16} className="animate-spin" /> Publishing...</>
            ) : (
              'Publish Reel'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
