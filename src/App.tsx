// src/App.tsx
// Rebow — clinical eccentric-loading app, Mondah brand.
//
// SessionScreen pass-2 wishlist (not changed in this pass — gauge logic stays):
//   • Rest screen needs a large countdown ("Next set in 0:42") + "Skip rest" button.
//   • Show condition/hand chip on the rest screen so user confirms config mid-session.
//   • Consider a 3-2-1 pre-set countdown before the gauge re-arms.
//   • Surface "Set N of 3" in the rest screen header.

import { useEffect, useMemo, useState, Component, type ReactNode } from 'react';
import SessionScreen, { type SessionResult } from './SessionScreen';
import HelpScreen, { ForearmAnatomy, MountIllustration, RepStoryboard } from './Help';

// ─── Types & constants ──────────────────────────────────────────────────────

type Condition = 'tennis' | 'golfers';
type Hand = 'L' | 'R';
type View = 'home' | 'session' | 'settings' | 'logbook' | 'help' | 'onboarding';

// Rebow palette — "Clinic" direction. See SessionScreen.redesign-spec.md.
//   BRAND  Mondah blue — reserved for the wordmark / parent-brand surfaces.
//   BLUE   Interaction blue — buttons, active pills, focus rings, gauge fill.
//   ACCENT Sage — live-state color: gauge needle, streak, success moments.
//   WARN   Terracotta — off-pace tint, error states.
const BRAND = '#1C7AAF';
const BLUE = '#0F4E72';
const ACCENT = '#5C8C6C';
const WARN = '#B2533A';
const CREAM = '#F4EFE0';
const INK = '#13181C';
const MUTE = '#6F7780';
const LINE = '#E2DCC9';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const STORAGE_KEY = 'rebow.settings.v1';
const LOG_KEY = 'rebow.log.v1';

type Settings = {
  hand: Hand;
  condition: Condition;
  paceMs: number;
  onboarded: boolean;
};
const DEFAULT_SETTINGS: Settings = { hand: 'R', condition: 'tennis', paceMs: 5000, onboarded: false };

type LogEntry = {
  id: string;
  completedAt: string;
  totalReps: number;
  totalSets: number;
  durationMs: number;
  condition: Condition;
  hand: Hand;
  paceMs: number;
};

const CONDITION_META: Record<Condition, {
  label: string; short: string; side: 'External' | 'Internal'; siteLong: string;
}> = {
  tennis:  { label: 'Tennis elbow',   short: 'Tennis',   side: 'External', siteLong: 'Lateral epicondyle · wrist extensors' },
  golfers: { label: "Golfer's elbow", short: "Golfer's", side: 'Internal', siteLong: 'Medial epicondyle · wrist flexors' },
};

const HAND_LABEL: Record<Hand, string> = { L: 'Left hand', R: 'Right hand' };

// ─── Persistence ────────────────────────────────────────────────────────────

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { return DEFAULT_SETTINGS; }
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
  } catch { return []; }
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

// ─── Error boundary ─────────────────────────────────────────────────────────

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

// ─── App shell ──────────────────────────────────────────────────────────────

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [view, setView] = useState<View>(() => (loadSettings().onboarded ? 'home' : 'onboarding'));
  const [lastResult, setLastResult] = useState<SessionResult | null>(null);

  useEffect(() => { saveSettings(settings); }, [settings]);

  // Best-effort portrait lock (no-op on iOS Safari outside installed PWA).
  useEffect(() => {
    type OrientationLock = ScreenOrientation & { lock?: (o: 'portrait') => Promise<void> };
    const o = screen.orientation as OrientationLock | undefined;
    if (o && typeof o.lock === 'function') o.lock('portrait').catch(() => {});
  }, []);

  const goHome = () => setView('home');

  if (view === 'onboarding') {
    return (
      <ErrorBoundary>
        <OnboardingScreen
          settings={settings}
          onChange={setSettings}
          onFinish={() => { setSettings({ ...settings, onboarded: true }); setView('home'); }}
        />
      </ErrorBoundary>
    );
  }

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
            goHome();
          }}
          onExit={goHome}
        />
      </ErrorBoundary>
    );
  }

  if (view === 'settings') return <ErrorBoundary><SettingsScreen settings={settings} onChange={setSettings} onBack={goHome} onHelp={() => setView('help')} /></ErrorBoundary>;
  if (view === 'logbook')  return <ErrorBoundary><LogbookScreen onBack={goHome} /></ErrorBoundary>;
  if (view === 'help')     return <ErrorBoundary><HelpScreen onBack={goHome} /></ErrorBoundary>;

  return (
    <ErrorBoundary>
      <HomeScreen
        settings={settings}
        onStart={() => setView('session')}
        onSettings={() => setView('settings')}
        onLogbook={() => setView('logbook')}
        onHelp={() => setView('help')}
        lastResult={lastResult}
      />
    </ErrorBoundary>
  );
}

