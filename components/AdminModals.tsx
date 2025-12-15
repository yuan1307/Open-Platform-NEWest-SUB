
import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Send, CheckSquare, Square, Clock, Edit2, Shield, Trash2, Megaphone, UserX, CheckCircle2, Search, User, Eye, UserCheck, PlusCircle, Lock, FileText, Loader2, Info, ClipboardList, ShieldAlert } from 'lucide-react';
import { Teacher, User as UserType, UserRole, TaskCategory, Broadcast, SystemRecord, ActionType, Warning } from '../types';
import { db } from '../services/db';
import { useLanguage } from '../LanguageContext';
import { VISIBLE_ACTION_TYPES } from '../constants';

interface AddTeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (t: Teacher, createAccount: boolean) => void;
}

export const AddTeacherModal: React.FC<AddTeacherModalProps> = ({ isOpen, onClose, onSave }) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [createAccount, setCreateAccount] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ id: `t-${Date.now()}`, name, subject, email }, createAccount);
    setName(''); setSubject(''); setEmail(''); setCreateAccount(false); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="bg-brand-600 text-white p-4 flex justify-between items-center">
            <h3 className="font-bold">{t.modals.addTeacher}</h3>
            <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.common.name} *</label><input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 rounded text-sm"/></div>
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.common.subject} *</label><input required type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full border p-2 rounded text-sm"/></div>
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.common.email} *</label><input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border p-2 rounded text-sm"/></div>
            <div className="bg-slate-50 p-3 rounded border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={createAccount} onChange={e => setCreateAccount(e.target.checked)} className="rounded text-brand-600 focus:ring-brand-500"/><span className="text-sm font-bold text-slate-700">{t.modals.createAccount}</span></label>
                <p className="text-xs text-slate-500 mt-1 ml-5">{t.modals.createAccountMsg}</p>
            </div>
            <button type="submit" className="w-full bg-brand-600 text-white py-2 rounded font-bold hover:bg-brand-700">{t.common.confirm}</button>
        </form>
      </div>
    </div>
  );
};

interface EditTeacherModalProps { isOpen: boolean; onClose: () => void; teacher: Teacher | null; onSave: (updated: Teacher) => void; }

export const EditTeacherModal: React.FC<EditTeacherModalProps> = ({ isOpen, onClose, teacher, onSave }) => {
    const { t } = useLanguage();
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [email, setEmail] = useState('');

    useEffect(() => { if (teacher) { setName(teacher.name); setSubject(teacher.subject); setEmail(teacher.email); } }, [teacher]);
    if (!isOpen || !teacher) return null;

    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ ...teacher, name, subject, email }); onClose(); };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="bg-brand-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{t.modals.editTeacher}</h3><button onClick={onClose}><X size={20} /></button></div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.common.name}</label><input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 rounded text-sm"/></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.common.subject}</label><input required type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full border p-2 rounded text-sm"/></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.common.email}</label><input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border p-2 rounded text-sm"/></div>
                    <button type="submit" className="w-full bg-brand-600 text-white py-2 rounded font-bold hover:bg-brand-700">{t.common.save}</button>
                </form>
            </div>
        </div>
    );
};

interface EditSubjectModalProps { isOpen: boolean; onClose: () => void; originalSubject: string; onSave: (oldName: string, newName: string) => void; }

export const EditSubjectModal: React.FC<EditSubjectModalProps> = ({ isOpen, onClose, originalSubject, onSave }) => {
    const { t } = useLanguage();
    const [name, setName] = useState('');
    useEffect(() => { if(originalSubject) setName(originalSubject); }, [originalSubject]);
    if (!isOpen) return null;
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(originalSubject, name); onClose(); };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-brand-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{t.modals.editSubject}</h3><button onClick={onClose}><X size={20} /></button></div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.common.subject}</label><input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 rounded text-sm"/></div>
                    <button type="submit" className="w-full bg-brand-600 text-white py-2 rounded font-bold hover:bg-brand-700">{t.common.save}</button>
                </form>
            </div>
        </div>
    );
};

interface BroadcastStatusModalProps { isOpen: boolean; onClose: () => void; broadcastId: string; title: string; }

