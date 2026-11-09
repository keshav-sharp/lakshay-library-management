import React, { useState } from 'react';
import { ShiftItem } from '../types/shift';
import { useTheme } from '../context/ThemeContext';
import { 
  addCustomShift, 
  updateShift, 
  deleteShift, 
  resetShiftsToDefaults 
} from '../services/shiftService';
import { 
  X, 
  Clock, 
  Plus, 
  Edit3, 
  Trash2, 
  IndianRupee, 
  Check, 
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { ThemeColors } from '../types/theme';

interface ShiftManagerModalProps {
  shifts: ShiftItem[];
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeColors;
}

export const ShiftManagerModal: React.FC<ShiftManagerModalProps> = ({
  shifts,
  isOpen,
  onClose,
  theme,
}) => {
  const { darkModeClass } = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New Shift form state
  const [newLabel, setNewLabel] = useState('');
  const [newTimings, setNewTimings] = useState('');
  const [newFee, setNewFee] = useState('1200');
  const [newDescription, setNewDescription] = useState('');

  // Edit Shift form state
  const [editLabel, setEditLabel] = useState('');
  const [editTimings, setEditTimings] = useState('');
  const [editFee, setEditFee] = useState('1200');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newTimings.trim()) return;

    addCustomShift({
      label: newLabel.trim(),
      timings: newTimings.trim(),
      defaultFee: parseFloat(newFee) || 1200,
      description: newDescription.trim() || undefined,
    });

    setNewLabel('');
    setNewTimings('');
    setNewFee('1200');
    setNewDescription('');
    setIsAdding(false);
  };

  const startEdit = (shift: ShiftItem) => {
    setEditingId(shift.id);
    setEditLabel(shift.label);
    setEditTimings(shift.timings);
    setEditFee(shift.defaultFee.toString());
  };

  const handleSaveEdit = (id: string) => {
    if (!editLabel.trim() || !editTimings.trim()) return;

    updateShift(id, {
      label: editLabel.trim(),
      timings: editTimings.trim(),
      defaultFee: parseFloat(editFee) || 1200,
    });
    setEditingId(null);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 ${darkModeClass}`}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b border-slate-100 flex items-center justify-between ${theme.headerBg} text-white`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border border-white/20">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Customize Shift Timings &amp; Pricing
              </h3>
              <p className="text-xs text-white/80">
                Lakshay Library &bull; Manage standard shift schedule and default monthly fees
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Shifts &amp; Pricing ({shifts.length})
              </h4>
              <p className="text-xs text-slate-500">
                These shifts automatically appear in student registration with auto-filled fee pricing.
              </p>
            </div>

            {!isAdding && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white ${theme.primary} ${theme.primaryHover} rounded-xl shadow-xs transition-all`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Shift</span>
              </button>
            )}
          </div>

          {/* Add New Shift Form */}
          {isAdding && (
            <form onSubmit={handleCreate} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Create New Custom Shift
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Shift Name / Label *
                  </label>
                  <input
                    type="text"
                    required
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. Early Bird Shift, Weekend Pass"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Timings (Hours) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTimings}
                    onChange={(e) => setNewTimings(e.target.value)}
                    placeholder="e.g. 06:00 AM - 10:00 AM"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Default Monthly Fee (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="100"
                    step="50"
                    value={newFee}
                    onChange={(e) => setNewFee(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Short Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="e.g. Reserved desk for morning hours"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 text-xs font-semibold text-white ${theme.primary} ${theme.primaryHover} rounded-xl shadow-xs`}
                >
                  Save Shift
                </button>
              </div>
            </form>
          )}

          {/* Shift List */}
          <div className="space-y-2.5">
            {shifts.map((shift) => {
              const isEditing = editingId === shift.id;

              if (isEditing) {
                return (
                  <div key={shift.id} className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-300 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Label</label>
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Timings</label>
                        <input
                          type="text"
                          value={editTimings}
                          onChange={(e) => setEditTimings(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Fee (₹)</label>
                        <input
                          type="number"
                          value={editFee}
                          onChange={(e) => setEditFee(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(shift.id)}
                        className="px-3 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Update Shift</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={shift.id}
                  className="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-between shadow-2xs gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-700">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{shift.label}</span>
                        {shift.isSystem && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Standard
                          </span>
                        )}
                        {!shift.isSystem && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            Custom
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {shift.timings}
                      </div>
                      {shift.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{shift.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center justify-end text-sm font-bold text-slate-900">
                        <IndianRupee className="w-3.5 h-3.5" />
                        <span>{shift.defaultFee.toLocaleString('en-IN')}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">per month</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(shift)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit timings & fee"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {!shift.isSystem && (
                        <button
                          type="button"
                          onClick={() => deleteShift(shift.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete custom shift"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-start gap-2 border border-slate-200">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <span>
              Tip: You can also specify an on-the-fly custom shift timing and custom fee amount right inside the <strong>Add Student</strong> dialog.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset all shifts to standard presets?')) {
                resetShiftsToDefaults();
              }
            }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restore Default Shifts</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 text-xs font-semibold text-white ${theme.primary} ${theme.primaryHover} rounded-xl shadow-xs`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
