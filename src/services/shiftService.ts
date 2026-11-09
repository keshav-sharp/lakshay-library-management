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
};

export const getStoredShifts = (): ShiftItem[] => {
  try {
    const raw = localStorage.getItem(SHIFTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(INITIAL_SHIFTS));
      return INITIAL_SHIFTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(INITIAL_SHIFTS));
      return INITIAL_SHIFTS;
    }
    return parsed;
  } catch {
    return INITIAL_SHIFTS;
  }
};

export const addCustomShift = (shift: Omit<ShiftItem, 'id' | 'isSystem'>): ShiftItem => {
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
  const shifts = getStoredShifts().filter((s) => s.id !== id);
  localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
  notifyShiftListeners();
};

export const resetShiftsToDefaults = () => {
  localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(INITIAL_SHIFTS));
  notifyShiftListeners();
};

export const saveStoredShifts = (shifts: ShiftItem[]) => {
  localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
  notifyShiftListeners();
};

export const subscribeToShifts = (callback: ShiftListener): (() => void) => {
  shiftListeners.add(callback);
  return () => {
    shiftListeners.delete(callback);
  };
};