export const BroadcastStatusModal: React.FC<BroadcastStatusModalProps> = ({ isOpen, onClose, broadcastId, title }) => {
    const { t } = useLanguage();
    const [statuses, setStatuses] = useState<{name: string, id: string, read: boolean, date?: string}[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { if (isOpen && broadcastId) { loadStatuses(); } }, [isOpen, broadcastId]);

    const loadStatuses = async () => {
        setLoading(true);
        const users = await db.scan<UserType>('basis_user_');
        const results: {name: string, id: string, read: boolean, date?: string}[] = [];
        users.forEach(({ value: user }) => {
            if (user.role === 'student' && user.broadcasts) {
                const b = user.broadcasts.find(b => b.id === broadcastId);
                if (b) { results.push({ name: user.name || 'Unknown', id: user.id, read: b.acknowledged, date: b.acknowledgedDate }); }
            }
        });
        setStatuses(results); setLoading(false);
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[80vh]">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center"><div><h3 className="font-bold">{t.common.status}</h3><div className="text-xs text-slate-400">{title}</div></div><button onClick={onClose}><X size={20} /></button></div>
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center"><div className="text-sm font-bold text-slate-600">Total: {statuses.length}</div><div className="flex gap-2"><span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">Read: {statuses.filter(s => s.read).length}</span><span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">Unread: {statuses.filter(s => !s.read).length}</span></div></div>
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? <div className="p-10 text-center">{t.common.loading}</div> : (
                        <table className="w-full text-left text-sm"><thead className="bg-white sticky top-0"><tr className="text-slate-500 border-b"><th className="p-3">{t.common.name}</th><th className="p-3">ID</th><th className="p-3">{t.common.status}</th><th className="p-3">{t.common.date}</th></tr></thead><tbody>{statuses.map(s => (<tr key={s.id} className="border-b last:border-0 hover:bg-slate-50"><td className="p-3 font-bold">{s.name}</td><td className="p-3 font-mono text-xs">{s.id}</td><td className="p-3">{s.read ? <span className="flex items-center gap-1 text-green-600 font-bold"><CheckCircle2 size={14}/> Read</span> : <span className="flex items-center gap-1 text-red-500 font-bold"><Clock size={14}/> Pending</span>}</td><td className="p-3 text-xs text-slate-500">{s.date ? new Date(s.date).toLocaleString() : '-'}</td></tr>))}</tbody></table>
                    )}
                </div>
            </div>
        </div>
    );
};

interface AddSubjectModalProps { isOpen: boolean; onClose: () => void; onSave: (subjects: string[]) => void; }

export const AddSubjectModal: React.FC<AddSubjectModalProps> = ({ isOpen, onClose, onSave }) => {
  const { t } = useLanguage();
  const [subject, setSubject] = useState('');
  if (!isOpen) return null;
  const handleSubmit = (e: React.FormEvent) => { 
      e.preventDefault(); 
      if(subject.trim()) { 
          // Split by semi-colon for bulk import
          const subjects = subject.split(';').map(s => s.trim()).filter(s => s.length > 0);
          if (subjects.length > 0) {
              onSave(subjects); 
              setSubject(''); 
              onClose(); 
          }
      } 
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
        <div className="bg-brand-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{t.modals.addSubject}</h3><button onClick={onClose}><X size={20} /></button></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.common.subject} *</label>
                <p className="text-[10px] text-gray-400 mb-2">Tip: Use ";" to add multiple (e.g. Math; English; Science)</p>
                <input required type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="Subject Name"/>
            </div>
            <button type="submit" className="w-full bg-brand-600 text-white py-2 rounded font-bold hover:bg-brand-700">{t.common.confirm}</button>
        </form>
      </div>
    </div>
  );
};

interface ConfirmDeleteModalProps { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; }

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
        <div className="bg-red-50 p-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-3"><AlertTriangle size={24} /></div>
            <h3 className="font-bold text-lg text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-2 mb-6">{message}</p>
            <div className="flex gap-3 w-full"><button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">{t.common.cancel}</button><button onClick={() => { onConfirm(); onClose(); }} className="flex-1 px-4 py-2 bg-red-600 rounded-lg text-white font-medium hover:bg-red-700">{t.common.confirm}</button></div>
        </div>
      </div>
    </div>
  );
};

// Generic Modal for various actions (Success/Info/Danger)
interface ConfirmGenericModalProps { 
    isOpen: boolean; 
    onClose: () => void; 
    onConfirm: () => void; 
    title: string; 
    message: string;
    type?: 'danger' | 'success' | 'info';
}

