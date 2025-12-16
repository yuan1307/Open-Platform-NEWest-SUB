
import * as React from 'react';
import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import { AdminDashboard } from './components/AdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import ClassModal from './components/ClassModal';
import ToDoPage from './components/ToDoPage';
import CommunityPage from './components/CommunityPage';
import GPACalculator from './components/GPACalculator';
import ContactUs from './components/ContactUs';
import AssessmentCalendar from './components/AssessmentCalendar';
import ResetPasswordModal from './components/ResetPasswordModal';
import ScheduleGrid from './components/ScheduleGrid';
import AIImportModal from './components/AIImportModal';
import StudentAIHub from './components/StudentAIHub';
import { User, ClassPeriod, AppState, Teacher, Warning, Broadcast, FeatureFlags, CommunityPost, AssessmentEvent, ScheduleMap } from './types';
import { WEEKDAYS, DEFAULT_TEACHERS, DEFAULT_SUBJECTS, ADMIN_ID, DEFAULT_FLAGS, SUPER_ADMIN_ID_2, LANGUAGES } from './constants';
import { db } from './services/db';
import { LogOut, Calculator, ShieldCheck, CheckSquare, CalendarDays, KeyRound, Eye, MessageSquare, AlertTriangle, GraduationCap, Radio, Loader2, Wifi, WifiOff, Calendar, Globe, RefreshCw, Menu, X, Download, Sparkles } from 'lucide-react';
import { useLanguage } from './LanguageContext';

