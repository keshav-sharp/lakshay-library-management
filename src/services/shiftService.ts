import { assertProductionWritesAllowed, isRecoveryOnlyMode, setRecoveryOnlyMode } from './storageService';
import { ShiftItem, INITIAL_SHIFTS } from '../types/shift';

const SHIFTS_STORAGE_KEY = 'lakshay_app_shifts';

type ShiftListener = () => void;
const shiftListeners: Set<ShiftListener> = new Set();

const notifyShiftListeners = () => {
  shiftListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });

  try {
    import('./googleDriveSyncService').then((m) => {
      m.triggerLivePrimaryAutoSync();
    }).catch(() => {});
  } catch {
    // Ignore
  }
};

export const getStoredShifts = (): ShiftItem[] => {
  try {
    const raw = localStorage.getItem(SHIFTS_STORAGE_KEY);
    if (raw === null) {
      if (!isRecoveryOnlyMode()) {
        localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(INITIAL_SHIFTS));
      }
      return INITIAL_SHIFTS;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      setRecoveryOnlyMode(true);
      return INITIAL_SHIFTS; // Display fallback only; preserve the original bytes.
    }
    return parsed as ShiftItem[];
  } catch {
    setRecoveryOnlyMode(true);
    return INITIAL_SHIFTS;
  }
};

export const addCustomShift = (shift: Omit<ShiftItem, 'id' | 'isSystem'>): ShiftItem => {
  assertProductionWritesAllowed();
  const shifts = getStoredShifts();
  const newShift: ShiftItem = {
    ...shift,
    id: `shift_${Date.now()}`,
    isSystem: false,
  };
  const updated = [...shifts, newShift];
  localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(updated));
  notifyShiftListeners();
  return newShift;
};

export const updateShift = (id: string, updates: Partial<Omit<ShiftItem, 'id'>>): ShiftItem => {
  assertProductionWritesAllowed();
  const shifts = getStoredShifts();
  const index = shifts.findIndex((s) => s.id === id);
  if (index === -1) throw new Error('Shift not found');

  const updatedShift = { ...shifts[index], ...updates };
  shifts[index] = updatedShift;
  localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
  notifyShiftListeners();
  return updatedShift;
};

export const deleteShift = (id: string) => {
  assertProductionWritesAllowed();
  const shifts = getStoredShifts().filter((s) => s.id !== id);
  localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
  notifyShiftListeners();
};

export const resetShiftsToDefaults = () => {
  assertProductionWritesAllowed();
  localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(INITIAL_SHIFTS));
  notifyShiftListeners();
};

export const saveStoredShifts = (shifts: ShiftItem[]) => {
  assertProductionWritesAllowed();
  localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
  notifyShiftListeners();
};

export const subscribeToShifts = (callback: ShiftListener): (() => void) => {
  shiftListeners.add(callback);
  return () => {
    shiftListeners.delete(callback);
  };
};