export const ConfirmGenericModal: React.FC<ConfirmGenericModalProps> = ({ isOpen, onClose, onConfirm, title, message, type = 'danger' }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;
  
  let bgClass = "bg-red-50";
  let iconBg = "bg-red-100";
  let iconText = "text-red-600";
  let confirmBtn = "bg-red-600 hover:bg-red-700";
  let Icon = AlertTriangle;

  if (type === 'success') {
      bgClass = "bg-green-50";
      iconBg = "bg-green-100";
      iconText = "text-green-600";
      confirmBtn = "bg-green-600 hover:bg-green-700";
      Icon = CheckCircle2;
  } else if (type === 'info') {
      bgClass = "bg-blue-50";
      iconBg = "bg-blue-100";
      iconText = "text-blue-600";
      confirmBtn = "bg-blue-600 hover:bg-blue-700";
      Icon = Info;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
        <div className={`${bgClass} p-6 flex flex-col items-center text-center`}>
            <div className={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center ${iconText} mb-3`}><Icon size={24} /></div>
            <h3 className="font-bold text-lg text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-2 mb-6">{message}</p>
            <div className="flex gap-3 w-full"><button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">{t.common.cancel}</button><button onClick={() => { onConfirm(); onClose(); }} className={`flex-1 px-4 py-2 ${confirmBtn} rounded-lg text-white font-medium`}>{t.common.confirm}</button></div>
        </div>
      </div>
    </div>
  );
};

interface ConfirmDeleteCommentModalProps { isOpen: boolean; onClose: () => void; onConfirm: () => void; }

export const ConfirmDeleteCommentModal: React.FC<ConfirmDeleteCommentModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
        <div className="bg-red-50 p-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-3"><Trash2 size={24} /></div>
            <h3 className="font-bold text-lg text-gray-900">{t.modals.deleteComment}</h3>
            <p className="text-sm text-gray-500 mt-2 mb-6">{t.modals.areYouSure}</p>
            <div className="flex gap-3 w-full"><button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">{t.common.cancel}</button><button onClick={() => { onConfirm(); onClose(); }} className="flex-1 px-4 py-2 bg-red-600 rounded-lg text-white font-medium hover:bg-red-700">{t.common.delete}</button></div>
        </div>
      </div>
    </div>
  );
};

interface SendWarningModalProps { isOpen: boolean; onClose: () => void; users: { user: UserType; key: string }[]; onSend: (userIds: string[], message: string) => void; }

export const SendWarningModal: React.FC<SendWarningModalProps> = ({ isOpen, onClose, users, onSend }) => {
    const { t } = useLanguage();
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [message, setMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    if (!isOpen) return null;
    const toggleUser = (id: string) => setSelectedUsers(prev => prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]);
    const handleSubmit = () => { if (selectedUsers.length > 0 && message.trim()) { onSend(selectedUsers, message); setSelectedUsers([]); setMessage(''); onClose(); } };
    const filteredUsers = users.filter(u => u.user.role === 'student' && (u.user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.user.id.includes(searchTerm)));
    const handleSelectAll = () => { if (selectedUsers.length === filteredUsers.length) { setSelectedUsers([]); } else { setSelectedUsers(filteredUsers.map(u => u.user.id)); } };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
                <div className="bg-orange-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{t.modals.sendWarning}</h3><button onClick={onClose}><X size={20} /></button></div>
                <div className="p-6 flex flex-col md:flex-row gap-6 overflow-hidden flex-1">
                    <div className="flex-1 flex flex-col">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex justify-between">
                            <span>{t.modals.selectStudents} ({selectedUsers.length})</span>
                            <button onClick={handleSelectAll} className="text-brand-600 hover:underline">{t.common.selectAll}</button>
                        </label>
                        <div className="relative mb-2"><input type="text" placeholder={t.common.search} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full border p-2 pl-8 rounded text-sm"/><Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} /></div><div className="border rounded-lg flex-1 overflow-y-auto p-2 space-y-1 h-64">{filteredUsers.map(({user}) => (<div key={user.id} onClick={() => toggleUser(user.id)} className={`p-2 rounded flex items-center justify-between cursor-pointer transition-colors ${selectedUsers.includes(user.id) ? 'bg-orange-50 border border-orange-200' : 'hover:bg-gray-50'}`}><div><div className="font-bold text-sm text-gray-800">{user.name}</div><div className="text-xs text-gray-500">{user.id}</div></div>{selectedUsers.includes(user.id) ? <CheckSquare size={16} className="text-orange-600"/> : <Square size={16} className="text-gray-300"/>}</div>))}</div></div>
                    <div className="flex-1 flex flex-col"><label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t.modals.warningMsg}</label><textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="..." className="w-full border p-3 rounded-lg flex-1 resize-none focus:ring-2 focus:ring-orange-500 outline-none"/></div>
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end"><button onClick={handleSubmit} disabled={selectedUsers.length === 0 || !message.trim()} className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"><Send size={16} /> {t.common.confirm}</button></div>
            </div>
        </div>
    );
};

interface WarningHistoryModalProps { isOpen: boolean; onClose: () => void; user: UserType | null; }

export const WarningHistoryModal: React.FC<WarningHistoryModalProps> = ({ isOpen, onClose, user }) => {
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [freshUser, setFreshUser] = useState<UserType | null>(null);

    useEffect(() => {
        const fetchFreshUser = async () => {
            if (isOpen && user) {
                setLoading(true);
                const fetched = await db.getItem<UserType>(`basis_user_${user.id}`);
                setFreshUser(fetched || user); // Fallback to prop if fetch fails
                setLoading(false);
            }
        };
        fetchFreshUser();
    }, [isOpen, user]);

    if (!isOpen || !user) return null;
    
    // Use freshUser if available (for cloud sync), otherwise fallback to passed prop
    const displayUser = freshUser || user;
    const warnings = displayUser.warnings || [];
    const filteredWarnings = warnings.filter(w => w.message.toLowerCase().includes(search.toLowerCase()) || w.date.includes(search));

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                <div className="bg-gray-800 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{t.modals.warningHistory}: {displayUser.name}</h3><button onClick={onClose}><X size={20} /></button></div>
                <div className="p-4 border-b border-gray-100 bg-gray-50"><div className="relative"><input type="text" placeholder={t.common.search} value={search} onChange={e => setSearch(e.target.value)} className="w-full border p-2 pl-8 rounded text-sm outline-none"/><Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} /></div></div>
                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                    {loading ? (
                        <div className="text-center py-4 flex items-center justify-center gap-2 text-slate-500">
                            <Loader2 className="animate-spin" size={16}/> {t.common.loading}
                        </div>
                    ) : filteredWarnings.length === 0 ? (
                        <p className="text-center text-gray-400 py-4">No warnings found.</p>
                    ) : (
                        filteredWarnings.map((w) => (<div key={w.id} className="border border-gray-200 rounded-lg p-3 bg-white"><div className="flex justify-between items-start mb-2"><span className="text-xs font-bold text-gray-500 flex items-center gap-1"><Clock size={12} /> {w.date}</span><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${w.acknowledged ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{w.acknowledged ? 'Read' : 'Unread'}</span></div><p className="text-sm text-gray-800">{w.message}</p></div>))
                    )}
                </div>
            </div>
        </div>
    );
};

interface EditUserModalProps { isOpen: boolean; onClose: () => void; user: UserType | null; onSave: (newName: string) => void; }

export const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, user, onSave }) => {
    const { t } = useLanguage();
    const [name, setName] = useState('');
    React.useEffect(() => { if (user) setName(user.name || ''); }, [user]);
    if (!isOpen || !user) return null;
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(name); onClose(); };

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-brand-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Edit2 size={18}/> {t.modals.editName}</h3><button onClick={onClose}><X size={20}/></button></div>
                <form onSubmit={handleSubmit} className="p-6"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.common.name}</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 rounded mb-4" required/><button type="submit" className="w-full bg-brand-600 text-white py-2 rounded font-bold hover:bg-brand-700">{t.common.save}</button></form>
            </div>
        </div>
    );
};

interface AdminChangePasswordModalProps { isOpen: boolean; onClose: () => void; user: UserType | null; onSave: (newPass: string) => void; }

export const AdminChangePasswordModal: React.FC<AdminChangePasswordModalProps> = ({ isOpen, onClose, user, onSave }) => {
    const { t } = useLanguage();
    const [password, setPassword] = useState('');
    if (!isOpen || !user) return null;
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(password); setPassword(''); onClose(); };

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-yellow-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Shield size={18}/> {t.modals.changePass}</h3><button onClick={onClose}><X size={20}/></button></div>
                <form onSubmit={handleSubmit} className="p-6"><p className="text-sm text-gray-600 mb-4">Set a new password for <strong>{user.name}</strong> ({user.id})</p><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.common.password}</label><input type="text" value={password} onChange={e => setPassword(e.target.value)} className="w-full border p-2 rounded mb-4" required/><button type="submit" className="w-full bg-yellow-600 text-white py-2 rounded font-bold hover:bg-yellow-700">{t.common.confirm}</button></form>
            </div>
        </div>
    );
};

interface RejectPostModalProps { isOpen: boolean; onClose: () => void; onConfirm: (reason: string) => void; }

export const RejectPostModal: React.FC<RejectPostModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const { t } = useLanguage();
    const [reason, setReason] = useState('');
    if (!isOpen) return null;
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onConfirm(reason); setReason(''); onClose(); };

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="bg-red-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{t.modals.rejectPost}</h3><button onClick={onClose}><X size={20}/></button></div>
                <form onSubmit={handleSubmit} className="p-6"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.modals.reason}</label><textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full border p-2 rounded h-24 mb-4 resize-none" required/><button type="submit" className="w-full bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700">{t.modals.rejectPost}</button></form>
            </div>
        </div>
    );
};

interface ChangeRoleModalProps { isOpen: boolean; onClose: () => void; user: UserType | null; role: UserRole; onConfirm: () => void; }

export const ChangeRoleModal: React.FC<ChangeRoleModalProps> = ({ isOpen, onClose, user, role, onConfirm }) => {
    const { t } = useLanguage();
    if (!isOpen || !user) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-indigo-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{t.modals.confirmRole}</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 text-center"><p className="text-gray-700 mb-6">{t.modals.areYouSure} <strong>{user.name}</strong> -> <strong>{role}</strong>?</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-50">{t.common.cancel}</button><button onClick={() => { onConfirm(); onClose(); }} className="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 font-bold">{t.common.confirm}</button></div></div>
            </div>
        </div>
    );
};

interface BanUserModalProps { isOpen: boolean; onClose: () => void; user: UserType | null; onConfirm: () => void; }

export const BanUserModal: React.FC<BanUserModalProps> = ({ isOpen, onClose, user, onConfirm }) => {
    const { t } = useLanguage();
    if (!isOpen || !user) return null;
    const isBanned = user.isBanned;
    const action = isBanned ? t.modals.unbanUser : t.modals.banUser;
    const color = isBanned ? "bg-green-600" : "bg-red-600";
    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className={`${color} text-white p-4 flex justify-between items-center`}><h3 className="font-bold">{action}</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 text-center"><p className="text-gray-700 mb-6">{t.modals.areYouSure} <strong>{user.name}</strong>?</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-50">{t.common.cancel}</button><button onClick={() => { onConfirm(); onClose(); }} className={`flex-1 ${color} text-white py-2 rounded font-bold opacity-90 hover:opacity-100`}>{t.common.confirm}</button></div></div>
            </div>
        </div>
    );
};

interface ConfirmCreateAccountModalProps { isOpen: boolean; onClose: () => void; teacher: Teacher | null; onConfirm: () => void; }

export const ConfirmCreateAccountModal: React.FC<ConfirmCreateAccountModalProps> = ({ isOpen, onClose, teacher, onConfirm }) => {
    const { t } = useLanguage();
    if (!isOpen || !teacher) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-green-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><PlusCircle size={18}/> {t.modals.createAccountConfirm}</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 text-center"><p className="text-gray-700 mb-6">{t.modals.areYouSure} <strong>{teacher.name}</strong>?<br/>{t.modals.createAccountMsg}</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-50">{t.common.cancel}</button><button onClick={() => { onConfirm(); onClose(); }} className="flex-1 bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700">{t.common.confirm}</button></div></div>
            </div>
        </div>
    );
};

interface ConfirmBroadcastModalProps { isOpen: boolean; onClose: () => void; count: number; onConfirm: () => void; }

export const ConfirmBroadcastModal: React.FC<ConfirmBroadcastModalProps> = ({ isOpen, onClose, count, onConfirm }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-brand-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Megaphone size={18}/> {t.modals.broadcastConfirm}</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 text-center"><p className="text-gray-700 mb-6">{t.modals.broadcastMsg.replace('{count}', count.toString())}</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-50">{t.common.cancel}</button><button onClick={() => { onConfirm(); onClose(); }} className="flex-1 bg-brand-600 text-white py-2 rounded font-bold hover:bg-brand-700">{t.common.confirm}</button></div></div>
            </div>
        </div>
    );
};

interface ConfirmRemoveStudentModalProps { isOpen: boolean; onClose: () => void; studentName: string; onConfirm: () => void; }

export const ConfirmRemoveStudentModal: React.FC<ConfirmRemoveStudentModalProps> = ({ isOpen, onClose, studentName, onConfirm }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-red-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><UserX size={18}/> {t.modals.removeStudent}</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 text-center"><p className="text-gray-700 mb-6">{t.modals.removeStudentMsg.replace('{name}', studentName)}</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-50">{t.common.cancel}</button><button onClick={() => { onConfirm(); onClose(); }} className="flex-1 bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700">{t.common.confirm}</button></div></div>
            </div>
        </div>
    );
};

interface PostPendingModalProps { isOpen: boolean; onClose: () => void; }

export const PostPendingModal: React.FC<PostPendingModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="p-8 text-center flex flex-col items-center"><div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4"><CheckCircle2 size={32}/></div><h3 className="font-bold text-xl text-gray-800 mb-2">{t.community.postPendingTitle}</h3><p className="text-gray-500 mb-6">{t.community.postPendingMsg}</p><button onClick={onClose} className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-bold hover:bg-brand-700">{t.community.gotIt}</button></div>
            </div>
        </div>
    );
};

interface ForcePasswordChangeModalProps { isOpen: boolean; user: UserType | null; onSave: (newPass: string) => void; }

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({ isOpen, user, onSave }) => {
    const { t } = useLanguage();
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [error, setError] = useState('');

    if (!isOpen || !user) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPass !== confirmPass) { setError('Passwords do not match.'); return; }
        if (newPass.length < 6) { setError('Password must be at least 6 characters.'); return; }
        onSave(newPass);
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="bg-orange-600 text-white p-5 flex flex-col items-center text-center"><Lock size={32} className="mb-2 opacity-80"/><h3 className="font-bold text-xl">{t.modals.forcePass}</h3><p className="text-orange-100 text-sm mt-1">{t.modals.forcePassMsg}</p></div>
                <form onSubmit={handleSubmit} className="p-8 space-y-4">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.common.password}</label><input required type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full border p-3 rounded-lg text-sm bg-slate-50"/></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.common.confirm}</label><input required type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full border p-3 rounded-lg text-sm bg-slate-50"/></div>
                    {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
                    <button type="submit" className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-700 shadow-md">{t.common.confirm}</button>
                </form>
             </div>
        </div>
    );
};

interface AddRecordModalProps { isOpen: boolean; onClose: () => void; onSave: (record: SystemRecord) => void; currentUser: UserType; isIllegalMode?: boolean; }

export const AddRecordModal: React.FC<AddRecordModalProps> = ({ isOpen, onClose, onSave, currentUser, isIllegalMode }) => {
    const { t } = useLanguage();
    const [action, setAction] = useState<ActionType>('LOGIN');
    const [details, setDetails] = useState('');
    const [targetName, setTargetName] = useState('');
    
    // Super Admin Mode fields
    const [customActorName, setCustomActorName] = useState('');
    const [customActorId, setCustomActorId] = useState('');
    const [customActorRole, setCustomActorRole] = useState<UserRole>('student');

    useEffect(() => {
        if (isOpen) {
            setCustomActorName(currentUser.name || 'Admin');
            setCustomActorId(currentUser.id);
            setCustomActorRole(currentUser.role);
            setAction('LOGIN');
            setDetails('');
            setTargetName('');
        }
    }, [isOpen, currentUser]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const record: SystemRecord = {
            id: `log-${Date.now()}`,
            timestamp: Date.now(),
            date: new Date().toISOString(),
            actorId: isIllegalMode ? customActorId : currentUser.id,
            actorName: isIllegalMode ? customActorName : (currentUser.name || 'Admin'),
            actorRole: isIllegalMode ? customActorRole : currentUser.role,
            action,
            targetName,
            details
        };
        onSave(record);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><FileText size={18}/> {t.admin.records.addRecord}</h3><button onClick={onClose}><X size={20}/></button></div>
                <form onSubmit={handleSubmit} className="p-6 space-y-3 overflow-y-auto">
                    {isIllegalMode && (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 space-y-2 mb-2">
                            <div className="text-xs font-bold text-red-600 uppercase">Super Admin Mode Override</div>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="text" placeholder="Actor Name" value={customActorName} onChange={e => setCustomActorName(e.target.value)} className="border p-1 text-xs rounded"/>
                                <input type="text" placeholder="Actor ID" value={customActorId} onChange={e => setCustomActorId(e.target.value)} className="border p-1 text-xs rounded"/>
                            </div>
                            <select value={customActorRole} onChange={e => setCustomActorRole(e.target.value as UserRole)} className="w-full border p-1 text-xs rounded bg-white">
                                <option value="student">student</option>
                                <option value="teacher">teacher</option>
                                <option value="admin">admin</option>
                                <option value="secondary_admin">secondary_admin</option>
                            </select>
                        </div>
                    )}
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.admin.records.action}</label><select value={action} onChange={e => setAction(e.target.value as ActionType)} className="w-full border p-2 rounded text-sm bg-white">{VISIBLE_ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.admin.records.target} ({t.common.optional})</label><input type="text" value={targetName} onChange={e => setTargetName(e.target.value)} className="w-full border p-2 rounded text-sm"/></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.admin.records.details} ({t.common.optional})</label><textarea value={details} onChange={e => setDetails(e.target.value)} className="w-full border p-2 rounded text-sm h-20 resize-none"/></div>
                    <button type="submit" className="w-full bg-slate-800 text-white py-2 rounded font-bold hover:bg-slate-900">{t.common.confirm}</button>
                </form>
            </div>
        </div>
    );
};

interface EditRecordModalProps { isOpen: boolean; onClose: () => void; record: SystemRecord | null; onSave: (record: SystemRecord) => void; }

export const EditRecordModal: React.FC<EditRecordModalProps> = ({ isOpen, onClose, record, onSave }) => {
    const { t } = useLanguage();
    const [action, setAction] = useState<ActionType>('LOGIN');
    const [details, setDetails] = useState('');
    const [targetName, setTargetName] = useState('');

    useEffect(() => {
        if (record) {
            setAction(record.action);
            setDetails(record.details || '');
            setTargetName(record.targetName || '');
        }
    }, [record]);

    if (!isOpen || !record) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...record, action, details, targetName });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Edit2 size={18}/> {t.admin.records.editRecord}</h3><button onClick={onClose}><X size={20}/></button></div>
                <form onSubmit={handleSubmit} className="p-6 space-y-3">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.admin.records.action}</label><select value={action} onChange={e => setAction(e.target.value as ActionType)} className="w-full border p-2 rounded text-sm bg-white">{VISIBLE_ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.admin.records.target}</label><input type="text" value={targetName} onChange={e => setTargetName(e.target.value)} className="w-full border p-2 rounded text-sm"/></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.admin.records.details}</label><textarea value={details} onChange={e => setDetails(e.target.value)} className="w-full border p-2 rounded text-sm h-20 resize-none"/></div>
                    <button type="submit" className="w-full bg-slate-800 text-white py-2 rounded font-bold hover:bg-slate-900">{t.common.save}</button>
                </form>
            </div>
        </div>
    );
};

interface ConfirmDeleteRecordModalProps { isOpen: boolean; onClose: () => void; onConfirm: () => void; }

export const ConfirmDeleteRecordModal: React.FC<ConfirmDeleteRecordModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-red-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{t.admin.records.deleteRecord}</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 text-center"><p className="text-gray-700 mb-6">{t.modals.areYouSure}</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-50">{t.common.cancel}</button><button onClick={() => { onConfirm(); onClose(); }} className="flex-1 bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700">{t.common.delete}</button></div></div>
            </div>
        </div>
    );
};

interface ConfirmDeleteAllRecordsModalProps { isOpen: boolean; onClose: () => void; onConfirm: () => void; }

export const ConfirmDeleteAllRecordsModal: React.FC<ConfirmDeleteAllRecordsModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-red-900 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><AlertTriangle size={18}/> {t.admin.records.deleteAll}</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 text-center"><p className="text-red-800 font-bold mb-2">{t.modals.deleteAllRecordsMsg}</p><p className="text-gray-600 text-sm mb-6">{t.modals.areYouSure}</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-50">{t.common.cancel}</button><button onClick={() => { onConfirm(); onClose(); }} className="flex-1 bg-red-900 text-white py-2 rounded font-bold hover:bg-red-950">{t.common.delete}</button></div></div>
            </div>
        </div>
    );
};

interface ConfirmMultiBanModalProps { isOpen: boolean; onClose: () => void; count: number; onConfirm: (action: 'ban' | 'unban') => void; }

export const ConfirmMultiBanModal: React.FC<ConfirmMultiBanModalProps> = ({ isOpen, onClose, count, onConfirm }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{t.common.action}</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 text-center">
                    <p className="text-gray-700 mb-6">Selected Users: <strong>{count}</strong></p>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => { onConfirm('ban'); onClose(); }} className="w-full bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700">{t.modals.multiBan}</button>
                        <button onClick={() => { onConfirm('unban'); onClose(); }} className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700">{t.modals.multiUnban}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ManageSuperAdminModalProps { isOpen: boolean; onClose: () => void; count: number; onConfirm: () => void; actionType: 'grant' | 'revoke'; }

export const ManageSuperAdminModal: React.FC<ManageSuperAdminModalProps> = ({ isOpen, onClose, count, onConfirm, actionType }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    const isGrant = actionType === 'grant';
    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className={`text-white p-4 flex justify-between items-center ${isGrant ? 'bg-purple-600' : 'bg-slate-600'}`}>
                    <h3 className="font-bold flex items-center gap-2"><ShieldAlert size={18}/> {isGrant ? 'Grant Privilege' : 'Revoke Privilege'}</h3>
                    <button onClick={onClose}><X size={20}/></button>
                </div>
                <div className="p-6 text-center">
                    <p className="text-gray-700 mb-6">
                        {isGrant 
                            ? `Grant Super Admin privileges to ${count} users? This allows them to toggle Super Admin Mode.` 
                            : `Revoke Super Admin privileges from ${count} users?`}
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-50">{t.common.cancel}</button>
                        <button onClick={() => { onConfirm(); onClose(); }} className={`flex-1 text-white py-2 rounded font-bold ${isGrant ? 'bg-purple-600 hover:bg-purple-700' : 'bg-slate-600 hover:bg-slate-700'}`}>{t.common.confirm}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ConfirmPostModalProps { isOpen: boolean; onClose: () => void; onConfirm: () => void; }

export const ConfirmPostModal: React.FC<ConfirmPostModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-brand-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{t.community.confirmPost}</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 text-center"><p className="text-gray-700 mb-6">{t.community.confirmPostMsg}</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-50">{t.common.cancel}</button><button onClick={() => { onConfirm(); onClose(); }} className="flex-1 bg-brand-600 text-white py-2 rounded font-bold hover:bg-brand-700">{t.common.confirm}</button></div></div>
            </div>
        </div>
    );
};

interface ConfirmClearBroadcastsModalProps { isOpen: boolean; onClose: () => void; onConfirm: () => void; }

export const ConfirmClearBroadcastsModal: React.FC<ConfirmClearBroadcastsModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-red-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Trash2 size={18}/> {t.modals.clearBroadcasts}</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-6 text-center"><p className="text-gray-700 mb-6">{t.modals.clearBroadcastsMsg}</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-50">{t.common.cancel}</button><button onClick={() => { onConfirm(); onClose(); }} className="flex-1 bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700">{t.common.delete}</button></div></div>
            </div>
        </div>
    );
};

interface AIModerationModalProps { isOpen: boolean; onClose: () => void; reason: string; }

export const AIModerationModal: React.FC<AIModerationModalProps> = ({ isOpen, onClose, reason }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-red-100">
                <div className="bg-red-50 p-6 flex flex-col items-center text-center border-b border-red-100">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 shadow-sm">
                        <ShieldAlert size={32} />
                    </div>
                    <h3 className="font-bold text-xl text-red-900">Content Flagged</h3>
                    <p className="text-red-600/80 text-sm mt-1 font-medium">AI Safety Check</p>
                </div>
                <div className="p-6">
                    <p className="text-slate-600 text-sm mb-3 font-medium text-center">
                        Your content was flagged by our AI moderation system and cannot be published.
                    </p>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-800 text-sm mb-6 shadow-inner text-center italic">
                        "{reason}"
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 active:scale-[0.98]"
                    >
                        Understood
                    </button>
                </div>
            </div>
        </div>
    );
};
