import { assertProductionWritesAllowed } from './storageService';
export interface SeatItem {
  id: string;
  seatNumber: string; // e.g. "A-01"
  section: string;    // e.g. "A"
  zoneLabel?: string; // e.g. "Silent Reading Zone"
}

const SEATS_STORAGE_KEY = 'lakshay_app_seats';

type SeatListener = () => void;
const seatListeners: Set<SeatListener> = new Set();

const notifySeatListeners = () => {
  seatListeners.forEach((fn) => {
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

export const generateInitialSeats = (): SeatItem[] => {
  const rows = ['A', 'B', 'C'];
  const seatsPerRow = 15;
  const list: SeatItem[] = [];

  rows.forEach((row) => {
    for (let i = 1; i <= seatsPerRow; i++) {
      const seatNumber = `${row}-${i.toString().padStart(2, '0')}`;
      list.push({
        id: `seat_${seatNumber}`,
        seatNumber,
        section: row,
        zoneLabel: 'Silent Reading Zone',
      });
    }
  });

  return list;
};

export const INITIAL_SEATS: SeatItem[] = generateInitialSeats();

export const getStoredSeats = (): SeatItem[] => {
  try {
    const raw = localStorage.getItem(SEATS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SEATS_STORAGE_KEY, JSON.stringify(INITIAL_SEATS));
      return INITIAL_SEATS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(SEATS_STORAGE_KEY, JSON.stringify(INITIAL_SEATS));
      return INITIAL_SEATS;
    }
    return parsed;
  } catch {
    return INITIAL_SEATS;
  }
};

export const saveStoredSeats = (seats: SeatItem[]) => {
  assertProductionWritesAllowed();
  localStorage.setItem(SEATS_STORAGE_KEY, JSON.stringify(seats));
  notifySeatListeners();
};

// Add a single custom seat (e.g. "A-16" or "D-01")
export const addCustomSeat = (
  rawSeatNumber: string,
  customSection?: string,
  zoneLabel: string = 'Silent Reading Zone'
): SeatItem => {
  assertProductionWritesAllowed();
  const seatNumber = rawSeatNumber.trim().toUpperCase();
  if (!seatNumber) {
    throw new Error('Seat number is required');
  }

  const seats = getStoredSeats();
  const existing = seats.find((s) => s.seatNumber === seatNumber);
  if (existing) {
    return existing;
  }

  // Derive section from prefix before '-' or first character if not provided
  const derivedSection =
    customSection?.trim().toUpperCase() ||
    (seatNumber.includes('-') ? seatNumber.split('-')[0] : seatNumber.charAt(0)) ||
    'A';

  const newSeat: SeatItem = {
    id: `seat_${seatNumber}_${Date.now()}`,
    seatNumber,
    section: derivedSection,
    zoneLabel,
  };

  const updated = [...seats, newSeat];
  saveStoredSeats(updated);
  return newSeat;
};

// Automatically append the next sequential seat in a section (e.g. A-15 -> A-16)
export const addNextSeatInSection = (
  section: string,
  zoneLabel: string = 'Silent Reading Zone'
): SeatItem => {
  assertProductionWritesAllowed();
  const cleanSection = section.trim().toUpperCase();
  const seats = getStoredSeats();
  const sectionSeats = seats.filter((s) => s.section === cleanSection);

  let maxNum = 0;
  sectionSeats.forEach((s) => {
    const parts = s.seatNumber.split('-');
    const numPart = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(numPart) && numPart > maxNum) {
      maxNum = numPart;
    }
  });

  const nextNum = maxNum + 1;
  const seatNumber = `${cleanSection}-${nextNum.toString().padStart(2, '0')}`;
  return addCustomSeat(seatNumber, cleanSection, zoneLabel);
};

// Add a new section with N seats
export const addSectionWithSeats = (
  sectionName: string,
  count: number,
  zoneLabel: string = 'Silent Reading Zone'
): SeatItem[] => {
  assertProductionWritesAllowed();
  const cleanSection = sectionName.trim().toUpperCase();
  if (!cleanSection || count <= 0) return [];

  const seats = getStoredSeats();
  const created: SeatItem[] = [];

  for (let i = 1; i <= count; i++) {
    const seatNumber = `${cleanSection}-${i.toString().padStart(2, '0')}`;
    if (!seats.some((s) => s.seatNumber === seatNumber)) {
      const item: SeatItem = {
        id: `seat_${seatNumber}_${Date.now()}_${i}`,
        seatNumber,
        section: cleanSection,
        zoneLabel,
      };
      seats.push(item);
      created.push(item);
    }
  }

  saveStoredSeats(seats);
  return created;
};

// Remove a specific seat by seatNumber
export const removeSeatByNumber = (seatNumber: string) => {
  assertProductionWritesAllowed();
  const clean = seatNumber.trim().toUpperCase();
  const seats = getStoredSeats().filter((s) => s.seatNumber !== clean);
  saveStoredSeats(seats);
};

// Reset seats to default 45 desks (Sections A, B, C)
export const resetSeatsToDefaults = () => {
  assertProductionWritesAllowed();
  saveStoredSeats(generateInitialSeats());
};

export const subscribeToSeats = (callback: SeatListener): (() => void) => {
  seatListeners.add(callback);
  return () => {
    seatListeners.delete(callback);
  };
};
