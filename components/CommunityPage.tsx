
import React, { useState, useEffect, useRef } from 'react';
import { CommunityPost, User, CommunityCategory, Comment, FeatureFlags, Teacher } from '../types';
import { GRADE_LEVELS, DEFAULT_FLAGS } from '../constants';
import { db } from '../services/db';
import { audit } from '../services/audit';
import { checkContentSafety } from '../services/geminiService';
import { MessageSquare, ThumbsUp, Plus, Calendar, Trash2, Eye, Megaphone, CalendarDays, Search, Filter, History, ChevronDown, ChevronUp, ShieldCheck, User as UserIcon, ArrowLeft, Paperclip, Download, CornerDownRight, BookOpen, Send, Lock, Pin, PinOff, AlertOctagon, Loader2 } from 'lucide-react';
import { ConfirmDeleteModal, PostPendingModal, ConfirmDeleteCommentModal, ConfirmPostModal, AIModerationModal } from './AdminModals';
import MyCenter from './MyCenter';
import { useLanguage } from '../LanguageContext';

interface CommunityPageProps { currentUser: User; subjects: string[]; teachers?: Teacher[]; }

const PROFANITY_LIST = ['abuse', 'hate', 'stupid', 'idiot', 'kill', 'attack', 'hell', 'damn']; // Basic list, expand as needed

