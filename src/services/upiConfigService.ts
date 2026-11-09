export interface LibraryUpiConfig {
  upiId: string;
  payeeName: string;
  customQrImageUrl?: string;
  notes?: string;
  lastUpdatedISO?: string;
  isConfigured: boolean;
}

const UPI_CONFIG_STORAGE_KEY = 'lakshay_library_upi_config_v1';

export const DEFAULT_UPI_CONFIG: LibraryUpiConfig = {
  upiId: '',
  payeeName: 'Lakshay Library',
  customQrImageUrl: '',
  notes: 'Scan using any UPI App (GPay, PhonePe, Paytm, BHIM) to pay library monthly desk fees.',
  isConfigured: false,
};

type UpiListener = (config: LibraryUpiConfig) => void;
const listeners: Set<UpiListener> = new Set();

const notifyListeners = (config: LibraryUpiConfig) => {
  listeners.forEach((listener) => {
    try {
      listener(config);
    } catch {
      // Ignore
    }
  });
};

export const subscribeToUpiConfig = (callback: UpiListener): (() => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

export const getStoredUpiConfig = (): LibraryUpiConfig => {
  try {
    const raw = localStorage.getItem(UPI_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_UPI_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_UPI_CONFIG,
      ...parsed,
    };
  } catch {
    return DEFAULT_UPI_CONFIG;
  }
};

export const saveUpiConfig = (config: Partial<LibraryUpiConfig>): LibraryUpiConfig => {
  const current = getStoredUpiConfig();
  const updated: LibraryUpiConfig = {
    ...current,
    ...config,
    lastUpdatedISO: new Date().toISOString(),
    isConfigured: !!(config.upiId || config.customQrImageUrl || current.upiId),
  };

  try {
    localStorage.setItem(UPI_CONFIG_STORAGE_KEY, JSON.stringify(updated));
    notifyListeners(updated);
  } catch (e) {
    console.error('Failed to save UPI config to localStorage', e);
  }

  return updated;
};

/**
 * Generates dynamic UPI URI (upi://pay?pa=...&pn=...) and returns
 * a high-resolution QR image URL for instant scanning with GPay/PhonePe/Paytm.
 */
export const buildUpiPaymentUri = (upiId: string, payeeName = 'Lakshay Library', amount?: number): string => {
  const sanitizedUpi = upiId.trim().replace(/[^a-zA-Z0-9.@_-]/g, '');
  const cleanUpi = encodeURIComponent(sanitizedUpi);
  const cleanName = encodeURIComponent(payeeName.trim().substring(0, 50));
  let uri = `upi://pay?pa=${cleanUpi}&pn=${cleanName}&cu=INR`;
  if (amount && amount > 0 && !isNaN(amount)) {
    uri += `&am=${Math.round(amount)}`;
  }
  return uri;
};

export const getDynamicQrImageUrl = (upiId: string, payeeName = 'Lakshay Library', amount?: number): string => {
  const upiUri = buildUpiPaymentUri(upiId, payeeName, amount);
  const encoded = encodeURIComponent(upiUri);
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&format=svg&data=${encoded}`;
};
