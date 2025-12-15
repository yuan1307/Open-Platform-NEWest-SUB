
import React from 'react';
import { ScheduleMap, ClassPeriod } from '../types';
import { WEEKDAYS, getSubjectColor } from '../constants';
import { MapPin, AlertTriangle, Copy, Clock, BookOpen, Calendar, Plus } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface ScheduleGridProps {
  schedule: ScheduleMap;
  onCellClick?: (day: string, slot: number) => void;
  onCopyDay?: (day: string) => void;
  readOnly?: boolean;
}

const ScheduleGrid: React.FC<ScheduleGridProps> = ({ schedule, onCellClick, onCopyDay, readOnly = false }) => {
  const { t } = useLanguage();

  const getPeriod = (day: string, slot: number): ClassPeriod => { 
    const id = `${day}-${slot}`; 
    return schedule[id] || { id, subject: '', tasks: [] }; 
  };

  const checkHasOverdue = (period: ClassPeriod) => { 
    const today = new Date(); 
    today.setHours(0, 0, 0, 0); 
    return (period.tasks || []).some(t => t.dueDate ? new Date(t.dueDate) < today : false); 
  };

  // Mobile Card Component
  const MobilePeriodCard: React.FC<{ day: string, slot: number }> = ({ day, slot }) => {
      const period = getPeriod(day, slot);
      const hasSubject = !!period.subject;
      const bgColor = getSubjectColor(period.subject);
      const hasOverdue = checkHasOverdue(period);
      
      const safeTasks = period.tasks || [];
      const assessmentsCount = safeTasks.filter(t => t.category === 'Test' || t.category === 'Quiz').length;
      const assignmentsCount = safeTasks.filter(t => ['Project', 'Homework', 'Presentation', 'Others'].includes(t.category)).length;

      // Render placeholder for free periods to allow adding classes on mobile
      if (!hasSubject) {
          if (readOnly) return null; // Don't show empty slots in read-only mode (e.g. admin view) to save space
          return (
            <div 
                onClick={() => onCellClick && onCellClick(day, slot)}
                className="mb-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 overflow-hidden cursor-pointer active:bg-slate-100 transition-colors"
            >
                <div className="flex">
                    <div className="w-12 flex items-center justify-center border-r border-slate-200 text-xs font-bold text-slate-400">
                        P{slot + 1}
                    </div>
                    <div className="flex-1 p-3 flex items-center justify-center text-slate-400 text-xs font-medium gap-2">
                        <Plus size={14} /> {t.schedule.free}
                    </div>
                </div>
            </div>
          );
      }

      return (
          <div 
            onClick={() => !readOnly && onCellClick && onCellClick(day, slot)}
            className="mb-2 rounded-lg border border-slate-200 shadow-sm overflow-hidden bg-white"
          >
              <div className="flex" style={{ backgroundColor: bgColor }}>
                  <div className="w-12 flex items-center justify-center border-r border-black/5 bg-black/5 text-xs font-bold text-slate-600">
                      P{slot + 1}
                  </div>
                  <div className="flex-1 p-3">
                      <div className="flex justify-between items-start">
                          <h4 className="font-bold text-slate-800 text-sm">{period.subject}</h4>
                          {hasOverdue && <AlertTriangle size={14} className="text-red-500"/>}
                      </div>
                      <div className="flex justify-between items-end mt-1">
                          <div className="text-xs text-slate-600">
                              {period.teacherName && <div>{period.teacherName}</div>}
                              {period.room && <div className="flex items-center gap-1 text-[10px] text-slate-500"><MapPin size={10}/> {period.room}</div>}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                              {assessmentsCount > 0 && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">{assessmentsCount} {t.schedule.asmtShort}</span>}
                              {assignmentsCount > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">{assignmentsCount} {t.schedule.asgnShort}</span>}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="w-full pb-4">
      {/* Desktop/Tablet View (Table) */}
      <div className="hidden md:grid min-w-[800px] grid-cols-6 gap-0 border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white schedule-grid">
        <div className="bg-slate-50 p-2 border-b border-r border-slate-200 font-bold text-slate-500 text-center text-xs uppercase tracking-wider flex items-center justify-center">
            {t.schedule.period}
        </div>
        {WEEKDAYS.map(day => (
            <div key={day} className="bg-slate-50 p-2 border-b border-r border-slate-200 font-bold text-slate-700 text-center uppercase tracking-wider last:border-r-0 flex justify-between items-center group">
                <span className="flex-1 text-sm">{t.weekdays[day as keyof typeof t.weekdays]}</span>
                {!readOnly && onCopyDay && (
                    <button onClick={() => onCopyDay(day)} className="text-xs text-slate-300 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity p-1" title={t.schedule.copyDay}>
                        <Copy size={12} />
                    </button>
                )}
            </div>
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
            <React.Fragment key={i}>
                <div className="border-b border-r border-slate-200 bg-slate-50/50 p-1 flex items-center justify-center font-bold text-slate-400 text-xs">P{i + 1}</div>
                {WEEKDAYS.map(day => {
                    const period = getPeriod(day, i);
                    const hasSubject = !!period.subject;
                    const bgColor = getSubjectColor(period.subject);
                    const hasOverdue = checkHasOverdue(period);
                    const safeTasks = period.tasks || [];
                    
                    const assessmentsCount = safeTasks.filter(t => t.category === 'Test' || t.category === 'Quiz').length;
                    const assignmentsCount = safeTasks.filter(t => ['Project', 'Homework', 'Presentation', 'Others'].includes(t.category)).length;

                    return (
                        <div 
                            key={`${day}-${i}`} 
                            onClick={() => !readOnly && onCellClick && onCellClick(day, i)}
                            className={`min-h-[5rem] border-b border-r border-slate-200 p-1 ${!readOnly ? 'cursor-pointer hover:bg-slate-50' : ''} transition-colors flex flex-col gap-0.5 schedule-cell last:border-r-0 relative group ${hasSubject ? '' : 'bg-white'}`}
                            style={{ backgroundColor: hasSubject ? bgColor : undefined }}
                        >
                            {hasSubject ? (
                                <>
                                    <div className="font-bold text-xs leading-tight text-slate-800 line-clamp-2">{period.subject}</div>
                                    {period.teacherName && <div className="text-[9px] text-slate-500 font-medium truncate">{period.teacherName}</div>}
                                    {period.room && <div className="text-[9px] text-slate-400 flex items-center gap-1"><MapPin size={8}/> {period.room}</div>}
                                    <div className="mt-auto flex flex-wrap gap-0.5">
                                        {assessmentsCount > 0 && (
                                            <div className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 w-fit whitespace-nowrap" title={t.schedule.assessments}>
                                                {assessmentsCount} {t.schedule.asmtShort}
                                            </div>
                                        )}
                                        {assignmentsCount > 0 && (
                                            <div className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 w-fit whitespace-nowrap" title={t.schedule.assignments}>
                                                {assignmentsCount} {t.schedule.asgnShort}
                                            </div>
                                        )}
                                    </div>
                                    {hasOverdue && <div className="absolute top-1 right-1 text-red-500"><AlertTriangle size={10} /></div>}
                                </>
                            ) : (
                                !readOnly && <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 text-slate-300 text-[10px] uppercase font-bold tracking-widest">{t.schedule.free}</div>
                            )}
                        </div>
                    );
                })}
            </React.Fragment>
        ))}
      </div>

      {/* Mobile View (Vertical List) */}
      <div className="md:hidden space-y-6">
          {WEEKDAYS.map(day => (
              <div key={day}>
                  <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2 border-b border-slate-200 pb-1">
                      <Calendar size={16} className="text-brand-600"/> {t.weekdays[day as keyof typeof t.weekdays]}
                  </h3>
                  <div className="space-y-1">
                      {Array.from({ length: 8 }).map((_, i) => (
                          <MobilePeriodCard key={`${day}-${i}`} day={day} slot={i} />
                      ))}
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};

export default ScheduleGrid;
