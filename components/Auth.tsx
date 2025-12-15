
import React, { useState } from 'react';
import { User, Teacher } from '../types';
import { ADMIN_ID, DEFAULT_PASSWORD, SUPER_ADMIN_ID_2 } from '../constants';
import { db } from '../services/db';
import { audit } from '../services/audit';
import { GraduationCap, BookOpen, AlertCircle, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { ForcePasswordChangeModal } from './AdminModals';
import { useLanguage } from '../LanguageContext';

interface AuthProps {
  onLogin: (user: User, remember: boolean) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  
  // Form States
  const [isRegister, setIsRegister] = useState(false);
  const [id, setId] = useState(''); 
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false); 
  
  const [forcePassUser, setForcePassUser] = useState<User | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!acknowledged) {
        setError(t.common.required);
        setLoading(false);
        return;
    }

    let key = '';
    let role = '';

    if (activeTab === 'student') {
        key = `basis_user_${id}`;
        role = id === ADMIN_ID ? 'admin' : 'student';
    } else {
        key = `basis_user_${id.toLowerCase()}`;
        role = 'teacher';
    }
    
    try {
        if (isRegister) {
          const existing = await db.getItem<User>(key);
          if (existing) {
            setError(t.auth.errorExists);
            setLoading(false);
            return;
          }

          if (activeTab === 'teacher') {
              const savedTeachers = await db.getItem<Teacher[]>('basis_teachers');
              const teachers = savedTeachers || [];
              const matchedTeacher = teachers.find(t => t.email.toLowerCase() === id.toLowerCase());
              
              if (!matchedTeacher) {
                  setError(t.auth.errorEmail);
                  setLoading(false);
                  return;
              }
              
              if (matchedTeacher.name.trim().toLowerCase() !== name.trim().toLowerCase()) {
                  setError(`${t.auth.errorName} (${matchedTeacher.name}).`);
                  setLoading(false);
                  return;
              }
          }

          const newUser: User = {
            id: activeTab === 'teacher' ? id.toLowerCase() : id,
            password, 
            name,
            role: role as any,
            email: activeTab === 'teacher' ? id.toLowerCase() : undefined,
            isBanned: false,
            isCommunicationBanned: activeTab === 'student', // Students banned by default per requirement
            isApproved: activeTab === 'teacher' ? false : true
          };
          
          await db.setItem(key, newUser);
          if (activeTab === 'teacher') {
            setPendingApproval(true);
          } else {
            audit.logAction(newUser, 'LOGIN');
            onLogin(newUser, remember);
          }

        } else {
          const user = await db.getItem<User>(key);
          if (!user) {
            setError(t.auth.errorUserNotFound);
            setLoading(false);
            return;
          }
          
          if (user.isBanned) {
              setError(t.auth.errorBanned);
              setLoading(false);
              return;
          }

          if (user.role === 'teacher' && user.isApproved === false) {
              setError(t.auth.errorPending);
              setLoading(false);
              return;
          }

          if (user.password !== password) {
            setError(t.auth.errorPass);
            setLoading(false);
            return;
          }

          const teachers = await db.getItem<Teacher[]>('basis_teachers') || [];
          const isTeacher = user.role === 'teacher' || teachers.some(t => t.id === user.id || t.email.toLowerCase() === user.id.toLowerCase());

          if (isTeacher && user.password === DEFAULT_PASSWORD) {
              setForcePassUser(user); 
              setLoading(false);
              return; 
          }
          
          audit.logAction(user, 'LOGIN');
          onLogin(user, remember);
        }
    } catch (err) {
        console.error(err);
        setError("Network error.");
    } finally {
        setLoading(false);
    }
  };

  const handleForcePassSave = async (newPass: string) => {
      if (!forcePassUser) return;
      setLoading(true);
      try {
          const updatedUser = { ...forcePassUser, password: newPass };
          const key = `basis_user_${updatedUser.id}`;
          await db.setItem(key, updatedUser);
          setForcePassUser(null);
          audit.logAction(updatedUser, 'CHANGE_PASSWORD', undefined, undefined, 'Forced password change on login');
          onLogin(updatedUser, remember);
      } catch (err) {
          console.error(err);
          setError("Failed to update password.");
      } finally {
          setLoading(false);
      }
  };

  const handleSync = async () => {
      setSyncing(true);
      setError('');
      try {
          // Changed to pullCloudData to refresh local state from server truth
          const count = await db.pullCloudData();
          alert(`${t.auth.syncSuccess} (Updated ${count} items from Cloud)`);
      } catch (e) {
          console.error(e);
          setError("Sync failed.");
      } finally {
          setSyncing(false);
      }
  };

  if (pendingApproval) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden p-8 md:p-10 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 mx-auto">
                      <CheckCircle2 size={32}/>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">{t.auth.regSuccessTitle}</h2>
                  <p className="text-slate-500 mb-6 text-sm">{t.auth.regSuccessMsg}</p>
                  <button onClick={() => { setPendingApproval(false); setIsRegister(false); }} className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-700">{t.auth.backLogin}</button>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <ForcePasswordChangeModal 
          isOpen={!!forcePassUser} 
          user={forcePassUser} 
          onSave={handleForcePassSave} 
      />

      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden">
        
        <div className="text-center pt-8 md:pt-10 pb-4 md:pb-6 px-6 md:px-8">
            <div className="w-12 h-12 bg-brand-600 rounded-xl mx-auto flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg shadow-brand-500/30">O</div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{t.auth.title}</h1>
            <p className="text-slate-500 text-sm mt-2">{t.auth.subtitle}</p>
        </div>

        <div className="flex border-b border-slate-100">
            <button 
                onClick={() => { setActiveTab('student'); setIsRegister(false); setError(''); setId(''); setPassword(''); }}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'student' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <GraduationCap size={18} /> {t.auth.studentLogin}
            </button>
            <button 
                onClick={() => { setActiveTab('teacher'); setIsRegister(false); setError(''); setId(''); setPassword(''); }}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'teacher' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <BookOpen size={18} /> {t.auth.teacherLogin}
            </button>
        </div>

        <div className="p-6 md:p-10">
            <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
                <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {activeTab === 'teacher' ? `${t.auth.fullName} (${t.auth.teacherNameHint})` : t.auth.fullName}
                </label>
                <input 
                    type="text" 
                    required 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    placeholder={activeTab === 'teacher' ? "Registered Name" : "John Doe"}
                />
                </div>
            )}
            
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {activeTab === 'student' ? t.auth.studentId : t.auth.emailInput}
                </label>
                <input 
                type={activeTab === 'student' ? "text" : "email"}
                required 
                value={id} 
                onChange={e => setId(e.target.value)} 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono transition-all text-sm"
                placeholder={activeTab === 'student' ? "e.g. 14548" : "name@basischina.com"}
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.common.password}</label>
                <input 
                type="password" 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                placeholder={t.auth.passwordPlaceholder}
                />
            </div>

            <div className="flex items-center gap-2">
                <input 
                    type="checkbox" 
                    id="remember" 
                    checked={remember} 
                    onChange={e => setRemember(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 border-slate-300"
                />
                <label htmlFor="remember" className="text-sm text-slate-600 font-medium">{t.auth.rememberMe}</label>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <input 
                    type="checkbox" 
                    id="acknowledge" 
                    checked={acknowledged} 
                    onChange={e => setAcknowledged(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 border-slate-300 mt-1"
                />
                <label htmlFor="acknowledge" className="text-xs text-slate-600 italic leading-relaxed cursor-pointer select-none">
                    {t.auth.disclaimer}
                </label>
            </div>

            {error && (
                <div className="text-red-600 text-xs text-center font-bold bg-red-50 p-3 rounded-lg border border-red-100 flex items-center justify-center gap-2">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            <button 
                type="submit"
                disabled={!acknowledged || loading}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-brand-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {loading && <Loader2 className="animate-spin" size={18} />}
                {isRegister ? t.auth.createAccount : t.auth.signIn}
            </button>
            </form>

            <div className="mt-8 text-center pt-6 border-t border-slate-100">
                <button 
                    onClick={() => setIsRegister(!isRegister)}
                    className="text-sm text-slate-500 hover:text-brand-600 font-medium transition-colors mb-4"
                >
                    {isRegister ? t.auth.alreadyHave : t.auth.firstTime}
                </button>
                
                <button 
                    onClick={handleSync}
                    disabled={syncing}
                    className="w-full text-xs text-brand-600 font-bold flex items-center justify-center gap-2 py-2 hover:bg-brand-50 rounded-lg transition-colors"
                >
                    {syncing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                    {t.auth.sync}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
