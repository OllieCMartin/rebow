import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSIONS_KEY = '@rebow_sessions';
const SETTINGS_KEY = '@rebow_settings';

// ── Sessions (logbook) ──────────────────────────────────

export async function saveSessions(sessions) {
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export async function loadSessions() {
  const raw = await AsyncStorage.getItem(SESSIONS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addSession(session) {
  const sessions = await loadSessions();
  sessions.unshift({ ...session, id: Date.now().toString() });
  await saveSessions(sessions);
  return sessions;
}

export async function deleteSession(id) {
  const sessions = await loadSessions();
  const filtered = sessions.filter((s) => s.id !== id);
  await saveSessions(filtered);
  return filtered;
}

// ── Settings (persisted exercise config) ────────────────

export async function saveSettings(settings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadSettings() {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : null;
}
