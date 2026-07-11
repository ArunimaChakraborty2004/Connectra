import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Code2, Image as ImageIcon, Send, X, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../../lib/toast';

export default function CreatePost({ session, onPostCreated }) {
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
    
    const { error } = await supabase.from('posts').insert({
      user_id: session.user.id,
      content,
      image_url: finalImageUrl || null,
      code_snippet: codeSnippet || null,
      code_language: codeLang || null,
      poll_data: pollPayload
    });
    
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
          placeholder="What are you building today?" 
          className="w-full bg-transparent text-main placeholder-[#666] resize-none outline-none text-[15px] min-h-[60px]"
        />
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
            <div className="flex gap-2">
              <textarea value={codeSnippet} onChange={e => setCodeSnippet(e.target.value)} placeholder="Paste your code snippet here..." className="w-full glass-panel rounded-lg px-4 py-3 text-sm text-green-400 font-mono focus:border-primary/50 outline-none resize-y min-h-[100px]"></textarea>
            </div>
            <input type="text" value={codeLang} onChange={e => setCodeLang(e.target.value)} placeholder="Language (e.g. javascript)" className="w-1/3 min-w-[120px] glass-panel rounded-lg px-4 py-2 text-sm text-main focus:border-primary/50 outline-none transition-colors" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 flex justify-between items-center bg-[#050505]">
        <div className="flex gap-1">
          <button onClick={() => setShowExtras(true)} className="p-2 text-[#666] hover:text-main rounded-lg transition-colors" title="Add Media">
            <ImageIcon size={18} />
          </button>
          <button onClick={() => setShowExtras(true)} className="p-2 text-[#666] hover:text-main rounded-lg transition-colors" title="Add Code">
            <Code2 size={18} />
          </button>
          <button
            onClick={() => { setShowPoll(p => !p); setShowExtras(false); }}
            className={`p-2 rounded-lg transition-colors ${showPoll ? 'text-primary bg-primary/10' : 'text-[#666] hover:text-main'}`}
            title="Create Poll"
          >
            <BarChart2 size={18} />
          </button>
        </div>
        <button 
          onClick={handlePost} 
          disabled={loading || (!content && !imageUrl && !codeSnippet && !imageFile && !showPoll)}
          className="px-5 py-1.5 bg-primary text-main font-semibold rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2 text-sm hover:bg-primary/90"
        >
          {loading ? 'Posting...' : 'Post'} <Send size={14} />
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
