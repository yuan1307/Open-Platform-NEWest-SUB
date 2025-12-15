
import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, MessageSquare, StickyNote, Baby, Send, Loader2, Copy, Paperclip, FileText, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { getTutorResponse, generateFlashcards, simplifyConcept } from '../services/geminiService';
import { ScheduleMap } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';

interface StudentAIHubProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: ScheduleMap;
}

const StudentAIHub: React.FC<StudentAIHubProps> = ({ isOpen, onClose, schedule }) => {
    const { t } = useLanguage();
    const [activeTool, setActiveTool] = useState<'tutor' | 'flashcards' | 'simplifier'>('tutor');
    
    // Shared State
    const [attachedFile, setAttachedFile] = useState<{ name: string, type: string, data: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Tutor State ---
    const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- Flashcards State ---
    const [fcTopic, setFcTopic] = useState('');
    const [fcResult, setFcResult] = useState('');
    const [isFcLoading, setIsFcLoading] = useState(false);

    // --- Simplifier State ---
    const [simpleConcept, setSimpleConcept] = useState('');
    const [simpleResult, setSimpleResult] = useState('');
    const [isSimpleLoading, setIsSimpleLoading] = useState(false);

    // Init Chat
    useEffect(() => {
        if (messages.length === 0) {
            setMessages([{ role: 'model', text: "Hello! I'm your AI Tutor. What are we studying today?" }]);
        }
    }, []);

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
            // Determine current class based on time for context
            const now = new Date();
            const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayName = dayMap[now.getDay()];
            const currentTime = now.getHours() * 60 + now.getMinutes();
            let context = "";
            
            // Simple period check logic (approximate)
            const periods = [
                { idx: 0, start: 480, end: 525 }, { idx: 1, start: 530, end: 575 },
                { idx: 2, start: 590, end: 635 }, { idx: 3, start: 640, end: 685 },
                { idx: 4, start: 760, end: 805 }, { idx: 5, start: 810, end: 855 },
                { idx: 6, start: 865, end: 910 }, { idx: 7, start: 915, end: 960 }
            ];
            const currentPeriod = periods.find(p => currentTime >= p.start && currentTime <= p.end);
            if (currentPeriod) {
                const periodId = `${dayName}-${currentPeriod.idx}`;
                const classData = schedule[periodId];
                if (classData && classData.subject) {
                    context = `[System: The student is currently in Period ${currentPeriod.idx + 1}: ${classData.subject}] `;
                }
            }

            const response = await getTutorResponse(
                messages, 
                context + (text || (currentFile ? "Analyze this file." : "")), 
                currentFile ? { mimeType: currentFile.type, data: currentFile.data } : undefined, 
                'student' // Explicitly use student mode
            );
            setMessages(prev => [...prev, { role: 'model', text: response }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error." }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    // Flashcards
    const handleGenerateFlashcards = async () => {
        if (!fcTopic && !attachedFile) return;
        setIsFcLoading(true);
        const fileData = attachedFile ? { mimeType: attachedFile.type, data: attachedFile.data } : undefined;
        const res = await generateFlashcards(fcTopic || "Based on the attached file", fileData);
        setFcResult(res);
        setIsFcLoading(false);
    };

    // Simplifier
    const handleSimplify = async () => {
        if (!simpleConcept && !attachedFile) return;
        setIsSimpleLoading(true);
        const fileData = attachedFile ? { mimeType: attachedFile.type, data: attachedFile.data } : undefined;
        const res = await simplifyConcept(simpleConcept || "the attached content", fileData);
        setSimpleResult(res);
        setIsSimpleLoading(false);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
    };

    const AttachedFilePreview = () => {
        if (!attachedFile) return null;
        return (
            <div className="flex items-center justify-between text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg border border-indigo-100 mb-2">
                <span className="flex items-center gap-2 truncate max-w-[200px]">
                    <Paperclip size={12} /> {attachedFile.name}
                </span>
                <button onClick={() => setAttachedFile(null)} className="text-indigo-400 hover:text-indigo-600"><X size={14}/></button>
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
                            <Sparkles className="text-indigo-400" /> {t.studentAI.title}
                        </div>
                        <div className="text-xs text-slate-500">{t.studentAI.subtitle}</div>
                    </div>
                    <nav className="flex-1 p-2 space-y-1">
                        <button onClick={() => handleSwitchTool('tutor')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTool === 'tutor' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
                            <MessageSquare size={18} /> {t.studentAI.tabs.tutor}
                        </button>
                        <button onClick={() => handleSwitchTool('flashcards')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTool === 'flashcards' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
                            <StickyNote size={18} /> {t.studentAI.tabs.flashcards}
                        </button>
                        <button onClick={() => handleSwitchTool('simplifier')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTool === 'simplifier' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
                            <Baby size={18} /> {t.studentAI.tabs.simplifier}
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
                    
                    {/* Tutor Chat View */}
                    {activeTool === 'tutor' && (
                        <div className="flex flex-col h-full">
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
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
                                <button onClick={() => fileInputRef.current?.click()} className="text-slate-400 p-2 hover:text-indigo-600 transition-colors" title="Attach file"><Paperclip size={20} /></button>
                                <textarea 
                                    value={chatInput} 
                                    onChange={e => setChatInput(e.target.value)} 
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChat())}
                                    placeholder="Type a message..." 
                                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none max-h-32 bg-slate-50" 
                                    rows={1}
                                />
                                <button onClick={handleSendChat} disabled={isChatLoading || (!chatInput.trim() && !attachedFile)} className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"><Send size={18} /></button>
                            </div>
                        </div>
                    )}

                    {/* Flashcards View */}
                    {activeTool === 'flashcards' && (
                        <div className="flex flex-col h-full p-6 md:p-8 overflow-y-auto">
                            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><StickyNote className="text-indigo-600"/> {t.studentAI.tabs.flashcards}</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.studentAI.flashcards.topic}</label>
                                            <textarea 
                                                value={fcTopic} 
                                                onChange={e => setFcTopic(e.target.value)} 
                                                className="w-full border p-3 rounded-lg text-sm bg-slate-50 resize-none h-32 focus:ring-1 focus:ring-indigo-500 outline-none" 
                                                placeholder={t.studentAI.flashcards.topicPlace} 
                                            />
                                        </div>
                                        
                                        <AttachedFilePreview />
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 mb-2">
                                            <Paperclip size={12}/> Attach Notes/File
                                        </button>

                                        <button onClick={handleGenerateFlashcards} disabled={isFcLoading || (!fcTopic && !attachedFile)} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                            {isFcLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={18}/>} {isFcLoading ? t.studentAI.flashcards.generating : t.studentAI.flashcards.generate}
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative overflow-hidden min-h-[400px]">
                                    {fcResult ? (
                                        <>
                                            <button onClick={() => copyToClipboard(fcResult)} className="absolute top-4 right-4 text-slate-400 hover:text-indigo-600 p-2 bg-slate-50 rounded-lg"><Copy size={16}/></button>
                                            <div className="markdown-content overflow-auto h-full text-sm">
                                                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{fcResult}</ReactMarkdown>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                            <StickyNote size={48} className="mb-2 opacity-20"/>
                                            <p className="text-sm">Content will appear here.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Simplifier View */}
                    {activeTool === 'simplifier' && (
                        <div className="flex flex-col h-full p-6 md:p-8 overflow-y-auto">
                            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Baby className="text-indigo-600"/> {t.studentAI.tabs.simplifier}</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 h-fit">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.studentAI.simplifier.concept}</label>
                                        <textarea 
                                            value={simpleConcept} 
                                            onChange={e => setSimpleConcept(e.target.value)} 
                                            className="w-full border p-3 rounded-lg text-sm bg-slate-50 resize-none h-32 focus:ring-1 focus:ring-indigo-500 outline-none" 
                                            placeholder={t.studentAI.simplifier.conceptPlace} 
                                        />
                                    </div>
                                    
                                    <AttachedFilePreview />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 mb-2">
                                        <Paperclip size={12}/> Attach Reading/Source
                                    </button>

                                    <button onClick={handleSimplify} disabled={isSimpleLoading || (!simpleConcept && !attachedFile)} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                        {isSimpleLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={18}/>} {isSimpleLoading ? t.studentAI.simplifier.generating : t.studentAI.simplifier.generate}
                                    </button>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative min-h-[400px]">
                                    {simpleResult ? (
                                        <>
                                            <button onClick={() => copyToClipboard(simpleResult)} className="absolute top-4 right-4 text-slate-400 hover:text-indigo-600 p-2 bg-slate-50 rounded-lg"><Copy size={16}/></button>
                                            <div className="markdown-content overflow-auto h-full text-sm">
                                                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{simpleResult}</ReactMarkdown>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                            <Baby size={48} className="mb-2 opacity-20"/>
                                            <p className="text-sm">Simplified explanation will appear here.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Disclaimer Footer */}
                    <div className="p-3 text-[10px] text-center text-slate-400 border-t border-slate-200 bg-slate-50 shrink-0">
                        {t.ai.disclaimer}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentAIHub;