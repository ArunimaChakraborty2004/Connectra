import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sparkles, RefreshCw, Image as ImageIcon, Send, Loader2, GitBranch, ExternalLink, Code2, CheckCircle2
} from 'lucide-react';
import { toast } from '../../lib/toast';
import { polishPostContent, callGroq } from '../../lib/ai';

export default function ShareRepoModal({ project, session, onClose, onPostCreated }) {
  const [content, setContent] = useState(
    `🚀 Check out my project: **${project.title}**!\n\n${project.description || ''}\n\n🔗 Repo: ${project.repo_url || ''}${project.demo_url ? `\n🌐 Demo: ${project.demo_url}` : ''}\n\n#opensource #project #buildinpublic`
  );
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiPolishing, setAiPolishing] = useState(false);

  const handleAiRefine = async () => {
    setAiPolishing(true);
    try {
      const generated = await callGroq({
        messages: [
          { role: 'system', content: 'You are an engaging developer advocate on Connectra. Write an attractive, viral, well-formatted feed post announcing a software project.' },
          {
            role: 'user',
            content: `Turn this into an exciting post announcing the project "${project.title}".
Description: ${project.description || ''}
Repo: ${project.repo_url || ''}
Demo: ${project.demo_url || ''}
Include relevant emojis, 3 bullet points of what it does, and tech hashtags. Keep it concise.`,
          },
        ],
        temperature: 0.7,
      });

      if (generated) {
        setContent(generated.trim());
        toast.success('Project announcement redefined with AI! ✨');
      }
    } catch {
      // Fallback to basic polish
      try {
        const polished = await polishPostContent({ content });
        setContent(polished);
        toast.success('Announcement polished!');
      } catch {
        toast.error('AI refinement failed');
      }
    } finally {
      setAiPolishing(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image must be under 10MB');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('Please write something in your post.');
      return;
    }

    setLoading(true);
    let finalImageUrl = null;

    try {
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop() || 'png';
        const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
        const filePath = `post_images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post_images')
          .upload(filePath, imageFile, { upsert: true });

        if (!uploadError) {
          const { data: pubData } = supabase.storage.from('post_images').getPublicUrl(filePath);
          finalImageUrl = pubData?.publicUrl;
        } else {
          // Fallback to Data URL
          finalImageUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.readAsDataURL(imageFile);
          });
        }
      }

      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: session.user.id,
          content: content.trim(),
          image_url: finalImageUrl,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Published "${project.title}" to Feed! 🚀`);
      onPostCreated?.(data);
      onClose();
    } catch (err) {
      toast.error('Failed to publish post: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="w-full max-w-xl bg-white border border-[#f1e4d3] rounded-3xl shadow-2xl overflow-hidden flex flex-col font-sans"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#f1e4d3] bg-[#fffcf7]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#ffedd5] text-[#ea580c] flex items-center justify-center border border-[#fed7aa]">
              <GitBranch size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#1c130d]">Share Project to Feed</h3>
              <p className="text-xs text-[#8d7565]">Customize, attach screenshots, or polish with AI before publishing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8d7565] hover:text-[#1c130d] hover:bg-[#faf6f0] rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handlePublish} className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1c130d]">Post Content</span>
            <button
              type="button"
              onClick={handleAiRefine}
              disabled={aiPolishing}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-xl bg-gradient-to-r from-orange-100 to-amber-100 text-[#ea580c] border border-orange-200 hover:brightness-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {aiPolishing ? <RefreshCw size={12} className="animate-spin text-[#ea580c]" /> : <Sparkles size={12} className="text-[#ea580c]" />}
              <span>{aiPolishing ? 'Refining with AI...' : '✨ AI Redefine Pitch'}</span>
            </button>
          </div>

          <textarea
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your project launch announcement..."
            className="w-full p-3.5 rounded-2xl bg-[#faf6f0] border border-[#f1e4d3] text-sm text-[#1c130d] focus:border-[#ea580c] focus:bg-white outline-none transition-all resize-none font-sans leading-relaxed"
          />

          {/* Image Preview */}
          {imagePreview && (
            <div className="relative rounded-2xl overflow-hidden border border-[#f1e4d3] max-h-56 bg-black/5">
              <img src={imagePreview} alt="Screenshot Preview" className="w-full h-full object-cover max-h-56" />
              <button
                type="button"
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2 border-t border-[#f1e4d3]">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#faf6f0] hover:bg-[#ffedd5] text-[#1c130d] hover:text-[#ea580c] border border-[#f1e4d3] text-xs font-bold cursor-pointer transition-colors">
              <ImageIcon size={15} className="text-[#ea580c]" />
              <span>{imageFile ? 'Change Screenshot' : 'Attach Screenshot'}</span>
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-[#8d7565] hover:text-[#1c130d] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-orange-500/25 hover:brightness-105 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{loading ? 'Publishing...' : 'Publish to Feed'}</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