const CommunityPage: React.FC<CommunityPageProps> = ({ currentUser, subjects, teachers = [] }) => {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [expandedArchives, setExpandedArchives] = useState<{ [key: string]: boolean }>({ 'Club/ASA': false, 'Others': false, 'Announcement': false });
  const [showMyCenter, setShowMyCenter] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CommunityCategory>('Club/ASA'); 
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [attachedFile, setAttachedFile] = useState<{name: string, type: string, data: string} | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isPosting, setIsPosting] = useState(false);

  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, postId: string}>({isOpen: false, postId: ''});
  const [deleteCommentModal, setDeleteCommentModal] = useState<{isOpen: boolean, postId: string, commentId: string}>({isOpen: false, postId: '', commentId: ''});
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  
  const [commentText, setCommentText] = useState<{ [postId: string]: string }>({});
  const [replyText, setReplyText] = useState<{ [commentId: string]: string }>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  
  // State for AI Moderation Pop-up
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => { 
      const load = async () => { 
          const saved = await db.getItem<CommunityPost[]>('basis_community_posts'); if (saved) setPosts(saved); 
          const flags = await db.getItem<FeatureFlags>('basis_feature_flags'); if (flags) setFeatureFlags(flags);
      }; 
      load(); 
  }, []);

  const savePosts = async (newPosts: CommunityPost[]) => { setPosts(newPosts); await db.setItem('basis_community_posts', newPosts); };
  
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'secondary_admin';
  const isTeacher = currentUser.role === 'teacher';
  const isRealTeacher = isTeacher || teachers.some(t => t.id === currentUser.id || t.email.toLowerCase() === currentUser.id.toLowerCase());

  const isAutoApproved = isAdmin || isRealTeacher || featureFlags.autoApprovePosts;
  
  // Permission check for Announcements
  const canPostAnnouncements = isAdmin || isRealTeacher;

  const containsProfanity = (text: string) => {
      const lower = text.toLowerCase();
      return PROFANITY_LIST.some(word => lower.includes(word));
  };

  const handlePost = async () => {
      if (category !== 'Announcement' && selectedGrades.length === 0) return alert("Select at least one grade level.");
      
      // 1. Basic Static Check (Fast)
      if (containsProfanity(title) || containsProfanity(desc)) {
          setAiError("Contains prohibited keywords (Profanity Filter).");
          return;
      }

      setIsPosting(true);

      // 2. AI Content Check (Slower, but smarter)
      if (featureFlags.enableAIContentCheck) {
          const contentToCheck = `${title}\n${desc}`;
          try {
              const checkResult = await checkContentSafety(contentToCheck);
              if (!checkResult.isSafe) {
                  setAiError(checkResult.reason || "Content flagged as inappropriate by AI safety filters.");
                  setIsPosting(false);
                  return;
              }
          } catch (e) {
              console.error("AI Check failed, proceeding with caution.", e);
          }
      }

      const newPost: CommunityPost = { 
          id: Date.now().toString(), 
          authorId: currentUser.id, 
          authorName: currentUser.name || 'Unknown', 
          authorRole: currentUser.role, 
          title, 
          subject: 'General', 
          category, 
          description: desc, 
          gradeLevels: selectedGrades, 
          date, 
          timestamp: Date.now(), 
          likes: 0, 
          status: isAutoApproved ? 'approved' : 'pending',
          comments: [],
          attachments: attachedFile ? [attachedFile] : [],
          pinned: false
      };
      
      await savePosts([newPost, ...posts]);
      await audit.logAction(currentUser, 'CREATE_POST', undefined, undefined, `${title}`);
      
      setIsPosting(false);
      
      if (!isAutoApproved) setPendingModalOpen(true);
      setIsFormOpen(false); setTitle(''); setDesc(''); setDate(''); setSelectedGrades([]); setCategory('Club/ASA'); setAttachedFile(undefined);
  };

  const handlePin = async (id: string) => {
      const updated = posts.map(p => p.id === id ? { ...p, pinned: !p.pinned } : p);
      await savePosts(updated);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (evt) => {
              const base64 = (evt.target?.result as string);
              setAttachedFile({ name: file.name, type: file.type, data: base64 });
          };
          reader.readAsDataURL(file);
      }
  };

  const addComment = async (postId: string) => {
      if (!commentText[postId]?.trim()) return;
      if (containsProfanity(commentText[postId])) {
          setAiError("Comment contains prohibited keywords.");
          return;
      }
      
      // Simple AI Check for comments too if enabled
      if (featureFlags.enableAIContentCheck) {
          const checkResult = await checkContentSafety(commentText[postId]);
          if (!checkResult.isSafe) {
              setAiError(checkResult.reason || "Comment flagged as inappropriate.");
              return;
          }
      }

      const newComment: Comment = {
          id: Date.now().toString() + Math.random(),
          authorId: currentUser.id,
          authorName: currentUser.name || 'Unknown',
          authorRole: currentUser.role,
          text: commentText[postId],
          timestamp: Date.now(),
          replies: []
      };
      const updatedPosts = posts.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), newComment] } : p);
      await savePosts(updatedPosts);
      setCommentText(prev => ({ ...prev, [postId]: '' }));
  };

  const deleteComment = async () => {
      const { postId, commentId } = deleteCommentModal;
      if (!postId || !commentId) return;
      
      const deleteRecursive = (comments: Comment[]): Comment[] => {
          return comments.filter(c => c.id !== commentId).map(c => ({
              ...c,
              replies: c.replies ? deleteRecursive(c.replies) : []
          }));
      };

      const updatedPosts = posts.map(p => p.id === postId ? { ...p, comments: deleteRecursive(p.comments || []) } : p);
      await savePosts(updatedPosts);
      await audit.logAction(currentUser, 'COMMUNITY_EDIT', undefined, undefined, `Deleted Comment in post ${postId}`);
      setDeleteCommentModal({isOpen: false, postId: '', commentId: ''});
  };

  const toggleGrade = (grade: string) => setSelectedGrades(prev => prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]);
  const confirmDelete = async () => { await savePosts(posts.filter(p => p.id !== deleteModal.postId)); await audit.logAction(currentUser, 'COMMUNITY_EDIT', undefined, undefined, `Deleted Post ${deleteModal.postId}`); setDeleteModal({isOpen: false, postId: ''}); };
  
  const handleLike = async (id: string) => { 
      const post = posts.find(p => p.id === id);
      if (!post) return;
      const hasLiked = post.likedBy?.includes(currentUser.id);
      
      let updated;
      if (hasLiked) {
          updated = posts.map(p => p.id === id ? { ...p, likes: p.likes - 1, likedBy: (p.likedBy || []).filter(uid => uid !== currentUser.id) } : p);
      } else {
          updated = posts.map(p => p.id === id ? { ...p, likes: p.likes + 1, likedBy: [...(p.likedBy || []), currentUser.id] } : p);
      }
      await savePosts(updated); 
  };
  
  const toggleArchive = (cat: string) => setExpandedArchives(prev => ({ ...prev, [cat]: !prev[cat] }));
  
  const getWeekBounds = () => {
      const now = new Date();
      const day = now.getDay(); 
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
      const start = new Date(now.setDate(diff));
      start.setHours(0,0,0,0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23,59,59,999);
      return { start, end };
  };
  const { start: weekStart, end: weekEnd } = getWeekBounds();
  const isPostInWeek = (timestamp: number) => timestamp >= weekStart.getTime() && timestamp <= weekEnd.getTime();

  const filteredPosts = posts.filter(p => { 
      if (p.status !== 'approved') return false; 
      
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.description?.toLowerCase().includes(searchQuery.toLowerCase()) || p.authorName.toLowerCase().includes(searchQuery.toLowerCase()); 
      return matchesSearch && (gradeFilter ? p.gradeLevels.includes(gradeFilter) : true); 
  });

  const getCategorizedPosts = (cat: CommunityCategory) => { 
      const catPosts = filteredPosts.filter(p => p.category === cat).sort((a,b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.timestamp - a.timestamp); 
      return { 
          active: catPosts.filter(p => isPostInWeek(p.timestamp) || p.pinned), 
          past: catPosts.filter(p => !isPostInWeek(p.timestamp) && !p.pinned) 
      }; 
  };

  const renderComment = (c: Comment, postId: string) => (
      <div key={c.id} className="mt-2 bg-slate-50 p-2 rounded-lg text-sm">
          <div className="flex justify-between items-start">
              <div className="w-full">
                  <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold text-xs ${c.authorRole === 'teacher' || c.authorRole.includes('admin') ? 'text-brand-600' : 'text-slate-600'}`}>
                          {c.authorName}
                      </span>
                      <span className="text-[10px] text-slate-400">{new Date(c.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-800">{c.text}</p>
                  {isAdmin && <div className="text-right"><button onClick={() => setDeleteCommentModal({isOpen: true, postId, commentId: c.id})} className="text-[10px] text-red-400 hover:text-red-600 font-bold">{t.common.delete}</button></div>}
              </div>
          </div>
      </div>
  );

  const renderPostCard = (post: CommunityPost) => (
    <div key={post.id} className={`bg-white p-4 rounded-xl border ${post.pinned ? 'border-brand-300 ring-1 ring-brand-100' : 'border-slate-200'} shadow-sm hover:shadow-md transition-all mb-4`}>
        <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-slate-800 text-lg leading-tight flex items-center gap-2">
                {post.pinned && <Pin size={16} className="text-brand-600 fill-brand-100" />}
                {post.title}
                {post.authorRole === 'teacher' && <ShieldCheck size={16} className="text-blue-500 fill-blue-100" />}
            </h4>
            <div className="flex items-center gap-1">
                {(isAdmin || isRealTeacher) && (
                    <button onClick={() => handlePin(post.id)} className={`text-slate-300 hover:text-brand-600 p-1 ${post.pinned ? 'text-brand-600' : ''}`} title={post.pinned ? t.community.unpin : t.community.pin}>
                        {post.pinned ? <PinOff size={16}/> : <Pin size={16}/>}
                    </button>
                )}
                {(isAdmin || post.authorId === currentUser.id) && <button onClick={() => setDeleteModal({isOpen: true, postId: post.id})} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={16} /></button>}
            </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
            {post.gradeLevels.map(g => <span key={g} className="text-[10px] font-bold bg-brand-50 text-brand-600 border border-brand-100 px-1.5 py-0.5 rounded">{g}</span>)}
        </div>
        {post.description && <p className="text-slate-600 text-sm mb-3 whitespace-pre-wrap">{post.description}</p>}
        
        {post.attachments && post.attachments.map((att, i) => (
            <div key={i} className="mb-3">
                {att.type.startsWith('image/') ? <img src={att.data} alt="attachment" className="max-h-48 rounded border" /> : <a href={att.data} download={att.name} className="flex items-center gap-2 text-sm text-brand-600 hover:underline bg-brand-50 p-2 rounded border border-brand-100"><Paperclip size={14}/> {att.name}</a>}
            </div>
        ))}

        <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-2">
            <div className="flex items-center gap-3">
                <button onClick={() => handleLike(post.id)} className={`flex items-center gap-1 transition-colors ${post.likedBy?.includes(currentUser.id) ? 'text-brand-600 font-bold' : 'text-slate-400 hover:text-brand-600'}`}><ThumbsUp size={14} /><span className="text-xs">{post.likes}</span></button>
                <span className="flex items-center gap-1 text-xs text-slate-500 font-medium"><Calendar size={12} /> {new Date(post.timestamp).toLocaleDateString()}</span>
                {post.date && <span className="text-[10px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200">{t.community.relevantDate}: {post.date}</span>}
            </div>
            <span className={`text-[10px] flex items-center gap-1 ${post.authorRole === 'teacher' ? 'text-blue-600 font-bold' : 'text-slate-300'}`}>
                <Eye size={10} /> {post.authorName}
            </span>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-50">
            <div className="max-h-40 overflow-y-auto mb-2 space-y-2">
                {post.comments?.map(c => renderComment(c, post.id))}
            </div>
            <div className="flex gap-2">
                <input type="text" value={commentText[post.id] || ''} onChange={e => setCommentText(prev => ({...prev, [post.id]: e.target.value}))} placeholder={t.community.writeComment} className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-brand-500"/>
                <button onClick={() => addComment(post.id)} className="text-brand-600 hover:bg-brand-50 p-1 rounded"><CornerDownRight size={18}/></button>
            </div>
        </div>
    </div>
  );

  const renderColumn = (title: string, icon: React.ReactNode, data: { active: CommunityPost[], past: CommunityPost[] }, cat: string, color: string) => (
    <div className="flex flex-col h-full">
        <div className={`flex items-center gap-2 mb-4 pb-2 border-b-2 ${color}`}>{icon}<h3 className="font-bold text-slate-700">{title}</h3></div>
        <div className="bg-slate-50/50 rounded-xl p-2 flex-1">
            {data.active.map(p => renderPostCard(p))}
            {data.active.length === 0 && <p className="text-center text-slate-400 text-sm mt-4 mb-4">{t.community.noPosts}</p>}
            
            {data.past.length > 0 && (
                <div className="mt-6 border-t border-slate-200 pt-4">
                    <button onClick={() => toggleArchive(cat)} className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider w-full hover:text-slate-600 transition-colors">
                        <History size={14} /> {t.community.pastHidden} ({data.past.length}) {expandedArchives[cat] ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
                    </button>
                    {expandedArchives[cat] && (
                        <div className="mt-4 space-y-2">
                            <div className="text-[10px] text-center text-slate-400 mb-2 italic">{t.community.collapsedMsg}</div>
                            {data.past.map(p => renderPostCard(p))}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );

  if (showMyCenter) {
      return (
          <div className="max-w-7xl mx-auto p-4 md:p-10 animate-in slide-in-from-right-4">
              <button onClick={() => setShowMyCenter(false)} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-brand-600 font-bold transition-colors">
                  <ArrowLeft size={20} /> {t.common.back}
              </button>
              <MyCenter user={currentUser} />
          </div>
      );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10">
      <ConfirmDeleteModal isOpen={deleteModal.isOpen} title={t.modals.deletePost} message={t.modals.areYouSure} onClose={() => setDeleteModal({isOpen: false, postId: ''})} onConfirm={confirmDelete} />
      <ConfirmDeleteCommentModal isOpen={deleteCommentModal.isOpen} onClose={() => setDeleteCommentModal({isOpen: false, postId: '', commentId: ''})} onConfirm={deleteComment} />
      <PostPendingModal isOpen={pendingModalOpen} onClose={() => setPendingModalOpen(false)} />
      <AIModerationModal isOpen={!!aiError} onClose={() => setAiError(null)} reason={aiError || ''} />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div><h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2"><MessageSquare className="text-brand-600" /> {t.community.header}</h1><p className="text-slate-500 text-sm mt-1">{t.community.subtitle}</p></div>
          <div className="flex items-center gap-4 w-full md:w-auto">
              <button onClick={() => setShowMyCenter(true)} className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-lg font-bold shadow-sm hover:bg-slate-50 hover:text-brand-600 flex items-center justify-center gap-2 transition-colors">
                  <UserIcon size={18} /> {t.myCenter.title}
              </button>
              <button onClick={() => setIsFormOpen(true)} className="flex-1 md:flex-none bg-brand-600 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg hover:bg-brand-700 flex items-center justify-center gap-2 transition-colors">
                  <Plus size={18} /> {t.community.newPost}
              </button>
          </div>
      </div>
      
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input type="text" placeholder={t.community.search} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none" /></div>
          <div className="relative min-w-[200px]"><Filter className="absolute left-3 top-2.5 text-slate-400" size={18} /><select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none appearance-none"><option value="">{t.community.allGrades}</option>{GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}</select><ChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={14} /></div>
      </div>

      {isFormOpen && (
          <div className="mb-10 bg-white p-6 rounded-xl shadow-lg border border-brand-100 animate-in slide-in-from-top-4 relative">
              {isPosting && (
                  <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center rounded-xl backdrop-blur-sm">
                      <Loader2 className="animate-spin text-brand-600 mb-2" size={32}/>
                      <div className="font-bold text-slate-600">Processing Post...</div>
                      {featureFlags.enableAIContentCheck && <div className="text-xs text-brand-500 mt-1 font-medium">Running AI Content Moderation</div>}
                  </div>
              )}
              <h3 className="font-bold text-lg mb-4 text-slate-800">{t.community.createTitle}</h3>
              <form className="space-y-4">
                  <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.common.title} <span className="text-red-500">*</span></label><input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50" /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.common.category} <span className="text-red-500">*</span></label>
                              <select value={category} onChange={e => setCategory(e.target.value as CommunityCategory)} className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50">
                                  {canPostAnnouncements && <option value="Announcement">{t.community.announcements}</option>}
                                  <option value="Club/ASA">{t.community.club}</option>
                                  <option value="Others">{t.community.others}</option>
                              </select>
                          </div>
                          <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.community.relevantDate} ({t.common.optional})</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50" /></div>
                  </div>
                  <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t.common.grade} {category !== 'Announcement' && <span className="text-red-500">*</span>}</label><div className="flex flex-wrap gap-2">{GRADE_LEVELS.map(g => <button key={g} type="button" onClick={() => toggleGrade(g)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${selectedGrades.includes(g) ? 'bg-brand-600 text-white' : 'bg-white text-slate-500'}`}>{g}</button>)}</div></div>
                  <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.common.description}</label><textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-slate-50 h-20" /></div>
                  
                  <div className="border-t pt-3">
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.community.uploaded}</label>
                      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,.pdf" />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-xs font-bold text-brand-600 bg-brand-50 px-3 py-2 rounded border border-brand-100 hover:bg-brand-100">
                          <Paperclip size={14}/> {attachedFile ? attachedFile.name : 'Attach File'}
                      </button>
                  </div>

                  <div className="flex items-end gap-3 pt-2"><button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-lg border">{t.common.cancel}</button><button type="button" onClick={handlePost} disabled={isPosting} className="flex-1 py-2.5 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 disabled:opacity-50">{t.community.newPost}</button></div>
              </form>
          </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderColumn(t.community.announcements, <Megaphone className="text-green-500" size={20} />, getCategorizedPosts('Announcement'), 'Announcement', 'border-green-100')}
          {renderColumn(t.community.club, <CalendarDays className="text-blue-500" size={20} />, getCategorizedPosts('Club/ASA'), 'Club/ASA', 'border-blue-100')}
          {renderColumn(t.community.others, <BookOpen className="text-purple-500" size={20} />, getCategorizedPosts('Others'), 'Others', 'border-purple-100')}
      </div>
    </div>
  );
};
export default CommunityPage;
