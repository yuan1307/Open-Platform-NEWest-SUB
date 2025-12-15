
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { User, Teacher, UserRole, CommunityPost, Warning, FeatureFlags, SystemRecord, ActionType, AssessmentEvent, ScheduleMap, GradeCourse } from '../types';
import { db } from '../services/db';
import { audit } from '../services/audit';
import { LayoutDashboard, Trash2, Eye, EyeOff, Search, Plus, Ban, KeyRound, Database, Shield, LogOut, AlertTriangle, CheckCircle2, Inbox, Briefcase, Edit2, Download, Upload, LogIn, Settings, Sliders, ToggleLeft, ToggleRight, Calendar, PlusCircle, Globe, FileText, Filter, X, CheckSquare, Square, ShieldAlert, MessageSquare } from 'lucide-react';
import { AddTeacherModal, AddSubjectModal, ConfirmDeleteModal, SendWarningModal, WarningHistoryModal, EditUserModal, AdminChangePasswordModal, RejectPostModal, ChangeRoleModal, BanUserModal, EditTeacherModal, EditSubjectModal, ConfirmCreateAccountModal, AddRecordModal, EditRecordModal, ConfirmDeleteRecordModal, ConfirmDeleteAllRecordsModal, ConfirmMultiBanModal, ManageSuperAdminModal, ConfirmGenericModal } from './AdminModals';
import { ADMIN_ID, DEFAULT_FLAGS, DEFAULT_PASSWORD, SUPER_ADMIN_ID_2, LANGUAGES } from '../constants';
import { useLanguage } from '../LanguageContext';
import ScheduleGrid from './ScheduleGrid';
import SystemLogs from './admin/SystemLogs';

