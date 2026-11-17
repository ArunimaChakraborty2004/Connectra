import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../../lib/toast';
import PostCard from '../feed/PostCard';
import {
  Send,
  Image as ImageIcon,
  Code2,
  X,
  Loader2,
  MessageSquare,
  Sparkles,
  Shield,
  RefreshCw,
  AlertTriangle,
  Clock,
  Star,
  Users,
  Search,
  FileImage,
  BarChart2,
  Globe,
  HelpCircle,
  Cpu,
} from 'lucide-react';
import { reviewCodeAndSecurity, polishPostContent, polishCodeSnippet } from '../../lib/ai';
import { scanForSecrets, redactSecrets } from '../../lib/secretScanner';
import { detectCodeLanguage, getLanguageDisplayName, SUPPORTED_LANGUAGES } from '../../lib/codeDetector';
import AIAnalysisCard from '../feed/AIAnalysisCard';

// ─── Simple Community Channels ────────────────────────────────────────────────
const COMMUNITY_CHANNELS = [
  { id: 'all', label: 'All Discussions', icon: Globe },
  { id: 'general', label: 'General', icon: MessageSquare },
  { id: 'code', label: 'Code & Reviews', icon: Code2 },
  { id: 'showcase', label: 'Showcase', icon: Sparkles },
  { id: 'help', label: 'Questions & Help', icon: HelpCircle },
];

