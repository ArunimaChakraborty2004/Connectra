import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Image as ImageIcon,
  Video,
  Calendar,
  MoreHorizontal,
  Send,
  X,
  Shield,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../../lib/toast';
import { reviewCodeAndSecurity, polishPostContent, screenContentSafety } from '../../lib/ai';
import { scanForSecrets, redactSecrets } from '../../lib/secretScanner';
import AIAnalysisCard from './AIAnalysisCard';
import { createNotification } from '../../lib/notifications';

export default function CreatePost({ session, onPostCreated, placeholder }) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [codeLang, setCodeLang] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoPreview, setVideoPreview] = useState(null);
  const [activeMediaType, setActiveMediaType] = useState('image'); // 'image' | 'video'
  const [userProfile, setUserProfile] = useState(null);

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        toast.error('Please select a valid video file (MP4, WebM)');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Video must be under 50MB');
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setVideoUrl('');
      setImageFile(null);
      setImageUrl('');
    }
  };

  // AI Assistant States
  const [aiPolishing, setAiPolishing] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [codeReviewResult, setCodeReviewResult] = useState(null);
  const [showCodeReview, setShowCodeReview] = useState(false);

  // Cybersecurity Pre-Publish Interceptors
  const [secretDetections, setSecretDetections] = useState([]);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [guardrailViolation, setGuardrailViolation] = useState(null);

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
    if (!codeSnippet.trim()) {
      toast.error('Please paste code to review first.');
      return;
    }
    setAiScanning(true);
    setShowCodeReview(true);
    try {
      const result = await reviewCodeAndSecurity({ code: codeSnippet, language: codeLang || 'javascript' });
      setCodeReviewResult(result);
      if (result.isClean) {
        toast.success('Zero critical vulnerabilities found! 🛡️');
      } else {
        toast.error(`Identified ${result.vulnerabilityCount || 1} security advisories.`);
      }
    } catch {
      toast.error('Failed to run code scan');
    } finally {
      setAiScanning(false);
    }
  };

  /**
   * Final publish executor after security screenings pass
   */
  const executePublish = async (overrideContent, overrideCode) => {
    setLoading(true);
    const finalContent = overrideContent !== undefined ? overrideContent : content;
    const finalCode = overrideCode !== undefined ? overrideCode : codeSnippet;

    let finalImageUrl = imageUrl;
    let finalVideoUrl = videoUrl.trim();

    // 1. Handle Video Upload
    if (videoFile) {
      const fileExt = videoFile.name.split('.').pop() || 'mp4';
      const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
      const filePath = `reels/${fileName}`;

      let uploadSuccess = false;
      // Try 'reels' bucket
      const { error: vErr } = await supabase.storage.from('reels').upload(filePath, videoFile, { upsert: true });
      if (!vErr) {
        const { data } = supabase.storage.from('reels').getPublicUrl(filePath);
        finalVideoUrl = data?.publicUrl;
        uploadSuccess = true;
      } else {
        // Fallback to 'post_images' bucket
        const { error: pErr } = await supabase.storage.from('post_images').upload(filePath, videoFile, { upsert: true });
        if (!pErr) {
          const { data } = supabase.storage.from('post_images').getPublicUrl(filePath);
          finalVideoUrl = data?.publicUrl;
          uploadSuccess = true;
        }
      }

      if (!uploadSuccess && !finalVideoUrl) {
        finalVideoUrl = videoPreview;
      }
    }

    // 2. Handle Image Upload
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop() || 'png';
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `post_images/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('post_images').upload(filePath, imageFile, { upsert: true });
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('post_images').getPublicUrl(filePath);
        finalImageUrl = publicUrlData.publicUrl;
      } else {
        // Fallback to data URL
        finalImageUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(imageFile);
        });
      }
    }

    // If video was posted, also persist to reels table & local reels cache
    if (finalVideoUrl) {
      try {
        await supabase.from('reels').insert({
          user_id: session.user.id,
          video_url: finalVideoUrl,
          caption: finalContent || '🎬 New Developer Reel',
        });
      } catch (rErr) {
        console.warn('Reels table insert warning:', rErr);
      }

      const existingReels = JSON.parse(localStorage.getItem('connectra_active_reels') || '[]');
      const newLocalReel = {
        id: `reel-${Date.now()}`,
        user_id: session.user.id,
        video_url: finalVideoUrl,
        caption: finalContent || '',
        created_at: new Date().toISOString(),
        profiles: {
          username: session?.user?.user_metadata?.username || userProfile?.username || 'You',
          avatar_url: session?.user?.user_metadata?.avatar_url || userProfile?.avatar_url || null,
        },
        reel_likes: [],
        reel_comments: [],
      };
      localStorage.setItem('connectra_active_reels', JSON.stringify([newLocalReel, ...existingReels]));
      finalImageUrl = finalVideoUrl;
    }

    const postPayload = {
      user_id: session.user.id,
      content: finalContent,
      image_url: finalImageUrl || null,
      code_snippet: finalCode || null,
      code_language: codeLang || null,
    };

    let createdPostId = null;
    const { data: newPost, error } = await supabase.from('posts').insert(postPayload).select('id').single();
    if (!error && newPost) {
      createdPostId = newPost.id;
    } else {
      console.warn('Posts insert notice:', error?.message);
    }

    // Save optimistic post copy to localStorage so it is 100% visible immediately
    const existingPosts = JSON.parse(localStorage.getItem('connectra_active_posts') || '[]');
    const newOptimisticPost = {
      id: createdPostId || `post-${Date.now()}`,
      user_id: session.user.id,
      content: finalContent,
      image_url: finalImageUrl || null,
      video_url: finalVideoUrl || null,
      is_reel: Boolean(finalVideoUrl),
      code_snippet: finalCode || null,
      code_language: codeLang || null,
      created_at: new Date().toISOString(),
      profiles: {
        username: session?.user?.user_metadata?.username || userProfile?.username || 'You',
        avatar_url: session?.user?.user_metadata?.avatar_url || userProfile?.avatar_url || null,
      },
      likes: [{ count: 0 }],
      likes_count: 0,
      user_has_liked: false,
      comments: [],
    };
    localStorage.setItem('connectra_active_posts', JSON.stringify([newOptimisticPost, ...existingPosts]));

    setLoading(false);

    // Notify followers about the new post
    if (session?.user?.id && createdPostId) {
      supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', session.user.id)
        .then(({ data: followers }) => {
          if (followers && followers.length > 0) {
            followers.forEach((f) => {
              createNotification({
                userId: f.follower_id,
                actorId: session.user.id,
                type: 'post',
                entityId: createdPostId,
              });
            });
          }
        })
        .catch(() => {});
    }

    setContent('');
    setImageUrl('');
    setImageFile(null);
    setVideoFile(null);
    setVideoUrl('');
    setVideoPreview(null);
    setCodeSnippet('');
    setCodeLang('');
    setShowExtras(false);
    setShowCodeReview(false);
    setGuardrailViolation(null);
    setShowSecretModal(false);

    window.dispatchEvent(new Event('refreshFeed'));
    toast.success(finalVideoUrl ? 'Reel published & reflected in Feed! 🎬🚀' : 'Post published safely! 🛡️🚀');
    if (onPostCreated) onPostCreated();
  };

  /**
   * Pre-Publish Interceptor (Secret Detection + AI Guardrails)
   */
  const handlePost = async () => {
    if (!content.trim() && !imageUrl.trim() && !videoUrl.trim() && !codeSnippet.trim() && !imageFile && !videoFile) return;

    // 1. Secret & Key Leak Scanner
    const combinedText = `${content}\n${codeSnippet}`;
    const secretScan = scanForSecrets(combinedText);
    if (secretScan.hasSecrets) {
      setSecretDetections(secretScan.detections);
      setShowSecretModal(true);
      return;
    }

    // 2. AI Guardrail Safety Screener
    setLoading(true);
    const safetyCheck = await screenContentSafety({ text: content, code: codeSnippet });
    setLoading(false);

    if (!safetyCheck.safe) {
      setGuardrailViolation(safetyCheck);
      return;
    }

    // Passed all pre-publish defense checks
    await executePublish();
  };

  const handleRedactAndPublish = async () => {
    const safeContent = redactSecrets(content, secretDetections);
    const safeCode = redactSecrets(codeSnippet, secretDetections);
    setContent(safeContent);
    setCodeSnippet(safeCode);
    setShowSecretModal(false);
    toast.info('Secrets redacted with cryptographic placeholder!');
    await executePublish(safeContent, safeCode);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
    }
  };

  const initial = userProfile?.username?.[0]?.toUpperCase() || 'A';
  const displayPlaceholder = placeholder || `What's on your mind, ${userProfile?.username || 'Alex'}?`;

  return (
    <div className="rounded-2xl p-4 bg-white border border-[#f1e4d3] shadow-xs flex flex-col gap-3 relative">
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

      {/* AI Guardrail Warning Banner */}
      <AnimatePresence>
        {guardrailViolation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-rose-900">
                  AI Guardrail Block: {guardrailViolation.category.toUpperCase()}
                </strong>
                <p className="mt-0.5 text-rose-700 leading-relaxed">
                  {guardrailViolation.reasoning}
                </p>
                <span className="text-[10px] text-rose-500 font-mono block mt-1">
                  Connectra Zero-Trust Guardrails • Confidence: {Math.round(guardrailViolation.confidence * 100)}%
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGuardrailViolation(null)}
              className="text-rose-400 hover:text-rose-700 cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
                <span className="flex items-center gap-1.5">
                  <span>Attachments & Code</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-100 text-orange-700 font-mono">
                    Zero-Trust Verified
                  </span>
                </span>
                <button onClick={() => setShowExtras(false)} className="hover:text-[#2b1f17] cursor-pointer">
                  <X size={14} />
                </button>
              </div>

              {/* Media Type Tabs */}
              <div className="flex items-center gap-2 border-b border-[#f1e4d3] pb-2">
                <button
                  type="button"
                  onClick={() => setActiveMediaType('image')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeMediaType === 'image'
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-white text-[#8d7565] hover:text-[#2b1f17] border border-[#f1e4d3]'
                  }`}
                >
                  <ImageIcon size={13} />
                  <span>Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMediaType('video')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeMediaType === 'video'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                      : 'bg-white text-[#8d7565] hover:text-[#2b1f17] border border-[#f1e4d3]'
                  }`}
                >
                  <Video size={13} />
                  <span>🎬 Video / Reel</span>
                </button>
              </div>

              {/* Image Input Section */}
              {activeMediaType === 'image' && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-center flex-wrap">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ffedd5] text-[#9a3412] hover:bg-[#fed7aa] text-xs font-bold cursor-pointer transition-all">
                      <ImageIcon size={14} /> Upload image
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                    </label>
                    <input
                      type="url"
                      value={!imageFile ? imageUrl : ''}
                      disabled={!!imageFile}
                      onChange={(e) => {
                        setImageUrl(e.target.value);
                        setImageFile(null);
                        setVideoFile(null);
                        setVideoUrl('');
                        setVideoPreview(null);
                      }}
                      placeholder="Or paste image URL"
                      className="flex-1 bg-white border border-[#f1e4d3] rounded-lg px-3 py-1.5 text-xs text-[#2b1f17] outline-none"
                    />
                  </div>

                  {imageUrl && (
                    <div className="relative w-max mt-1">
                      <img src={imageUrl} alt="preview" className="max-h-28 rounded-lg object-cover border border-[#f1e4d3]" />
                      <button
                        type="button"
                        onClick={() => {
                          setImageUrl('');
                          setImageFile(null);
                        }}
                        className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-rose-500 rounded-full text-white cursor-pointer"
                        title="Remove image"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Video / Reel Input Section */}
              {activeMediaType === 'video' && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-center flex-wrap">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ffedd5] text-[#9a3412] hover:bg-[#fed7aa] text-xs font-bold cursor-pointer transition-all">
                      <Video size={14} /> Upload Video (MP4, WebM)
                      <input type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />
                    </label>
                    <input
                      type="url"
                      value={!videoFile ? videoUrl : ''}
                      disabled={!!videoFile}
                      onChange={(e) => {
                        setVideoUrl(e.target.value);
                        setVideoFile(null);
                        setVideoPreview(null);
                        setImageFile(null);
                        setImageUrl('');
                      }}
                      placeholder="Or paste direct video URL (e.g. .mp4)"
                      className="flex-1 bg-white border border-[#f1e4d3] rounded-lg px-3 py-1.5 text-xs text-[#2b1f17] outline-none"
                    />
                  </div>

                  {(videoPreview || videoUrl) && (
                    <div className="relative w-full max-w-sm mt-1 rounded-xl overflow-hidden border border-[#f1e4d3] bg-black">
                      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-black/70 text-orange-400 font-bold text-[10px] flex items-center gap-1">
                        <Film size={11} /> Reel Preview
                      </div>
                      <video
                        src={videoPreview || videoUrl}
                        controls
                        className="w-full max-h-48 object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setVideoFile(null);
                          setVideoUrl('');
                          setVideoPreview(null);
                        }}
                        className="absolute top-2 right-2 p-1 bg-black/70 hover:bg-rose-500 rounded-full text-white cursor-pointer z-10"
                        title="Remove video"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Code snippet input with SAST Scan button */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[#8d7565] font-semibold">Code snippet</span>
                  {codeSnippet.trim() && (
                    <button
                      type="button"
                      onClick={handleScanCode}
                      disabled={aiScanning}
                      className="text-[11px] px-2.5 py-0.5 rounded-md bg-orange-500/10 text-[#ea580c] hover:bg-orange-500/20 font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {aiScanning ? <RefreshCw size={11} className="animate-spin" /> : <Shield size={11} />}
                      <span>{aiScanning ? 'Scanning...' : 'Run LLM-SAST Scan'}</span>
                    </button>
                  )}
                </div>
                <textarea
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  placeholder="Paste your code snippet here (SQL, JavaScript, Python, etc.)..."
                  className="w-full bg-[#2b1f17] rounded-lg p-2.5 text-xs font-mono text-amber-300 outline-none resize-y min-h-[70px]"
                />
              </div>

              {/* Structured SAST Results Card with 1-Click Apply */}
              {showCodeReview && (
                <div className="mt-2">
                  <AIAnalysisCard
                    content={codeReviewResult}
                    type="security"
                    onClose={() => setShowCodeReview(false)}
                    onApplyFix={(fixedCode) => {
                      setCodeSnippet(fixedCode);
                      toast.success('Remediation patch applied to snippet!');
                    }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons Row */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              setShowExtras(true);
              setActiveMediaType('image');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#8d7565] hover:text-[#ea580c] hover:bg-[#fff7ed] transition-all cursor-pointer"
          >
            <ImageIcon size={15} className="text-[#ea580c]" />
            <span>Image</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowExtras(true);
              setActiveMediaType('video');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#8d7565] hover:text-[#ea580c] hover:bg-[#fff7ed] transition-all cursor-pointer"
          >
            <Video size={15} className="text-[#f97316]" />
            <span>Video</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExtras(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#8d7565] hover:text-[#ea580c] hover:bg-[#fff7ed] transition-all cursor-pointer"
          >
            <Calendar size={15} className="text-[#ea580c]" />
            <span>Event</span>
          </button>

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
          disabled={loading || (!content && !imageUrl && !videoUrl && !codeSnippet && !imageFile && !videoFile)}
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fb923c] hover:brightness-105 text-white font-extrabold text-xs transition-all shadow-md shadow-orange-500/25 disabled:opacity-40 cursor-pointer active:scale-95 flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <span>Post</span>
          )}
        </button>
      </div>

      {/* Secret Leak Detection Warning Modal */}
      <AnimatePresence>
        {showSecretModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-stone-900 border border-amber-500/40 rounded-2xl p-5 max-w-md w-full shadow-2xl text-stone-200 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-stone-100">
                    Credential Leak Intercepted!
                  </h3>
                  <span className="text-xs text-amber-400/90 font-mono">
                    {secretDetections.length} sensitive key/token signature(s) detected
                  </span>
                </div>
              </div>

              <p className="text-xs text-stone-300 leading-relaxed">
                Connectra’s client-side pre-commit entropy scanner detected sensitive API credentials in your post.
                Publishing raw secrets may lead to account takeover or cloud resource exploitation.
              </p>

              {/* Detections List */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {secretDetections.map((det, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-black/40 border border-white/10 text-[11px] flex items-center justify-between font-mono"
                  >
                    <span className="text-amber-300">{det.label}</span>
                    <span className="text-stone-400 text-[10px]">Entropy: {det.entropy}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowSecretModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-300 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancel & Edit
                </button>
                <button
                  type="button"
                  onClick={handleRedactAndPublish}
                  className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:brightness-110 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock size={12} />
                  <span>Auto-Redact & Publish</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