// ─── Home ───────────────────────────────────────────────────────────────────

function HomeScreen({ settings, onStart, onSettings, onLogbook, onHelp, lastResult }: {
  settings: Settings;
  onStart: () => void;
  onSettings: () => void;
  onLogbook: () => void;
  onHelp: () => void;
  lastResult: SessionResult | null;
}) {
  const meta = CONDITION_META[settings.condition];
  const nextSlot = useNextSlot();

  return (
    <Page>
      {/* Top row: brand + config chip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ color: BRAND, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Rebow
        </div>
        <button onClick={onSettings} style={configChip} aria-label="Edit configuration">
          <Dot color={BRAND} />
          <span>{HAND_LABEL[settings.hand]} · {meta.short}</span>
          <span style={{ color: MUTE, fontSize: 11, marginLeft: 2 }}>{meta.side[0]}</span>
          <span style={{ color: MUTE, fontSize: 14, marginLeft: 2 }}>›</span>
        </button>
      </div>

      {/* Hero: next session */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 24 }}>
        <div style={kickerStyle}>Next</div>
        <div style={{ fontSize: 40, fontWeight: 900, color: INK, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          {nextSlot === 'AM' && 'Morning session'}
          {nextSlot === 'PM' && 'Evening session'}
          {nextSlot === 'done' && 'You’re done today'}
        </div>
        <div style={{ fontSize: 14, color: MUTE, marginTop: 4, lineHeight: 1.45 }}>
          {nextSlot === 'done'
            ? 'Both sessions logged — rest, ice if sore, repeat tomorrow.'
            : <>3 sets × 15 reps · {(settings.paceMs / 1000).toFixed(0)}s lower · ~6 min</>}
        </div>
      </div>

      {/* Primary CTA */}
      <div style={{ flex: 1 }} />

      <button onClick={onStart} style={primaryBtn}>
        {nextSlot === 'done' ? 'Start extra session' : 'Start session'}
      </button>

      {lastResult && (
        <div style={{ color: MUTE, fontSize: 13, textAlign: 'center', marginTop: -4 }}>
          Last: {lastResult.totalReps} reps · {lastResult.totalSets} sets · {Math.round(lastResult.durationMs / 1000)}s
        </div>
      )}

      {/* Bottom tile row */}
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <TileBtn label="Help"     icon="?" onClick={onHelp} />
        <TileBtn label="Logbook"  icon="≡" onClick={onLogbook} />
        <TileBtn label="Settings" icon="⚙" onClick={onSettings} />
      </div>
    </Page>
  );
}

function useNextSlot(): 'AM' | 'PM' | 'done' {
  return useMemo(() => {
    const today = new Date();
    const same = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const todays = loadLog().filter((e) => same(new Date(e.completedAt), today));
    if (todays.length === 0) return 'AM';
    if (todays.length === 1) return 'PM';
    return 'done';
  }, []);
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 6, height: 6, borderRadius: 999, background: color, display: 'inline-block' }} />;
}

function TileBtn({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, height: 60, borderRadius: 14, background: '#FFF', border: `1px solid ${LINE}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 2, color: INK, cursor: 'pointer', fontFamily: FONT,
    }}>
      <div style={{ fontSize: 16, color: BLUE, fontWeight: 700, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
    </button>
  );
}

// ─── Onboarding ─────────────────────────────────────────────────────────────

function OnboardingScreen({ settings, onChange, onFinish }: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onFinish: () => void;
}) {
  const [step, setStep] = useState(0);
  const steps = 3;

  return (
    <Page>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ color: BRAND, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Rebow</div>
        <div style={{ color: MUTE, fontSize: 12, fontWeight: 600 }}>{step + 1} of {steps}</div>
      </div>

      {/* progress dots */}
      <div style={{ display: 'flex', gap: 6, width: '100%' }}>
        {Array.from({ length: steps }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 999,
            background: i <= step ? BLUE : LINE,
          }} />
        ))}
      </div>

      {step === 0 && (
        <>
          <StepHeader title="Which hand?" subtitle="You can change this later in Settings." />
          <BigPill
            value={settings.hand}
            options={[{ v: 'L' as Hand, label: 'Left' }, { v: 'R' as Hand, label: 'Right' }]}
            onSelect={(v) => onChange({ ...settings, hand: v })}
          />
        </>
      )}

      {step === 1 && (
        <>
          <StepHeader title="Which side?" subtitle="Tap a card to choose. The diagram shows where the tendon attaches." />
          <ConditionPicker value={settings.condition} onSelect={(c) => onChange({ ...settings, condition: c })} />
        </>
      )}

      {step === 2 && (
        <>
          <StepHeader title="How a rep works" subtitle="Mount the phone on your forearm, then lower the wrist slowly." />
          <div style={{ background: '#FFF', borderRadius: 14, border: `1px solid ${LINE}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MountIllustration />
            <RepStoryboard />
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} style={secondaryBtn}>Back</button>
        )}
        <button
          onClick={() => (step < steps - 1 ? setStep(step + 1) : onFinish())}
          style={{ ...primaryBtn, flex: 1 }}
        >
          {step < steps - 1 ? 'Continue' : 'Got it — let’s go'}
        </button>
      </div>
    </Page>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ width: '100%', marginTop: 8 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: INK, margin: 0, letterSpacing: '-0.01em' }}>{title}</h1>
      <div style={{ fontSize: 14, color: MUTE, marginTop: 6, lineHeight: 1.4 }}>{subtitle}</div>
    </div>
  );
}

