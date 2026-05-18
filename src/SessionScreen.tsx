// src/SessionScreen.tsx
// Rebow — eccentric loading session.
// Renders the locked rep-page design: upper-quadrant pendulum gauge, sage
// needle for live wrist, blue fill for pacer target, full-screen flash between
// reps, sage-ring countdown for rest. Prop contract preserved.

import { useEffect, useRef, useState } from 'react';
import { BLUE, INK, CREAM, LINE, ACCENT, WARN, MUTE, FONT } from './tokens';

// ─── Prop / result contract (unchanged) ─────────────────────────────────────

export type SessionResult = {
  completedAt: Date;
  totalReps: number;
  totalSets: number;
  durationMs: number;
};

type Props = {
  sessionNumber: number;
  condition: 'tennis' | 'golfers';
  hand: 'L' | 'R';
  paceMs: number;
  onComplete: (r: SessionResult) => void;
  onExit: () => void;
};

// ─── Protocol constants ─────────────────────────────────────────────────────

const REPS_PER_SET = 15;
const TOTAL_SETS = 3;
const REST_MS = 90_000;
const FLASH_MS = 700;
const ARM_MS = 1200;
const DRIFT_TOLERANCE = 0.18;
const Z_RANGE_DEG = 90;

// ─── Gauge geometry ─────────────────────────────────────────────────────────

const W = 390;
const PIVOT_INSET = 44;
const PIVOT_Y = 480;
const GAUGE_R = 280;
const GAUGE_STROKE = 48;

type Phase = 'arm' | 'rep' | 'flash' | 'rest' | 'done';

