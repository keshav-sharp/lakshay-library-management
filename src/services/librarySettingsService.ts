export interface LibraryProfileSettings {
  libraryName: string;
  address?: string;
  libraryAddress?: string;
  contactNumber?: string;
  contactPhone?: string;
  email?: string;
  contactEmail?: string;
  receiptHeader?: string;
  termsNotice?: string;
  termsAndConditions?: string;
  logoUrl?: string;
}

export const LIBRARY_SETTINGS_STORAGE_KEY = 'lakshay_library_profile_settings_v1';

export const DEFAULT_LIBRARY_SETTINGS: LibraryProfileSettings = {
  libraryName: 'Lakshay Library',
  address: '',
  libraryAddress: '',
  contactNumber: '',
  contactPhone: '',
  email: '',
  contactEmail: '',
  receiptHeader: 'FEE PAYMENT RECEIPT',
  termsNotice: 'Fees once paid are non-refundable. Please keep this receipt for library desk records.',
  termsAndConditions: 'Fees once paid are non-refundable & non-transferable. Please retain this receipt for official library records.',
};

type LibrarySettingsListener = (settings: LibraryProfileSettings) => void;
const listeners: Set<LibrarySettingsListener> = new Set();

export const subscribeToLibrarySettings = (callback: LibrarySettingsListener): (() => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

export const getLibraryProfileSettings = (): LibraryProfileSettings => {
  try {
    const raw = localStorage.getItem(LIBRARY_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_LIBRARY_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_LIBRARY_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_LIBRARY_SETTINGS;
  }
};

export const saveLibraryProfileSettings = (
  updates: Partial<LibraryProfileSettings>
): LibraryProfileSettings => {
  const current = getLibraryProfileSettings();
  const updated: LibraryProfileSettings = {
    ...current,
    ...updates,
    libraryName: updates.libraryName?.trim() || current.libraryName || 'Lakshay Library',
  };

  try {
    localStorage.setItem(LIBRARY_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    listeners.forEach((fn) => {
      try {
        fn(updated);
      } catch {
        // Ignore listener error
      }
    });
  } catch (err) {
    console.error('Failed to save library profile settings:', err);
  }

  return updated;
};