function BigPill<T extends string>({ value, options, onSelect }: {
  value: T;
  options: { v: T; label: string }[];
  onSelect: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
      {options.map((o) => {
        const selected = o.v === value;
        return (
          <button
            key={o.v}
            onClick={() => onSelect(o.v)}
            style={{
              flex: 1, height: 72, borderRadius: 16, cursor: 'pointer',
              background: selected ? BLUE : '#FFF',
              color: selected ? '#FFF' : INK,
              border: `1.5px solid ${selected ? BLUE : LINE}`,
              fontSize: 18, fontWeight: 700, fontFamily: FONT,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ConditionPicker({ value, onSelect }: { value: Condition; onSelect: (c: Condition) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      {(['tennis', 'golfers'] as Condition[]).map((c) => {
        const meta = CONDITION_META[c];
        const selected = value === c;
        return (
          <button key={c} onClick={() => onSelect(c)} style={{
            background: selected ? BLUE : '#FFF',
            color: selected ? '#FFF' : INK,
            border: `1.5px solid ${selected ? BLUE : LINE}`,
            borderRadius: 16, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 14,
            cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
          }}>
            <div style={{ width: 70, flexShrink: 0 }}>
              <ForearmAnatomy highlight={c} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{meta.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: selected ? 'rgba(255,255,255,0.85)' : BLUE, marginTop: 2, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {meta.side}
              </div>
              <div style={{ fontSize: 12, color: selected ? 'rgba(255,255,255,0.8)' : MUTE, marginTop: 4 }}>
                {meta.siteLong}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Settings ───────────────────────────────────────────────────────────────

function SettingsScreen({ settings, onChange, onBack, onHelp }: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
  onHelp: () => void;
}) {
  const paceSec = (settings.paceMs / 1000).toFixed(1);

  return (
    <Page>
      <Header title="Settings" onBack={onBack} />

      <Section label="Hand">
        <PillRow
          value={settings.hand}
          options={[{ v: 'L' as Hand, label: 'Left' }, { v: 'R' as Hand, label: 'Right' }]}
          onSelect={(v) => onChange({ ...settings, hand: v })}
        />
      </Section>

      <Section label="Condition" footer={CONDITION_META[settings.condition].siteLong}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(['tennis', 'golfers'] as Condition[]).map((c) => {
            const meta = CONDITION_META[c];
            const selected = settings.condition === c;
            return (
              <button key={c} onClick={() => onChange({ ...settings, condition: c })} style={{
                background: selected ? BLUE : 'transparent',
                color: selected ? '#FFF' : INK,
                border: `1.5px solid ${BLUE}`,
                borderRadius: 12, padding: '12px 14px', height: 56,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', fontFamily: FONT,
              }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{meta.label}</div>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: selected ? 'rgba(255,255,255,0.85)' : BLUE,
                  border: `1px solid ${selected ? 'rgba(255,255,255,0.4)' : BLUE}`,
                  borderRadius: 999, padding: '3px 8px',
                }}>
                  {meta.side}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section label={`Eccentric pace · ${paceSec}s`} footer="Time to lower the wrist. Start at 3s, build to 5–6s for therapeutic load.">
        <input
          type="range"
          min={2000}
          max={8000}
          step={500}
          value={settings.paceMs}
          onChange={(e) => onChange({ ...settings, paceMs: Number(e.target.value) })}
          style={{ width: '100%', accentColor: BLUE }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTE, marginTop: 4 }}>
          <span>2s</span><span style={{ color: BLUE, fontWeight: 700 }}>5s · Alfredson</span><span>8s</span>
        </div>
      </Section>

      <button onClick={onHelp} style={{
        height: 48, borderRadius: 12, background: 'transparent', color: BLUE,
        fontSize: 14, fontWeight: 600, border: `1.5px solid ${BLUE}`, cursor: 'pointer',
        width: '100%', fontFamily: FONT, marginTop: 8,
      }}>
        Read the protocol & how-to
      </button>
    </Page>
  );
}

// ─── Logbook ────────────────────────────────────────────────────────────────

function LogbookScreen({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<LogEntry[]>(loadLog);

  const grouped = groupByDay(entries);
  const totalReps = entries.reduce((acc, e) => acc + e.totalReps, 0);
  const totalSessions = entries.length;
  const streak = computeStreakDays(entries);

  return (
    <Page>
      <Header title="Logbook" onBack={onBack} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, width: '100%' }}>
        <Stat label="Sessions" value={String(totalSessions)} />
        <Stat label="Reps" value={String(totalReps)} />
        <Stat label="Streak" value={streak > 0 ? `${streak}d` : '—'} accent={streak > 0} />
      </div>

      {entries.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTE, fontSize: 14, textAlign: 'center', padding: 24 }}>
          No sessions yet.<br />Complete one to see it here.
        </div>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              marginTop: 8, height: 44, borderRadius: 10, border: `1px solid ${LINE}`,
              background: 'transparent', color: MUTE, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </Page>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      background: '#FFF', border: `1px solid ${LINE}`, borderRadius: 12,
      padding: '12px 8px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ? ACCENT : INK, lineHeight: 1 }}>{value}</div>
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
  const meta = CONDITION_META[entry.condition];
  return (
    <div style={{
      background: '#FFF', border: `1px solid ${LINE}`, borderRadius: 12,
      padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* Hand badge with side mini-tag */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: BLUE, color: '#FFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800,
        }}>
          {entry.hand}
        </div>
        <div style={{
          position: 'absolute', right: -4, bottom: -4, background: CREAM,
          border: `1.5px solid ${BLUE}`, color: BLUE, fontWeight: 800,
          width: 18, height: 18, borderRadius: 999, fontSize: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {meta.side[0]}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
          {meta.short} · {entry.totalReps} reps
          <span style={{ color: MUTE, fontWeight: 500, marginLeft: 6, fontSize: 12 }}>
            {meta.side}
          </span>
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
    } else break;
  }
  return streak;
}

// ─── Shared bits ────────────────────────────────────────────────────────────

function Page({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: CREAM, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', gap: 16,
      padding: '40px 20px 24px', boxSizing: 'border-box', overflowY: 'auto',
      maxWidth: '100vw',
    }}>
      <div style={{ width: '100%', maxWidth: 380, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12 }}>
      <button onClick={onBack} style={backBtn} aria-label="Back">←</button>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: 0 }}>{title}</h1>
    </div>
  );
}

function Section({ label, children, footer }: { label: string; children: ReactNode; footer?: string }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={kickerStyle}>{label}</div>
      {children}
      {footer && (
        <div style={{ fontSize: 12, color: MUTE, marginTop: 8, lineHeight: 1.45 }}>{footer}</div>
      )}
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
          <button key={o.v} onClick={() => onSelect(o.v)} style={{
            flex: 1, height: 48, borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            background: selected ? BLUE : 'transparent',
            color: selected ? '#FFF' : BLUE,
            border: `1.5px solid ${BLUE}`,
            fontFamily: FONT,
          }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Style tokens ───────────────────────────────────────────────────────────

const kickerStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
  color: MUTE, textTransform: 'uppercase', marginBottom: 8,
};

const primaryBtn: React.CSSProperties = {
  height: 64, padding: '0 32px', borderRadius: 16, background: BLUE, color: '#FFF',
  fontSize: 18, fontWeight: 700, border: 'none', cursor: 'pointer',
  width: '100%', fontFamily: FONT, letterSpacing: '0.005em',
};

const secondaryBtn: React.CSSProperties = {
  flex: 1, height: 64, borderRadius: 16, background: 'transparent', color: BLUE,
  fontSize: 16, fontWeight: 700, border: `1.5px solid ${BLUE}`, cursor: 'pointer', fontFamily: FONT,
};

const backBtn: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 999, border: `1.5px solid ${BLUE}`,
  background: 'transparent', color: BLUE, fontSize: 20, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const configChip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 44, padding: '0 14px',
  borderRadius: 999, border: `1px solid ${LINE}`, background: '#FFF',
  color: INK, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: FONT,
};

// Re-export so a preview/storybook can mount individual screens
// without redoing the layout chrome. Tree-shaken out of prod bundles
// when callers don't import them.
export { HomeScreen, SettingsScreen, LogbookScreen, OnboardingScreen };
export { BRAND, BLUE, ACCENT, WARN, CREAM, INK, MUTE, LINE, FONT };
