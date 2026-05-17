import { useEffect, useState, Component, type ReactNode } from 'react';
import SessionScreen, { type SessionResult } from './SessionScreen';

type Condition = 'tennis' | 'golfers';
type Hand = 'L' | 'R';
type View = 'home' | 'session' | 'settings' | 'logbook';

const BLUE = '#1C7AAF';
const CREAM = '#F5F0E1';
const INK = '#1A1A1A';
const MUTE = '#777';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const STORAGE_KEY = 'rebow.settings.v1';
const LOG_KEY = 'rebow.log.v1';

type Settings = { hand: Hand; condition: Condition; paceMs: number };
const DEFAULT_SETTINGS: Settings = { hand: 'R', condition: 'tennis', paceMs: 5000 };

type LogEntry = {
  id: string;
  completedAt: string; // ISO
  totalReps: number;
  totalSets: number;
  durationMs: number;
  condition: Condition;
  hand: Hand;
  paceMs: number;
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: Settings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function loadLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendLog(entry: LogEntry) {
  try {
    const next = [entry, ...loadLog()].slice(0, 500);
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

function clearLog() {
  try { localStorage.removeItem(LOG_KEY); } catch { /* ignore */ }
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state;
    if (error) return (
      <div style={{ padding: 24, fontFamily: 'monospace', fontSize: 13, background: '#fff', color: '#c00', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        <strong>Runtime error</strong>{'\n\n'}{(error as Error).message}{'\n\n'}{(error as Error).stack}
      </div>
    );
    return this.props.children;
  }
}

export default function App() {
  const [view, setView] = useState<View>('home');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [lastResult, setLastResult] = useState<SessionResult | null>(null);

  // Persist settings
  useEffect(() => { saveSettings(settings); }, [settings]);

  // Lock orientation to portrait (best-effort; ignored on iOS Safari outside fullscreen)
  useEffect(() => {
    type OrientationLock = ScreenOrientation & { lock?: (o: 'portrait') => Promise<void> };
    const o = screen.orientation as OrientationLock | undefined;
    if (o && typeof o.lock === 'function') {
      o.lock('portrait').catch(() => { /* unsupported, that's ok */ });
    }
  }, []);

  if (view === 'session') {
    return (
      <ErrorBoundary>
        <SessionScreen
          sessionNumber={1}
          condition={settings.condition}
          hand={settings.hand}
          paceMs={settings.paceMs}
          onComplete={(r) => {
            setLastResult(r);
            appendLog({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              completedAt: r.completedAt.toISOString(),
              totalReps: r.totalReps,
              totalSets: r.totalSets,
              durationMs: r.durationMs,
              condition: settings.condition,
              hand: settings.hand,
              paceMs: settings.paceMs,
            });
            setView('home');
          }}
          onExit={() => setView('home')}
        />
      </ErrorBoundary>
    );
  }

  if (view === 'settings') {
    return (
      <ErrorBoundary>
        <SettingsScreen
          settings={settings}
          onChange={setSettings}
          onBack={() => setView('home')}
        />
      </ErrorBoundary>
    );
  }

  if (view === 'logbook') {
    return (
      <ErrorBoundary>
        <LogbookScreen onBack={() => setView('home')} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <HomeScreen
        settings={settings}
        onChange={setSettings}
        onStart={() => setView('session')}
        onSettings={() => setView('settings')}
        onLogbook={() => setView('logbook')}
        lastResult={lastResult}
      />
    </ErrorBoundary>
  );
}

// ─── Home ────────────────────────────────────────────────────────────────────

function HomeScreen({ settings, onChange, onStart, onSettings, onLogbook, lastResult }: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onStart: () => void;
  onSettings: () => void;
  onLogbook: () => void;
  lastResult: SessionResult | null;
}) {
  return (
    <Page>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ color: BLUE, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
          Rebow
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: INK, margin: 0 }}>Eccentric session</h1>
      </div>

      <Section label="Hand">
        <PillRow
          value={settings.hand}
          options={[{ v: 'L', label: 'Left' }, { v: 'R', label: 'Right' }]}
          onSelect={(v) => onChange({ ...settings, hand: v })}
        />
      </Section>

      <Section label="Condition">
        <PillRow
          value={settings.condition}
          options={[{ v: 'tennis', label: 'Tennis elbow' }, { v: 'golfers', label: "Golfer's elbow" }]}
          onSelect={(v) => onChange({ ...settings, condition: v })}
        />
      </Section>

      <button onClick={onStart} style={primaryBtn}>Start session</button>

      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 360 }}>
        <button onClick={onSettings} style={secondaryBtn}>Settings</button>
        <button onClick={onLogbook} style={secondaryBtn}>Logbook</button>
      </div>

      {lastResult && (
        <div style={{ marginTop: 8, color: MUTE, fontSize: 13, textAlign: 'center' }}>
          Last: {lastResult.totalReps} reps · {lastResult.totalSets} sets · {Math.round(lastResult.durationMs / 1000)}s
        </div>
      )}
    </Page>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────

function SettingsScreen({ settings, onChange, onBack }: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
}) {
  const paceSec = (settings.paceMs / 1000).toFixed(1);
  return (
    <Page>
      <Header title="Settings" onBack={onBack} />

      <Section label={`Eccentric pace · ${paceSec}s`}>
        <input
          type="range"
          min={2000}
          max={8000}
          step={500}
          value={settings.paceMs}
          onChange={(e) => onChange({ ...settings, paceMs: Number(e.target.value) })}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTE, marginTop: 4 }}>
          <span>2s</span><span>5s (Alfredson)</span><span>8s</span>
        </div>
      </Section>

      <Section label="Hand">
        <PillRow
          value={settings.hand}
          options={[{ v: 'L', label: 'Left' }, { v: 'R', label: 'Right' }]}
          onSelect={(v) => onChange({ ...settings, hand: v })}
        />
      </Section>

      <Section label="Condition">
        <PillRow
          value={settings.condition}
          options={[{ v: 'tennis', label: 'Tennis elbow' }, { v: 'golfers', label: "Golfer's elbow" }]}
          onSelect={(v) => onChange({ ...settings, condition: v })}
        />
      </Section>
    </Page>
  );
}

