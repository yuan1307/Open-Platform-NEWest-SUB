
import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, MessageSquare, ListChecks, Mail, FileQuestion, Send, Loader2, Copy, CheckCircle2, ChevronRight, RefreshCw, Paperclip, FileText, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { getTutorResponse, generateRubric, generateEmail, generateQuiz } from '../services/geminiService';
import { QuizQuestion } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';

interface TeacherAIHubProps {
    isOpen: boolean;
    onClose: () => void;
    currentUserName: string;
}

const TeacherAIHub: React.FC<TeacherAIHubProps> = ({ isOpen, onClose, currentUserName }) => {
    const { t } = useLanguage();
    const [activeTool, setActiveTool] = useState<'assistant' | 'rubric' | 'email' | 'quiz'>('assistant');
    
    // Shared State
    const [attachedFile, setAttachedFile] = useState<{ name: string, type: string, data: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Assistant State ---
    const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- Rubric State ---
    const [rubricSubject, setRubricSubject] = useState('');
    const [rubricGrade, setRubricGrade] = useState('');
    const [rubricAssign, setRubricAssign] = useState('');
    const [rubricResult, setRubricResult] = useState('');
    const [isRubricLoading, setIsRubricLoading] = useState(false);

    // --- Email State ---
    const [emailStudent, setEmailStudent] = useState('');
    const [emailIssue, setEmailIssue] = useState('');
    const [emailTone, setEmailTone] = useState('Professional');
    const [emailResult, setEmailResult] = useState('');
    const [isEmailLoading, setIsEmailLoading] = useState(false);

    // --- Quiz State ---
    const [quizTopic, setQuizTopic] = useState('');
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [isQuizLoading, setIsQuizLoading] = useState(false);
    const [quizAnswers, setQuizAnswers] = useState<{[index: number]: string}>({});
    const [quizSubmitted, setQuizSubmitted] = useState(false);

    // Init Chat
    useEffect(() => {
        if (messages.length === 0) {
            setMessages([{ role: 'model', text: `Hello ${currentUserName}! I am your Instructional Design Assistant. How can I help you with lesson planning, resources, or administration today?` }]);
        }
    }, [currentUserName]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, activeTool]);

    if (!isOpen) return null;

    // --- Handlers ---

    const handleSwitchTool = (tool: typeof activeTool) => {
        setActiveTool(tool);
        setAttachedFile(null); // Clear file when switching context
    };

    // Chat
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (evt) => {
            const base64String = (evt.target?.result as string).split(',')[1];
            setAttachedFile({ name: file.name, type: file.type, data: base64String });
          };
          reader.readAsDataURL(file);
        }
    };

    const handleSendChat = async () => {
        if ((!chatInput.trim() && !attachedFile) || isChatLoading) return;
        const text = chatInput.trim();
        const currentFile = attachedFile;
        setChatInput('');
        setAttachedFile(null);
        setMessages(prev => [...prev, { role: 'user', text: currentFile ? `[Uploaded: ${currentFile.name}] ${text}` : text }]);
        setIsChatLoading(true);
        try {
            const response = await getTutorResponse(
                messages, 
                text || (currentFile ? "Analyze this file." : ""), 
                currentFile ? { mimeType: currentFile.type, data: currentFile.data } : undefined, 
                'teacher'
            );
            setMessages(prev => [...prev, { role: 'model', text: response }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error." }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    // Rubric
    const handleGenerateRubric = async () => {
        if (!rubricSubject || !rubricGrade || !rubricAssign) return;
        setIsRubricLoading(true);
        const fileData = attachedFile ? { mimeType: attachedFile.type, data: attachedFile.data } : undefined;
        const res = await generateRubric(rubricSubject, rubricGrade, rubricAssign, fileData);
        setRubricResult(res);
        setIsRubricLoading(false);
    };

    // Email
    const handleGenerateEmail = async () => {
        if (!emailStudent || !emailIssue) return;
        setIsEmailLoading(true);
        const fileData = attachedFile ? { mimeType: attachedFile.type, data: attachedFile.data } : undefined;
        const res = await generateEmail(emailStudent, emailIssue, emailTone, fileData);
        setEmailResult(res);
        setIsEmailLoading(false);
    };

    // Quiz
    const handleGenerateQuiz = async () => {
        if (!quizTopic && !attachedFile) return;
        setIsQuizLoading(true);
        setQuizQuestions([]);
        setQuizSubmitted(false);
        setQuizAnswers({});
        const fileData = attachedFile ? { mimeType: attachedFile.type, data: attachedFile.data } : undefined;
        const res = await generateQuiz(quizTopic || "Based on the attached file", fileData);
        setQuizQuestions(res);
        setIsQuizLoading(false);
    };

    const handleQuizSelect = (qIdx: number, option: string) => {
        if (quizSubmitted) return;
        setQuizAnswers(prev => ({ ...prev, [qIdx]: option }));
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
    };

    const AttachedFilePreview = () => {
        if (!attachedFile) return null;
        return (
            <div className="flex items-center justify-between text-xs bg-purple-50 text-purple-700 px-3 py-2 rounded-lg border border-purple-100 mb-2">
                <span className="flex items-center gap-2 truncate max-w-[200px]">
                    <Paperclip size={12} /> {attachedFile.name}
                </span>
                <button onClick={() => setAttachedFile(null)} className="text-purple-400 hover:text-purple-600"><X size={14}/></button>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden flex-col md:flex-row">
                
                {/* Global Hidden Input for Files */}
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf,text/plain" />

                {/* Sidebar */}
                <div className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0">
                    <div className="p-6 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-white font-bold text-lg mb-1">
                            <Sparkles className="text-purple-400" /> {t.teacherAI.title}
                        </div>
                        <div className="text-xs text-slate-500">{t.teacherAI.subtitle}</div>
                    </div>
                    <nav className="flex-1 p-2 space-y-1">
                        <button onClick={() => handleSwitchTool('assistant')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTool === 'assistant' ? 'bg-purple-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
                            <MessageSquare size={18} /> {t.teacherAI.tabs.assistant}
                        </button>
                        <button onClick={() => handleSwitchTool('rubric')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTool === 'rubric' ? 'bg-purple-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
                            <ListChecks size={18} /> {t.teacherAI.tabs.rubric}
                        </button>
                        <button onClick={() => handleSwitchTool('email')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTool === 'email' ? 'bg-purple-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
                            <Mail size={18} /> {t.teacherAI.tabs.email}
                        </button>
                        <button onClick={() => handleSwitchTool('quiz')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTool === 'quiz' ? 'bg-purple-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
                            <FileQuestion size={18} /> {t.teacherAI.tabs.quiz}
                        </button>
                    </nav>
                    <div className="p-4 border-t border-slate-800">
                        <button onClick={onClose} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold text-white transition-colors">
                            <X size={16} /> Close Hub
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden relative">
                    
                    {/* Assistant View */}
                    {activeTool === 'assistant' && (
                        <div className="flex flex-col h-full">
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm text-sm ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
                                            <div className="markdown-content">
                                                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {isChatLoading && <div className="flex justify-start"><div className="bg-white p-3 rounded-2xl rounded-bl-none shadow-sm"><Loader2 className="animate-spin text-slate-400" size={20} /></div></div>}
                                <div ref={messagesEndRef} />
                            </div>
                            {attachedFile && (
                                <div className="px-6 py-2 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs">
                                    <span className="flex items-center gap-2 truncate max-w-[300px]">
                                        {attachedFile.type.startsWith('image/') ? <ImageIcon size={14}/> : <FileText size={14}/>}
                                        {attachedFile.name}
                                    </span>
                                    <button onClick={() => setAttachedFile(null)} className="text-slate-500 hover:text-red-500"><X size={16}/></button>
                                </div>
                            )}
                            <div className="p-4 bg-white border-t border-slate-200 flex gap-2 items-end">
                                <button onClick={() => fileInputRef.current?.click()} className="text-slate-400 p-2 hover:text-purple-600 transition-colors" title="Attach file"><Paperclip size={20} /></button>
                                <textarea 
                                    value={chatInput} 
                                    onChange={e => setChatInput(e.target.value)} 
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChat())}
                                    placeholder="Type a message..." 
                                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500 resize-none max-h-32 bg-slate-50" 
                                    rows={1}
                                />
                                <button onClick={handleSendChat} disabled={isChatLoading || (!chatInput.trim() && !attachedFile)} className="bg-purple-600 text-white p-2.5 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors"><Send size={18} /></button>
                            </div>
                        </div>
                    )}

                    {/* Rubric View */}
                    {activeTool === 'rubric' && (
                        <div className="flex flex-col h-full p-6 md:p-8 overflow-y-auto">
                            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><ListChecks className="text-purple-600"/> {t.teacherAI.tabs.rubric}</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.common.subject}</label><input type="text" value={rubricSubject} onChange={e => setRubricSubject(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" placeholder="e.g. English Literature" /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.common.grade}</label><input type="text" value={rubricGrade} onChange={e => setRubricGrade(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" placeholder="e.g. Grade 10" /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.teacherAI.rubric.assignment}</label><input type="text" value={rubricAssign} onChange={e => setRubricAssign(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" placeholder={t.teacherAI.rubric.assignmentPlace} /></div>
                                        
                                        <AttachedFilePreview />
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-purple-600 font-bold hover:underline flex items-center gap-1 mb-2">
                                            <Paperclip size={12}/> Attach Assignment/Context
                                        </button>

                                        <button onClick={handleGenerateRubric} disabled={isRubricLoading || !rubricSubject} className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                            {isRubricLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={18}/>} {isRubricLoading ? t.teacherAI.rubric.generating : t.teacherAI.rubric.generate}
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative overflow-hidden min-h-[400px]">
                                    {rubricResult ? (
                                        <>
                                            <button onClick={() => copyToClipboard(rubricResult)} className="absolute top-4 right-4 text-slate-400 hover:text-purple-600 p-2 bg-slate-50 rounded-lg"><Copy size={16}/></button>
                                            <div className="markdown-content overflow-auto h-full text-sm">
                                                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{rubricResult}</ReactMarkdown>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                            <ListChecks size={48} className="mb-2 opacity-20"/>
                                            <p className="text-sm">Enter details to generate a rubric.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Email View */}
                    {activeTool === 'email' && (
                        <div className="flex flex-col h-full p-6 md:p-8 overflow-y-auto">
                            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Mail className="text-purple-600"/> {t.teacherAI.tabs.email}</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 h-fit">
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.teacherAI.email.studentName}</label><input type="text" value={emailStudent} onChange={e => setEmailStudent(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50" /></div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.teacherAI.email.issue}</label><textarea value={emailIssue} onChange={e => setEmailIssue(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50 h-24 resize-none" placeholder={t.teacherAI.email.issuePlace} /></div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.teacherAI.email.tone}</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['Professional', 'Friendly', 'Stern', 'Empathetic'].map(tone => (
                                                <button key={tone} onClick={() => setEmailTone(tone)} className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${emailTone === tone ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-slate-200 text-slate-600 hover:border-purple-300'}`}>
                                                    {t.teacherAI.email.tones[tone.toLowerCase() as keyof typeof t.teacherAI.email.tones] || tone}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <AttachedFilePreview />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-purple-600 font-bold hover:underline flex items-center gap-1 mb-2">
                                        <Paperclip size={12}/> Attach Evidence/Context
                                    </button>

                                    <button onClick={handleGenerateEmail} disabled={isEmailLoading || !emailStudent} className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                        {isEmailLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={18}/>} {isEmailLoading ? t.teacherAI.email.generating : t.teacherAI.email.generate}
                                    </button>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative min-h-[400px]">
                                    {emailResult ? (
                                        <>
                                            <button onClick={() => copyToClipboard(emailResult)} className="absolute top-4 right-4 text-slate-400 hover:text-purple-600 p-2 bg-slate-50 rounded-lg"><Copy size={16}/></button>
                                            <textarea readOnly value={emailResult} className="w-full h-full resize-none outline-none text-sm text-slate-700 leading-relaxed font-mono" />
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                            <Mail size={48} className="mb-2 opacity-20"/>
                                            <p className="text-sm">Draft will appear here.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quiz View */}
                    {activeTool === 'quiz' && (
                        <div className="flex flex-col h-full p-6 md:p-8 overflow-y-auto">
                            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><FileQuestion className="text-purple-600"/> {t.teacherAI.tabs.quiz}</h2>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-start">
                                <div className="flex-1 w-full">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.teacherAI.quiz.topic}</label>
                                    <textarea value={quizTopic} onChange={e => setQuizTopic(e.target.value)} className="w-full border p-3 rounded-lg text-sm bg-slate-50 resize-none h-20 outline-none focus:ring-1 focus:ring-purple-500" placeholder={t.teacherAI.quiz.topicPlace} />
                                    <div className="mt-2">
                                        <AttachedFilePreview />
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-purple-600 font-bold hover:underline flex items-center gap-1">
                                            <Paperclip size={12}/> Attach Source Material
                                        </button>
                                    </div>
                                </div>
                                <button onClick={handleGenerateQuiz} disabled={isQuizLoading || (!quizTopic && !attachedFile)} className="h-20 w-full md:w-32 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 flex flex-col items-center justify-center gap-2 mt-5">
                                    {isQuizLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={24}/>} 
                                    <span className="text-xs">{t.teacherAI.quiz.generate}</span>
                                </button>
                            </div>

                            {quizQuestions.length > 0 && (
                                <div className="space-y-4 pb-10">
                                    {quizQuestions.map((q, idx) => {
                                        const userAnswer = quizAnswers[idx];
                                        const isCorrect = userAnswer === q.answer;
                                        
                                        return (
                                            <div key={idx} className={`bg-white p-6 rounded-xl border shadow-sm transition-all ${quizSubmitted ? (isCorrect ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30') : 'border-slate-200'}`}>
                                                <h3 className="font-bold text-lg text-slate-800 mb-4 flex gap-3"><span className="bg-slate-100 text-slate-500 w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0">{idx + 1}</span> {q.question}</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-11">
                                                    {q.options.map((opt, oIdx) => (
                                                        <button 
                                                            key={oIdx} 
                                                            onClick={() => handleQuizSelect(idx, opt)}
                                                            disabled={quizSubmitted}
                                                            className={`p-3 rounded-lg text-left text-sm border transition-all flex justify-between items-center
                                                                ${quizSubmitted 
                                                                    ? (opt === q.answer 
                                                                        ? 'bg-green-100 border-green-300 text-green-800 font-bold' 
                                                                        : (userAnswer === opt ? 'bg-red-100 border-red-300 text-red-800' : 'bg-white border-slate-100 opacity-60'))
                                                                    : (userAnswer === opt ? 'bg-purple-100 border-purple-300 text-purple-800 font-medium' : 'bg-slate-50 border-slate-200 hover:bg-slate-100')
                                                                }
                                                            `}
                                                        >
                                                            {opt}
                                                            {quizSubmitted && opt === q.answer && <CheckCircle2 size={16} className="text-green-600"/>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {!quizSubmitted ? (
                                        <div className="flex justify-end pt-4">
                                            <button onClick={() => setQuizSubmitted(true)} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-900 shadow-lg flex items-center gap-2">
                                                Check Answers <ChevronRight size={16}/>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end pt-4">
                                            <button onClick={handleGenerateQuiz} className="bg-purple-100 text-purple-700 px-6 py-3 rounded-xl font-bold hover:bg-purple-200 flex items-center gap-2">
                                                <RefreshCw size={16}/> Generate Another
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Disclaimer Footer */}
                    <div className="p-3 text-[10px] text-center text-slate-400 border-t border-slate-200 bg-slate-50 shrink-0">
                        Provided by Google Gemini. AI-generated content may contain errors. Please verify all materials before using in the classroom.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeacherAIHub;
