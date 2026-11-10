import React, { useState, useEffect, useMemo } from 'react';
import { Student } from '../types/student';
import { useTheme } from '../context/ThemeContext';
import { getDaysDifference, formatDueDateDisplay } from '../services/storageService';
import {
  SeatItem,
  getStoredSeats,
  addCustomSeat,
  addNextSeatInSection,
  addSectionWithSeats,
  removeSeatByNumber,
  resetSeatsToDefaults,
  subscribeToSeats,
} from '../services/seatService';
import {
  X,
  Armchair,
  Plus,
  Trash2,
  Settings2,
  RotateCcw,
  FolderPlus,
  Check,
  Minus,
  UserPlus,
  Clock,
  Calendar,
  ExternalLink,
} from 'lucide-react';

interface SeatMatrixModalProps {
  students: Student[];
  isOpen: boolean;
  onClose: () => void;
  onSelectStudent: (student: Student) => void;
  onAddStudentToSeat: (seatNumber: string) => void;
}

export const SeatMatrixModal: React.FC<SeatMatrixModalProps> = ({
  students,
  isOpen,
  onClose,
  onSelectStudent,
  onAddStudentToSeat,
}) => {
  const { darkModeClass } = useTheme();
  const [seats, setSeats] = useState<SeatItem[]>(getStoredSeats());
  const [isManageMode, setIsManageMode] = useState(false);
  const [activePreviewSeat, setActivePreviewSeat] = useState<string | null>(null);

  // Add individual seat inputs
  const [newSeatNumber, setNewSeatNumber] = useState('');
  const [newSeatSection, setNewSeatSection] = useState('A');

  // Add new section inputs
  const [showAddSectionForm, setShowAddSectionForm] = useState(false);
  const [newSectionName, setNewSectionName] = useState('D');
  const [newSectionCount, setNewSectionCount] = useState('10');
  const [newSectionZone, setNewSectionZone] = useState('Silent Reading Zone');

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToSeats(() => {
      setSeats([...getStoredSeats()]);
    });
    return unsub;
  }, []);

  const showTempFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const studentBySeat = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => {
      map.set(s.seatNumber.trim().toUpperCase(), s);
    });
    return map;
  }, [students]);

  const mergedSeats = useMemo(() => {
    const list = [...seats];
    const existingNumbers = new Set(list.map((s) => s.seatNumber));
    students.forEach((std) => {
      const num = std.seatNumber.trim().toUpperCase();
      if (num && !existingNumbers.has(num)) {
        existingNumbers.add(num);
        const sec = num.includes('-') ? num.split('-')[0] : num.charAt(0) || 'A';
        list.push({
          id: `dynamic_${num}`,
          seatNumber: num,
          section: sec,
          zoneLabel: 'Custom Assigned Desk',
        });
      }
    });
    return list;
  }, [seats, students]);

  const sectionsMap = useMemo(() => {
    const grouped = new Map<string, SeatItem[]>();
    mergedSeats.forEach((seat) => {
      const sec = seat.section || 'A';
      if (!grouped.has(sec)) {
        grouped.set(sec, []);
      }
      grouped.get(sec)!.push(seat);
    });

    grouped.forEach((list) => {
      list.sort((a, b) =>
        a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true, sensitivity: 'base' })
      );
    });

    return grouped;
  }, [mergedSeats]);

  if (!isOpen) return null;

  const totalSeats = mergedSeats.length;
  const occupiedCount = students.length;
  const vacantCount = Math.max(0, totalSeats - occupiedCount);
  const expiringCount = students.filter((s) => getDaysDifference(s.nextFeeDueDate) <= 3).length;

  const previewSeatObj = activePreviewSeat
    ? mergedSeats.find((s) => s.seatNumber === activePreviewSeat) || null
    : null;
  const previewStudent = activePreviewSeat ? studentBySeat.get(activePreviewSeat) || null : null;

  const handleAddSingleSeat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeatNumber.trim()) return;
    const formatted = newSeatNumber.trim().toUpperCase();
    addCustomSeat(formatted, newSeatSection.trim().toUpperCase() || undefined);
    setNewSeatNumber('');
    showTempFeedback(`Added desk ${formatted}`);
  };

  const handleAddNewSection = (e: React.FormEvent) => {
    e.preventDefault();
    const sec = newSectionName.trim().toUpperCase();
    const count = parseInt(newSectionCount, 10) || 5;
    if (!sec) return;
    const added = addSectionWithSeats(sec, Math.min(30, Math.max(1, count)), newSectionZone);
    setShowAddSectionForm(false);
    showTempFeedback(`Added Section ${sec} with ${added.length} desks`);
  };

  const handleRemoveSeat = (seatNumber: string) => {
    const occupant = studentBySeat.get(seatNumber);
    if (occupant) {
      showTempFeedback(`Cannot remove ${seatNumber}: Occupied by ${occupant.name}`);
      return;
    }
    removeSeatByNumber(seatNumber);
    if (activePreviewSeat === seatNumber) setActivePreviewSeat(null);
    showTempFeedback(`Removed desk ${seatNumber}`);
  };

  const handleRemoveLastVacantInSection = (section: string) => {
    const sectionSeats = sectionsMap.get(section) || [];
    for (let i = sectionSeats.length - 1; i >= 0; i--) {
      const candidate = sectionSeats[i];
      if (!studentBySeat.has(candidate.seatNumber)) {
        removeSeatByNumber(candidate.seatNumber);
        showTempFeedback(`Removed desk ${candidate.seatNumber} from Section ${section}`);
        return;
      }
    }
    showTempFeedback(`No vacant desks available to remove in Section ${section}`);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/55 backdrop-blur-xs animate-in fade-in duration-200 ${darkModeClass}`}
      onClick={onClose}
    >
      {/* Modern Slide-Over Drawer (Right on Desktop, Bottom Sheet on Mobile) */}
      <div
        className="bg-white w-full max-w-full sm:max-w-2xl h-[90vh] sm:h-full rounded-t-3xl sm:rounded-t-none sm:rounded-l-3xl shadow-2xl border-t sm:border-t-0 sm:border-l border-slate-200/60 flex flex-col min-w-0 overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/60 flex items-center justify-between bg-white shrink-0 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 flex items-center justify-center shrink-0">
              <Armchair className="w-5 h-5" />
            </div>
            <div className="min-w-0 truncate">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                Minimalist Desk Matrix
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Tap any desk tile to inspect student shift &amp; actions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsManageMode(!isManageMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all touch-manipulation ${
                isManageMode
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200/60 hover:bg-slate-100'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{isManageMode ? 'Done' : 'Customize'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors touch-manipulation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unified Metrics & Micro-Indicator Legend Bar */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-50/70 border-b border-slate-200/60 flex items-center justify-between flex-wrap gap-2 shrink-0 min-w-0">
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.65)]" />
              Available ({vacantCount})
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.65)]" />
              Expiring / Due ({expiringCount})
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Occupied ({ Math.max(0, occupiedCount - expiringCount) })
            </span>
          </div>

          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
            Total Capacity: <strong className="text-slate-900 font-mono">{totalSeats} Desks</strong>
          </div>
        </div>

        {/* Customize Seats Toolbar */}
        {isManageMode && (
          <div className="px-6 py-4 bg-amber-50/50 border-b border-amber-200/60 space-y-3 animate-in fade-in shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold text-amber-900">
                Add individual desks or append entire rows:
              </span>
              <button
                type="button"
                onClick={() => setShowAddSectionForm(!showAddSectionForm)}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-amber-800 border border-amber-200/60 text-xs font-semibold flex items-center gap-1 shadow-xs"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
                <span>{showAddSectionForm ? 'Hide Row Builder' : '+ New Section Row'}</span>
              </button>
            </div>

            <form onSubmit={handleAddSingleSeat} className="flex items-end gap-2 flex-wrap">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Desk Code
                </label>
                <input
                  type="text"
                  value={newSeatNumber}
                  onChange={(e) => setNewSeatNumber(e.target.value)}
                  placeholder="e.g. A-16, D-01"
                  className="px-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs font-mono uppercase w-36 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Row
                </label>
                <input
                  type="text"
                  value={newSeatSection}
                  onChange={(e) => setNewSeatSection(e.target.value)}
                  placeholder="A, B..."
                  className="px-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs font-mono uppercase w-20 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Desk</span>
              </button>
            </form>

            {showAddSectionForm && (
              <form
                onSubmit={handleAddNewSection}
                className="p-3 bg-white rounded-2xl border border-slate-200/60 flex items-end gap-2.5 flex-wrap animate-in fade-in"
              >
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Row Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-mono uppercase w-16"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Desks
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={newSectionCount}
                    onChange={(e) => setNewSectionCount(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl text-xs w-20"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Zone Label
                  </label>
                  <input
                    type="text"
                    value={newSectionZone}
                    onChange={(e) => setNewSectionZone(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Create</span>
                </button>
              </form>
            )}
          </div>
        )}

        {feedbackMsg && (
          <div className="px-6 py-2 bg-slate-900 text-amber-300 text-xs font-medium flex items-center justify-between shrink-0">
            <span>{feedbackMsg}</span>
            <button type="button" onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-white">
              &times;
            </button>
          </div>
        )}

        {/* Interactive Compact Preview Popover Card (Displays on Tap/Hover of any Tile) */}
        <div className="px-6 pt-4 shrink-0">
          {activePreviewSeat ? (
            <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/60 shadow-sm flex items-center justify-between gap-3 flex-wrap animate-in fade-in duration-150">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl font-mono text-xs font-bold flex items-center justify-center shrink-0 border ${
                    !previewStudent
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                      : getDaysDifference(previewStudent.nextFeeDueDate) <= 3
                      ? 'bg-amber-50 text-amber-800 border-amber-200/60'
                      : 'bg-slate-100 text-slate-800 border-slate-200/60'
                  }`}
                >
                  {activePreviewSeat}
                </div>

                {previewStudent ? (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {previewStudent.name}
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                        ₹{previewStudent.monthlyFee}/mo
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" />
                        {previewStudent.shiftTimings.split('(')[0].trim()}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Due: {formatDueDateDisplay(previewStudent.nextFeeDueDate)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-emerald-700">
                      Desk {activePreviewSeat} &bull; Available
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {previewSeatObj?.zoneLabel || 'Silent Reading Zone'} &bull; Ready for assignment
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {previewStudent ? (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStudent(previewStudent);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <span>Open Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleRemoveSeat(activePreviewSeat)}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAddStudentToSeat(activePreviewSeat);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Assign Student</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-50/60 border border-slate-200/60 text-xs text-slate-500 flex items-center justify-between">
              <span>Hover or tap any desk tile below to preview student details or assign a vacant seat.</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Interactive Grid</span>
            </div>
          )}
        </div>

        {/* Minimalist Sections & Compact Seat Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden space-y-4 sm:space-y-5 flex-1 min-w-0 max-w-full">
          {Array.from(sectionsMap.entries()).map(([sectionName, sectionSeats]) => (
            <div
              key={sectionName}
              className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Section {sectionName}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {sectionSeats.length} desks
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    &bull; {sectionSeats[0]?.zoneLabel || 'Silent Reading Zone'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleRemoveLastVacantInSection(sectionName)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200/60 text-[11px] font-semibold transition-colors"
                    title={`Remove last vacant seat in Section ${sectionName}`}
                  >
                    <Minus className="w-3 h-3" />
                    <span>Seat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const added = addNextSeatInSection(sectionName);
                      showTempFeedback(`Added ${added.seatNumber} to Section ${sectionName}`);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-700 border border-slate-200/60 text-[11px] font-semibold transition-colors"
                    title={`Add next seat to Section ${sectionName}`}
                  >
                    <Plus className="w-3 h-3" />
                    <span>Seat</span>
                  </button>
                </div>
              </div>

              {/* Clean, Unobstructed Micro-Indicator Grid */}
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                {sectionSeats.map((seatObj) => {
                  const seatNum = seatObj.seatNumber;
                  const student = studentBySeat.get(seatNum);
                  const isPreviewed = activePreviewSeat === seatNum;

                  const diffDays = student ? getDaysDifference(student.nextFeeDueDate) : 999;
                  const isExpiringOrOverdue = student ? diffDays <= 3 : false;

                  // Micro-indicator dot color
                  const dotClass = !student
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.65)]'
                    : isExpiringOrOverdue
                    ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.75)]'
                    : 'bg-slate-400';

                  // Subtle tile surface
                  const tileSurfaceClass = !student
                    ? 'bg-emerald-50/40 hover:bg-emerald-50/80 border-emerald-200/60 text-slate-800'
                    : isExpiringOrOverdue
                    ? 'bg-amber-50/50 hover:bg-amber-50/90 border-amber-300/70 text-slate-900'
                    : 'bg-slate-50/80 hover:bg-slate-100/90 border-slate-200/60 text-slate-800';

                  return (
                    <button
                      key={seatObj.id}
                      type="button"
                      onMouseEnter={() => setActivePreviewSeat(seatNum)}
                      onClick={() => {
                        setActivePreviewSeat(seatNum);
                        if (isManageMode && !student) {
                          handleRemoveSeat(seatNum);
                        } else if (isPreviewed) {
                          if (student) {
                            onSelectStudent(student);
                            onClose();
                          } else {
                            onAddStudentToSeat(seatNum);
                            onClose();
                          }
                        }
                      }}
                      className={`relative h-12 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all shadow-2xs hover:shadow-md ${tileSurfaceClass} ${
                        isPreviewed ? 'ring-2 ring-amber-500 scale-[1.03]' : ''
                      }`}
                    >
                      <span className="font-mono text-xs font-bold tracking-tight">
                        {seatNum}
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Footer Restore Action */}
          <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Tap a tile once to preview, or tap again to open/assign.</span>
            <button
              type="button"
              onClick={() => {
                resetSeatsToDefaults();
                showTempFeedback('Restored default 45 library desks');
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/60"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Layout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
