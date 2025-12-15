
import React, { useState, useEffect, useMemo } from 'react';
import { User, AssessmentEvent, ScheduleMap, Teacher, ClassPeriod, Task, Importance, Urgency, FeatureFlags } from '../types';
import { db } from '../services/db';
import { audit } from '../services/audit';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Search, Trash2, Filter, ChevronDown, Clock, User as UserIcon, PlusCircle, Eye, Megaphone, School } from 'lucide-react';
import { AddAssessmentModal, ConfirmDeleteAssessmentModal, ConfirmAddToToDoModal, ViewAssessmentModal } from './AssessmentModals';
import { GRADE_LEVELS, DEFAULT_FLAGS } from '../constants';
import { useLanguage } from '../LanguageContext';

interface AssessmentCalendarProps { currentUser: User; schedule: ScheduleMap; subjects: string[]; teachers: Teacher[]; onScheduleUpdate: (newSchedule: ScheduleMap) => void; }

const AssessmentCalendar: React.FC<AssessmentCalendarProps> = ({ currentUser, schedule, subjects, teachers, onScheduleUpdate }) => {
  const { t, language } = useLanguage();
  const [events, setEvents] = useState<AssessmentEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteEvent, setDeleteEvent] = useState<AssessmentEvent | null>(null);
  const [showPendingAlert, setShowPendingAlert] = useState(false);
  const [addToDoEvent, setAddToDoEvent] = useState<AssessmentEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<AssessmentEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<AssessmentEvent | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [showRelatedOnly, setShowRelatedOnly] = useState(false);
  const [prefillDate, setPrefillDate] = useState('');

  // Identify roles
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'secondary_admin';
  const isTeacherIdentity = currentUser.role === 'teacher' || currentUser.id.includes('@basischina.com');
  const isStudentIdentity = !isTeacherIdentity; // Includes Students and Student-Admins

  useEffect(() => { 
      loadEvents();
      loadFlags();
      const interval = setInterval(loadEvents, 10000);
      return () => clearInterval(interval);
  }, []);

  const loadEvents = async () => { 
      const saved = await db.getItem<AssessmentEvent[]>('basis_assessment_events'); 
      if (saved) {
          // Migration logic: Ensure all events have a category. Default to 'Test' if missing.
          let hasChanges = false;
          const migrated = saved.map(e => {
              if (!e.category && !e.eventType) { // Legacy migration
                  hasChanges = true;
                  return { ...e, category: 'Test' as const, eventType: 'academic' as const };
              }
              if (!e.eventType) {
                  hasChanges = true;
                  return { ...e, eventType: 'academic' as const };
              }
              return e;
          });
          
          if (hasChanges) {
              await db.setItem('basis_assessment_events', migrated);
          }
          setEvents(migrated); 
      }
  };
  const loadFlags = async () => { const flags = await db.getItem<FeatureFlags>('basis_feature_flags'); if(flags) setFeatureFlags(flags); };
  
  const handleSaveEvent = async (eventData: Omit<AssessmentEvent, 'id' | 'creatorId' | 'creatorName'>) => {
    let newEvents = [...events];
    
    // Auto-approve logic
    let finalStatus = eventData.status;
    if (finalStatus === 'pending' && featureFlags.autoApproveRequests) {
        finalStatus = 'approved';
    }

    let savedEvent: AssessmentEvent;

    if (editingEvent) {
        // Edit existing
        savedEvent = { ...editingEvent, ...eventData, status: finalStatus };
        newEvents = newEvents.map(e => e.id === editingEvent.id ? savedEvent : e);
        if (eventData.eventType !== 'personal') {
            await audit.logAction(currentUser, 'EDIT_ASSESSMENT_CALENDAR', editingEvent.id, undefined, eventData.title);
        }
    } else {
        // Create new
        const newId = `evt-${Date.now()}`;
        savedEvent = { ...eventData, id: newId, creatorId: currentUser.id, creatorName: currentUser.name || 'Unknown', status: finalStatus };
        newEvents.push(savedEvent);
        
        if (savedEvent.status === 'pending') {
            setShowPendingAlert(true);
        } else {
            // Log logic based on event type and approval
            // For auto-approved assessments/events:
            // Actor: Requestor (Current User)
            // Details: Auto-accepted
            
            const logActionType = eventData.eventType === 'school' ? 'EDIT_EVENT_CALENDAR' : 'EDIT_ASSESSMENT_CALENDAR';
            const details = featureFlags.autoApproveRequests ? "Auto-accepted" : "Direct Add";

            if (eventData.eventType !== 'personal') {
                await audit.logAction(currentUser, logActionType, undefined, undefined, `${eventData.title} (${details})`);
            }
        }
    }

    setEvents(newEvents);
    await db.setItem('basis_assessment_events', newEvents);
    setEditingEvent(null);
    setPrefillDate('');
  };

  const handleDeleteEvent = async () => { 
      if (deleteEvent) { 
          const updated = events.filter(e => e.id !== deleteEvent.id); 
          setEvents(updated); 
          await db.setItem('basis_assessment_events', updated); 
          if (deleteEvent.eventType !== 'personal') {
              await audit.logAction(currentUser, 'EDIT_ASSESSMENT_CALENDAR', undefined, undefined, `Deleted: ${deleteEvent.title}`);
          }
          setDeleteEvent(null); 
      } 
  };

  // Helper: Fuzzy match for strings (token based) to handle typos like "Stated" vs "States"
  const isFuzzyMatch = (str1: string, str2: string) => {
      if (!str1 || !str2) return false;
      const normalize = (s: string) => s.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();
      const s1 = normalize(str1);
      const s2 = normalize(str2);
      
      // Direct substring check
      if (s1.includes(s2) || s2.includes(s1)) return true;

      // Token overlap check
      const tokens1 = s1.split(/\s+/).filter(t => t.length > 2); 
      const tokens2 = s2.split(/\s+/).filter(t => t.length > 2);
      
      // If either has no significant tokens, fallback to exact/contains
      if (tokens1.length === 0 || tokens2.length === 0) return s1.includes(s2) || s2.includes(s1);

      // Check intersection
      const intersection = tokens1.filter(t => tokens2.some(t2 => t2.includes(t) || t.includes(t2)));
      
      return intersection.length >= 2 || (tokens1.length === 1 && intersection.length === 1);
  };

  const handleAddToToDo = async () => {
      if (!addToDoEvent) return;
      const event = addToDoEvent;
      
      // School events cannot be added as Assessment/Quiz linked tasks in the same way (no subject).
      if (event.eventType === 'school') return;

      const newSchedule = { ...schedule };
      
      // We want to add this task to ALL periods that match the event subject
      const matchingPeriods: string[] = [];
      
      if (event.eventType !== 'personal') {
          Object.keys(newSchedule).forEach(key => {
              if (newSchedule[key].subject && isFuzzyMatch(newSchedule[key].subject, event.subject)) {
                  matchingPeriods.push(key);
              }
          });
      }
      
      // If no matches (or it's personal/unlinked), find the first available slot or fallback to Mon-0
      if (matchingPeriods.length === 0) {
          if (!newSchedule['Mon-0']) {
              newSchedule['Mon-0'] = { id: 'Mon-0', subject: '', tasks: [] };
          }
          matchingPeriods.push('Mon-0');
      }

      const newTask: Task = {
          id: `t-cal-${Date.now()}`,
          title: event.title,
          description: `Imported from Calendar. ${event.eventType !== 'personal' ? `Teacher: ${event.teacherName}` : ''}\n${event.description || ''}`,
          category: (event.category === 'Quiz') ? 'Quiz' : (event.eventType === 'personal' ? 'Personal' : 'Test'),
          importance: Importance.High,
          urgency: Urgency.High,
          dueDate: event.date,
          completed: false,
          source: 'student',
          subject: event.subject !== 'Personal' ? event.subject : undefined
      };

      // Add to all identified periods
      matchingPeriods.forEach(periodId => {
          if (newSchedule[periodId]) {
              newSchedule[periodId] = {
                  ...newSchedule[periodId],
                  tasks: [...(newSchedule[periodId].tasks || []), newTask]
              };
          }
      });

      // Update parent state directly (No Reload!)
      onScheduleUpdate(newSchedule);
      alert("Added to your To Do List!");
      setAddToDoEvent(null);
  };

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const filteredEvents = useMemo(() => {
      return events.filter(evt => {
          // Hide pending events from students who didn't create them
          if (evt.status === 'pending' && !isTeacherIdentity && !isAdmin && evt.creatorId !== currentUser.id) return false;
          
          if (evt.eventType === 'personal') {
              return evt.creatorId === currentUser.id;
          }

          // Filter logic for Students (and Student Admins)
          if (isStudentIdentity && evt.eventType === 'academic') {
              if (showRelatedOnly) {
                  // Fuzzy matching for Teachers and Subjects
                  const periods = Object.values(schedule) as ClassPeriod[];
                  
                  // Split event teacher string (e.g. "Smith, Jones")
                  const evtTeacherLower = evt.teacherName.toLowerCase();
                  const evtTeachers = evtTeacherLower.split(/[,\/&;]+/).map(t => t.trim()).filter(t => t.length > 0);

                  const matches = periods.some(p => {
                      if (!p.subject || !p.teacherName) return false;
                      
                      // Fuzzy subject match
                      const subMatch = isFuzzyMatch(evt.subject, p.subject);
                      
                      // Fuzzy Teacher Match (Tokenized)
                      const pTeacherLower = p.teacherName.toLowerCase();
                      const pTokens = pTeacherLower.split(/[\s,.]+/).filter(t => t.length > 1);
                      
                      const teacherMatch = evtTeachers.some(evtT => {
                          const evtTokens = evtT.split(/[\s,.]+/).filter(t => t.length > 1);
                          return pTokens.some(token => evtT.includes(token)) || evtTokens.some(token => pTeacherLower.includes(token));
                      });
                      
                      return subMatch && teacherMatch;
                  });
                  if (!matches) return false;
              }
          }

          if (searchQuery) { if (!evt.title.toLowerCase().includes(searchQuery.toLowerCase()) && !evt.subject.toLowerCase().includes(searchQuery.toLowerCase())) return false; }
          if (gradeFilter) { if (!evt.gradeLevels.includes(gradeFilter)) return false; }
          return true;
      });
  }, [events, isStudentIdentity, isTeacherIdentity, isAdmin, schedule, searchQuery, gradeFilter, currentUser.id, showRelatedOnly]);

  const getEventsForDay = (day: number) => {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      return filteredEvents.filter(e => e.date === `${year}-${month}-${dayStr}`);
  };

  const isToday = (day: number) => { const today = new Date(); return day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear(); };
  const isPast = (day: number) => { return new Date(currentDate.getFullYear(), currentDate.getMonth(), day) < new Date(new Date().setHours(0,0,0,0)); };

  const canEdit = (evt: AssessmentEvent) => {
      if (isAdmin) return true;
      if (evt.creatorId === currentUser.id) return true;
      if (currentUser.role === 'teacher' && evt.teacherName.includes(currentUser.name || '')) return true;
      return false;
  };

  const getEventStyle = (evt: AssessmentEvent) => {
      if (evt.status === 'pending') return 'bg-yellow-50 border-yellow-300 text-yellow-800 border-dashed';
      
      if (evt.eventType === 'personal') return 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100';
      if (evt.eventType === 'school') return 'bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100';
      
      // Academic (Assessment)
      return 'bg-red-50 border-red-200 text-red-900 hover:bg-red-100';
  };

  const handleDayClick = (day: number) => {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayStr}`;
      
      setEditingEvent(null);
      
      // Use event object to prefill modal
      setEditingEvent({
          id: '',
          title: '',
          subject: '',
          teacherName: '',
          gradeLevels: [],
          date: dateStr,
          creatorId: '',
          creatorName: '',
          status: 'approved',
          eventType: 'academic',
          category: 'Test',
          description: ''
      } as AssessmentEvent);
      // Hack: we abuse editingEvent to pass partial data or logic, but standard IsAddOpen might be cleaner if refactored.
      // Current modal logic checks eventToEdit. If present, prefills.
      // So passing a dummy event with just date works.
  };

  // Locale handling
  const localeMap: {[key: string]: string} = {
      'en': 'en-US',
      'zh': 'zh-CN',
      'zh-TW': 'zh-TW',
      'es': 'es-ES',
      'hi': 'hi-IN'
  };
  const currentLocale = localeMap[language] || 'en-US';

  const dayHeaders = [t.weekdays.Sun, t.weekdays.Mon, t.weekdays.Tue, t.weekdays.Wed, t.weekdays.Thu, t.weekdays.Fri, t.weekdays.Sat];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Reusing AddAssessmentModal for both Add and Edit */}
      {(isAddOpen || editingEvent) && (
        <AddAssessmentModal 
            isOpen={true} 
            onClose={() => { setIsAddOpen(false); setEditingEvent(null); }} 
            onSave={handleSaveEvent} 
            subjects={subjects} 
            currentUserRole={currentUser.role} 
            currentUserName={currentUser.name || ''} 
            teachers={teachers} 
            eventToEdit={editingEvent || undefined}
        />
      )}
      
      {viewingEvent && (
          <ViewAssessmentModal 
              isOpen={true} 
              onClose={() => setViewingEvent(null)} 
              event={viewingEvent} 
          />
      )}
      
      <ConfirmDeleteAssessmentModal isOpen={!!deleteEvent} onClose={() => setDeleteEvent(null)} onConfirm={handleDeleteEvent} title={deleteEvent?.title || ''} />
      <ConfirmAddToToDoModal isOpen={!!addToDoEvent} onClose={() => setAddToDoEvent(null)} onConfirm={handleAddToToDo} />
      
      {showPendingAlert && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white px-6 py-3 rounded-xl shadow-xl font-bold animate-in slide-in-from-top-4 flex items-center gap-3 w-11/12 md:w-auto">
              <Clock size={20} />
              <div><div className="text-sm">{t.calendar.requestPending}</div><div className="text-xs font-normal opacity-90">{t.calendar.requestPendingMsg}</div></div>
              <button onClick={() => setShowPendingAlert(false)} className="ml-2 hover:bg-white/20 p-1 rounded"><Clock size={16} /></button>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div><h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2"><CalendarIcon className="text-brand-600" /> {t.calendar.header}</h1><p className="text-slate-500 text-sm mt-1">{isTeacherIdentity || isAdmin ? t.calendar.staffSub : t.calendar.studentSub}</p></div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center w-full md:w-auto">
                <div className="relative w-full sm:w-auto"><Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} /><input type="text" placeholder={t.common.search} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand-500 w-full sm:w-32 md:w-48" /></div>
                
                {isStudentIdentity && (
                    <button 
                        onClick={() => setShowRelatedOnly(!showRelatedOnly)}
                        className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-sm border transition-colors ${showRelatedOnly ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                        {showRelatedOnly ? <Filter size={16}/> : <Filter size={16}/>}
                        {t.calendar.showRelatedOnly}
                    </button>
                )}

                {(isTeacherIdentity || isAdmin) && <div className="relative w-full sm:w-auto"><Filter className="absolute left-2.5 top-2.5 text-slate-400" size={14} /><select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="pl-8 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none appearance-none w-full"><option value="">{t.calendar.allGrades}</option>{GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}</select><ChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={12} /></div>}
                
                <button onClick={() => setIsAddOpen(true)} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-brand-700 flex items-center gap-2 text-sm shadow-md w-full sm:w-auto justify-center"><Plus size={16} /> {isTeacherIdentity || isAdmin ? t.calendar.addEvent : t.calendar.requestEvent}</button>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="p-4 flex justify-between items-center bg-slate-50 border-b border-slate-200">
                <button onClick={prevMonth} className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><ChevronLeft size={20} /></button>
                <h2 className="text-lg font-bold text-slate-800 capitalize">
                    {currentDate.toLocaleString(currentLocale, { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={nextMonth} className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><ChevronRight size={20} /></button>
            </div>
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">{dayHeaders.map((d, i) => (<div key={i} className="p-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">{d}</div>))}</div>
            <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)] bg-slate-200 gap-px border-b border-slate-200">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (<div key={`empty-${i}`} className="bg-slate-50/30"></div>))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dayEvents = getEventsForDay(day);
                    const today = isToday(day);
                    const past = isPast(day);
                    return (
                        <div 
                            key={day} 
                            onClick={(e) => { 
                                // Only trigger if clicking blank area
                                if (e.target === e.currentTarget) handleDayClick(day); 
                            }}
                            className={`bg-white p-2 min-h-[120px] relative transition-colors group cursor-pointer ${past ? 'bg-slate-50' : 'hover:bg-blue-50/30'} ${today ? 'ring-2 ring-inset ring-yellow-400 bg-yellow-50/20' : ''}`}
                        >
                            <div className="pointer-events-none"> {/* Prevent label blocking click */}
                                <div className={`text-sm font-bold mb-2 flex justify-between items-center ${today ? 'text-brand-700' : past ? 'text-slate-400' : 'text-slate-700'}`}><span className={`${today ? 'bg-yellow-400 text-white w-7 h-7 flex items-center justify-center rounded-full shadow-sm' : ''}`}>{day}</span>{today && <span className="text-[10px] uppercase font-extrabold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">{t.calendar.today}</span>}</div>
                            </div>
                            <div className="space-y-1.5">{dayEvents.map(evt => (
                                <div 
                                    key={evt.id} 
                                    onClick={(e) => {
                                        e.stopPropagation(); 
                                        canEdit(evt) ? setEditingEvent(evt) : setViewingEvent(evt);
                                    }}
                                    className={`p-1.5 rounded border text-xs relative group/evt shadow-sm cursor-pointer transition-all hover:shadow-md ${past ? 'opacity-60 grayscale' : getEventStyle(evt)}`}
                                >
                                    {/* Hide 'Test' or 'Quiz' badge for school events */}
                                    <div className="flex justify-between items-start">
                                        <div className="font-bold leading-tight">
                                            {evt.eventType === 'personal' && <UserIcon size={10} className="inline mr-1"/>}
                                            {evt.eventType === 'school' && <Megaphone size={10} className="inline mr-1"/>}
                                            {evt.title} {evt.status === 'pending' && '(Pending)'}
                                        </div>
                                        {isStudentIdentity && evt.eventType !== 'school' && <button onClick={(e) => { e.stopPropagation(); setAddToDoEvent(evt); }} className="opacity-0 group-hover/evt:opacity-100 hover:text-black/50 p-0.5 rounded"><PlusCircle size={12}/></button>}
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        {evt.category && (evt.eventType !== 'school' || (evt.category !== 'Test' && evt.category !== 'Quiz')) && (
                                            <span className="text-[9px] px-1 rounded bg-black/5 text-black/70 font-bold">{evt.category}</span>
                                        )}
                                        {evt.subject && evt.subject !== 'Personal' && evt.subject !== 'School Event' && <div className="text-[9px] font-medium truncate max-w-[60px]">{evt.subject}</div>}
                                    </div>
                                    {canEdit(evt) && (<button onClick={(e) => { e.stopPropagation(); setDeleteEvent(evt); }} className="absolute bottom-1 right-1 text-slate-400 hover:text-red-500 opacity-0 group-hover/evt:opacity-100 transition-opacity bg-white/80 rounded"><Trash2 size={12} /></button>)}
                                </div>
                            ))}</div>
                        </div>
                    );
                })}
            </div>
          </div>
      </div>
    </div>
  );
};
export default AssessmentCalendar;