// ─── Logbook ─────────────────────────────────────────────────────────────────

function LogbookScreen({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<LogEntry[]>(loadLog);

  const grouped = groupByDay(entries);
  const totalReps = entries.reduce((acc, e) => acc + e.totalReps, 0);
  const totalSessions = entries.length;
  const streak = computeStreakDays(entries);

  return (
    <Page>
      <Header title="Logbook" onBack={onBack} />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
        width: '100%', maxWidth: 360,
      }}>
        <Stat label="Sessions" value={String(totalSessions)} />
        <Stat label="Reps" value={String(totalReps)} />
        <Stat label="Streak" value={streak > 0 ? `${streak}d` : '—'} />
      </div>

      {entries.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTE, fontSize: 14, textAlign: 'center', padding: 24 }}>
          No sessions yet.{'\n'}Complete one to see it here.
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grouped.map(({ day, items }) => (
            <div key={day}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: MUTE, textTransform: 'uppercase', marginBottom: 6 }}>
                {day}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((e) => <LogRow key={e.id} entry={e} />)}
              </div>
            </div>
          ))}

          <button
            onClick={() => {
              if (confirm('Clear all logbook entries?')) {
                clearLog();
                setEntries([]);
              }
            }}
            style={{
              marginTop: 8, height: 40, borderRadius: 10, border: '1px solid #CCC',
              background: 'transparent', color: MUTE, fontSize: 13, cursor: 'pointer',
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#FFF', border: '1px solid #E5DFCB', borderRadius: 12,
      padding: '10px 8px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: INK, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: MUTE, textTransform: 'uppercase', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const d = new Date(entry.completedAt);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const mins = Math.round(entry.durationMs / 60000);
  const condLabel = entry.condition === 'tennis' ? 'Tennis' : "Golfer's";
  return (
    <div style={{
      background: '#FFF', border: '1px solid #E5DFCB', borderRadius: 10,
      padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: BLUE, color: '#FFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700,
      }}>
        {entry.hand}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>
          {condLabel} · {entry.totalReps} reps
        </div>
        <div style={{ fontSize: 12, color: MUTE, marginTop: 2 }}>
          {time} · {entry.totalSets} sets · {mins} min · {(entry.paceMs / 1000).toFixed(1)}s pace
        </div>
      </div>
    </div>
  );
}

function groupByDay(entries: LogEntry[]): { day: string; items: LogEntry[] }[] {
  const map = new Map<string, LogEntry[]>();
  for (const e of entries) {
    const d = new Date(e.completedAt);
    const key = dayLabel(d);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
}

function dayLabel(d: Date): string {
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function computeStreakDays(entries: LogEntry[]): number {
  if (entries.length === 0) return 0;
  const days = new Set(entries.map((e) => {
    const d = new Date(e.completedAt);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (days.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

function Page({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: CREAM, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
      padding: '40px 24px', boxSizing: 'border-box', overflowY: 'auto',
    }}>
      {children}
    </div>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: 360, gap: 12 }}>
      <button onClick={onBack} style={backBtn} aria-label="Back">←</button>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: 0 }}>{title}</h1>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: MUTE, textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function PillRow<T extends string>({ value, options, onSelect }: {
  value: T;
  options: { v: T; label: string }[];
  onSelect: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map((o) => {
        const selected = o.v === value;
        return (
          <button
            key={o.v}
            onClick={() => onSelect(o.v)}
            style={{
              flex: 1, height: 44, borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              background: selected ? BLUE : 'transparent',
              color: selected ? '#FFF' : BLUE,
              border: `1.5px solid ${BLUE}`,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  height: 60, padding: '0 32px', borderRadius: 16, background: BLUE, color: '#FFF',
  fontSize: 18, fontWeight: 600, border: 'none', cursor: 'pointer',
  width: '100%', maxWidth: 360,
};

const secondaryBtn: React.CSSProperties = {
  flex: 1, height: 44, borderRadius: 12, background: 'transparent', color: BLUE,
  fontSize: 14, fontWeight: 600, border: `1.5px solid ${BLUE}`, cursor: 'pointer',
};

const backBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 999, border: `1.5px solid ${BLUE}`,
  background: 'transparent', color: BLUE, fontSize: 18, cursor: 'pointer',
};