const App: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [state, setState] = useState<AppState>({
    user: null,
    schedule: {},
    grades: [],
    view: 'student' // Default to student (schedule) view
  });

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [resetPassModalOpen, setResetPassModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<{day: string, slot: number} | null>(null);
  const [activeWarning, setActiveWarning] = useState<Warning | null>(null);
  const [activeBroadcast, setActiveBroadcast] = useState<Broadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [adminNotificationCount, setAdminNotificationCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [studentAIHubOpen, setStudentAIHubOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        const connected = await db.checkConnection();
        setIsConnected(connected);

        // On load, we generally PULL from cloud if possible, or assume existing state.
        
        let savedTeachers = await db.getItem<Teacher[]>('basis_teachers');
        if (!savedTeachers) {
            await db.setItem('basis_teachers', DEFAULT_TEACHERS);
            savedTeachers = DEFAULT_TEACHERS;
        }
        setTeachers(savedTeachers);

        let savedSubjects = await db.getItem<string[]>('basis_subjects');
        if (!savedSubjects) {
            await db.setItem('basis_subjects', DEFAULT_SUBJECTS);
            savedSubjects = DEFAULT_SUBJECTS;
        }
        setSubjects(savedSubjects);
        
        const savedFlags = await db.getItem<FeatureFlags>('basis_feature_flags');
        if (savedFlags) setFlags(savedFlags);
        else await db.setItem('basis_feature_flags', DEFAULT_FLAGS);

        const rememberedId = localStorage.getItem('basis_remembered_uid');
        if (rememberedId) {
            const stored = await db.getItem<User>(`basis_user_${rememberedId}`);
            if (stored) {
                await loadUserData(stored);
                setLoading(false);
                return;
            }
        }

        const sessionUser = sessionStorage.getItem('basis_current_user');
        if (sessionUser) {
            const user = JSON.parse(sessionUser);
            await loadUserData(user);
        }
        setLoading(false);
    };
    init();
  }, []);

  // Poll for notifications and pending items
  useEffect(() => {
      const poll = async () => {
          if (!state.user || !isConnected) return;

          // User Warnings/Broadcasts
          const freshUser = await db.getItem<User>(`basis_user_${state.user?.id}`);
          if (freshUser) {
              const unackWarning = freshUser.warnings?.find((w: Warning) => !w.acknowledged);
              if (unackWarning && (!activeWarning || activeWarning.id !== unackWarning.id)) {
                  setActiveWarning(unackWarning);
              }
              if (!activeWarning && !unackWarning) {
                  const unackBroadcast = freshUser.broadcasts?.find((b: Broadcast) => !b.acknowledged);
                  if (unackBroadcast && (!activeBroadcast || activeBroadcast.id !== unackBroadcast.id)) {
                      setActiveBroadcast(unackBroadcast);
                  }
              }
          }

          // Admin Notifications (Pending Posts/Assessments)
          if (state.user.role === 'admin' || state.user.role === 'secondary_admin') {
              const posts = await db.getItem<CommunityPost[]>('basis_community_posts') || [];
              const pendingPosts = posts.filter(p => p.status === 'pending').length;
              
              const events = await db.getItem<AssessmentEvent[]>('basis_assessment_events') || [];
              const pendingEvents = events.filter(e => e.status === 'pending').length;
              
              setAdminNotificationCount(pendingPosts + pendingEvents);
          }
      };

      const interval = setInterval(poll, 10000);
      return () => clearInterval(interval);
  }, [state.user, isConnected, activeWarning, activeBroadcast]);

  const loadUserData = async (user: User) => {
      const currentUser = await db.getItem<User>(`basis_user_${user.id}`) || user;

      if (currentUser.isBanned) {
          handleLogout();
          return;
      }

      if (currentUser.warnings) {
          const unack = currentUser.warnings.find((w: Warning) => !w.acknowledged);
          if (unack) setActiveWarning(unack);
      }

      if (currentUser.broadcasts) {
          const unackBroadcast = currentUser.broadcasts.find((b: Broadcast) => !b.acknowledged);
          if (!activeWarning && unackBroadcast) setActiveBroadcast(unackBroadcast);
      }

      const scheduleKey = `basis_schedule_${currentUser.id}`;
      const savedSchedule = await db.getItem<any>(scheduleKey);
      
      const teachersList = await db.getItem<Teacher[]>('basis_teachers') || [];
      const isRegisteredTeacher = teachersList.some(t => t.email.toLowerCase() === currentUser.id.toLowerCase() || t.id === currentUser.id);
      
      const shouldUseTeacherView = currentUser.role === 'teacher' || isRegisteredTeacher;
      const isSuperAdmin2 = currentUser.id === SUPER_ADMIN_ID_2;

      setState(prev => ({
          ...prev,
          user: currentUser,
          schedule: savedSchedule || {},
          view: isSuperAdmin2 ? 'admin' : (shouldUseTeacherView ? 'teacher_dashboard' : 'student'),
          spectatingUserId: undefined,
          impersonatedUser: undefined
      }));
  };

  const handleLogin = async (user: User, remember: boolean) => {
    sessionStorage.setItem('basis_current_user', JSON.stringify(user));
    if (remember) {
        localStorage.setItem('basis_remembered_uid', user.id);
    }
    await loadUserData(user);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('basis_current_user');
    localStorage.removeItem('basis_remembered_uid');
    setState(prev => ({ ...prev, user: null, schedule: {}, impersonatedUser: undefined }));
    setActiveWarning(null);
    setActiveBroadcast(null);
  };

  const handleHeaderSync = async () => {
      if (!isConnected) {
          alert("Must be connected to internet to sync.");
          return;
      }
      setIsSyncing(true);
      try {
          // Changed to pullCloudData to refresh local state from server truth
          const count = await db.pullCloudData();
          alert(`${t.auth.syncSuccess} (Downloaded ${count} items from Cloud)`);
          window.location.reload(); // Reload to reflect changes immediately
      } catch (error) {
          console.error(error);
          alert("Sync failed.");
      } finally {
          setIsSyncing(false);
      }
  };

  const acknowledgeWarning = async () => {
      if (!state.user || !activeWarning) return;
      const updatedWarnings = state.user.warnings?.map(w => w.id === activeWarning.id ? { ...w, acknowledged: true, acknowledgedDate: new Date().toISOString() } : w);
      const updatedUser = { ...state.user, warnings: updatedWarnings };
      await db.setItem(`basis_user_${state.user.id}`, updatedUser);
      sessionStorage.setItem('basis_current_user', JSON.stringify(updatedUser));
      setState(prev => ({ ...prev, user: updatedUser }));
      setActiveWarning(null);
      const nextWarning = updatedWarnings?.find(w => !w.acknowledged);
      if (nextWarning) setActiveWarning(nextWarning);
      else {
          if (updatedUser.broadcasts) {
              const nextBroadcast = updatedUser.broadcasts.find((b: Broadcast) => !b.acknowledged);
              if (nextBroadcast) setActiveBroadcast(nextBroadcast);
          }
      }
  };

  const acknowledgeBroadcast = async () => {
      if (!state.user || !activeBroadcast) return;
      const updatedBroadcasts = state.user.broadcasts?.map(b => b.id === activeBroadcast.id ? { ...b, acknowledged: true, acknowledgedDate: new Date().toISOString() } : b);
      const updatedUser = { ...state.user, broadcasts: updatedBroadcasts };
      await db.setItem(`basis_user_${state.user.id}`, updatedUser);
      sessionStorage.setItem('basis_current_user', JSON.stringify(updatedUser));
      setState(prev => ({ ...prev, user: updatedUser }));
      setActiveBroadcast(null);
      const nextBroadcast = updatedBroadcasts?.find(b => !b.acknowledged);
      if (nextBroadcast) setActiveBroadcast(nextBroadcast);
  };

  const handleResetPassword = async (oldPass: string, newPass: string) => {
      if (!state.user) return;
      const freshUser = await db.getItem<User>(`basis_user_${state.user.id}`);
      if (!freshUser || freshUser.password !== oldPass) { alert("Incorrect old password."); return; }
      const updatedUser = { ...freshUser, password: newPass };
      await db.setItem(`basis_user_${state.user.id}`, updatedUser);
      sessionStorage.setItem('basis_current_user', JSON.stringify(updatedUser));
      setState(prev => ({ ...prev, user: updatedUser }));
      setResetPassModalOpen(false);
      alert("Password updated successfully.");
  };

  const updateSchedule = async (period: ClassPeriod) => {
    const updatedSchedule = { ...state.schedule };
    
    // Update the specific period
    updatedSchedule[period.id] = period;

    // Propagate Teacher Name and Room to all other periods with the SAME SUBJECT
    if (period.subject) {
        Object.keys(updatedSchedule).forEach(key => {
            const p = updatedSchedule[key];
            // Check for exact subject match to propagate details
            if (p.subject === period.subject) {
                updatedSchedule[key] = { 
                    ...p, 
                    teacherName: period.teacherName, // Sync teacher name
                    teacherId: period.teacherId,     // Sync teacher ID
                    room: period.room,               // Sync room
                    tasks: period.tasks              // Sync tasks (ensure consistency)
                };
            }
        });
    }

    const targetUserId = state.impersonatedUser?.id || state.spectatingUserId || state.user?.id;
    if (targetUserId) {
        await db.setItem(`basis_schedule_${targetUserId}`, updatedSchedule);
        setState(prev => ({ ...prev, schedule: updatedSchedule }));
    }
    setModalOpen(false);
  };
  
  const handleBulkScheduleUpdate = async (newSchedule: ScheduleMap) => {
      const mergedSchedule = { ...state.schedule };
      
      Object.keys(newSchedule).forEach(key => {
          const newItem = newSchedule[key];
          const existing = mergedSchedule[key] || { id: key, tasks: [] };

          if (newItem.subject) {
             mergedSchedule[key] = {
                 ...existing,
                 subject: newItem.subject,
                 teacherName: newItem.teacherName,
                 teacherId: newItem.teacherId,
                 room: newItem.room,
                 // Prioritize tasks from newItem if they exist (e.g. from Add to To Do), otherwise fall back to existing
                 tasks: newItem.tasks !== undefined ? newItem.tasks : (existing.tasks || [])
             };
          } else {
             // If subject is cleared/empty
             mergedSchedule[key] = {
                 ...existing,
                 subject: '',
                 teacherName: undefined,
                 teacherId: undefined,
                 room: undefined,
                 tasks: newItem.tasks !== undefined ? newItem.tasks : (existing.tasks || [])
             };
          }
      });
      
      const targetUserId = state.impersonatedUser?.id || state.spectatingUserId || state.user?.id;
      if (targetUserId) {
          await db.setItem(`basis_schedule_${targetUserId}`, mergedSchedule);
          setState(prev => ({ ...prev, schedule: mergedSchedule }));
      }
  };

  const deleteTask = async (periodId: string, taskId: string) => {
      const period = state.schedule[periodId];
      if (!period) return;
      const newTasks = period.tasks.filter(t => t.id !== taskId);
      const updatedPeriod = { ...period, tasks: newTasks };
      await updateSchedule(updatedPeriod);
  };

  const copyDay = async (fromDay: string) => {
    const targetDay = prompt(t.schedule.copyPrompt.replace('{day}', fromDay));
    if (!targetDay || !WEEKDAYS.includes(targetDay)) return;
    const newSchedule = { ...state.schedule };
    for (let i = 0; i < 8; i++) {
        const srcId = `${fromDay}-${i}`;
        const destId = `${targetDay}-${i}`;
        const srcPeriod = newSchedule[srcId];
        if (srcPeriod) { newSchedule[destId] = { ...srcPeriod, id: destId, tasks: [] }; }
    }
    const targetUserId = state.impersonatedUser?.id || state.spectatingUserId || state.user?.id;
    if (targetUserId) {
        await db.setItem(`basis_schedule_${targetUserId}`, newSchedule);
        setState(prev => ({ ...prev, schedule: newSchedule }));
    }
  };

  const handleAddTeacher = async (t: Teacher, createAccount: boolean) => {
      const newTeachers = [...teachers, t];
      setTeachers(newTeachers);
      await db.setItem('basis_teachers', newTeachers);
      if (createAccount) {
          const userKey = `basis_user_${t.email.toLowerCase()}`;
          const existing = await db.getItem(userKey);
          if (!existing) {
              const newUser: User = {
                  id: t.email.toLowerCase(),
                  name: t.name,
                  email: t.email.toLowerCase(),
                  role: 'teacher',
                  password: DEFAULT_FLAGS ? 'BASIS2025!' : 'password123',
                  isApproved: true,
                  isBanned: false
              };
              await db.setItem(userKey, newUser);
          }
      }
  };
  
  const handleDeleteTeacher = async (id: string) => {
      const newTeachers = teachers.filter(t => t.id !== id);
      setTeachers(newTeachers);
      await db.setItem('basis_teachers', newTeachers);
  };

  const handleAddSubject = async (newSubjects: string[]) => {
      // merge and unique
      const merged = Array.from(new Set([...subjects, ...newSubjects]));
      setSubjects(merged);
      await db.setItem('basis_subjects', merged);
  };

  const handleDeleteSubject = async (s: string) => {
      const newSubjects = subjects.filter(sub => sub !== s);
      setSubjects(newSubjects);
      await db.setItem('basis_subjects', newSubjects);
  };

  const handleSpectate = async (userId: string) => {
      const savedSchedule = await db.getItem<any>(`basis_schedule_${userId}`);
      setState(prev => ({ ...prev, view: 'spectate', spectatingUserId: userId, schedule: savedSchedule || {} }));
  };

  const handleImpersonate = async (userId: string) => {
      const targetUser = await db.getItem<User>(`basis_user_${userId}`);
      if (!targetUser) return;
      
      const teachersList = await db.getItem<Teacher[]>('basis_teachers') || [];
      const isTeacher = targetUser.role === 'teacher' || teachersList.some(t => t.email.toLowerCase() === targetUser.id.toLowerCase() || t.id === targetUser.id);
      
      const targetSchedule = await db.getItem<any>(`basis_schedule_${userId}`);

      setState(prev => ({ 
          ...prev, 
          impersonatedUser: targetUser, 
          schedule: targetSchedule || {}, 
          view: isTeacher ? 'teacher_dashboard' : 'student' 
      }));
  };

  const handleStopImpersonation = async () => { 
      if (state.user) {
          const adminSchedule = await db.getItem<any>(`basis_schedule_${state.user.id}`);
          setState(prev => ({ 
              ...prev, 
              impersonatedUser: undefined, 
              view: 'admin',
              schedule: adminSchedule || {} 
          })); 
      } else {
          setState(prev => ({ ...prev, impersonatedUser: undefined, view: 'admin' }));
      }
  };

  const getPeriod = (day: string, slot: number): ClassPeriod => { const id = `${day}-${slot}`; return state.schedule[id] || { id, subject: '', tasks: [] }; };
  
  const WarningModal = () => {
      const [checked, setChecked] = useState(false);
      if (!activeWarning) return null;
      return (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                  <div className="bg-orange-600 text-white p-6 flex flex-col items-center">
                      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3"><AlertTriangle size={40} /></div>
                      <h2 className="text-2xl font-bold">Administrator Message</h2>
                  </div>
                  <div className="p-8">
                      <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6">
                          <p className="text-orange-800 leading-relaxed">{activeWarning.message}</p>
                          <p className="text-xs text-orange-400 mt-4 text-right">{t.common.date}: {activeWarning.date}</p>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="w-5 h-5" />
                          <label onClick={() => setChecked(!checked)} className="text-sm font-bold text-slate-700 cursor-pointer">I have read and understood.</label>
                      </div>
                  </div>
                  <div className="p-6 bg-slate-50 border-t border-slate-200 text-right">
                      <button onClick={acknowledgeWarning} disabled={!checked} className="px-6 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 disabled:opacity-50">{t.common.confirm}</button>
                  </div>
              </div>
          </div>
      );
  };

  const BroadcastModal = () => {
      const [checked, setChecked] = useState(false);
      if (!activeBroadcast) return null;
      return (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                  <div className="bg-brand-600 text-white p-6 flex flex-col items-center">
                      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3"><Radio size={32} /></div>
                      <h2 className="text-2xl font-bold">{t.teacher.newBroadcast}</h2>
                      <p className="text-brand-100 mt-1">{t.common.teacher}: {activeBroadcast.teacherName}</p>
                  </div>
                  <div className="p-8">
                      <div className="bg-brand-50 border-l-4 border-brand-500 p-4 mb-6">
                          <p className="font-bold text-brand-900 text-lg mb-2">{activeBroadcast.title}</p>
                          <p className="text-brand-800 leading-relaxed text-sm">{activeBroadcast.message}</p>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="w-5 h-5" />
                          <label onClick={() => setChecked(!checked)} className="text-sm font-bold text-slate-700 cursor-pointer">I acknowledge.</label>
                      </div>
                  </div>
                  <div className="p-6 bg-slate-50 border-t border-slate-200 text-right">
                      <button onClick={acknowledgeBroadcast} disabled={!checked} className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 disabled:opacity-50">{t.common.confirm}</button>
                  </div>
              </div>
          </div>
      );
  };

  const HeaderLanguageSelector = () => (
    <div className="relative group z-50">
        <button className="text-slate-600 hover:text-brand-600 p-2 rounded hover:bg-slate-100 transition-colors" title="Switch Language">
            <Globe size={20}/>
        </button>
        <div className="absolute right-0 top-full pt-2 hidden group-hover:block min-w-[140px] z-50">
            <div className="bg-white border border-slate-200 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95">
                {LANGUAGES.map(l => (
                    <button key={l.code} onClick={() => setLanguage(l.code as any)} className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${language === l.code ? 'font-bold text-brand-600 bg-brand-50' : 'text-slate-700'}`}>
                        {l.label}
                    </button>
                ))}
            </div>
        </div>
    </div>
  );

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-brand-600" size={48} /></div>;

  if (!state.user) {
    return (
        <>
            <div className="fixed top-4 right-4 z-[110]">
                 <HeaderLanguageSelector />
            </div>
            <Auth onLogin={handleLogin} />
        </>
    );
  }

  const ConnectionStatus = () => (
      <div className={`fixed bottom-4 right-4 z-[100] px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-lg ${isConnected ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
          {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {isConnected ? t.status.cloudConnected : t.status.offline}
      </div>
  );

  const isSuperAdmin2 = state.user.id === SUPER_ADMIN_ID_2;
  const isRegisteredTeacher = teachers.some(t => t.email.toLowerCase() === state.user?.id.toLowerCase() || t.id === state.user?.id);
  const isTeacherLogically = state.user.role === 'teacher' || isRegisteredTeacher;

  const isImpersonating = !!state.impersonatedUser;
  const showAdminView = (state.view === 'admin' || isSuperAdmin2) && !isImpersonating && (state.user.role === 'admin' || state.user.role === 'secondary_admin');

  const ImpersonationBanner = () => {
      if (!state.impersonatedUser) return null;
      return (
          <div className="bg-purple-600 text-white p-2 text-center font-bold text-sm sticky top-0 z-[110]">
              {t.nav.viewing} {state.impersonatedUser.name}. <button onClick={handleStopImpersonation} className="underline ml-2">{t.nav.exit}</button>
          </div>
      );
  };

  const showAITutor = flags.enableAITutor && state.view !== 'admin' && state.view !== 'teacher_dashboard';

  if (showAdminView) {
    return (
      <>
        <ConnectionStatus />
        <AdminDashboard 
            currentUser={state.user}
            onLogout={handleLogout} 
            onSwitchView={() => {
                if (isTeacherLogically) {
                    setState(prev => ({ ...prev, view: 'teacher_dashboard' }));
                } else {
                     setState(prev => ({ ...prev, view: 'student' }));
                }
            }} 
            onSpectate={handleSpectate}
            onImpersonate={handleImpersonate}
            teachers={teachers}
            onAddTeacher={handleAddTeacher}
            onDeleteTeacher={handleDeleteTeacher}
            subjects={subjects}
            onAddSubject={handleAddSubject}
            onDeleteSubject={handleDeleteSubject}
        />
      </>
    );
  }
  
  const showTeacherDashboard = state.view === 'teacher_dashboard' || (isTeacherLogically && !isImpersonating) || (state.impersonatedUser?.role === 'teacher');

  if (showTeacherDashboard) {
    const effectiveUser = state.impersonatedUser || state.user;
    return (
        <>
            <ConnectionStatus />
            <ImpersonationBanner />
            <TeacherDashboard 
                user={effectiveUser} 
                onLogout={state.impersonatedUser ? handleStopImpersonation : handleLogout} 
                onSwitchToCommunity={() => {}}
                onSwitchToAdmin={() => setState(prev => ({ ...prev, view: 'admin' }))} 
            />
        </>
    );
  }

  const isSpectating = state.view === 'spectate';

  const NavButton = ({ view, icon: Icon, label }: { view: AppState['view'], icon: any, label: string }) => (
      <button 
        onClick={() => { setState(p => ({...p, view})); setMobileMenuOpen(false); }} 
        className={`px-4 py-3 md:py-2 rounded-md text-sm font-bold flex items-center gap-3 md:gap-2 w-full md:w-auto ${state.view === view ? 'bg-brand-50 text-brand-600 md:bg-white md:shadow-sm' : 'text-slate-600 md:text-slate-500 hover:bg-slate-50'}`}
      >
          <Icon size={18} /> {label}
      </button>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-slate-900">
      <ConnectionStatus />
      <ImpersonationBanner />
      {activeWarning && <WarningModal />}
      {activeBroadcast && <BroadcastModal />}
      
      {aiImportOpen && (
          <AIImportModal 
             isOpen={aiImportOpen} 
             onClose={() => setAiImportOpen(false)} 
             onSave={handleBulkScheduleUpdate}
             availableTeachers={teachers}
          />
      )}

      {/* Student AI Hub Modal */}
      {showAITutor && (
          <StudentAIHub 
              isOpen={studentAIHubOpen} 
              onClose={() => setStudentAIHubOpen(false)} 
              schedule={state.schedule}
          />
      )}

      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg"><GraduationCap size={20} /></div>
                    <span className="font-bold text-lg md:text-xl tracking-tight text-slate-800 hidden sm:block">OPEN PLATFORM</span>
                </div>
                
                {/* Desktop Nav */}
                <nav className="hidden md:flex bg-slate-100 p-1 rounded-lg gap-1">
                    <button onClick={() => setState(p => ({...p, view: 'todo'}))} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${state.view === 'todo' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}><CheckSquare size={18} /> {t.nav.todo}</button>
                    <button onClick={() => setState(p => ({...p, view: 'student'}))} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${state.view === 'student' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}><CalendarDays size={18} /> {t.nav.schedule}</button>
                    {flags.enableCalendar && <button onClick={() => setState(p => ({...p, view: 'calendar'}))} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${state.view === 'calendar' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}><Calendar size={18} /> {t.nav.calendar}</button>}
                    {flags.enableGPA && <button onClick={() => setState(p => ({...p, view: 'gpa'}))} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${state.view === 'gpa' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}><Calculator size={18} /> {t.nav.gpa}</button>}
                    {flags.enableCommunity && (
                        <button onClick={() => setState(p => ({...p, view: 'community'}))} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${state.view === 'community' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}><MessageSquare size={18} /> {t.nav.community}</button>
                    )}
                </nav>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                {isSpectating && (
                    <div className="hidden md:flex bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold border border-yellow-200 items-center gap-2">
                         <Eye size={12}/> {t.nav.viewing}: {state.spectatingUserId}
                         <button onClick={() => setState(prev => ({ ...prev, view: 'admin', spectatingUserId: undefined }))} className="hover:underline ml-2">{t.nav.exit}</button>
                    </div>
                )}
                
                <div className="hidden md:flex items-center gap-3">
                    {!isSpectating && <button onClick={() => setResetPassModalOpen(true)} className="text-slate-400 hover:text-slate-600 p-2"><KeyRound size={18} /></button>}
                </div>
                
                <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block"></div>
                
                <div className="flex items-center gap-1 md:gap-2">
                    <HeaderLanguageSelector />
                    {!isSpectating && (state.user.role === 'admin' || state.user.role === 'secondary_admin') && (
                        <button onClick={() => setState(prev => ({ ...prev, view: 'admin' }))} className="text-slate-600 hover:text-purple-600 p-2 relative hidden md:block">
                            <ShieldCheck size={20} />
                            {adminNotificationCount > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold">{adminNotificationCount > 9 ? '9+' : adminNotificationCount}</span>}
                        </button>
                    )}
                    
                    <button onClick={handleHeaderSync} disabled={isSyncing} className="text-slate-600 hover:text-brand-600 p-2 flex items-center gap-2 rounded transition-colors disabled:opacity-50">
                        <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
                        <span className="hidden sm:inline text-xs font-bold">{t.nav.sync}</span>
                    </button>

                    <button onClick={handleLogout} className="text-slate-600 hover:text-red-600 p-2 hidden md:block"><LogOut size={20} /></button>
                    
                    {/* Mobile Menu Toggle */}
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
            <div className="md:hidden bg-white border-t border-slate-200 p-4 absolute w-full shadow-lg z-50 animate-in slide-in-from-top-2">
                <div className="flex flex-col gap-1">
                    <NavButton view="todo" icon={CheckSquare} label={t.nav.todo} />
                    <NavButton view="student" icon={CalendarDays} label={t.nav.schedule} />
                    {flags.enableCalendar && <NavButton view="calendar" icon={Calendar} label={t.nav.calendar} />}
                    {flags.enableGPA && <NavButton view="gpa" icon={Calculator} label={t.nav.gpa} />}
                    {flags.enableCommunity && <NavButton view="community" icon={MessageSquare} label={t.nav.community} />}
                    
                    <div className="border-t border-slate-100 my-2 pt-2">
                        {!isSpectating && (state.user.role === 'admin' || state.user.role === 'secondary_admin') && (
                            <button onClick={() => { setState(prev => ({ ...prev, view: 'admin' })); setMobileMenuOpen(false); }} className="px-4 py-3 rounded-md text-sm font-bold flex items-center gap-3 w-full text-purple-600 hover:bg-purple-50">
                                <ShieldCheck size={18} /> {t.nav.adminMode}
                                {adminNotificationCount > 0 && <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{adminNotificationCount}</span>}
                            </button>
                        )}
                        <button onClick={() => setResetPassModalOpen(true)} className="px-4 py-3 rounded-md text-sm font-bold flex items-center gap-3 w-full text-slate-600 hover:bg-slate-50">
                            <KeyRound size={18} /> {t.modals.changePass}
                        </button>
                        <button onClick={handleLogout} className="px-4 py-3 rounded-md text-sm font-bold flex items-center gap-3 w-full text-red-600 hover:bg-red-50">
                            <LogOut size={18} /> {t.nav.logout}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </header>
      
      <main className={`flex-1 overflow-x-hidden bg-slate-50/50 ${activeWarning || activeBroadcast ? 'filter blur-sm pointer-events-none' : ''}`}>
        {state.view === 'todo' && <ToDoPage schedule={state.schedule} onDeleteTask={deleteTask} onUpdateSchedule={handleBulkScheduleUpdate} />}
        {state.view === 'community' && <CommunityPage currentUser={state.user} subjects={subjects} teachers={teachers} />}
        {state.view === 'calendar' && flags.enableCalendar && 
            <AssessmentCalendar 
                currentUser={state.user} 
                schedule={state.schedule} 
                subjects={subjects} 
                teachers={teachers} 
                onScheduleUpdate={handleBulkScheduleUpdate}
            />
        }
        {state.view === 'gpa' && flags.enableGPA && <GPACalculator userId={state.user.id} />}
        {state.view === 'contact_us' && <ContactUs />}
        {(state.view === 'student' || state.view === 'spectate') && (
            <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full">
                <div className="flex justify-end gap-3 mb-4 no-print">
                    {/* Feature Flag Check for AI Import */}
                    {flags.enableAIImport && (
                        <button 
                            onClick={() => setAiImportOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md flex items-center gap-2 transition-all"
                        >
                            <Sparkles size={16} className="text-yellow-300" />
                            {t.schedule.aiImport}
                        </button>
                    )}
                    <button 
                        onClick={handlePrint} 
                        className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-4 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2 transition-all"
                    >
                        <Download size={16} /> {t.nav.exportPdf}
                    </button>
                </div>
                <ScheduleGrid 
                    schedule={state.schedule} 
                    onCellClick={(day, slot) => { setActiveCell({ day, slot }); setModalOpen(true); }}
                    onCopyDay={copyDay}
                />
            </div>
        )}
        
        {/* Student AI Hub FAB - Added at the bottom left */}
        {showAITutor && (
            <button
                onClick={() => setStudentAIHubOpen(true)}
                className="fixed bottom-6 left-6 bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:bg-indigo-700 transition-transform hover:scale-105 z-50 flex items-center gap-2 animate-in fade-in zoom-in"
                title={t.ai.hub}
            >
                <Sparkles size={24} />
                <span className="font-bold hidden md:inline">{t.ai.hub}</span>
            </button>
        )}
      </main>

      {modalOpen && activeCell && (
        <ClassModal
          period={getPeriod(activeCell.day, activeCell.slot)}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={updateSchedule}
          day={activeCell.day}
          slotIndex={activeCell.slot}
          availableTeachers={teachers}
          availableSubjects={subjects}
          currentUserRole={state.user.role}
          currentUserName={state.user.name}
        />
      )}

      {resetPassModalOpen && (
        <ResetPasswordModal 
            isOpen={resetPassModalOpen} 
            onClose={() => setResetPassModalOpen(false)} 
            onSave={handleResetPassword} 
        />
      )}
    </div>
  );
};

export default App;