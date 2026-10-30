import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Image as ImageIcon, Video, Calendar, MoreHorizontal, Send, X, Shield, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../../lib/toast';
import { reviewCodeAndSecurity, polishPostContent } from '../../lib/ai';

export default function CreatePost({ session, onPostCreated, placeholder }) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [codeLang, setCodeLang] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // AI Assistant States
  const [aiPolishing, setAiPolishing] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [codeReviewResult, setCodeReviewResult] = useState(null);
  const [showCodeReview, setShowCodeReview] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', session.user.id)
        .single();
      if (data) setUserProfile(data);
    };
    fetchProfile();
  }, [session?.user?.id]);

  const handlePolishPost = async () => {
    if (!content.trim()) return;
    setAiPolishing(true);
    try {
      const polished = await polishPostContent({ content });
      setContent(polished);
      toast.success('Post polished with AI! 🚀');
    } catch {
      toast.error('Failed to polish post');
    } finally {
      setAiPolishing(false);
    }
  };

  const handleScanCode = async () => {
    if (!codeSnippet.trim()) { toast.error('Please paste code to review first.'); return; }
    setAiScanning(true);
    setShowCodeReview(true);
    try {
      const result = await reviewCodeAndSecurity({ code: codeSnippet, language: codeLang || 'javascript' });
      setCodeReviewResult(result);
    } catch {
      toast.error('Failed to run code scan');
    } finally {
      setAiScanning(false);
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !imageUrl.trim() && !codeSnippet.trim() && !imageFile) return;
    setLoading(true);
    let finalImageUrl = imageUrl;
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `post_images/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('post_images').upload(filePath, imageFile);
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('post_images').getPublicUrl(filePath);
        finalImageUrl = publicUrlData.publicUrl;
      } else {
        toast.error('Failed to upload image.'); setLoading(false); return;
      }
    }

    const postPayload = {
      user_id: session.user.id,
      content,
      image_url: finalImageUrl || null,
      code_snippet: codeSnippet || null,
      code_language: codeLang || null
    };

    const { error } = await supabase.from('posts').insert(postPayload);
    setLoading(false);
    if (error) { 
      toast.error(error.message); 
    } else {
      setContent(''); 
      setImageUrl(''); 
      setImageFile(null); 
      setCodeSnippet('');
      setCodeLang(''); 
      setShowExtras(false);
      toast.success('Post created!');
      if (onPostCreated) onPostCreated();
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImageFile(file); setImageUrl(URL.createObjectURL(file)); }
  };

  const initial = userProfile?.username?.[0]?.toUpperCase() || 'A';
  const displayPlaceholder = placeholder || `What's on your mind, ${userProfile?.username || 'Alex'}?`;

  return (
    <div className="rounded-2xl p-4 bg-white border border-[#f1e4d3] shadow-xs flex flex-col gap-3">
      {/* Top Input area with avatar */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-[#ea580c] via-[#f97316] to-[#facc15] flex items-center justify-center text-sm font-bold text-white shrink-0 p-0.5 shadow-2xs">
          {userProfile?.avatar_url ? (
            <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-full" />
          ) : (
            initial
          )}
        </div>

        <div className="flex-1 rounded-full bg-[#faf6f0] border border-[#f1e4d3] px-4 py-2.5 flex items-center focus-within:border-orange-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-100 transition-all">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handlePost()}
            placeholder={displayPlaceholder}
            className="w-full bg-transparent text-sm text-[#2b1f17] placeholder-[#a89284] outline-none"
          />
          {content.trim().length > 5 && (
            <button
              type="button"
              onClick={handlePolishPost}
              disabled={aiPolishing}
              className="ml-2 text-xs text-[#ea580c] hover:underline font-bold shrink-0 flex items-center gap-1 cursor-pointer"
            >
              {aiPolishing ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
              <span>Polish</span>
            </button>
          )}
        </div>
      </div>

      {/* Attachments drawer */}
      <AnimatePresence>
        {showExtras && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 rounded-xl bg-[#faf6f0] border border-[#f1e4d3] flex flex-col gap-2.5 mt-1">
              <div className="flex justify-between items-center text-xs text-[#8d7565] font-bold">
                <span>Attachments</span>
                <button onClick={() => setShowExtras(false)} className="hover:text-[#2b1f17] cursor-pointer"><X size={14} /></button>
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ffedd5] text-[#9a3412] hover:bg-[#fed7aa] text-xs font-bold cursor-pointer transition-all">
                  <ImageIcon size={14} /> Upload image
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                <input
                  type="url"
                  value={!imageFile ? imageUrl : ''}
                  disabled={!!imageFile}
                  onChange={(e) => { setImageUrl(e.target.value); setImageFile(null); }}
                  placeholder="Or paste image URL"
                  className="flex-1 bg-white border border-[#f1e4d3] rounded-lg px-3 py-1.5 text-xs text-[#2b1f17] outline-none"
                />
              </div>

              {imageUrl && (
                <div className="relative w-max mt-1">
                  <img src={imageUrl} alt="preview" className="max-h-28 rounded-lg object-cover border border-[#f1e4d3]" />
                  <button
                    onClick={() => { setImageUrl(''); setImageFile(null); }}
                    className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-rose-500 rounded-full text-white cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}

              {/* Code input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[#8d7565] font-semibold">Code snippet</span>
                  {codeSnippet.trim() && (
                    <button
                      type="button"
                      onClick={handleScanCode}
                      disabled={aiScanning}
                      className="text-[11px] text-[#ea580c] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {aiScanning ? <RefreshCw size={10} className="animate-spin" /> : <Shield size={10} />}
                      <span>Scan Code</span>
                    </button>
                  )}
                </div>
                <textarea
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  placeholder="Paste your code snippet..."
                  className="w-full bg-[#2b1f17] rounded-lg p-2.5 text-xs font-mono text-amber-300 outline-none resize-y min-h-[60px]"
                />
              </div>

              {showCodeReview && (
                <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-200 text-xs text-[#8d7565] whitespace-pre-wrap max-h-36 overflow-y-auto">
                  {codeReviewResult}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons Row */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Image */}
          <button
            type="button"
            onClick={() => setShowExtras(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#8d7565] hover:text-[#ea580c] hover:bg-[#fff7ed] transition-all cursor-pointer"
          >
            <ImageIcon size={15} className="text-[#ea580c]" />
            <span>Image</span>
          </button>

          {/* Video */}
          <button
            type="button"
            onClick={() => setShowExtras(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#8d7565] hover:text-[#ea580c] hover:bg-[#fff7ed] transition-all cursor-pointer"
          >
            <Video size={15} className="text-[#f97316]" />
            <span>Video</span>
          </button>

          {/* Event */}
          <button
            type="button"
            onClick={() => setShowExtras(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#8d7565] hover:text-[#ea580c] hover:bg-[#fff7ed] transition-all cursor-pointer"
          >
            <Calendar size={15} className="text-[#ea580c]" />
            <span>Event</span>
          </button>

          {/* More */}
          <button
            type="button"
            onClick={() => setShowExtras(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#8d7565] hover:text-[#ea580c] hover:bg-[#fff7ed] transition-all cursor-pointer"
          >
            <MoreHorizontal size={15} />
            <span>More</span>
          </button>
        </div>

        {/* Post Button */}
        <button
          type="button"
          onClick={handlePost}
          disabled={loading || (!content && !imageUrl && !codeSnippet && !imageFile)}
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fb923c] hover:brightness-105 text-white font-extrabold text-xs transition-all shadow-md shadow-orange-500/25 disabled:opacity-40 cursor-pointer active:scale-95"
        >
          {loading ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  );
}
