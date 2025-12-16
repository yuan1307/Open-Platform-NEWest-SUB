
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { User, Teacher, UserRole, CommunityPost, Warning, FeatureFlags, SystemRecord, ActionType, AssessmentEvent, ScheduleMap, GradeCourse } from '../types';
import { db } from '../services/db';
import { audit } from '../services/audit';
import { LayoutDashboard, Trash2, Eye, EyeOff, Search, Plus, Ban, KeyRound, Database, Shield, LogOut, AlertTriangle, CheckCircle2, Inbox, Briefcase, Edit2, Download, Upload, LogIn, Settings, Sliders, ToggleLeft, ToggleRight, Calendar, PlusCircle, Globe, FileText, Filter, X, CheckSquare, Square, ShieldAlert, MessageSquare, Users, Loader2, Megaphone } from 'lucide-react';
import { AddTeacherModal, AddSubjectModal, ConfirmDeleteModal, SendWarningModal, WarningHistoryModal, EditUserModal, AdminChangePasswordModal, RejectPostModal, ChangeRoleModal, BanUserModal, EditTeacherModal, EditSubjectModal, ConfirmCreateAccountModal, AddRecordModal, EditRecordModal, ConfirmDeleteRecordModal, ConfirmDeleteAllRecordsModal, ConfirmMultiBanModal, ConfirmGenericModal } from './AdminModals';
import { ADMIN_ID, DEFAULT_FLAGS, DEFAULT_PASSWORD, SUPER_ADMIN_ID_2, LANGUAGES } from '../constants';
import { useLanguage } from '../LanguageContext';
import ScheduleGrid from './ScheduleGrid';
import SystemLogs from './admin/SystemLogs';

