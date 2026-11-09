import { getGoogleDriveSyncConfig } from './googleDriveSyncService';
import { getDriveAccessToken } from './googleDriveSyncService';
import {
  uploadJsonToLogsFolder,
  downloadJsonFromLogsFolder,
  ACTIVE_CLIENTS_FILENAME,
} from './driveLogsService';

export interface ActiveClientRecord {
  clientId: string;
  deviceName: string;
  deviceRole: 'PRIMARY' | 'SECONDARY';
  platform: string;
  browser: string;
  isCurrentDevice: boolean;
  firstSeenAt: string;
  lastActiveAt: string;
  lastActiveTimestamp: number;
  status: 'ONLINE' | 'IDLE' | 'OFFLINE';
  ipOrContext?: string;
  isBlocked?: boolean;
  blockedAt?: string;
  blockedReason?: string;
}

export interface ActiveClientsPayload {
  schemaVersion: string;
  lastUpdatedISO: string;
  activeCount: number;
  blockedCount?: number;
  blockedClientIds?: string[];
  clients: ActiveClientRecord[];
}

const LOCAL_CLIENTS_STORAGE_KEY = 'lakshay_library_active_clients_registry_v1';
const BLOCKED_CLIENTS_STORAGE_KEY = 'lakshay_library_blocked_clients_manifest_v1';
const MY_CLIENT_ID_KEY = 'lakshay_library_current_client_id_v1';
const PRESENCE_BROADCAST_CHANNEL = 'lakshay_presence_heartbeat_bus';

const ONLINE_THRESHOLD_MS = 90 * 1000; // 90 seconds
const IDLE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

type PresenceListener = (clients: ActiveClientRecord[]) => void;
const listeners: Set<PresenceListener> = new Set();

const notifyListeners = (clients: ActiveClientRecord[]) => {
  listeners.forEach((listener) => {
    try {
      listener(clients);
    } catch {
      // Ignore
    }
  });
};

export const subscribeToActiveClients = (callback: PresenceListener): (() => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

/**
 * Gets or creates this device's persistent client ID.
 */
export const getMyClientId = (): string => {
  try {
    let id = localStorage.getItem(MY_CLIENT_ID_KEY);
    if (!id) {
      id = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem(MY_CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return 'client_fallback';
  }
};

/**
 * Detects platform information (Android, Windows, macOS, iOS, Linux) and browser.
 */
export const detectPlatformAndBrowser = (): { platform: string; browser: string } => {
  if (typeof navigator === 'undefined') {
    return { platform: 'Unknown', browser: 'Web Browser' };
  }
  const ua = navigator.userAgent;
  let platform = 'Unknown';
  if (/android/i.test(ua)) platform = 'Android Phone / Tablet';
  else if (/iphone|ipad|ipod/i.test(ua)) platform = 'Apple iOS';
  else if (/windows/i.test(ua)) platform = 'Windows Laptop / PC';
  else if (/macintosh|mac os x/i.test(ua)) platform = 'macOS Desktop';
  else if (/linux/i.test(ua)) platform = 'Linux System';

  let browser = 'Web App';
  if (/chrome|crios/i.test(ua) && !/edge|edg|opr/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edg/i.test(ua)) browser = 'Edge';

  return { platform, browser };
};

/**
 * Reads the cached active client list from localStorage.
 */
export const getStoredActiveClients = (): ActiveClientRecord[] => {
  try {
    const raw = localStorage.getItem(LOCAL_CLIENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const myId = getMyClientId();
    const now = Date.now();

    return parsed.map((c: ActiveClientRecord) => {
      const diff = now - (c.lastActiveTimestamp || 0);
      let status: ActiveClientRecord['status'] = 'ONLINE';
      if (diff > IDLE_THRESHOLD_MS) status = 'OFFLINE';
      else if (diff > ONLINE_THRESHOLD_MS) status = 'IDLE';

      return {
        ...c,
        isCurrentDevice: c.clientId === myId,
        status,
      };
    });
  } catch {
    return [];
  }
};

/**
 * Saves active client list to localStorage.
 */
const saveActiveClients = (clients: ActiveClientRecord[]) => {
  try {
    localStorage.setItem(LOCAL_CLIENTS_STORAGE_KEY, JSON.stringify(clients));
    notifyListeners(clients);
  } catch {
    // Ignore
  }
};

/**
 * Builds or refreshes the current client record.
 */
export const buildCurrentClientRecord = (): ActiveClientRecord => {
  const syncConfig = getGoogleDriveSyncConfig();
  const myId = getMyClientId();
  const { platform, browser } = detectPlatformAndBrowser();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const existingClients = getStoredActiveClients();
  const myExisting = existingClients.find((c) => c.clientId === myId);

  return {
    clientId: myId,
    deviceName: syncConfig.deviceName || (platform.includes('Android') ? 'Android Pixel' : 'Workstation PC'),
    deviceRole: syncConfig.deviceRole || 'PRIMARY',
    platform,
    browser,
    isCurrentDevice: true,
    firstSeenAt: myExisting?.firstSeenAt || nowIso,
    lastActiveAt: nowIso,
    lastActiveTimestamp: now,
    status: 'ONLINE',
  };
};

/**
 * Broadcasts heartbeat to other open tabs / windows on this device via BroadcastChannel.
 */
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel(PRESENCE_BROADCAST_CHANNEL);
  }
} catch {
  // BroadcastChannel not supported in some restricted environments
}

/**
 * Sends a local heartbeat, updates current client status, and notifies subscribers.
 */
export const sendPresenceHeartbeat = (): ActiveClientRecord[] => {
  const currentRecord = buildCurrentClientRecord();
  const allClients = getStoredActiveClients();

  const merged = [
    currentRecord,
    ...allClients.filter((c) => c.clientId !== currentRecord.clientId),
  ];

  // Re-calculate statuses
  const now = Date.now();
  const updated = merged.map((c) => {
    if (c.clientId === currentRecord.clientId) return currentRecord;
    const diff = now - (c.lastActiveTimestamp || 0);
    let status: ActiveClientRecord['status'] = 'ONLINE';
    if (diff > IDLE_THRESHOLD_MS) status = 'OFFLINE';
    else if (diff > ONLINE_THRESHOLD_MS) status = 'IDLE';
    return { ...c, isCurrentDevice: false, status };
  });

  saveActiveClients(updated);

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'HEARTBEAT',
        client: currentRecord,
      });
    } catch {
      // Ignore
    }
  }

  return updated;
};