export default function SessionScreen({
  sessionNumber: _sessionNumber,
  condition,
  hand,
  paceMs,
  onComplete,
  onExit,
}: Props) {
  const mirror = (condition === 'tennis' && hand === 'L') ||
                 (condition === 'golfers' && hand === 'R');

  const [phase, setPhase] = useState<Phase>('arm');
  const [setIdx, setSetIdx] = useState(0);
  const [repIdx, setRepIdx] = useState(0);
  const [pacerT, setPacerT] = useState(0);
  const [realT, setRealT] = useState(0);
  const [restRemaining, setRestRemaining] = useState(REST_MS);
  const [sensorReady, setSensorReady] = useState(false);
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  const startedAt = useRef<Date>(new Date());
  const repStartTime = useRef<number>(0);
  const baselineGamma = useRef<number | null>(null);
  const latestGamma = useRef<number>(0);

  useEffect(() => {
    type DeviceOrientationEventStatic = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    const DOE = DeviceOrientationEvent as unknown as DeviceOrientationEventStatic | undefined;

    const handler = (e: DeviceOrientationEvent) => {
      const g = e.gamma ?? 0;
      latestGamma.current = g;
      if (baselineGamma.current === null) {
        baselineGamma.current = g;
        setSensorReady(true);
      }
    };

    if (DOE && typeof DOE.requestPermission === 'function') {
      return;
    }

    window.addEventListener('deviceorientation', handler);
    setPermissionState('granted');
    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  const requestSensor = async () => {
    type DeviceOrientationEventStatic = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    const DOE = DeviceOrientationEvent as unknown as DeviceOrientationEventStatic | undefined;
    if (!DOE || typeof DOE.requestPermission !== 'function') {
      setPermissionState('granted');
      return;
    }
    setPermissionState('requesting');
    try {
      const r = await DOE.requestPermission();
      setPermissionState(r);
      if (r === 'granted') {
        const handler = (e: DeviceOrientationEvent) => {
          const g = e.gamma ?? 0;
          latestGamma.current = g;
          if (baselineGamma.current === null) {
            baselineGamma.current = g;
            setSensorReady(true);
          }
        };
        window.addEventListener('deviceorientation', handler);
      }
    } catch {
      setPermissionState('denied');
    }
  };

  useEffect(() => {
    if (phase !== 'rep') return;
    repStartTime.current = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - repStartTime.current;
      const p = Math.min(1, elapsed / paceMs);
      setPacerT(p);

      const baseline = baselineGamma.current ?? 0;
      const deltaDeg = Math.abs(latestGamma.current - baseline);
      const r = Math.max(0, Math.min(1, deltaDeg / Z_RANGE_DEG));
      setRealT(r);

      if (p >= 1) {
        setPhase('flash');
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, paceMs]);

  useEffect(() => {
    if (phase !== 'flash') return;
    const nextRep = repIdx + 1;
    const t = setTimeout(() => {
      if (nextRep >= REPS_PER_SET) {
        setRepIdx(0);
        const nextSet = setIdx + 1;
        if (nextSet >= TOTAL_SETS) {
          onComplete({
            completedAt: new Date(),
            totalReps: TOTAL_SETS * REPS_PER_SET,
            totalSets: TOTAL_SETS,
            durationMs: Date.now() - startedAt.current.getTime(),
          });
          setPhase('done');
        } else {
          setSetIdx(nextSet);
          setRestRemaining(REST_MS);
          setPhase('rest');
        }
      } else {
        setRepIdx(nextRep);
        setPacerT(0);
        setRealT(0);
        setPhase('arm');
      }
    }, FLASH_MS);
    return () => clearTimeout(t);
  }, [phase, repIdx, setIdx, onComplete]);

  useEffect(() => {
    if (phase !== 'arm') return;
    baselineGamma.current = latestGamma.current;
    const t = setTimeout(() => setPhase('rep'), ARM_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'rest') return;
    const start = performance.now();
    const initial = restRemaining;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const remaining = Math.max(0, initial - elapsed);
      setRestRemaining(remaining);
      if (remaining <= 0) {
        setPhase('arm');
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (permissionState !== 'granted' && permissionState !== 'denied') {
    return (
      <PermissionGate
        state={permissionState}
        onRequest={requestSensor}
        onExit={onExit}
      />
    );
  }

  if (phase === 'rest') {
    return (
      <RestView
        setNumber={setIdx + 1}
        paceMs={paceMs}
        remaining={restRemaining}
        onSkip={() => setPhase('arm')}
        onExit={onExit}
      />
    );
  }

  const showFlash = phase === 'flash';
  return (
    <div style={{ position: 'fixed', inset: 0, background: CREAM, fontFamily: FONT, overflow: 'hidden' }}>
      <TopBar setNumber={setIdx + 1} onExit={onExit} />

      {!showFlash && (
        <Gauge pacerT={pacerT} realT={realT} mirror={mirror} dim={phase === 'arm'} />
      )}

      {showFlash && (
        <FlashOverlay repCompleted={repIdx + 1} />
      )}

      {!showFlash && (
        <>
          <RepCounter rep={repIdx + 1} />
          <PaceBar
            phase={phase}
            pacerT={pacerT}
            paceMs={paceMs}
            sensorReady={sensorReady}
          />
        </>
      )}
    </div>
  );
}

function TopBar({ setNumber, onExit }: { setNumber: number; onExit: () => void }) {
  return (
    <div style={{
      position: 'absolute', top: 60, left: 20, right: 20, zIndex: 3,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <button onClick={onExit} aria-label="Exit session" style={{
        width: 44, height: 44, borderRadius: 999, border: `1.5px solid ${INK}`,
        background: 'transparent', color: INK, fontSize: 18, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT,
      }}>✕</button>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {Array.from({ length: TOTAL_SETS }).map((_, i) => {
          const done = i < setNumber - 1, active = i === setNumber - 1;
          return (
            <div key={i} style={{
              width: active ? 28 : 16, height: 4, borderRadius: 999,
              background: active || done ? INK : LINE,
              opacity: done ? 0.35 : 1,
              transition: 'width 0.2s',
            }} />
          );
        })}
        <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, color: INK, letterSpacing: '0.02em', fontFamily: FONT }}>
          SET {setNumber}
        </span>
      </div>

      <div style={{ width: 44 }} />
    </div>
  );
}

function Gauge({ pacerT, realT, mirror, dim }: {
  pacerT: number; realT: number; mirror: boolean; dim: boolean;
}) {
  const cx = mirror ? W - PIVOT_INSET : PIVOT_INSET;
  const cy = PIVOT_Y;
  const r = GAUGE_R;
  const a0 = -Math.PI / 2;
  const a1 = mirror ? -Math.PI : 0;
  const aOf = (t: number) => a0 + (a1 - a0) * t;

  const aPacer = aOf(pacerT);
  const aReal = aOf(realT);

  const sx = cx + r * Math.cos(a0), sy = cy + r * Math.sin(a0);
  const ex = cx + r * Math.cos(a1), ey = cy + r * Math.sin(a1);
  const px = cx + r * Math.cos(aPacer), py = cy + r * Math.sin(aPacer);
  const nx = cx + r * Math.cos(aReal), ny = cy + r * Math.sin(aReal);

  const drift = Math.abs(realT - pacerT);
  const offPace = drift > DRIFT_TOLERANCE && pacerT > 0.05;
  const needleColor = offPace ? WARN : ACCENT;

  const ticks = [0.25, 0.5, 0.75].map((t) => {
    const a = aOf(t);
    const inner = r - (GAUGE_STROKE / 2 + 4);
    const outer = r + (GAUGE_STROKE / 2 + 4);
    return {
      x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a),
      x2: cx + outer * Math.cos(a), y2: cy + outer * Math.sin(a),
      visible: pacerT < t,
    };
  });

  const sweepFlag = mirror ? 0 : 1;

  return (
    <svg
      viewBox={`0 0 ${W} 760`}
      width={W}
      height={760}
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none', opacity: dim ? 0.55 : 1,
        transition: 'opacity 0.25s',
      }}
    >
      <path d={`M ${sx} ${sy} A ${r} ${r} 0 0 ${sweepFlag} ${ex} ${ey}`}
        stroke={LINE} strokeWidth={GAUGE_STROKE} fill="none" strokeLinecap="round" />

      {pacerT > 0.001 && (
        <path d={`M ${sx} ${sy} A ${r} ${r} 0 0 ${sweepFlag} ${px} ${py}`}
          stroke={BLUE} strokeWidth={GAUGE_STROKE} fill="none" strokeLinecap="round" />
      )}

      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={INK} strokeWidth="2" strokeLinecap="round"
          opacity={t.visible ? 0.2 : 0} />
      ))}

      <line x1={cx} y1={cy} x2={nx} y2={ny}
        stroke={needleColor} strokeWidth="8" strokeLinecap="round" />
      <circle cx={nx} cy={ny} r="18" fill={needleColor} />
      <circle cx={nx} cy={ny} r="8" fill={CREAM} />

      <circle cx={cx} cy={cy} r="7" fill={INK} />
    </svg>
  );
}