interface AdminDashboardProps { onLogout: () => void; onSwitchView: () => void; onSpectate: (userId: string) => void; onImpersonate: (userId: string) => void; currentUser: User; teachers: Teacher[]; onAddTeacher: (t: Teacher, createAccount: boolean) => void; onDeleteTeacher: (id: string) => void; subjects: string[]; onAddSubject: (s: string[]) => void; onDeleteSubject: (s: string) => void; }
interface EnrichedUser { user: User; key: string; }

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onSwitchView, onSpectate, onImpersonate, currentUser, teachers, onAddTeacher, onDeleteTeacher, subjects, onAddSubject, onDeleteSubject }) => {
  const { t, language, setLanguage } = useLanguage();
  const [userSearch, setUserSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'moderation' | 'database' | 'management'>('users');
  const [userList, setUserList] = useState<EnrichedUser[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [pendingPosts, setPendingPosts] = useState<CommunityPost[]>([]);
  const [pendingAssessments, setPendingAssessments] = useState<AssessmentEvent[]>([]);
  const [userTypeFilter, setUserTypeFilter] = useState<'student' | 'staff'>('student');
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  
  // Multi-select & System Records State
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [systemRecords, setSystemRecords] = useState<SystemRecord[]>([]);

  // Super Admin Mode State (formerly Illegal Mode)
  const [isSuperAdminMode, setIsSuperAdminMode] = useState(false);
  const [isManageSuperAdminOpen, setIsManageSuperAdminOpen] = useState(false);
  const [superAdminActionType, setSuperAdminActionType] = useState<'grant' | 'revoke'>('grant');

  // Multi-select for Database Tab
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [viewHistoryUser, setViewHistoryUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [rejectingPost, setRejectingPost] = useState<CommunityPost | null>(null);
  const [roleChangeData, setRoleChangeData] = useState<{user: User, key: string, role: UserRole} | null>(null);
  const [banUserData, setBanUserData] = useState<{user: User, key: string} | null>(null);
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void;}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  const [editTeacherData, setEditTeacherData] = useState<Teacher | null>(null);
  const [editSubjectData, setEditSubjectData] = useState<string | null>(null);
  const [createAccountTeacher, setCreateAccountTeacher] = useState<Teacher | null>(null);

  // Bulk Action Modals State
  const [bulkActionModal, setBulkActionModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void; type: 'danger' | 'success'}>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger' });

  // Record Modals
  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [editRecordData, setEditRecordData] = useState<SystemRecord | null>(null);
  const [deleteRecordData, setDeleteRecordData] = useState<SystemRecord | null>(null);
  const [deleteAllRecordsOpen, setDeleteAllRecordsOpen] = useState(false);

  // Student Schedule View (Modal)
  const [viewScheduleUser, setViewScheduleUser] = useState<User | null>(null);
  const [viewScheduleData, setViewScheduleData] = useState<ScheduleMap | null>(null);

  // Password Visibility State (Set of user IDs whose passwords are revealed)
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { refreshUserList(); refreshPendingPosts(); refreshPendingAssessments(); refreshFlags(); refreshRecords(); }, []);
  
  useEffect(() => {
      if (activeTab === 'moderation') {
          refreshPendingAssessments();
          refreshPendingPosts();
      }
  }, [activeTab]);

  useEffect(() => {
    if (viewScheduleUser) {
        db.getItem<ScheduleMap>(`basis_schedule_${viewScheduleUser.id}`).then(s => setViewScheduleData(s || {}));
    } else {
        setViewScheduleData(null);
    }
  }, [viewScheduleUser]);

  const refreshUserList = async () => { const results = await db.scan<User>('basis_user_'); const enriched = results.map(r => ({ user: r.value, key: r.key })); enriched.sort((a,b) => a.user.id.localeCompare(b.user.id)); setUserList(enriched); };
  const refreshPendingPosts = async () => { const posts = await db.getItem<CommunityPost[]>('basis_community_posts'); if (posts) setPendingPosts(posts.filter(p => p.status === 'pending')); };
  const refreshPendingAssessments = async () => { const events = await db.getItem<AssessmentEvent[]>('basis_assessment_events'); if (events) setPendingAssessments(events.filter(e => e.status === 'pending')); };
  const refreshFlags = async () => { 
      const flags = await db.getItem<FeatureFlags>('basis_feature_flags'); 
      setFeatureFlags({ ...DEFAULT_FLAGS, ...flags }); 
  };
  const refreshRecords = async () => { const records = await audit.getRecords(); setSystemRecords(records.sort((a, b) => b.timestamp - a.timestamp)); }; 

  const handlePostAction = async (post: CommunityPost, action: 'approved' | 'rejected', reason?: string) => {
      const posts = await db.getItem<CommunityPost[]>('basis_community_posts') || [];
      const updated = posts.map(p => p.id === post.id ? { ...p, status: action, rejectionReason: reason } : p);
      await db.setItem('basis_community_posts', updated);
      await audit.logAction(currentUser, action === 'approved' ? 'APPROVE_POST' : 'REJECT_POST', undefined, undefined, `${post.title} (${post.authorName})`);
      refreshPendingPosts();
  };

  const handleAssessmentAction = async (event: AssessmentEvent, action: 'approved' | 'rejected') => {
      const events = await db.getItem<AssessmentEvent[]>('basis_assessment_events') || [];
      const updatedEvents = events.map(e => e.id === event.id ? { ...e, status: action === 'approved' ? 'approved' : 'rejected' } : e);
      if (action === 'rejected') {
          await db.setItem('basis_assessment_events', updatedEvents.filter(e => e.id !== event.id));
      } else {
          await db.setItem('basis_assessment_events', updatedEvents);
          // Requirement: Log Actor as Requestor
          const requestor: User = { id: event.creatorId, name: event.creatorName, role: 'student' }; 
          const logType = event.eventType === 'school' ? 'EDIT_EVENT_CALENDAR' : 'EDIT_ASSESSMENT_CALENDAR';
          await audit.logAction(requestor, logType, undefined, undefined, `${event.title} (Approved by ${currentUser.name})`);
      }
      refreshPendingAssessments();
  };

  const toggleFlag = async (key: keyof FeatureFlags) => {
      const newFlags = { ...featureFlags, [key]: !featureFlags[key] };
      setFeatureFlags(newFlags);
      await db.setItem('basis_feature_flags', newFlags);
      
      if (key === 'autoApprovePosts' || key === 'autoApproveRequests' || key === 'enableAIContentCheck') {
          await audit.logAction(currentUser, 'FEATURE_TOGGLE', undefined, undefined, `${key} -> ${newFlags[key]}`);
      }
  };

  // ... [Other handler functions: handleExport, handleImport, etc. - kept identical] ...
  const handleExport = async () => {
      const data = await db.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `basis_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          if(!window.confirm(t.admin.importWarn)) return;
          const reader = new FileReader();
          reader.onload = async (ev) => {
              try {
                  const data = JSON.parse(ev.target?.result as string);
                  await db.importAll(data);
                  alert("Import Successful. Reloading...");
                  window.location.reload();
              } catch (err) { alert("Import Failed: Invalid JSON"); }
          };
          reader.readAsText(e.target.files[0]);
      }
  };

  const handleSendWarnings = async (userIds: string[], message: string) => {
      const date = new Date().toISOString().split('T')[0];
      for (const uid of userIds) {
          const userKey = `basis_user_${uid}`;
          const latestUser = await db.getItem<User>(userKey);
          if (latestUser) {
              const newWarning: Warning = { id: Date.now().toString() + Math.random(), message, date, acknowledged: false };
              const updatedUser = { ...latestUser, warnings: [...(latestUser.warnings || []), newWarning] };
              await db.setItem(userKey, updatedUser);
          }
      }
      await audit.logAction(currentUser, 'SEND_WARNING', undefined, undefined, `Sent to ${userIds.length} users: ${message}`);
      alert(`${t.admin.warningsSent}: ${userIds.length}`);
      refreshUserList();
  };

  const handleCreateTeacherAccount = async (teacher: Teacher) => {
      const userKey = `basis_user_${teacher.email.toLowerCase()}`;
      const existing = await db.getItem(userKey);
      if (existing) { alert("Account already exists."); return; }
      
      const newUser: User = { id: teacher.email.toLowerCase(), name: teacher.name, email: teacher.email.toLowerCase(), role: 'teacher', password: DEFAULT_PASSWORD, isApproved: true, isBanned: false };
      await db.setItem(userKey, newUser);
      await audit.logAction(currentUser, 'CREATE_TEACHER_ACC', newUser.id, newUser.name);
      alert(`Account created for ${teacher.name}`);
      refreshUserList();
  };

  const handleBulkCreateTeacherAccounts = async () => {
      let count = 0;
      for (const id of selectedTeacherIds) {
          const teacher = teachers.find(t => t.id === id);
          if (teacher) {
              const userKey = `basis_user_${teacher.email.toLowerCase()}`;
              const existing = await db.getItem(userKey);
              if (!existing) {
                  const newUser: User = { id: teacher.email.toLowerCase(), name: teacher.name, email: teacher.email.toLowerCase(), role: 'teacher', password: DEFAULT_PASSWORD, isApproved: true, isBanned: false };
                  await db.setItem(userKey, newUser);
                  count++;
              }
          }
      }
      if (count > 0) {
          await audit.logAction(currentUser, 'CREATE_TEACHER_ACC', undefined, undefined, `Bulk created ${count} accounts`);
          alert(`Created ${count} accounts.`);
          setSelectedTeacherIds([]);
          refreshUserList();
      }
  };

  const confirmBulkCreateAccounts = () => {
      setBulkActionModal({
          isOpen: true,
          title: "Bulk Create Accounts",
          message: `Create accounts for ${selectedTeacherIds.length} selected teachers?`,
          onConfirm: handleBulkCreateTeacherAccounts,
          type: 'success'
      });
  };

  const handleBulkDeleteTeachers = async () => {
      const newTeachers = teachers.filter(t => !selectedTeacherIds.includes(t.id));
      await db.setItem('basis_teachers', newTeachers);
      await audit.logAction(currentUser, 'EDIT_TEACHER_DATABASE', undefined, undefined, `Bulk deleted ${selectedTeacherIds.length} teachers`);
      setSelectedTeacherIds([]);
      window.location.reload();
  };

  const confirmBulkDeleteTeachers = () => {
      setBulkActionModal({
          isOpen: true,
          title: "Bulk Delete Teachers",
          message: `Are you sure you want to delete ${selectedTeacherIds.length} teachers from the database?`,
          onConfirm: handleBulkDeleteTeachers,
          type: 'danger'
      });
  };

  const handleBulkDeleteSubjects = async () => {
      if(!window.confirm(`Delete ${selectedSubjects.length} subjects?`)) return;
      const newSubjects = subjects.filter(s => !selectedSubjects.includes(s));
      await db.setItem('basis_subjects', newSubjects);
      await audit.logAction(currentUser, 'EDIT_SUBJECT_DATABASE', undefined, undefined, `Bulk deleted ${selectedSubjects.length} subjects`);
      setSelectedSubjects([]);
      window.location.reload();
  };

  const handleBulkDeleteStaff = async () => {
      for (const uid of selectedUserIds) {
          await handleFullDeleteUser(uid);
      }
      setSelectedUserIds([]);
  };

  const confirmBulkDeleteStaff = () => {
      setBulkActionModal({
          isOpen: true,
          title: "Bulk Delete Staff Accounts",
          message: `WARNING: You are about to delete ${selectedUserIds.length} accounts. This will wipe all data for these users. Are you sure?`,
          onConfirm: handleBulkDeleteStaff,
          type: 'danger'
      });
  };

  const handleDeleteAllRecords = async () => { await audit.clearAllRecords(); refreshRecords(); };
  const handleSaveRecord = async (record: SystemRecord) => { const current = await audit.getRecords(); if (editRecordData) { await audit.saveRecords(current.map(r => r.id === record.id ? record : r)); } else { await audit.saveRecords([record, ...current]); } refreshRecords(); };
  const handleDeleteRecord = async () => { if (deleteRecordData) { const current = await audit.getRecords(); await audit.saveRecords(current.filter(r => r.id !== deleteRecordData.id)); setDeleteRecordData(null); refreshRecords(); } };

  const handleSubjectRename = async (oldName: string, newName: string) => {
      const newSubjects = subjects.map(s => s === oldName ? newName : s);
      await db.setItem('basis_subjects', newSubjects);
      
      const allSchedules = await db.scan<ScheduleMap>('basis_schedule_');
      for (const { key, value: schedule } of allSchedules) {
          let updated = false;
          const newSchedule = { ...schedule };
          Object.keys(newSchedule).forEach(k => {
              if (newSchedule[k].subject === oldName) {
                  newSchedule[k].subject = newName;
                  newSchedule[k].tasks = newSchedule[k].tasks.map(t => t.subject === oldName ? { ...t, subject: newName } : t);
                  updated = true;
              }
          });
          if (updated) await db.setItem(key, newSchedule);
      }
      
      const events = await db.getItem<AssessmentEvent[]>('basis_assessment_events') || [];
      let eventsChanged = false;
      const updatedEvents = events.map(e => {
          if (e.subject === oldName) {
              eventsChanged = true;
              return { ...e, subject: newName };
          }
          return e;
      });
      if (eventsChanged) {
          await db.setItem('basis_assessment_events', updatedEvents);
      }

      const allGrades = await db.scan<GradeCourse[]>('basis_grades_');
      for (const { key, value: grades } of allGrades) {
          const hasOldSubject = grades.some(g => g.name === oldName);
          if (hasOldSubject) {
              const newGrades = grades.map(g => {
                  if (g.name === oldName) {
                      return { ...g, name: newName };
                  }
                  return g;
              });
              await db.setItem(key, newGrades);
          }
      }

      await audit.logAction(currentUser, 'EDIT_SUBJECT_DATABASE', undefined, undefined, `Renamed Subject: ${oldName} -> ${newName} (Propagated)`);
      window.location.reload();
  };

  const handleFullDeleteUser = async (userId: string) => {
      await db.removeItem(`basis_user_${userId}`);
      await db.removeItem(`basis_schedule_${userId}`);
      await db.removeItem(`basis_grades_${userId}`);
      await db.removeItem(`basis_broadcast_history_${userId}`);
      await audit.logAction(currentUser, 'DELETE_USER', userId, undefined, 'Full Account Wipe');
      refreshUserList();
  };

  const toggleSelectUser = (id: string) => setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectAll = () => { if (selectedUserIds.length === filteredUsers.length) setSelectedUserIds([]); else setSelectedUserIds(filteredUsers.map(u => u.user.id)); };

  const checkIsStaff = (u: User) => {
      return u.role === 'teacher' || teachers.some(t => t.id === u.id || t.email.toLowerCase() === u.id.toLowerCase()) || u.id.includes('@basischina.com');
  };

  const filteredUsers = userList.filter(({ user }) => {
      const isStaff = checkIsStaff(user);
      if (userTypeFilter === 'student' && isStaff) return false;
      if (userTypeFilter === 'staff' && !isStaff) return false;
      return user.name?.toLowerCase().includes(userSearch.toLowerCase()) || user.id.includes(userSearch);
  });

  const filteredTeachers = teachers.filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase()) || t.subject.toLowerCase().includes(teacherSearch.toLowerCase()));
  const filteredSubjects = subjects.filter(s => s.toLowerCase().includes(subjectSearch.toLowerCase()));
  
  const canManageRecords = isSuperAdminMode || currentUser.id === SUPER_ADMIN_ID_2;
  const canViewPasswords = isSuperAdminMode || currentUser.id === SUPER_ADMIN_ID_2;
  const canDeleteAccounts = currentUser.role === 'admin';

  const determineNaturalRole = (uid: string): UserRole => {
      if (uid.includes('@basischina.com')) return 'teacher';
      return 'student'; 
  };

  const isStaffAdmin = checkIsStaff(currentUser);

  const togglePasswordVisibility = (userId: string) => {
      setVisiblePasswords(prev => {
          const newSet = new Set(prev);
          if (newSet.has(userId)) newSet.delete(userId); else newSet.add(userId);
          return newSet;
      });
  };

  const handleShieldClick = () => {
      if (currentUser.id === ADMIN_ID && isSuperAdminMode && selectedUserIds.length > 0) {
          const selectedUsersList = userList.filter(u => selectedUserIds.includes(u.user.id));
          const allHavePrivilege = selectedUsersList.every(u => u.user.hasSuperAdminPrivilege);
          setSuperAdminActionType(allHavePrivilege ? 'revoke' : 'grant');
          setIsManageSuperAdminOpen(true);
      } else {
          if (currentUser.id === ADMIN_ID || currentUser.hasSuperAdminPrivilege) {
              setIsSuperAdminMode(prev => !prev);
          }
      }
  };

  const handleManageSuperAdminPrivilege = async () => {
      const isGranting = superAdminActionType === 'grant';
      for (const uid of selectedUserIds) {
          const userKey = `basis_user_${uid}`;
          const u = await db.getItem<User>(userKey);
          if (u) {
              const updated = { ...u, hasSuperAdminPrivilege: isGranting };
              await db.setItem(userKey, updated);
          }
      }
      setSelectedUserIds([]);
      refreshUserList();
  };

  const StudentScheduleModal = () => {
    if (!viewScheduleUser || !viewScheduleData) return null;
    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in-95 h-[90vh] flex flex-col">
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Calendar size={20}/> Schedule: {viewScheduleUser.name} ({viewScheduleUser.id})</h3>
                    <button onClick={() => setViewScheduleUser(null)} className="hover:bg-slate-700 p-2 rounded"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-slate-50">
                    <ScheduleGrid schedule={viewScheduleData} readOnly={true} />
                </div>
            </div>
        </div>
    );
  };

  const HeaderLanguageSelector = () => (
    <div className="relative group">
        <button className="text-slate-400 hover:text-white p-2 rounded transition-colors" title="Switch Language">
            <Globe size={20}/>
        </button>
        <div className="absolute right-0 top-full pt-2 hidden group-hover:block min-w-[140px] z-50">
            <div className="bg-white border border-slate-200 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 text-slate-800">
                {LANGUAGES.map(l => (
                    <button key={l.code} onClick={() => setLanguage(l.code as any)} className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${language === l.code ? 'font-bold text-brand-600 bg-brand-50' : 'text-slate-700'}`}>
                        {l.label}
                    </button>
                ))}
            </div>
        </div>
    </div>
  );

  const renderManagementTab = () => (
      <div className="space-y-8">
          {(currentUser.id === ADMIN_ID || currentUser.id === SUPER_ADMIN_ID_2) && (
              <div className="bg-slate-900 text-white p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div><h3 className="font-bold text-lg mb-1 flex items-center gap-2"><Database size={18}/> {t.admin.systemBackup}</h3><p className="text-slate-400 text-xs">Export/Import entire database.</p></div>
                  <div className="flex gap-3">
                      <button onClick={handleExport} className="px-4 py-2 bg-brand-600 rounded-lg font-bold text-sm hover:bg-brand-700 flex items-center gap-2"><Download size={14}/> {t.admin.exportData}</button>
                      <div className="relative"><input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden"/><button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-slate-700 rounded-lg font-bold text-sm hover:bg-slate-600 flex items-center gap-2"><Upload size={14}/> {t.admin.importData}</button></div>
                  </div>
              </div>
          )}

          <div className="bg-white p-6 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Sliders size={18}/> Feature Toggles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {['autoApprovePosts', 'autoApproveRequests', 'enableAIContentCheck'].map((key) => (
                        <div key={key} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <span className="font-bold text-sm text-slate-600">
                                {key === 'enableAIContentCheck' ? 'AI Check Posts' : (t.admin.features[key.replace('enable', '').toLowerCase() as keyof typeof t.admin.features] || key)}
                            </span>
                            <button onClick={() => toggleFlag(key as keyof FeatureFlags)} className={`text-2xl transition-colors ${featureFlags[key as keyof FeatureFlags] ? 'text-green-500' : 'text-slate-300'}`}>
                                {featureFlags[key as keyof FeatureFlags] ? <ToggleRight /> : <ToggleLeft />}
                            </button>
                        </div>
                    ))}
                    
                    {(currentUser.id === ADMIN_ID || currentUser.id === SUPER_ADMIN_ID_2) && (
                        ['enableCommunity', 'enableGPA', 'enableCalendar', 'enableAIImport', 'enableTeacherAI'].map((key) => (
                            <div key={key} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <span className="font-bold text-sm text-slate-600">{key === 'enableAIImport' ? 'AI Import Feature' : key === 'enableTeacherAI' ? 'Teacher AI Hub' : (t.admin.features[key.replace('enable', '').toLowerCase() as keyof typeof t.admin.features] || key)}</span>
                                <button onClick={() => toggleFlag(key as keyof FeatureFlags)} className={`text-2xl transition-colors ${featureFlags[key as keyof FeatureFlags] ? 'text-green-500' : 'text-slate-300'}`}>
                                    {featureFlags[key as keyof FeatureFlags] ? <ToggleRight /> : <ToggleLeft />}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

          <SystemLogs 
              records={systemRecords}
              currentUser={currentUser}
              isSuperAdminMode={isSuperAdminMode}
              onAddRecord={() => setAddRecordOpen(true)}
              onEditRecord={(rec) => setEditRecordData(rec)}
              onDeleteRecord={(rec) => setDeleteRecordData(rec)}
              onDeleteAllRecords={() => setDeleteAllRecordsOpen(true)}
              canManage={canManageRecords}
          />
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      {/* ... (Keep existing modals) ... */}
      <AddTeacherModal isOpen={isAddTeacherOpen} onClose={() => setIsAddTeacherOpen(false)} onSave={onAddTeacher} />
      <AddSubjectModal isOpen={isAddSubjectOpen} onClose={() => setIsAddSubjectOpen(false)} onSave={onAddSubject} />
      <SendWarningModal isOpen={isWarningOpen} onClose={() => setIsWarningOpen(false)} users={selectedUserIds.length > 0 ? userList.filter(u => selectedUserIds.includes(u.user.id)) : userList} onSend={handleSendWarnings} />
      <WarningHistoryModal isOpen={!!viewHistoryUser} onClose={() => setViewHistoryUser(null)} user={viewHistoryUser} />
      <EditUserModal isOpen={!!editingUser} onClose={() => setEditingUser(null)} user={editingUser} onSave={async (name) => { if(editingUser) { const updated = { ...editingUser, name }; await db.setItem(`basis_user_${editingUser.id}`, updated); await audit.logAction(currentUser, 'UPDATE_USER_NAME', editingUser.id, name); refreshUserList(); } }} />
      <AdminChangePasswordModal isOpen={!!passwordUser} onClose={() => setPasswordUser(null)} user={passwordUser} onSave={async (pass) => { if(passwordUser) { const updated = { ...passwordUser, password: pass }; await db.setItem(`basis_user_${passwordUser.id}`, updated); await audit.logAction(currentUser, 'CHANGE_PASSWORD', passwordUser.id, undefined, 'Admin Reset'); refreshUserList(); } }} />
      <RejectPostModal isOpen={!!rejectingPost} onClose={() => setRejectingPost(null)} onConfirm={(r) => rejectingPost && handlePostAction(rejectingPost, 'rejected', r)} />
      <ChangeRoleModal isOpen={!!roleChangeData} onClose={() => setRoleChangeData(null)} user={roleChangeData?.user || null} role={roleChangeData?.role || 'student'} onConfirm={async () => { if(roleChangeData) { const updated = { ...roleChangeData.user, role: roleChangeData.role }; await db.setItem(roleChangeData.key, updated); await audit.logAction(currentUser, 'CHANGE_ROLE', updated.id, undefined, roleChangeData.role); refreshUserList(); } }} />
      <BanUserModal isOpen={!!banUserData} onClose={() => setBanUserData(null)} user={banUserData?.user || null} onConfirm={async () => { if(banUserData) { const updated = { ...banUserData.user, isBanned: !banUserData.user.isBanned }; await db.setItem(banUserData.key, updated); await audit.logAction(currentUser, 'BAN_USER', updated.id, undefined, 'Account Ban'); refreshUserList(); } }} />
      <ConfirmDeleteModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })} title={deleteModal.title} message={deleteModal.message} onConfirm={deleteModal.onConfirm} />
      <ConfirmGenericModal isOpen={bulkActionModal.isOpen} onClose={() => setBulkActionModal({ ...bulkActionModal, isOpen: false })} title={bulkActionModal.title} message={bulkActionModal.message} onConfirm={bulkActionModal.onConfirm} type={bulkActionModal.type} />
      <EditTeacherModal isOpen={!!editTeacherData} onClose={() => setEditTeacherData(null)} teacher={editTeacherData} onSave={async (t) => { const newTeachers = teachers.map(x => x.id === t.id ? t : x); await db.setItem('basis_teachers', newTeachers); await audit.logAction(currentUser, 'EDIT_TEACHER_DATABASE', t.id, t.name, 'Update Teacher'); window.location.reload(); }} />
      <EditSubjectModal isOpen={!!editSubjectData} onClose={() => setEditSubjectData(null)} originalSubject={editSubjectData || ''} onSave={handleSubjectRename} />
      <ConfirmCreateAccountModal isOpen={!!createAccountTeacher} onClose={() => setCreateAccountTeacher(null)} teacher={createAccountTeacher} onConfirm={() => createAccountTeacher && handleCreateTeacherAccount(createAccountTeacher)} />
      <ManageSuperAdminModal isOpen={isManageSuperAdminOpen} onClose={() => setIsManageSuperAdminOpen(false)} count={selectedUserIds.length} onConfirm={handleManageSuperAdminPrivilege} actionType={superAdminActionType} />
      
      {viewScheduleUser && <StudentScheduleModal />}

      {canManageRecords && (
          <>
            <AddRecordModal isOpen={addRecordOpen} onClose={() => setAddRecordOpen(false)} onSave={handleSaveRecord} currentUser={currentUser} isIllegalMode={isSuperAdminMode} />
            <EditRecordModal isOpen={!!editRecordData} onClose={() => setEditRecordData(null)} record={editRecordData} onSave={handleSaveRecord} />
            <ConfirmDeleteRecordModal isOpen={!!deleteRecordData} onClose={() => setDeleteRecordData(null)} onConfirm={handleDeleteRecord} />
            <ConfirmDeleteAllRecordsModal isOpen={deleteAllRecordsOpen} onClose={() => setDeleteAllRecordsOpen(false)} onConfirm={handleDeleteAllRecords} />
          </>
      )}

      <nav className={`bg-slate-900 text-white px-4 md:px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-50 ${isSuperAdminMode ? 'border-b-4 border-red-600' : ''}`}>
          <div className="flex items-center gap-3">
              <button 
                onClick={handleShieldClick} 
                className={`p-2 rounded-lg transition-colors ${isSuperAdminMode ? 'bg-red-600 text-white animate-pulse' : 'bg-purple-600'}`}
                title={isSuperAdminMode ? "Disable Super Admin Mode" : "Enable Super Admin Mode"}
                disabled={currentUser.id !== ADMIN_ID && !currentUser.hasSuperAdminPrivilege}
              >
                  {isSuperAdminMode ? <ShieldAlert size={20}/> : <Shield size={20} />}
              </button>
              <div><h1 className="text-lg md:text-xl font-bold tracking-tight">{t.admin.dashboard}</h1><div className="text-xs text-slate-400 font-medium hidden md:block">{currentUser.id === ADMIN_ID || currentUser.id === SUPER_ADMIN_ID_2 ? t.admin.superAdmin : t.admin.secAdmin}</div></div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
              <HeaderLanguageSelector />
              <button onClick={onSwitchView} className="bg-slate-800 hover:bg-slate-700 px-3 md:px-4 py-2 rounded-lg text-sm font-bold border border-slate-700 flex items-center gap-2 transition-colors">
                  <Briefcase size={16}/> <span className="hidden md:inline">{isStaffAdmin ? t.admin.backToTeacher : t.common.back}</span>
              </button>
              <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 px-3 md:px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"><LogOut size={16}/> <span className="hidden md:inline">{t.nav.logout}</span></button>
          </div>
      </nav>

      {/* Rest of Dashboard Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-10 flex flex-col gap-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {[
                  { id: 'users', label: t.admin.tabs.users, icon: <LayoutDashboard size={18} /> },
                  { id: 'moderation', label: t.admin.tabs.moderation, icon: <Inbox size={18} /> },
                  { id: 'database', label: t.admin.tabs.database, icon: <Database size={18} /> },
                  { id: 'management', label: t.admin.tabs.management, icon: <Settings size={18} /> },
              ].map((tab: any) => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedUserIds([]); }} className={`px-5 py-3 rounded-xl font-bold flex-shrink-0 flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>{tab.icon} {tab.label}</button>
              ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 flex-1">
              {activeTab === 'users' && (
                  <div className="space-y-4">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 p-3 rounded-xl border border-slate-200 gap-3">
                          <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm w-full md:w-auto">
                              <button onClick={() => { setUserTypeFilter('student'); setSelectedUserIds([]); }} className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${userTypeFilter === 'student' ? 'bg-brand-100 text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}>{t.admin.filters.students}</button>
                              <button onClick={() => { setUserTypeFilter('staff'); setSelectedUserIds([]); }} className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${userTypeFilter === 'staff' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}>{t.admin.filters.staff}</button>
                          </div>
                          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
                              {userTypeFilter === 'student' && <button onClick={() => setIsWarningOpen(true)} className="bg-orange-50 text-orange-600 border border-orange-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-100 flex items-center justify-center gap-2"><AlertTriangle size={16}/> {t.modals.sendWarning}</button>}
                              {userTypeFilter === 'staff' && selectedUserIds.length > 0 && <button onClick={confirmBulkDeleteStaff} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 flex items-center justify-center gap-2"><Trash2 size={16}/> Delete ({selectedUserIds.length})</button>}
                              <div className="relative w-full md:w-auto"><input type="text" placeholder={t.common.search} value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full md:w-64 outline-none focus:border-brand-500"/><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /></div>
                          </div>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left text-sm min-w-[800px]">
                              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs"><tr><th className="p-4"><input type="checkbox" onChange={selectAll} checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0} /></th><th className="p-4">{t.common.name}</th><th className="p-4">ID / {t.common.email}</th><th className="p-4">{t.common.role}</th><th className="p-4">{t.common.password}</th><th className="p-4 text-right">{t.common.action}</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">
                                  {filteredUsers.map(({ user, key }) => {
                                      const isVisible = visiblePasswords.has(user.id);
                                      const isStaffRow = checkIsStaff(user);
                                      return (
                                          <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${user.isBanned ? 'bg-red-50 hover:bg-red-100' : ''}`}>
                                              <td className="p-4"><input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => toggleSelectUser(user.id)} /></td>
                                              <td className="p-4 font-bold flex items-center gap-2 text-slate-800">
                                                  {user.name || '-'}
                                                  {isSuperAdminMode && user.hasSuperAdminPrivilege && <span className="text-[10px] bg-red-600 text-white px-1.5 rounded font-bold" title="Has Super Admin Privileges">!</span>}
                                                  <button onClick={() => setEditingUser(user)} className="text-slate-300 hover:text-brand-600"><Edit2 size={12} /></button>
                                              </td>
                                              <td className="p-4 font-mono text-slate-600">{user.id}</td>
                                              <td className="p-4">
                                                  <div className="flex items-center gap-2">
                                                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : user.role === 'secondary_admin' ? 'bg-blue-100 text-blue-700' : user.role === 'teacher' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>{user.role}</span>
                                                      {(currentUser.id === ADMIN_ID || currentUser.id === SUPER_ADMIN_ID_2) && user.id !== ADMIN_ID && user.id !== SUPER_ADMIN_ID_2 && (
                                                          <div className="flex gap-1">
                                                              {user.role === 'admin' || user.role === 'secondary_admin' ? (
                                                                  <button onClick={() => setRoleChangeData({ user, key, role: determineNaturalRole(user.id) })} className="p-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] text-slate-600 font-bold" title={`Demote to ${determineNaturalRole(user.id)}`}>User</button>
                                                              ) : (
                                                                  <>
                                                                    <button onClick={() => setRoleChangeData({ user, key, role: 'secondary_admin' })} className="p-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[10px] font-bold" title="Make Sec Admin">SA</button>
                                                                    <button onClick={() => setRoleChangeData({ user, key, role: 'admin' })} className="p-1 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded text-[10px] font-bold" title="Make Admin">A</button>
                                                                  </>
                                                              )}
                                                          </div>
                                                      )}
                                                  </div>
                                                  {user.role === 'teacher' && user.isApproved === false && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded ml-2 font-bold">{t.admin.pendingApprovals}</span>}
                                              </td>
                                              <td className="p-4">
                                                  <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                                                      <span>{isVisible || (canViewPasswords) ? (isVisible ? user.password : (canViewPasswords ? user.password : '••••••••')) : '••••••••'}</span>
                                                      {canViewPasswords && (
                                                          <button onClick={() => togglePasswordVisibility(user.id)} className="text-slate-400 hover:text-slate-600">
                                                              {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                                          </button>
                                                      )}
                                                  </div>
                                              </td>
                                              <td className="p-4 flex justify-end gap-2">
                                                  {!isStaffRow && <button onClick={() => setViewHistoryUser(user)} className="p-2 bg-white border border-slate-200 rounded text-slate-500 hover:text-orange-600 hover:border-orange-200" title={t.modals.warningHistory}><AlertTriangle size={16} /></button>}
                                                  {user.role === 'teacher' && user.isApproved === false && <button onClick={async () => { await db.setItem(key, { ...user, isApproved: true }); refreshUserList(); }} className="p-2 bg-green-50 text-green-600 rounded border border-green-200 font-bold text-xs">{t.admin.approve}</button>}
                                                  
                                                  <button onClick={() => setPasswordUser(user)} className="p-2 bg-white border border-slate-200 rounded text-slate-500 hover:text-brand-600 hover:border-brand-200" title={t.modals.changePass}><KeyRound size={16} /></button>
                                                  <button onClick={() => setBanUserData({ user, key })} className={`p-2 bg-white border border-slate-200 rounded ${user.isBanned ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}`} title={user.isBanned ? t.modals.unbanUser : t.modals.banUser}>{user.isBanned ? <CheckCircle2 size={16} /> : <Ban size={16} />}</button>
                                                  
                                                  {isSuperAdminMode && (
                                                      <button onClick={() => onImpersonate(user.id)} className="p-2 bg-purple-50 border border-purple-100 rounded text-purple-600 hover:bg-purple-100" title={`Log As ${user.name}`}><LogIn size={16}/></button>
                                                  )}
                                                  
                                                  {canDeleteAccounts && user.id !== ADMIN_ID && user.id !== SUPER_ADMIN_ID_2 && (
                                                      <button onClick={() => setDeleteModal({ isOpen: true, title: t.modals.deleteUser, message: t.modals.areYouSure + " This will wipe ALL user data.", onConfirm: () => handleFullDeleteUser(user.id) })} className="p-2 bg-red-50 border border-red-100 rounded text-red-600 hover:bg-red-100"><Trash2 size={16} /></button>
                                                  )}
                                                  
                                                  {(user.role === 'student') && (
                                                      <button onClick={() => setViewScheduleUser(user)} className="p-2 bg-white border border-slate-200 rounded text-slate-500 hover:text-brand-600 hover:border-brand-200" title={t.admin.studentView}><Eye size={16}/></button>
                                                  )}
                                              </td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}

              {activeTab === 'moderation' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                      {/* Community Posts */}
                      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                          <h3 className="font-bold text-lg text-slate-700 mb-4 flex items-center gap-2">
                              <MessageSquare size={20}/> {t.community.postPendingTitle} ({pendingPosts.length})
                          </h3>
                          {pendingPosts.length === 0 ? <div className="text-center py-10 text-slate-400">{t.community.noPosts}</div> : (
                              <div className="space-y-3">
                                  {pendingPosts.map(post => (
                                      <div key={post.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                          <div className="flex justify-between items-start mb-2">
                                              <div>
                                                  <h4 className="font-bold text-slate-800">{post.title}</h4>
                                                  <div className="text-xs text-slate-500">{post.authorName} • {new Date(post.timestamp).toLocaleDateString()}</div>
                                              </div>
                                              <span className="text-[10px] bg-slate-100 px-2 py-1 rounded uppercase font-bold">{post.category}</span>
                                          </div>
                                          <p className="text-sm text-slate-600 mb-3 line-clamp-2">{post.description}</p>
                                          <div className="flex gap-2 justify-end">
                                              <button onClick={() => setRejectingPost(post)} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded hover:bg-red-100">{t.common.rejected}</button>
                                              <button onClick={() => handlePostAction(post, 'approved')} className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded hover:bg-green-100">{t.common.approved}</button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      {/* Assessment Requests */}
                      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                          <h3 className="font-bold text-lg text-slate-700 mb-4 flex items-center gap-2">
                              <Calendar size={20}/> {t.calendar.pendingRequests} ({pendingAssessments.length})
                          </h3>
                          {pendingAssessments.length === 0 ? <div className="text-center py-10 text-slate-400">{t.community.noPosts}</div> : (
                              <div className="space-y-3">
                                  {pendingAssessments.map(evt => (
                                      <div key={evt.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                          <div className="flex justify-between items-start mb-2">
                                              <div>
                                                  <h4 className="font-bold text-slate-800">{evt.title}</h4>
                                                  <div className="text-xs text-slate-500">{evt.creatorName} • {evt.date}</div>
                                              </div>
                                              <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-1 rounded uppercase font-bold">{evt.eventType === 'school' ? 'Event' : 'Assessment'}</span>
                                          </div>
                                          <div className="text-xs text-slate-600 mb-3">
                                              <span className="font-bold">{t.common.subject}:</span> {evt.subject} <span className="mx-1">|</span> 
                                              <span className="font-bold">{t.common.grade}:</span> {evt.gradeLevels?.join(', ')}
                                          </div>
                                          <div className="flex gap-2 justify-end">
                                              <button onClick={() => handleAssessmentAction(evt, 'rejected')} className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded hover:bg-red-100">{t.common.rejected}</button>
                                              <button onClick={() => handleAssessmentAction(evt, 'approved')} className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded hover:bg-green-100">{t.common.approved}</button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {activeTab === 'database' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                      {/* Teachers */}
                      <div className="bg-white rounded-xl border border-slate-200 flex flex-col h-[600px]">
                          <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
                              <div className="flex justify-between items-center">
                                  <h3 className="font-bold text-slate-700">{t.common.teacher} ({teachers.length})</h3>
                                  <button onClick={() => setIsAddTeacherOpen(true)} className="bg-brand-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-brand-700 flex items-center gap-1"><Plus size={14}/> Add</button>
                              </div>
                              <div className="flex gap-2">
                                  <div className="relative flex-1">
                                      <input type="text" placeholder={t.common.search} value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)} className="w-full pl-8 pr-2 py-1.5 border rounded text-xs"/>
                                      <Search size={12} className="absolute left-2.5 top-2 text-slate-400"/>
                                  </div>
                                  {selectedTeacherIds.length > 0 && (
                                      <>
                                          <button onClick={confirmBulkCreateAccounts} className="bg-green-50 text-green-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-green-100 whitespace-nowrap">Create Acc ({selectedTeacherIds.length})</button>
                                          <button onClick={confirmBulkDeleteTeachers} className="bg-red-50 text-red-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-100 whitespace-nowrap">Delete ({selectedTeacherIds.length})</button>
                                      </>
                                  )}
                              </div>
                          </div>
                          <div className="flex-1 overflow-y-auto">
                              <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 sticky top-0 text-slate-500 font-bold"><tr><th className="p-3"><input type="checkbox" onChange={() => setSelectedTeacherIds(selectedTeacherIds.length === filteredTeachers.length ? [] : filteredTeachers.map(t => t.id))} checked={selectedTeacherIds.length === filteredTeachers.length && filteredTeachers.length > 0}/></th><th className="p-3">{t.common.name}</th><th className="p-3">{t.common.subject}</th><th className="p-3 text-right">{t.common.action}</th></tr></thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {filteredTeachers.map(tea => {
                                          const hasAccount = userList.some(u => u.user.id.toLowerCase() === tea.email.toLowerCase() || u.user.id === tea.id);
                                          return (
                                              <tr key={tea.id} className="hover:bg-slate-50 group">
                                                  <td className="p-3"><input type="checkbox" checked={selectedTeacherIds.includes(tea.id)} onChange={() => setSelectedTeacherIds(prev => prev.includes(tea.id) ? prev.filter(x => x !== tea.id) : [...prev, tea.id])}/></td>
                                                  <td className="p-3">
                                                      <div className="font-bold text-slate-700">{tea.name}</div>
                                                      <div className="text-slate-400">{tea.email}</div>
                                                  </td>
                                                  <td className="p-3">{tea.subject}</td>
                                                  <td className="p-3 text-right flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      {!hasAccount && <button onClick={() => setCreateAccountTeacher(tea)} className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100" title="Create Account"><PlusCircle size={14}/></button>}
                                                      <button onClick={() => setEditTeacherData(tea)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Edit2 size={14}/></button>
                                                      <button onClick={() => onDeleteTeacher(tea.id)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 size={14}/></button>
                                                  </td>
                                              </tr>
                                          );
                                      })}
                                  </tbody>
                              </table>
                          </div>
                      </div>

                      {/* Subjects */}
                      <div className="bg-white rounded-xl border border-slate-200 flex flex-col h-[600px]">
                          <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
                              <div className="flex justify-between items-center">
                                  <h3 className="font-bold text-slate-700">{t.common.subject} ({subjects.length})</h3>
                                  <button onClick={() => setIsAddSubjectOpen(true)} className="bg-brand-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-brand-700 flex items-center gap-1"><Plus size={14}/> Add</button>
                              </div>
                              <div className="flex gap-2">
                                  <div className="relative flex-1">
                                      <input type="text" placeholder={t.common.search} value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)} className="w-full pl-8 pr-2 py-1.5 border rounded text-xs"/>
                                      <Search size={12} className="absolute left-2.5 top-2 text-slate-400"/>
                                  </div>
                                  {selectedSubjects.length > 0 && (
                                      <button onClick={handleBulkDeleteSubjects} className="bg-red-50 text-red-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-100 whitespace-nowrap">Delete ({selectedSubjects.length})</button>
                                  )}
                              </div>
                          </div>
                          <div className="flex-1 overflow-y-auto">
                              <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 sticky top-0 text-slate-500 font-bold"><tr><th className="p-3"><input type="checkbox" onChange={() => setSelectedSubjects(selectedSubjects.length === filteredSubjects.length ? [] : filteredSubjects)} checked={selectedSubjects.length === filteredSubjects.length && filteredSubjects.length > 0}/></th><th className="p-3">{t.common.name}</th><th className="p-3 text-right">{t.common.action}</th></tr></thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {filteredSubjects.map(sub => (
                                          <tr key={sub} className="hover:bg-slate-50 group">
                                              <td className="p-3"><input type="checkbox" checked={selectedSubjects.includes(sub)} onChange={() => setSelectedSubjects(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : [...prev, sub])}/></td>
                                              <td className="p-3 font-bold text-slate-700">{sub}</td>
                                              <td className="p-3 text-right flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button onClick={() => setEditSubjectData(sub)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Edit2 size={14}/></button>
                                                  <button onClick={() => onDeleteSubject(sub)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 size={14}/></button>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'management' && renderManagementTab()}
          </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