/**
 * Merges local client records with remote records from Google Drive.
 */
export const syncActiveClientsWithGoogleDrive = async (
  token?: string | null
): Promise<{ activeCount: number; clients: ActiveClientRecord[] }> => {
  const accessToken = token || getDriveAccessToken();
  if (!accessToken) {
    throw new Error('Google Drive is not connected. Sign in via Drive Sync first.');
  }

  // 1. Send local heartbeat first
  const currentRecord = buildCurrentClientRecord();
  let localList = getStoredActiveClients().filter((c) => c.clientId !== currentRecord.clientId);
  localList = [currentRecord, ...localList];

  // 2. Fetch remote client list from `Lakshay_Library_Logs/active_clients_status.json`
  let remoteList: ActiveClientRecord[] = [];
  try {
    const remoteData = await downloadJsonFromLogsFolder<ActiveClientsPayload>(
      accessToken,
      ACTIVE_CLIENTS_FILENAME
    );
    if (remoteData && Array.isArray(remoteData.clients)) {
      remoteList = remoteData.clients;
    }
  } catch {
    // File might not exist yet
  }

  // 3. Merge local and remote clients (newest timestamp wins for each clientId)
  const clientMap = new Map<string, ActiveClientRecord>();

  // Add remote clients
  remoteList.forEach((c) => {
    clientMap.set(c.clientId, c);
  });

  // Overwrite with newer local clients
  localList.forEach((c) => {
    const existing = clientMap.get(c.clientId);
    if (!existing || c.lastActiveTimestamp >= (existing.lastActiveTimestamp || 0)) {
      clientMap.set(c.clientId, c);
    }
  });

  // Always force current record
  clientMap.set(currentRecord.clientId, currentRecord);

  // Recompute online statuses
  const now = Date.now();
  const mergedClients = Array.from(clientMap.values()).map((c) => {
    const diff = now - (c.lastActiveTimestamp || 0);
    let status: ActiveClientRecord['status'] = 'ONLINE';
    if (diff > IDLE_THRESHOLD_MS) status = 'OFFLINE';
    else if (diff > ONLINE_THRESHOLD_MS) status = 'IDLE';
    return {
      ...c,
      isCurrentDevice: c.clientId === currentRecord.clientId,
      status,
    };
  });

  // Filter out ancient clients older than 7 days
  const recentClients = mergedClients.filter(
    (c) => now - (c.lastActiveTimestamp || 0) < 7 * 24 * 60 * 60 * 1000
  );

  const activeOnlineCount = recentClients.filter((c) => c.status === 'ONLINE').length;

  // 4. Upload merged active clients back to Google Drive
  const payload: ActiveClientsPayload = {
    schemaVersion: '1.0',
    lastUpdatedISO: new Date().toISOString(),
    activeCount: activeOnlineCount,
    clients: recentClients,
  };

  await uploadJsonToLogsFolder(
    accessToken,
    ACTIVE_CLIENTS_FILENAME,
    payload,
    `Lakshay Library Active Clients Telemetry (${activeOnlineCount} active)`
  );

  saveActiveClients(recentClients);
  return { activeCount: activeOnlineCount, clients: recentClients };
};

/**
 * Initializes the client presence heartbeat engine:
 * - Listens on BroadcastChannel for other tabs on this machine
 * - Sends periodic heartbeats every 25 seconds
 * - Syncs with Google Drive every 60 seconds if access token is present
 */
export const initClientPresenceEngine = (): (() => void) => {
  // Initial heartbeat
  sendPresenceHeartbeat();

  // Listen for peer heartbeats
  const handleBroadcastMessage = (event: MessageEvent) => {
    if (event.data?.type === 'HEARTBEAT' && event.data.client) {
      const incoming: ActiveClientRecord = event.data.client;
      const current = getStoredActiveClients();
      const myId = getMyClientId();
      if (incoming.clientId === myId) return;

      const merged = [
        ...current.filter((c) => c.clientId !== incoming.clientId),
        { ...incoming, isCurrentDevice: false },
      ];
      saveActiveClients(merged);
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcastMessage);
  }

  // Periodic local heartbeat every 20 seconds
  const localHeartbeatInterval = setInterval(() => {
    sendPresenceHeartbeat();
  }, 20 * 1000);

  // Periodic Google Drive heartbeat sync every 60 seconds
  const driveSyncInterval = setInterval(() => {
    const token = getDriveAccessToken();
    if (token) {
      syncActiveClientsWithGoogleDrive(token).catch(() => {
        // Silent failure in background
      });
    }
  }, 60 * 1000);

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcastMessage);
    }
    clearInterval(localHeartbeatInterval);
    clearInterval(driveSyncInterval);
  };
};

/**
 * Convenience helper to count actively online devices.
 */
export const getActiveOnlineClientsCount = (): number => {
  const clients = getStoredActiveClients();
  const online = clients.filter((c) => c.status === 'ONLINE');
  return Math.max(1, online.length); // At least 1 (the current user)
};