function RepCounter({ rep }: { rep: number }) {
  return (
    <div style={{
      position: 'absolute', top: 552, left: 0, right: 0,
      display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10,
      fontFamily: FONT, pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 96, fontWeight: 900, color: INK, lineHeight: 1, letterSpacing: '-0.04em' }}>
        {rep}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: MUTE }}>
        / {REPS_PER_SET}
      </div>
    </div>
  );
}

function PaceBar({ phase, pacerT, paceMs, sensorReady }: {
  phase: Phase; pacerT: number; paceMs: number; sensorReady: boolean;
}) {
  const seconds = (pacerT * (paceMs / 1000)).toFixed(1);
  const total = (paceMs / 1000).toFixed(1);
  const armCue = phase === 'arm';

  return (
    <div style={{ position: 'absolute', bottom: 64, left: 32, right: 32, fontFamily: FONT }}>
      <div style={{ height: 6, background: LINE, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pacerT * 100}%`,
          background: ACCENT,
          borderRadius: 999,
          transition: 'width 60ms linear',
        }} />
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 8,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: MUTE, textTransform: 'uppercase',
      }}>
        <span>
          {armCue
            ? sensorReady ? 'Lift to top · auto-starts' : 'Calibrating sensor…'
            : `Lower · ${seconds}s`}
        </span>
        <span>{total}s</span>
      </div>
    </div>
  );
}

function FlashOverlay({ repCompleted }: { repCompleted: number }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', fontFamily: FONT, pointerEvents: 'none',
    }}>
      <div style={{
        fontSize: 14, fontWeight: 700, color: ACCENT,
        letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8,
      }}>
        {repCompleted === REPS_PER_SET ? 'Set complete' : 'Rep complete'}
      </div>
      <div style={{
        fontSize: 280, fontWeight: 900, color: INK,
        lineHeight: 0.85, letterSpacing: '-0.06em',
      }}>
        {repCompleted}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: MUTE, marginTop: 8, letterSpacing: '0.04em' }}>
        of {REPS_PER_SET} · {repCompleted === REPS_PER_SET ? 'rest up' : 'reset and lift'}
      </div>
    </div>
  );
}

function RestView({ setNumber, paceMs, remaining, onSkip, onExit }: {
  setNumber: number; paceMs: number; remaining: number;
  onSkip: () => void; onExit: () => void;
}) {
  const total = REST_MS;
  const elapsedFrac = 1 - remaining / total;
  const totalSec = Math.ceil(remaining / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = String(totalSec % 60).padStart(2, '0');

  const C = 2 * Math.PI * 100;
  const dash = elapsedFrac * C;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: CREAM, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <TopBar setNumber={setNumber} onExit={onExit} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
          color: MUTE, textTransform: 'uppercase', marginBottom: 12,
        }}>Rest</div>

        <svg viewBox="0 0 240 240" width={280} height={280} style={{ marginBottom: 24 }}>
          <circle cx="120" cy="120" r="100" stroke={LINE} strokeWidth="14" fill="none" />
          <circle
            cx="120" cy="120" r="100"
            stroke={ACCENT} strokeWidth="14" fill="none"
            strokeDasharray={`${dash} ${C}`}
            strokeDashoffset="0"
            transform="rotate(-90 120 120)"
            strokeLinecap="round"
          />
          <text x="120" y="138" textAnchor="middle"
            fontFamily={FONT} fontSize="70" fontWeight="900" fill={INK} letterSpacing="-0.04em">
            {mm}:{ss}
          </text>
        </svg>

        <div style={{ fontSize: 18, fontWeight: 700, color: INK, textAlign: 'center', lineHeight: 1.3 }}>
          Set {setNumber} of {TOTAL_SETS} starts soon
        </div>
        <div style={{ fontSize: 13, color: MUTE, marginTop: 6, textAlign: 'center' }}>
          {REPS_PER_SET} reps · {(paceMs / 1000).toFixed(0)}s lower
        </div>
      </div>

      <div style={{ padding: '0 24px 60px' }}>
        <button onClick={onSkip} style={{
          height: 60, borderRadius: 16, background: BLUE, color: '#fff',
          border: 'none', fontSize: 17, fontWeight: 700, cursor: 'pointer',
          fontFamily: FONT, width: '100%',
        }}>
          Skip rest · start now
        </button>
      </div>
    </div>
  );
}

function PermissionGate({ state, onRequest, onExit }: {
  state: 'idle' | 'requesting' | 'granted' | 'denied';
  onRequest: () => void;
  onExit: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: CREAM, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', padding: '60px 24px 40px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button onClick={onExit} aria-label="Exit" style={{
          width: 44, height: 44, borderRadius: 999, border: `1.5px solid ${INK}`,
          background: 'transparent', color: INK, fontSize: 18, cursor: 'pointer',
        }}>✕</button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 360, margin: '0 auto', width: '100%' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: BLUE, textTransform: 'uppercase' }}>
          Sensor access
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: INK, margin: '8px 0 12px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          Allow motion to start
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: MUTE, margin: 0 }}>
          Rebow reads your phone's tilt to pace the eccentric drop. We don't record,
          upload, or share any sensor data.
        </p>

        {state === 'denied' && (
          <div style={{
            marginTop: 24, padding: 16, borderRadius: 12,
            background: '#FFF', border: `1px solid ${WARN}33`,
            fontSize: 13, color: INK, lineHeight: 1.5,
          }}>
            Motion access was denied. Open Safari settings to re-enable it,
            then come back.
          </div>
        )}
      </div>

      <button
        onClick={onRequest}
        disabled={state === 'requesting'}
        style={{
          height: 64, borderRadius: 16, background: BLUE, color: '#fff',
          border: 'none', fontSize: 18, fontWeight: 700, cursor: 'pointer',
          fontFamily: FONT, width: '100%', maxWidth: 360, margin: '0 auto',
        }}
      >
        {state === 'requesting' ? 'Asking…' : 'Allow motion access'}
      </button>
    </div>
  );
}
