import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Code2, Image as ImageIcon, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../../lib/toast';

export default function CreatePost({ session, onPostCreated }) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [codeLang, setCodeLang] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePost = async () => {
    if (!content.trim() && !imageUrl.trim() && !codeSnippet.trim()) return;
    setLoading(true);
    
    const { error } = await supabase.from('posts').insert({
      user_id: session.user.id,
      content,
      image_url: imageUrl || null,
      code_snippet: codeSnippet || null,
      code_language: codeLang || null
    });
    
    setLoading(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      setContent('');
      setImageUrl('');
      setCodeSnippet('');
      setCodeLang('');
      setShowExtras(false);
      toast.success('Post created!');
      if (onPostCreated) onPostCreated();
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
            <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Image URL (optional)" className="w-full glass-panel rounded-lg px-4 py-2 text-sm text-main focus:border-primary/50 outline-none transition-colors" />
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
        </div>
        <button 
          onClick={handlePost} 
          disabled={loading || (!content && !imageUrl && !codeSnippet)}
          className="px-5 py-1.5 bg-primary text-main font-semibold rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2 text-sm hover:bg-primary/90"
        >
          {loading ? 'Posting...' : 'Post'} <Send size={14} />
        </button>
      </div>
    </motion.section>
  );
}
