import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Code2, Image as ImageIcon, Send, X, BarChart2, Sparkles, Shield, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../../lib/toast';
import { reviewCodeAndSecurity, polishPostContent } from '../../lib/ai';

export default function CreatePost({ session, onPostCreated, communityId = null, placeholder = "What are you working on? Share code, ideas, or questions..." }) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [codeLang, setCodeLang] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // AI Assistant States
  const [aiPolishing, setAiPolishing] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [codeReviewResult, setCodeReviewResult] = useState(null);
  const [showCodeReview, setShowCodeReview] = useState(false);

  const handlePolishPost = async () => {
    if (!content.trim()) return;
    setAiPolishing(true);
    try {
      const polished = await polishPostContent({ content });
      setContent(polished);
      toast.success('Post polished with AI! 🚀');
    } catch (err) {
      toast.error('Failed to polish post');
    } finally {
      setAiPolishing(false);
    }
  };

  const handleScanCode = async () => {
    if (!codeSnippet.trim()) {
      toast.error('Please paste code to review first.');
      return;
    }
    setAiScanning(true);
    setShowCodeReview(true);
    try {
      const result = await reviewCodeAndSecurity({
        code: codeSnippet,
        language: codeLang || 'javascript',
      });
      setCodeReviewResult(result);
    } catch (err) {
      toast.error('Failed to run code scan');
    } finally {
      setAiScanning(false);
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !imageUrl.trim() && !codeSnippet.trim() && !imageFile && !showPoll) return;
    if (showPoll && (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2)) {
      toast.error('Please add a poll question and at least 2 options.');
      return;
    }
    setLoading(true);
    
    let finalImageUrl = imageUrl;
    
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `post_images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('post_images')
        .upload(filePath, imageFile);

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('post_images')
          .getPublicUrl(filePath);
        finalImageUrl = publicUrlData.publicUrl;
      } else {
        toast.error('Failed to upload image.');
        setLoading(false);
        return;
      }
    }

    const pollPayload = showPoll ? {
      question: pollQuestion,
      options: pollOptions.filter(o => o.trim()).map(text => ({ text, votes: [] }))
    } : null;
    
    const postPayload = {
      user_id: session.user.id,
      content,
      image_url: finalImageUrl || null,
      code_snippet: codeSnippet || null,
      code_language: codeLang || null,
      poll_data: pollPayload
    };
    if (communityId) {
      postPayload.community_id = communityId;
    }

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
      setShowPoll(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      toast.success('Post created!');
      if (onPostCreated) onPostCreated();
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
    }
  };

  return (
    <motion.section 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="glass-panel rounded-2xl overflow-hidden"
    >
      <div className="p-4 border-b border-white/10">
        <textarea 
          value={content} 
          onChange={e => setContent(e.target.value)} 
          placeholder={placeholder} 
          className="w-full bg-transparent text-main placeholder-[#666] resize-none outline-none text-[15px] min-h-[60px]"
        />
        {content.trim().length > 5 && (
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={handlePolishPost}
              disabled={aiPolishing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 hover:border-violet-500/50 transition-all cursor-pointer disabled:opacity-50"
            >
              {aiPolishing ? <RefreshCw size={11} className="animate-spin text-violet-400" /> : <Sparkles size={11} className="text-violet-400" />}
              <span>{aiPolishing ? 'Polishing...' : '✨ Polish with AI'}</span>
            </button>
          </div>
        )}
      </div>
      
      <AnimatePresence>
        {showExtras && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-3 bg-black/20 flex flex-col gap-3"
          >
            <div className="flex justify-between items-center text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">
              <span>Attachments</span>
              <button onClick={() => setShowExtras(false)} className="hover:text-main"><X size={14}/></button>
            </div>
            
            <div className="flex gap-2 items-center">
              <label className="bg-surface border border-white/10 hover:border-primary/50 text-main text-xs px-3 py-2 rounded-lg cursor-pointer transition-colors flex items-center gap-2">
                <ImageIcon size={14} /> Upload Image
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
              <span className="text-xs text-muted">OR</span>
              <input type="url" value={!imageFile ? imageUrl : ''} disabled={!!imageFile} onChange={e => {setImageUrl(e.target.value); setImageFile(null);}} placeholder="Paste Image URL" className="flex-1 glass-panel rounded-lg px-4 py-2 text-sm text-main focus:border-primary/50 outline-none transition-colors disabled:opacity-50" />
            </div>
            
            {imageUrl && (
              <div className="relative w-max">
                <img src={imageUrl} alt="Preview" className="max-h-32 rounded-lg object-cover" />
                <button 
                  onClick={() => {setImageUrl(''); setImageFile(null);}} 
                  className="absolute top-1 right-1 bg-black/60 p-1 rounded-full hover:bg-red-500 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted font-medium">Code Snippet</span>
                {codeSnippet.trim() && (
                  <button
                    type="button"
                    onClick={handleScanCode}
                    disabled={aiScanning}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {aiScanning ? <RefreshCw size={11} className="animate-spin text-emerald-400" /> : <Shield size={11} className="text-emerald-400" />}
                    <span>{aiScanning ? 'Auditing...' : '🛡️ AI Code & Security Scan'}</span>
                  </button>
                )}
              </div>
              <textarea value={codeSnippet} onChange={e => setCodeSnippet(e.target.value)} placeholder="Paste your code snippet here..." className="w-full glass-panel rounded-lg px-4 py-3 text-sm text-green-400 font-mono focus:border-primary/50 outline-none resize-y min-h-[100px]"></textarea>
            </div>

            {/* Code Audit Results Box */}
            <AnimatePresence>
              {showCodeReview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Shield size={13} /> Groq Security & Quality Audit
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCodeReview(false)}
                      className="text-muted hover:text-white text-xs cursor-pointer"
                    >
                      Hide
                    </button>
                  </div>
                  {aiScanning ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 py-2">
                      <RefreshCw size={12} className="animate-spin" />
                      Auditing code for injection, secret leaks, and security flaws...
                    </div>
                  ) : (
                    <div className="text-xs text-muted whitespace-pre-wrap leading-relaxed select-text bg-black/40 p-3 rounded-lg border border-white/5 max-h-56 overflow-y-auto">
                      {codeReviewResult}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <input type="text" value={codeLang} onChange={e => setCodeLang(e.target.value)} placeholder="Language (e.g. javascript)" className="w-1/3 min-w-[120px] glass-panel rounded-lg px-4 py-2 text-sm text-main focus:border-primary/50 outline-none transition-colors" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 flex justify-between items-center bg-surface-hover/40 border-t border-border">
        <div className="flex gap-1">
          <button onClick={() => setShowExtras(true)} className="p-2 text-muted hover:text-main hover:bg-surface-hover rounded-xl transition-colors cursor-pointer" title="Add Media">
            <ImageIcon size={18} />
          </button>
          <button onClick={() => setShowExtras(true)} className="p-2 text-muted hover:text-main hover:bg-surface-hover rounded-xl transition-colors cursor-pointer" title="Add Code">
            <Code2 size={18} />
          </button>
          <button
            onClick={() => { setShowPoll(p => !p); setShowExtras(false); }}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${showPoll ? 'text-primary bg-primary/10' : 'text-muted hover:text-main hover:bg-surface-hover'}`}
            title="Create Poll"
          >
            <BarChart2 size={18} />
          </button>
        </div>
        <button 
          onClick={handlePost} 
          disabled={loading || (!content && !imageUrl && !codeSnippet && !imageFile && !showPoll)}
          className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl disabled:opacity-40 transition-all flex items-center gap-2 text-xs shadow-md shadow-violet-500/20 hover:opacity-95 cursor-pointer"
        >
          {loading ? 'Posting...' : 'Post'} <Send size={13} />
        </button>
      </div>

      {/* Poll Builder */}
      <AnimatePresence>
        {showPoll && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 bg-primary/5 border-t border-primary/20 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5"><BarChart2 size={12}/> Poll</span>
                <button onClick={() => setShowPoll(false)} className="text-muted hover:text-main"><X size={14}/></button>
              </div>
              <input
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                placeholder="Ask a question..."
                className="w-full bg-background border border-white/10 rounded-xl px-3 py-2 text-sm text-main outline-none focus:border-primary/50"
              />
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={opt}
                    onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 bg-background border border-white/10 rounded-xl px-3 py-2 text-sm text-main outline-none focus:border-primary/50"
                  />
                  {pollOptions.length > 2 && (
                    <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))} className="text-muted hover:text-red-400"><X size={14}/></button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button
                  onClick={() => setPollOptions(prev => [...prev, ''])}
                  className="text-xs text-primary hover:underline text-left"
                >
                  + Add option
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