// ─── Post Composer ─────────────────────────────────────────────────────────────
function CreateCommunityPost({ session, community, communityId, onPostCreated, selectedChannel }) {
  const [activeTab, setActiveTab] = useState(
    selectedChannel === 'code' ? 'code' : selectedChannel === 'showcase' ? 'image' : selectedChannel === 'help' ? 'poll' : 'text'
  );
  const [content, setContent] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [codeLang, setCodeLang] = useState('javascript');
  const [isAutoDetected, setIsAutoDetected] = useState(false);
  const [codeReviewResult, setCodeReviewResult] = useState(null);
  const [showCodeReview, setShowCodeReview] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['Option 1', 'Option 2']);
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [aiPolishing, setAiPolishing] = useState(false);
  const [aiReviewing, setAiReviewing] = useState(false);
  const [secretDetections, setSecretDetections] = useState([]);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [pendingPublish, setPendingPublish] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => { if (data) setUserProfile(data); });
  }, [session?.user?.id]);

  useEffect(() => {
    if (selectedChannel === 'code') setActiveTab('code');
    else if (selectedChannel === 'showcase') setActiveTab('image');
    else if (selectedChannel === 'help') setActiveTab('poll');
    else if (selectedChannel === 'general') setActiveTab('text');
  }, [selectedChannel]);

  const avatarUrl = session?.user?.user_metadata?.avatar_url || userProfile?.avatar_url;
  const username = session?.user?.user_metadata?.username || userProfile?.username || 'You';

  const handleCodeSnippetChange = (newCode) => {
    setCodeSnippet(newCode);
    if (newCode && newCode.trim()) {
      const detected = detectCodeLanguage(newCode);
      if (detected) {
        setCodeLang(detected);
        setIsAutoDetected(true);
      }
    }
  };

  const handleManualLangChange = (newLang) => {
    setCodeLang(newLang);
    setIsAutoDetected(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          setImageFile(file);
          const reader = new FileReader();
          reader.onload = (ev) => {
            setImagePreview(ev.target.result);
            setActiveTab('image');
          };
          reader.readAsDataURL(file);
          toast.success('Screenshot pasted from clipboard.');
          break;
        }
      }
    }
  };

  const handlePolish = async () => {
    const hasText = Boolean(content && content.trim());
    const hasCode = Boolean(codeSnippet && codeSnippet.trim());
    if (!hasText && !hasCode) {
      toast.error('Write some text or paste a code snippet to polish');
      return;
    }

    setAiPolishing(true);
    try {
      // 1. If code exists, polish the code snippet and run verification
      if (hasCode) {
        const detected = detectCodeLanguage(codeSnippet);
        const activeLang = detected || codeLang || 'python';
        if (detected && detected !== codeLang) {
          setCodeLang(detected);
          setIsAutoDetected(true);
        }
        const polishedCode = await polishCodeSnippet({ code: codeSnippet, language: activeLang });
        setCodeSnippet(polishedCode);

        // Security & Quality SAST review
        const audit = await reviewCodeAndSecurity({ code: polishedCode, language: activeLang });
        setCodeReviewResult(audit);
        setShowCodeReview(true);
      }

      // 2. Polish text or generate informative caption for the code
      if (hasText) {
        const polished = await polishPostContent({ content });
        setContent(polished);
      } else if (hasCode) {
        const langName = getLanguageDisplayName(codeLang);
        setContent(`Optimized and security-verified ${langName} implementation.\n\n#${codeLang} #cleancode #devcommunity`);
      }

      toast.success('Post & code polished with AI! ✨');
    } catch (err) {
      console.warn('AI polish error:', err);
      toast.error('AI polish failed');
    } finally {
      setAiPolishing(false);
    }
  };

  const handlePreAuditCode = async () => {
    if (!codeSnippet.trim()) {
      toast.error('Enter some code to review');
      return;
    }
    setAiReviewing(true);
    setShowCodeReview(true);
    try {
      const detected = detectCodeLanguage(codeSnippet);
      const activeLang = detected || codeLang || 'python';
      if (detected && detected !== codeLang) {
        setCodeLang(detected);
        setIsAutoDetected(true);
      }
      const review = await reviewCodeAndSecurity({
        code: codeSnippet,
        language: activeLang,
      });
      setCodeReviewResult(review);
      if (review?.findings?.length > 0) {
        toast.error(`Identified ${review.findings.length} security advisory warning(s)`);
      } else {
        toast.success(`${getLanguageDisplayName(activeLang)} code verified clean! 🛡️`);
      }
    } catch (err) {
      console.warn('Code review error:', err);
      toast.error('AI code review failed');
    } finally {
      setAiReviewing(false);
    }
  };

  const executePublish = async (overrideContent) => {
    setLoading(true);
    let finalContent = overrideContent !== undefined ? overrideContent : content;
    let finalImageUrl = null;

    const hasCodeSnippet = Boolean(codeSnippet && codeSnippet.trim());
    let targetTag = selectedChannel && selectedChannel !== 'all' ? selectedChannel : null;
    if (!targetTag) {
      if (hasCodeSnippet || activeTab === 'code') targetTag = 'code';
      else if (imageFile || imagePreview || activeTab === 'image') targetTag = 'showcase';
      else if (activeTab === 'poll') targetTag = 'help';
      else targetTag = 'general';
    }

    if (targetTag && targetTag !== 'general' && !finalContent.includes(`[#${targetTag}]`)) {
      finalContent = `[#${targetTag}] ${finalContent}`;
    }

    let pollPayload = null;
    if (activeTab === 'poll' && pollQuestion?.trim()) {
      const validOpts = pollOptions.filter((o) => o?.trim());
      if (validOpts.length >= 2) {
        finalContent += `\n\n📊 **Poll: ${pollQuestion}**\n` + validOpts.map((o) => `• [ ] ${o}`).join('\n');
        pollPayload = {
          question: pollQuestion,
          options: validOpts.map((text, id) => ({ id: String(id), text, votes: [] })),
          voters: {},
        };
      }
    }

    if (imageFile) {
      const fileExt = imageFile.name?.split('.').pop() || 'png';
      const fileName = `${session.user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `post_images/${fileName}`;
      try {
        const { error: uploadError } = await supabase.storage
          .from('post_images')
          .upload(filePath, imageFile, { upsert: true });
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('post_images')
            .getPublicUrl(filePath);
          finalImageUrl = publicUrlData.publicUrl;
        } else {
          console.warn('Storage upload warning, using preview DataURL:', uploadError);
          finalImageUrl = imagePreview;
        }
      } catch (err) {
        console.warn('Storage exception, using preview DataURL:', err);
        finalImageUrl = imagePreview;
      }
    } else if (imageUrlInput && imageUrlInput.trim()) {
      finalImageUrl = imageUrlInput.trim();
    } else if (imagePreview) {
      finalImageUrl = imagePreview;
    }

    const hasCode = Boolean(codeSnippet && codeSnippet.trim());
    const finalCodeSnippet = hasCode ? codeSnippet.trim() : null;
    const finalCodeLang = hasCode ? (codeLang || 'javascript') : null;

    const taggedContent = `${finalContent}\n\n<!--community_id:${communityId}-->`;
    let createdPost = null;
    let insertError = null;

    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(communityId);

      const payload = {
        user_id: session.user.id,
        content: taggedContent,
        image_url: finalImageUrl || null,
        code_snippet: finalCodeSnippet,
        code_language: finalCodeLang,
        poll_data: pollPayload || null,
        community_id: isUUID ? communityId : null,
        community_slug: community?.slug || null,
      };

      const { data, error } = await supabase
        .from('posts')
        .insert(payload)
        .select('*, profiles(username, avatar_url, full_name)')
        .single();

      if (data && !error) {
        createdPost = data;
      } else {
        insertError = error;
      }
    } catch (err) {
      insertError = err;
    }

    if (insertError) {
      console.warn('Post insert error:', insertError);
      toast.error('Failed to publish post: ' + (insertError.message || 'database error'));
      setLoading(false);
      return;
    }

    const formattedPost = {
      ...(createdPost || {}),
      id: createdPost?.id || `post-${Date.now()}`,
      user_id: session.user.id,
      content: createdPost?.content || taggedContent,
      image_url: createdPost?.image_url || finalImageUrl || null,
      code_snippet: createdPost?.code_snippet || finalCodeSnippet,
      code_language: createdPost?.code_language || finalCodeLang,
      poll_data: pollPayload || null,
      community_id: communityId,
      community_slug: community?.slug || null,
      created_at: createdPost?.created_at || new Date().toISOString(),
      profiles: createdPost?.profiles || { username, avatar_url: avatarUrl || null },
      likes: [{ count: 0 }],
      likes_count: 0,
      user_has_liked: false,
      comments: [],
    };

    setLoading(false);
    setContent('');
    setCodeSnippet('');
    setCodeLang('javascript');
    setImageFile(null);
    setImagePreview(null);
    setImageUrlInput('');
    setPollQuestion('');
    setPollOptions(['Option 1', 'Option 2']);
    setPendingPublish(null);
    toast.success('Post published successfully.');
    onPostCreated?.(formattedPost);
  };

  const handleSubmit = async () => {
    if (!session?.user?.id) { toast.error('Sign in to post'); return; }
    const hasText = Boolean(content && content.trim());
    const hasCode = Boolean(codeSnippet && codeSnippet.trim());
    const hasImg = Boolean(imageFile || imagePreview || (imageUrlInput && imageUrlInput.trim()));
    const hasPoll = Boolean(activeTab === 'poll' && pollQuestion && pollQuestion.trim());

    if (!hasText && !hasCode && !hasImg && !hasPoll) {
      toast.error('Write something, paste code, or attach an image before posting');
      return;
    }

    const allText = `${content || ''} ${codeSnippet || ''}`;
    const scanRes = scanForSecrets(allText);
    if (scanRes?.hasSecrets && scanRes?.detections?.length > 0) {
      setSecretDetections(scanRes.detections);
      setPendingPublish(content);
      setShowSecretModal(true);
      return;
    }
    await executePublish();
  };

  const LANGS = ['javascript', 'typescript', 'python', 'rust', 'go', 'bash', 'solidity', 'cpp', 'java', 'sql'];

  return (
    <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-2xl shadow-xs overflow-hidden transition-all duration-200">
      {/* Secret scan modal */}
      <AnimatePresence>
        {showSecretModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-[#1f1813] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-300 dark:border-red-900/40"
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={20} className="text-red-500" />
                <h3 className="font-bold text-base text-[#1c130d] dark:text-[#f4e8da]">API Key / Secret Detected</h3>
              </div>
              <p className="text-xs text-[#6b5546] dark:text-[#c4aba0] mb-4">
                We detected sensitive keys or passwords in your post. Would you like to redact them automatically before posting?
              </p>
              <ul className="space-y-1.5 mb-4 max-h-36 overflow-y-auto">
                {secretDetections.map((d, i) => (
                  <li key={i} className="text-xs font-mono bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg px-2.5 py-1.5 border border-red-200 dark:border-red-900/40">
                    <span className="font-bold">{d.type}:</span> {d.match?.substring(0, 24)}…
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowSecretModal(false); executePublish(redactSecrets(pendingPublish)); }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white text-xs font-black hover:brightness-105 transition-all cursor-pointer shadow-sm"
                >
                  Redact & Post
                </button>
                <button
                  onClick={() => { setShowSecretModal(false); executePublish(pendingPublish); }}
                  className="flex-1 py-2.5 rounded-xl border border-[#f1e4d3] dark:border-[#382b22] text-[#8d7565] text-xs font-bold hover:bg-[#faf6f0] dark:hover:bg-[#281f18] transition-all cursor-pointer"
                >
                  Post As Is
                </button>
                <button
                  onClick={() => setShowSecretModal(false)}
                  className="p-2.5 rounded-xl border border-[#f1e4d3] dark:border-[#382b22] text-[#8d7565] hover:bg-[#faf6f0] dark:hover:bg-[#281f18] transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer Container (Always Open & Ready) */}
      <div className="p-4 sm:p-5 space-y-3.5">
        {/* Header / Posting Context */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-[#f1e4d3] dark:border-[#33261d]">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-[#ea580c] to-[#f97316] flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="You" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-black text-xs">{username?.[0]?.toUpperCase() || 'U'}</span>
              )}
            </div>
            <div className="text-xs font-bold text-[#1c130d] dark:text-white flex items-center gap-1.5 flex-wrap">
              <span>{username}</span>
              <span className="text-[10px] text-[#8d7565] font-normal">posting in</span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#ea580c] flex items-center gap-1">
                <Globe size={11} /> {community?.name}
              </span>
              {selectedChannel && selectedChannel !== 'all' && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                  #{selectedChannel}
                </span>
              )}
            </div>
          </div>

          {Boolean(content || codeSnippet || imageFile || imagePreview) && (
            <button
              type="button"
              onClick={() => { setContent(''); setCodeSnippet(''); setImageFile(null); setImagePreview(null); setImageUrlInput(''); }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#8d7565] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Clear all fields"
            >
              Clear
            </button>
          )}
        </div>

            {/* Post Format Tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#faf6f0] dark:bg-[#281f18] rounded-xl border border-[#f1e4d3] dark:border-[#382b22]">
              {[
                { id: 'text', label: 'Text Post', icon: MessageSquare },
                {
                  id: 'code',
                  label: codeSnippet?.trim()
                    ? `Code (${getLanguageDisplayName(codeLang).toUpperCase()})`
                    : (activeTab === 'code' ? `Code (${getLanguageDisplayName(codeLang).toUpperCase()})` : 'Code Snippet'),
                  icon: Code2,
                  hasAsset: Boolean(codeSnippet && codeSnippet.trim()),
                },
                { id: 'image', label: 'Image', icon: FileImage, hasAsset: Boolean(imageFile || imagePreview || (imageUrlInput && imageUrlInput.trim())) },
                { id: 'poll', label: 'Poll', icon: BarChart2, hasAsset: Boolean(pollQuestion && pollQuestion.trim()) },
              ].map(({ id, label, icon: Icon, hasAsset }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
                    activeTab === id
                      ? 'bg-white dark:bg-[#1f1813] text-[#ea580c] shadow-xs border border-[#f1e4d3] dark:border-[#382b22]'
                      : 'text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white'
                  }`}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                  {hasAsset && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-stone-900" title="Attached content" />
                  )}
                </button>
              ))}
            </div>

            {/* Text Input */}
            <textarea
              ref={textareaRef}
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              placeholder={
                activeTab === 'code'
                  ? 'Add context or explain what this code does…'
                  : activeTab === 'image'
                  ? 'Add a caption for your image…'
                  : activeTab === 'poll'
                  ? 'Ask a question for your poll…'
                  : `What's on your mind? Share with ${community?.name || 'the community'}…`
              }
              className="w-full bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#1c130d] dark:text-[#f4e8da] placeholder:text-[#b4a399] dark:placeholder:text-[#6b5546] resize-none focus:outline-none focus:ring-2 focus:ring-[#ea580c]/30 transition-all"
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit(); }}
            />

            {/* Code Snippet Editor */}
            <AnimatePresence>
              {activeTab === 'code' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 pt-1"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Code2 size={14} className="text-[#ea580c]" />
                      <select
                        value={codeLang}
                        onChange={(e) => handleManualLangChange(e.target.value)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c] cursor-pointer font-mono font-bold"
                      >
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <option key={l.id} value={l.id}>{l.label}</option>
                        ))}
                      </select>
                      {isAutoDetected ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 shadow-2xs">
                          <Sparkles size={10} /> Auto-detected
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#8d7565]">Language</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handlePreAuditCode}
                      disabled={!(codeSnippet && codeSnippet.trim()) || aiReviewing}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:brightness-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {aiReviewing ? <Loader2 size={11} className="animate-spin" /> : <Shield size={11} />}
                      <span>{aiReviewing ? 'Analyzing Code…' : 'Review Code with AI'}</span>
                    </button>
                  </div>

                  <textarea
                    rows={6}
                    value={codeSnippet}
                    onChange={(e) => handleCodeSnippetChange(e.target.value)}
                    placeholder={`# Paste your ${getLanguageDisplayName(codeLang)} code snippet here…`}
                    className="w-full font-mono text-xs bg-[#120e0b] border border-[#3d2e24] rounded-xl p-3 text-amber-200 placeholder:text-stone-600 resize-none focus:outline-none focus:ring-2 focus:ring-[#ea580c]/30 transition-all leading-relaxed"
                  />

                  {/* Inline AI Review & Error Reflection Card */}
                  {showCodeReview && codeReviewResult && (
                    <div className="pt-2">
                      <AIAnalysisCard
                        content={codeReviewResult}
                        type="security"
                        onClose={() => setShowCodeReview(false)}
                        onApplyFix={(fixedCode) => {
                          setCodeSnippet(fixedCode);
                          const detected = detectCodeLanguage(fixedCode);
                          if (detected) setCodeLang(detected);
                          toast.success('AI remediation patch applied to snippet!');
                        }}
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Media Upload & URL Input */}
            <AnimatePresence>
              {activeTab === 'image' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 pt-1"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  {imagePreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-[#f1e4d3] dark:border-[#382b22] max-h-64 bg-stone-900/10 dark:bg-stone-950 flex items-center justify-center p-2">
                      <img src={imagePreview} alt="Preview" className="w-full max-h-60 object-contain mx-auto rounded-lg" />
                      <button
                        onClick={() => { setImageFile(null); setImagePreview(null); setImageUrlInput(''); }}
                        className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/75 text-white hover:bg-black transition-colors cursor-pointer shadow-md"
                        title="Remove image"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-7 rounded-xl border-2 border-dashed border-[#f1e4d3] dark:border-[#382b22] text-[#8d7565] hover:border-[#ea580c] hover:text-[#ea580c] transition-all flex flex-col items-center gap-1.5 cursor-pointer bg-[#faf6f0]/60 dark:bg-[#281f18]/60"
                      >
                        <FileImage size={24} className="text-[#ea580c]" />
                        <span className="text-xs font-bold text-[#1c130d] dark:text-white">Choose Image or Screenshot</span>
                        <span className="text-[11px] text-[#8d7565]">PNG, JPG, WebP or paste clipboard screenshot (Ctrl+V)</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#8d7565] uppercase font-bold shrink-0">Or URL:</span>
                        <input
                          type="url"
                          value={imageUrlInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setImageUrlInput(val);
                            if (val.trim().startsWith('http')) {
                              setImagePreview(val.trim());
                            }
                          }}
                          placeholder="https://example.com/screenshot.png"
                          className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white placeholder:text-[#b4a399] dark:placeholder:text-[#6b5546] focus:outline-none focus:border-[#ea580c]"
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Poll Builder */}
            <AnimatePresence>
              {activeTab === 'poll' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2.5 pt-1 bg-[#faf6f0] dark:bg-[#281f18] p-3 rounded-xl border border-[#f1e4d3] dark:border-[#382b22]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart2 size={14} className="text-[#ea580c]" />
                      <span className="text-xs font-bold text-[#1c130d] dark:text-white">Create Developer Poll</span>
                    </div>
                    <span className="text-[10px] text-[#8d7565]">Options saved to database</span>
                  </div>
                  <input
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="e.g. Which async runtime do you use in production?"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white placeholder:text-[#b4a399] dark:placeholder:text-[#6b5546] focus:outline-none focus:border-[#ea580c]"
                  />
                  <div className="space-y-2">
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-[#ea580c] w-5 h-5 rounded-md bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center shrink-0">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...pollOptions];
                            next[i] = e.target.value;
                            setPollOptions(next);
                          }}
                          placeholder={`Choice ${String.fromCharCode(65 + i)}`}
                          className="flex-1 text-xs px-3 py-2 rounded-xl bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c]"
                        />
                        {pollOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                            className="p-1 rounded-lg text-[#8d7565] hover:text-rose-500 transition-colors cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 5 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions([...pollOptions, `Choice ${String.fromCharCode(65 + pollOptions.length)}`])}
                        className="text-[11px] font-bold text-[#ea580c] hover:underline flex items-center gap-1 pt-0.5 cursor-pointer"
                      >
                        + Add Choice ({pollOptions.length}/5)
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePolish}
                  disabled={(!content?.trim() && !codeSnippet?.trim()) || aiPolishing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#ea580c] bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/40 hover:brightness-95 transition-all cursor-pointer disabled:opacity-40"
                  title="Polish post and code with AI"
                >
                  {aiPolishing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  <span>AI Polish</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#b4a399] font-mono hidden sm:inline">Ctrl+↵</span>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fb923c] text-white text-xs font-black hover:brightness-105 transition-all shadow-md shadow-orange-500/25 cursor-pointer disabled:opacity-60 active:scale-95"
                >
                  {loading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Posting…</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Post</span>
                    </>
                  )}
                </button>
              </div>
            </div>
      </div>
    </div>
  );
}

// ─── Main CommunityFeed ────────────────────────────────────────────────────────
export default function CommunityFeed({
  session,
  community,
  communityId,
  isJoined = false,
  isAdmin = false,
  onToggleJoin,
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCodeOnly, setFilterCodeOnly] = useState(false);
  const [filterMediaOnly, setFilterMediaOnly] = useState(false);
  const [sort, setSort] = useState('latest');
  const [refreshing, setRefreshing] = useState(false);
  const channelRef = useRef(null);

  const loadPosts = async () => {
    if (!communityId) return;
    try {
      let rawPosts = [];
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(communityId);

      // 1. Direct query by community_id column
      if (isUUID) {
        try {
          const { data: dPosts, error: dErr } = await supabase
            .from('posts')
            .select('*, profiles(username, avatar_url, full_name)')
            .eq('community_id', communityId)
            .order('created_at', { ascending: false })
            .limit(80);

          if (!dErr && dPosts) {
            rawPosts = dPosts;
          }
        } catch {}
      }

      // 2. Query fallback if empty or not UUID
      if (rawPosts.length === 0) {
        try {
          const { data: allPosts } = await supabase
            .from('posts')
            .select('*, profiles(username, avatar_url, full_name)')
            .order('created_at', { ascending: false })
            .limit(100);

          if (allPosts) {
            rawPosts = allPosts.filter((p) => {
              const matchesId = p.community_id === communityId;
              const matchesSlug = community?.slug && (p.community_slug === community.slug || p.content?.includes(`[#guild:${community.slug}]`));
              const matchesTag = p.content?.includes(`<!--community_id:${communityId}-->`);
              return matchesId || matchesSlug || matchesTag;
            });
          }
        } catch {}
      }

      // Likes and Comments
      let likesData = [];
      let commentsData = [];
      const postIds = rawPosts.map((p) => p.id);

      if (postIds.length > 0) {
        try {
          const [{ data: lData }, { data: cData }] = await Promise.all([
            supabase.from('likes').select('id, post_id, user_id').in('post_id', postIds),
            supabase
              .from('comments')
              .select('id, post_id, user_id, content, created_at, profiles(username, avatar_url)')
              .in('post_id', postIds)
              .order('created_at', { ascending: true }),
          ]);
          if (lData) likesData = lData;
          if (cData) commentsData = cData;
        } catch (e) {
          console.warn('CommunityFeed likes/comments notice:', e);
        }
      }

      const likesCountMap = {};
      const userLikedMap = {};
      likesData.forEach((l) => {
        likesCountMap[l.post_id] = (likesCountMap[l.post_id] || 0) + 1;
        if (session?.user?.id && l.user_id === session.user.id) userLikedMap[l.post_id] = true;
      });

      const commentsGroupMap = {};
      commentsData.forEach((c) => {
        if (!commentsGroupMap[c.post_id]) commentsGroupMap[c.post_id] = [];
        commentsGroupMap[c.post_id].push(c);
      });

      const formatted = rawPosts.map((p) => ({
        ...p,
        likes: [{ count: likesCountMap[p.id] || 0 }],
        likes_count: likesCountMap[p.id] || 0,
        user_has_liked: Boolean(userLikedMap[p.id]),
        comments: commentsGroupMap[p.id] || p.comments || [],
      }));

      setPosts(formatted);
    } catch (e) {
      console.warn('CommunityFeed load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!communityId) return;
    setLoading(true);
    loadPosts();

    const channel = supabase
      .channel(`community-feed-${communityId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        () => { loadPosts(); }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => { setPosts((prev) => prev.filter((p) => p.id !== payload.old.id)); }
      )
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [communityId]);

  const handlePostCreated = (optimisticPost) => {
    setPosts((prev) => [optimisticPost, ...prev]);
  };

  const handlePostUpdate = (updatedPost) => {
    if (!updatedPost) {
      loadPosts();
    } else {
      setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    toast.success('Feed refreshed');
  };

  const channelCounts = useMemo(() => {
    const counts = { all: posts.length, general: 0, code: 0, showcase: 0, help: 0 };
    posts.forEach((p) => {
      const c = (p.content || '').toLowerCase();
      const hasCode = Boolean(p.code_snippet && p.code_snippet.trim());
      const hasImg = Boolean(p.image_url);
      const hasPoll = Boolean(p.poll_data);
      const isTaggedCode = c.includes('[#code]') || c.includes('#code');
      const isTaggedShowcase = c.includes('[#showcase]') || c.includes('#showcase');
      const isTaggedHelp = c.includes('[#help]') || c.includes('#help') || c.includes('?');

      if (hasCode || isTaggedCode) counts.code++;
      else if (hasImg || isTaggedShowcase) counts.showcase++;
      else if (hasPoll || isTaggedHelp) counts.help++;
      else counts.general++;
    });
    return counts;
  }, [posts]);

  const filteredPosts = useMemo(() => {
    let result = [...posts];

    if (selectedChannel !== 'all') {
      result = result.filter((p) => {
        const c = (p.content || '').toLowerCase();
        const hasCode = Boolean(p.code_snippet && p.code_snippet.trim());
        const hasImg = Boolean(p.image_url);
        const hasPoll = Boolean(p.poll_data);
        const isTaggedCode = c.includes('[#code]') || c.includes('#code');
        const isTaggedShowcase = c.includes('[#showcase]') || c.includes('#showcase');
        const isTaggedHelp = c.includes('[#help]') || c.includes('#help') || c.includes('?');

        if (selectedChannel === 'code') return hasCode || isTaggedCode;
        if (selectedChannel === 'showcase') return hasImg || isTaggedShowcase;
        if (selectedChannel === 'help') return hasPoll || isTaggedHelp;
        if (selectedChannel === 'general') return !hasCode && !isTaggedCode && !hasImg && !isTaggedShowcase && !hasPoll && !isTaggedHelp;
        return true;
      });
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.content?.toLowerCase()?.includes(q) ||
        p.code_snippet?.toLowerCase()?.includes(q) ||
        p.profiles?.username?.toLowerCase()?.includes(q)
      );
    }

    if (filterCodeOnly) {
      result = result.filter((p) => Boolean(p.code_snippet));
    }

    if (filterMediaOnly) {
      result = result.filter((p) => Boolean(p.image_url));
    }

    if (sort === 'top') {
      result.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
    } else {
      result.sort((a, b) => {
        const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
        const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
        return tB - tA;
      });
    }

    return result;
  }, [posts, selectedChannel, searchQuery, filterCodeOnly, filterMediaOnly, sort]);

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Post Composer (prominent at top, ONLY for joined members) */}
      {isJoined ? (
        <CreateCommunityPost
          session={session}
          community={community}
          communityId={communityId}
          onPostCreated={handlePostCreated}
          selectedChannel={selectedChannel}
        />
      ) : (
        <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-2xl p-5 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-[#ea580c] flex items-center justify-center mx-auto text-xl shadow-xs">
            <Users size={22} className="text-[#ea580c]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#1c130d] dark:text-white">
              Join {community?.name || 'this community'} to participate
            </h3>
            <p className="text-xs text-[#8d7565] dark:text-[#c4aba0] max-w-md mx-auto leading-relaxed">
              Only joined members can post code, start discussions, and ask questions in this community.
            </p>
          </div>
          <button
            onClick={onToggleJoin}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fb923c] hover:brightness-105 shadow-md shadow-orange-500/25 cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1.5"
          >
            <Users size={14} />
            <span>+ Join Community to Post</span>
          </button>
        </div>
      )}

      {/* 2. Channel Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {COMMUNITY_CHANNELS.map((ch) => {
          const isSelected = selectedChannel === ch.id;
          const ChannelIcon = ch.icon;
          const count = channelCounts[ch.id] ?? 0;
          return (
            <button
              key={ch.id}
              onClick={() => setSelectedChannel(ch.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white shadow-xs'
                  : 'bg-white dark:bg-[#1f1813] text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white border border-[#f1e4d3] dark:border-[#382b22]'
              }`}
            >
              <ChannelIcon size={13} className={isSelected ? 'text-white' : 'text-[#ea580c]'} />
              <span>{ch.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isSelected ? 'bg-white/20 text-white font-bold' : 'bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565]'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-2xl p-3 shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d7565]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search in ${community?.name || 'this community'}…`}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white placeholder:text-[#8d7565] focus:outline-none focus:border-[#ea580c]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8d7565] hover:text-[#1c130d]"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#8d7565] hover:text-[#ea580c] transition-all cursor-pointer shrink-0"
            title="Refresh posts"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-[#ea580c]' : ''} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-[#f1e4d3]/60 dark:border-[#382b22]/60">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterCodeOnly(!filterCodeOnly)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterCodeOnly
                  ? 'bg-orange-100 text-[#ea580c] dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800'
                  : 'bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] hover:text-[#1c130d] border border-[#f1e4d3] dark:border-[#382b22]'
              }`}
            >
              <Code2 size={11} />
              <span>With Code</span>
            </button>

            <button
              onClick={() => setFilterMediaOnly(!filterMediaOnly)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterMediaOnly
                  ? 'bg-orange-100 text-[#ea580c] dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800'
                  : 'bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] hover:text-[#1c130d] border border-[#f1e4d3] dark:border-[#382b22]'
              }`}
            >
              <FileImage size={11} />
              <span>With Media</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            {[
              { id: 'latest', label: 'Latest', icon: Clock },
              { id: 'top', label: 'Top', icon: Star },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSort(id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  sort === id
                    ? 'bg-[#ea580c] text-white shadow-2xs'
                    : 'text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white'
                }`}
              >
                <Icon size={11} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Posts Stream */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-2xl p-5 shadow-xs animate-pulse space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f1e4d3] dark:bg-[#281f18]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 bg-[#f1e4d3] dark:bg-[#281f18] rounded-full" />
                  <div className="h-2.5 w-20 bg-[#f1e4d3] dark:bg-[#281f18] rounded-full" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-[#f1e4d3] dark:bg-[#281f18] rounded-full w-full" />
                <div className="h-3 bg-[#f1e4d3] dark:bg-[#281f18] rounded-full w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-2xl p-10 shadow-xs flex flex-col items-center justify-center text-center gap-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-orange-100/70 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 flex items-center justify-center text-orange-600 shadow-xs">
            {selectedChannel === 'code' ? (
              <Code2 size={24} />
            ) : selectedChannel === 'showcase' ? (
              <Sparkles size={24} />
            ) : selectedChannel === 'help' ? (
              <HelpCircle size={24} />
            ) : (
              <MessageSquare size={24} />
            )}
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="font-bold text-sm sm:text-base text-[#1c130d] dark:text-white">
              {searchQuery
                ? 'No matching discussions found'
                : selectedChannel === 'code'
                ? 'No code reviews in this channel yet'
                : selectedChannel === 'showcase'
                ? 'No project showcases in this channel yet'
                : selectedChannel === 'help'
                ? 'No questions in this channel yet'
                : 'No discussions in this channel yet'}
            </h3>
            <p className="text-xs text-[#8d7565] leading-relaxed">
              {searchQuery
                ? `No posts matched "${searchQuery}". Try clearing your search or filters.`
                : selectedChannel === 'code'
                ? 'Be the first to share a code snippet above for peer review and AI security analysis.'
                : selectedChannel === 'showcase'
                ? 'Share a screenshot or product demo above to showcase your work.'
                : selectedChannel === 'help'
                ? 'Ask a question or create a poll above to get help from the guild.'
                : 'Share an update or question above to start the discussion.'}
            </p>
          </div>
          {selectedChannel !== 'all' && (
            <button
              onClick={() => setSelectedChannel('all')}
              className="text-xs font-bold text-[#ea580c] hover:underline cursor-pointer"
            >
              View All Community Discussions
            </button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          {filteredPosts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ delay: Math.min(i * 0.03, 0.25) }}
            >
              <PostCard
                post={post}
                session={session}
                onUpdate={handlePostUpdate}
                isCommunityAdmin={isAdmin}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