interface AdminDashboardProps { onLogout: () => void; onSwitchView: () => void; onSpectate: (userId: string) => void; onImpersonate: (userId: string) => void; currentUser: User; teachers: Teacher[]; onAddTeacher: (t: Teacher, createAccount: boolean) => void; onDeleteTeacher: (id: string) => void; subjects: string[]; onAddSubject: (s: string[]) => void; onDeleteSubject: (s: string) => void; }
interface EnrichedUser { user: User; key: string; }

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onSwitchView, onSpectate, onImpersonate, currentUser, teachers, onAddTeacher, onDeleteTeacher, subjects, onAddSubject, onDeleteSubject }) => {
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
  // PATCH 1: UI flag strictly controlled by verified admin IDs or server response
  const [isSuperAdminMode, setIsSuperAdminMode] = useState(false);

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

  // BulkAction Modals State
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

  const refreshUserList = async () => { 
      // PATCH 1: UI Control. Ensure we can actually fetch users. 
      const results = await db.scan<User>('basis_user_'); 
      const enriched = results.map(r => ({ user: r.value, key: r.key })); 
      enriched.sort((a,b) => a.user.id.localeCompare(b.user.id)); 
      setUserList(enriched); 
  };
  const refreshPendingPosts = async () => { const posts = await db.getItem<CommunityPost[]>('basis_community_posts'); if (posts) setPendingPosts(posts.filter(p => p.status === 'pending')); };
  const refreshPendingAssessments = async () => { const events = await db.getItem<AssessmentEvent[]>('basis_assessment_events'); if (events) setPendingAssessments(events.filter(e => e.status === 'pending')); };
  const refreshFlags = async () => { 
      const flags = await db.getItem<FeatureFlags>('basis_feature_flags'); 
      setFeatureFlags({ ...DEFAULT_FLAGS, ...flags }); 
  };
  
  // PATCH 2: Use audit.getRecords which now securely fetches from cloud (skipping local storage)
  const refreshRecords = async () => { 
      const records = await audit.getRecords(); 
      setSystemRecords(records.sort((a, b) => b.timestamp - a.timestamp)); 
  }; 

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
      // Simulate bulk delete by calling onDeleteTeacher for each
      // Note: In a real app this should be batched
      for (const id of selectedTeacherIds) {
          await onDeleteTeacher(id);
      }
      await audit.logAction(currentUser, 'EDIT_TEACHER_DATABASE', undefined, undefined, `Bulk deleted ${selectedTeacherIds.length} teachers`);
      alert("Teachers deleted.");
      setSelectedTeacherIds([]);
  };

  const toggleSuperAdminMode = () => {
      // Strict check: Only specific IDs can toggle this
      if (currentUser.id === ADMIN_ID || currentUser.id === SUPER_ADMIN_ID_2) {
          setIsSuperAdminMode(!isSuperAdminMode);
      } else {
          alert("Access Denied: Only root administrators can enable this mode.");
      }
  };

  // Render Logic
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* --- Modals --- */}
      <AddTeacherModal isOpen={isAddTeacherOpen} onClose={() => setIsAddTeacherOpen(false)} onSave={onAddTeacher} />
      <AddSubjectModal isOpen={isAddSubjectOpen} onClose={() => setIsAddSubjectOpen(false)} onSave={onAddSubject} />
      <SendWarningModal isOpen={isWarningOpen} onClose={() => setIsWarningOpen(false)} users={userList} onSend={handleSendWarnings} />
      <WarningHistoryModal isOpen={!!viewHistoryUser} onClose={() => setViewHistoryUser(null)} user={viewHistoryUser} />
      <EditUserModal isOpen={!!editingUser} onClose={() => setEditingUser(null)} user={editingUser} onSave={async (newName) => { if (editingUser) { const updated = { ...editingUser, name: newName }; await db.setItem(`basis_user_${editingUser.id}`, updated); await audit.logAction(currentUser, 'UPDATE_USER_NAME', editingUser.id, undefined, `${editingUser.name} -> ${newName}`); refreshUserList(); } }} />
      <AdminChangePasswordModal isOpen={!!passwordUser} onClose={() => setPasswordUser(null)} user={passwordUser} onSave={async (newPass) => { if (passwordUser) { const updated = { ...passwordUser, password: newPass }; await db.setItem(`basis_user_${passwordUser.id}`, updated); await audit.logAction(currentUser, 'CHANGE_PASSWORD', passwordUser.id, undefined, 'Admin Reset'); alert("Password Updated"); } }} />
      <RejectPostModal isOpen={!!rejectingPost} onClose={() => setRejectingPost(null)} onConfirm={(reason) => rejectingPost && handlePostAction(rejectingPost, 'rejected', reason)} />
      <ChangeRoleModal isOpen={!!roleChangeData} onClose={() => setRoleChangeData(null)} user={roleChangeData?.user || null} role={roleChangeData?.role || 'student'} onConfirm={async () => { if (roleChangeData) { const updated = { ...roleChangeData.user, role: roleChangeData.role }; await db.setItem(roleChangeData.key, updated); await audit.logAction(currentUser, 'CHANGE_ROLE', roleChangeData.user.id, undefined, `${roleChangeData.user.role} -> ${roleChangeData.role}`); refreshUserList(); } }} />
      <BanUserModal isOpen={!!banUserData} onClose={() => setBanUserData(null)} user={banUserData?.user || null} onConfirm={async () => { if (banUserData) { const updated = { ...banUserData.user, isBanned: !banUserData.user.isBanned }; await db.setItem(banUserData.key, updated); await audit.logAction(currentUser, updated.isBanned ? 'BAN_USER' : 'UNBAN_USER', banUserData.user.id, banUserData.user.name); refreshUserList(); } }} />
      <ConfirmDeleteModal isOpen={deleteModal.isOpen} title={deleteModal.title} message={deleteModal.message} onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })} onConfirm={deleteModal.onConfirm} />
      
      <EditTeacherModal isOpen={!!editTeacherData} onClose={() => setEditTeacherData(null)} teacher={editTeacherData} onSave={async (t) => { const newTeachers = teachers.map(x => x.id === t.id ? t : x); await db.setItem('basis_teachers', newTeachers); await audit.logAction(currentUser, 'EDIT_TEACHER_DATABASE', t.id, t.name, 'Updated details'); refreshUserList(); }} />
      <EditSubjectModal isOpen={!!editSubjectData} onClose={() => setEditSubjectData(null)} originalSubject={editSubjectData || ''} onSave={async (oldN, newN) => { const newSub = subjects.map(s => s === oldN ? newN : s); await db.setItem('basis_subjects', newSub); await audit.logAction(currentUser, 'EDIT_SUBJECT_DATABASE', undefined, undefined, `${oldN} -> ${newN}`); refreshUserList(); }} />
      <ConfirmCreateAccountModal isOpen={!!createAccountTeacher} onClose={() => setCreateAccountTeacher(null)} teacher={createAccountTeacher} onConfirm={() => createAccountTeacher && handleCreateTeacherAccount(createAccountTeacher)} />
      
      <ConfirmGenericModal isOpen={bulkActionModal.isOpen} onClose={() => setBulkActionModal({...bulkActionModal, isOpen: false})} onConfirm={bulkActionModal.onConfirm} title={bulkActionModal.title} message={bulkActionModal.message} type={bulkActionModal.type} />

      {/* Record Modals */}
      <AddRecordModal isOpen={addRecordOpen} onClose={() => setAddRecordOpen(false)} onSave={async (rec) => { await db.setSecureItem('basis_system_records', [rec, ...systemRecords]); refreshRecords(); }} currentUser={currentUser} isIllegalMode={isSuperAdminMode} />
      <EditRecordModal isOpen={!!editRecordData} onClose={() => setEditRecordData(null)} record={editRecordData} onSave={async (rec) => { const updated = systemRecords.map(r => r.id === rec.id ? rec : r); await db.setSecureItem('basis_system_records', updated); refreshRecords(); }} />
      <ConfirmDeleteRecordModal isOpen={!!deleteRecordData} onClose={() => setDeleteRecordData(null)} onConfirm={async () => { if (deleteRecordData) { const updated = systemRecords.filter(r => r.id !== deleteRecordData.id); await db.setSecureItem('basis_system_records', updated); refreshRecords(); setDeleteRecordData(null); } }} />
      <ConfirmDeleteAllRecordsModal isOpen={deleteAllRecordsOpen} onClose={() => setDeleteAllRecordsOpen(false)} onConfirm={async () => { await audit.clearAllRecords(); refreshRecords(); }} />

      {/* View Student Schedule Modal */}
      {viewScheduleUser && (
          <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] overflow-hidden flex flex-col animate-in zoom-in-95">
                  <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                      <div><h3 className="font-bold flex items-center gap-2"><Calendar size={18}/> Student Schedule: {viewScheduleUser.name}</h3><div className="text-xs text-slate-400">{viewScheduleUser.id}</div></div>
                      <button onClick={() => setViewScheduleUser(null)}><X size={20}/></button>
                  </div>
                  <div className="flex-1 overflow-auto p-4 bg-slate-50">
                      {viewScheduleData ? <ScheduleGrid schedule={viewScheduleData} readOnly={true} /> : <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin"/></div>}
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <nav className="bg-slate-900 text-white p-4 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <div className="bg-white/10 p-2 rounded-lg"><LayoutDashboard size={24} /></div>
                <div><h1 className="text-xl font-bold tracking-tight">{t.admin.dashboard}</h1><div className="text-xs text-slate-400 font-mono">{currentUser.name} | {currentUser.role === 'admin' ? t.admin.superAdmin : t.admin.secAdmin}</div></div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <button onClick={onSwitchView} className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"><Eye size={16} /> {t.admin.studentView}</button>
                <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"><LogOut size={16} /> {t.nav.logout}</button>
            </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-8 w-full flex-1">
          {/* Tabs */}
          <div className="flex overflow-x-auto gap-2 mb-6 pb-2 border-b border-slate-200">
              {['users', 'moderation', 'database', 'management'].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-3 rounded-t-lg font-bold text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === tab ? 'bg-white text-brand-600 border-t-2 border-brand-600 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                      {tab === 'users' && <Users size={16}/>}
                      {tab === 'moderation' && <ShieldAlert size={16}/>}
                      {tab === 'database' && <Database size={16}/>}
                      {tab === 'management' && <Sliders size={16}/>}
                      {t.admin.tabs[tab as keyof typeof t.admin.tabs]}
                  </button>
              ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] p-6">
              
              {/* USERS TAB */}
              {activeTab === 'users' && (
                  <div className="space-y-6">
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                              <button onClick={() => setUserTypeFilter('student')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${userTypeFilter === 'student' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t.admin.filters.students}</button>
                              <button onClick={() => setUserTypeFilter('staff')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${userTypeFilter === 'staff' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t.admin.filters.staff}</button>
                          </div>
                          <div className="flex gap-2 w-full md:w-auto">
                              <div className="relative flex-1"><input type="text" placeholder={t.common.search} value={userSearch} onChange={e => setUserSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm" /><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /></div>
                              <button onClick={() => setIsWarningOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2"><Megaphone size={16}/> {t.modals.sendWarning}</button>
                          </div>
                      </div>

                      <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                              <thead>
                                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                      <th className="p-3 w-10"><input type="checkbox" /></th>
                                      <th className="p-3">{t.common.name} / ID</th>
                                      <th className="p-3">{t.common.role}</th>
                                      <th className="p-3">{t.common.password}</th>
                                      <th className="p-3">{t.common.status}</th>
                                      <th className="p-3 text-right">{t.common.action}</th>
                                  </tr>
                              </thead>
                              <tbody className="text-sm divide-y divide-slate-50">
                                  {userList.filter(u => {
                                      const isStaff = u.user.role === 'teacher' || u.user.role === 'admin' || u.user.role === 'secondary_admin';
                                      if (userTypeFilter === 'student' && isStaff) return false;
                                      if (userTypeFilter === 'staff' && !isStaff) return false;
                                      return u.user.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.user.id.includes(userSearch);
                                  }).map(({ user, key }) => (
                                      <tr key={key} className="hover:bg-slate-50/50 group transition-colors">
                                          <td className="p-3"><input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => setSelectedUserIds(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id])} /></td>
                                          <td className="p-3">
                                              <div className="font-bold text-slate-800 flex items-center gap-2">
                                                  {user.name || 'Unknown'}
                                                  {user.role === 'student' && <button onClick={() => setViewScheduleUser(user)} className="text-slate-300 hover:text-brand-600" title="View Schedule"><Calendar size={14}/></button>}
                                              </div>
                                              <div className="text-xs text-slate-400 font-mono">{user.id}</div>
                                          </td>
                                          <td className="p-3">
                                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : user.role === 'teacher' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{user.role}</span>
                                          </td>
                                          <td className="p-3">
                                              <div className="flex items-center gap-2">
                                                  <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                      {visiblePasswords.has(user.id) ? user.password : '••••••••'}
                                                  </span>
                                                  <button onClick={() => setVisiblePasswords(prev => { const n = new Set(prev); if (n.has(user.id)) n.delete(user.id); else n.add(user.id); return n; })} className="text-slate-300 hover:text-slate-600"><Eye size={14}/></button>
                                              </div>
                                          </td>
                                          <td className="p-3">
                                              {user.isBanned ? <span className="text-red-600 font-bold text-xs flex items-center gap-1"><Ban size={12}/> Banned</span> : <span className="text-green-600 font-bold text-xs flex items-center gap-1"><CheckCircle2 size={12}/> Active</span>}
                                          </td>
                                          <td className="p-3 text-right">
                                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button onClick={() => onSpectate(user.id)} className="p-1.5 hover:bg-slate-200 rounded text-slate-500" title="Spectate"><Eye size={14}/></button>
                                                  <button onClick={() => onImpersonate(user.id)} className="p-1.5 hover:bg-slate-200 rounded text-purple-600" title="Impersonate"><LogIn size={14}/></button>
                                                  <button onClick={() => setEditingUser(user)} className="p-1.5 hover:bg-slate-200 rounded text-blue-600" title="Edit Name"><Edit2 size={14}/></button>
                                                  <button onClick={() => setPasswordUser(user)} className="p-1.5 hover:bg-slate-200 rounded text-yellow-600" title="Reset Password"><KeyRound size={14}/></button>
                                                  <button onClick={() => setBanUserData({user, key})} className={`p-1.5 hover:bg-slate-200 rounded ${user.isBanned ? 'text-green-600' : 'text-red-600'}`} title={user.isBanned ? "Unban" : "Ban"}>{user.isBanned ? <CheckCircle2 size={14}/> : <Ban size={14}/>}</button>
                                                  {isSuperAdminMode && (
                                                      <button onClick={() => setDeleteModal({ isOpen: true, title: t.modals.deleteUser, message: t.modals.areYouSure, onConfirm: async () => { await db.removeItem(key); refreshUserList(); } })} className="p-1.5 hover:bg-red-100 rounded text-red-600" title="DELETE"><Trash2 size={14}/></button>
                                                  )}
                                              </div>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}

              {/* MODERATION TAB */}
              {activeTab === 'moderation' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><Inbox size={20}/> Pending Posts <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full text-xs">{pendingPosts.length}</span></h3>
                          <div className="space-y-3 max-h-[500px] overflow-y-auto">
                              {pendingPosts.length === 0 ? <div className="text-center text-slate-400 py-10">No pending posts.</div> : pendingPosts.map(post => (
                                  <div key={post.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                      <div className="flex justify-between items-start mb-2">
                                          <div className="font-bold text-slate-800">{post.title}</div>
                                          <div className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{post.category}</div>
                                      </div>
                                      <p className="text-sm text-slate-600 mb-3 line-clamp-3">{post.description}</p>
                                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                                          <span>By {post.authorName}</span>
                                          <span>{new Date(post.timestamp).toLocaleDateString()}</span>
                                      </div>
                                      <div className="flex gap-2">
                                          <button onClick={() => handlePostAction(post, 'approved')} className="flex-1 bg-green-600 text-white py-1.5 rounded font-bold hover:bg-green-700 text-xs">Approve</button>
                                          <button onClick={() => setRejectingPost(post)} className="flex-1 bg-red-600 text-white py-1.5 rounded font-bold hover:bg-red-700 text-xs">Reject</button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                      
                      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><Calendar size={20}/> Pending Assessments <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full text-xs">{pendingAssessments.length}</span></h3>
                          <div className="space-y-3 max-h-[500px] overflow-y-auto">
                              {pendingAssessments.length === 0 ? <div className="text-center text-slate-400 py-10">No pending requests.</div> : pendingAssessments.map(evt => (
                                  <div key={evt.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                      <div className="flex justify-between items-start mb-2">
                                          <div className="font-bold text-slate-800">{evt.title}</div>
                                          <span className="text-xs font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded">{evt.category || 'Test'}</span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-3">
                                          <div><span className="font-bold">Date:</span> {evt.date}</div>
                                          <div><span className="font-bold">Subject:</span> {evt.subject}</div>
                                          <div><span className="font-bold">Teacher:</span> {evt.teacherName}</div>
                                          <div><span className="font-bold">Requester:</span> {evt.creatorName}</div>
                                      </div>
                                      {evt.description && <p className="text-xs text-slate-500 mb-3 bg-slate-50 p-2 rounded">{evt.description}</p>}
                                      <div className="flex gap-2">
                                          <button onClick={() => handleAssessmentAction(evt, 'approved')} className="flex-1 bg-green-600 text-white py-1.5 rounded font-bold hover:bg-green-700 text-xs">Approve</button>
                                          <button onClick={() => handleAssessmentAction(evt, 'rejected')} className="flex-1 bg-red-600 text-white py-1.5 rounded font-bold hover:bg-red-700 text-xs">Reject</button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              )}

              {/* DATABASE TAB */}
              {activeTab === 'database' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                      <div className="flex flex-col h-full">
                          <div className="flex justify-between items-center mb-4">
                              <h3 className="font-bold text-lg text-slate-800">Teachers Database</h3>
                              <div className="flex gap-2">
                                  {selectedTeacherIds.length > 0 && <button onClick={() => setBulkActionModal({isOpen: true, title: "Bulk Delete", message: `Delete ${selectedTeacherIds.length} teachers?`, onConfirm: handleBulkDeleteTeachers, type: 'danger'})} className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded font-bold">Delete ({selectedTeacherIds.length})</button>}
                                  {selectedTeacherIds.length > 0 && <button onClick={confirmBulkCreateAccounts} className="text-xs text-green-600 hover:bg-green-50 px-2 py-1 rounded font-bold">Create Accts ({selectedTeacherIds.length})</button>}
                                  <button onClick={() => setIsAddTeacherOpen(true)} className="bg-brand-600 text-white p-1.5 rounded hover:bg-brand-700"><Plus size={16}/></button>
                              </div>
                          </div>
                          <div className="mb-2"><input type="text" placeholder="Search Teachers..." value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)} className="w-full border p-2 rounded text-xs"/></div>
                          <div className="flex-1 overflow-y-auto border rounded-lg">
                              <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-50 sticky top-0"><tr><th className="p-2"><input type="checkbox" onChange={(e) => setSelectedTeacherIds(e.target.checked ? teachers.map(t => t.id) : [])}/></th><th className="p-2">Name</th><th className="p-2">Subject</th><th className="p-2">Email</th><th className="p-2">Action</th></tr></thead>
                                  <tbody>
                                      {teachers.filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase())).map(t => (
                                          <tr key={t.id} className="border-t hover:bg-slate-50">
                                              <td className="p-2"><input type="checkbox" checked={selectedTeacherIds.includes(t.id)} onChange={() => setSelectedTeacherIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])}/></td>
                                              <td className="p-2 font-bold">{t.name}</td>
                                              <td className="p-2">{t.subject}</td>
                                              <td className="p-2 text-slate-500">{t.email}</td>
                                              <td className="p-2 flex gap-1">
                                                  <button onClick={() => setEditTeacherData(t)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Edit2 size={12}/></button>
                                                  <button onClick={() => setCreateAccountTeacher(t)} className="text-green-600 hover:bg-green-50 p-1 rounded" title="Create Account"><PlusCircle size={12}/></button>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>

                      <div className="flex flex-col h-full">
                          <div className="flex justify-between items-center mb-4">
                              <h3 className="font-bold text-lg text-slate-800">Subjects Database</h3>
                              <button onClick={() => setIsAddSubjectOpen(true)} className="bg-brand-600 text-white p-1.5 rounded hover:bg-brand-700"><Plus size={16}/></button>
                          </div>
                          <div className="mb-2"><input type="text" placeholder="Search Subjects..." value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)} className="w-full border p-2 rounded text-xs"/></div>
                          <div className="flex-1 overflow-y-auto border rounded-lg bg-slate-50 p-2">
                              <div className="flex flex-wrap gap-2">
                                  {subjects.filter(s => s.toLowerCase().includes(subjectSearch.toLowerCase())).map(s => (
                                      <div key={s} className="bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 flex items-center gap-2 group hover:border-brand-300">
                                          {s}
                                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button onClick={() => setEditSubjectData(s)} className="text-blue-500 hover:text-blue-700"><Edit2 size={10}/></button>
                                              <button onClick={() => onDeleteSubject(s)} className="text-red-500 hover:text-red-700"><X size={10}/></button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {/* MANAGEMENT TAB */}
              {activeTab === 'management' && (
                  <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Feature Flags */}
                          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                              <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><Settings size={20}/> Feature Controls</h3>
                              <div className="space-y-3">
                                  {Object.keys(featureFlags).map((key) => (
                                      <div key={key} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                                          <span className="text-sm font-medium text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                          <button onClick={() => toggleFlag(key as keyof FeatureFlags)} className={`text-2xl transition-colors ${featureFlags[key as keyof FeatureFlags] ? 'text-green-500' : 'text-slate-300'}`}>
                                              {featureFlags[key as keyof FeatureFlags] ? <ToggleRight size={32} className="fill-green-100"/> : <ToggleLeft size={32}/>}
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          </div>

                          {/* Data Management */}
                          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                              <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><Database size={20}/> Data Management</h3>
                              <div className="grid grid-cols-2 gap-4 mb-6">
                                  <button onClick={handleExport} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-slate-200 hover:border-brand-500 hover:shadow-md transition-all gap-2">
                                      <Download size={24} className="text-brand-600"/>
                                      <span className="text-xs font-bold text-slate-600">{t.admin.exportData}</span>
                                  </button>
                                  <label className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-slate-200 hover:border-brand-500 hover:shadow-md transition-all gap-2 cursor-pointer">
                                      <Upload size={24} className="text-brand-600"/>
                                      <span className="text-xs font-bold text-slate-600">{t.admin.importData}</span>
                                      <input type="file" className="hidden" onChange={handleImport} accept=".json"/>
                                  </label>
                              </div>
                              
                              <div className="pt-6 border-t border-slate-200">
                                  <div className="flex items-center justify-between mb-4">
                                      <h4 className="font-bold text-slate-700">Super Admin Controls</h4>
                                      <button onClick={toggleSuperAdminMode} className={`text-xs font-bold px-2 py-1 rounded border ${isSuperAdminMode ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-400 border-slate-200'}`}>
                                          {isSuperAdminMode ? 'ENABLED' : 'DISABLED'}
                                      </button>
                                  </div>
                                  {isSuperAdminMode && (
                                      <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-xs text-red-800">
                                          <AlertTriangle size={16} className="inline mr-1 mb-0.5"/> 
                                          <strong>Caution:</strong> You are in unrestricted mode. Actions logged.
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>

                      {/* System Logs */}
                      <SystemLogs 
                          records={systemRecords} 
                          currentUser={currentUser} 
                          isSuperAdminMode={isSuperAdminMode}
                          onAddRecord={() => setAddRecordOpen(true)}
                          onEditRecord={(r) => setEditRecordData(r)}
                          onDeleteRecord={(r) => setDeleteRecordData(r)}
                          onDeleteAllRecords={() => setDeleteAllRecordsOpen(true)}
                          canManage={isSuperAdminMode}
                      />
                  </div>
              )}
          </div>
      </main>
    </div>
  );
};