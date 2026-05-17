import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useReducer,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

type MountAxis = 'x' | 'y' | 'z';
type Condition = 'tennis' | 'golfers';
type Hand = 'L' | 'R';
type AccelPhase = 'LOWER' | 'HOLD' | 'LIFT' | 'NEUTRAL';
type InternalPhase = 'WAITING' | 'ACTIVE' | 'REST' | 'COMPLETE';
type AccelPermission = 'unknown' | 'granted' | 'denied' | 'unavailable';

export interface SessionResult {
  totalReps: number;
  totalSets: number;
  durationMs: number;
  completedAt: Date;
}

export interface SessionScreenProps {
  sessionNumber: 1 | 2;
  condition?: Condition; // 'tennis' = wrist extension (CCW); 'golfers' = wrist flexion (CW)
  hand?: Hand;           // 'L' | 'R' — flips the expected rotation direction
  paceMs?: number;       // eccentric lowering duration (default 5000)
  onComplete: (result: SessionResult) => void;
  onExit: () => void;
  mountAxis?: MountAxis;
}

// iOS 13+ exposes a static requestPermission on DeviceMotionEvent (not in TS lib)
type IOSDeviceMotionEvent = typeof DeviceMotionEvent & {
  requestPermission: () => Promise<'granted' | 'denied'>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_SETS = 3;
const REPS_PER_SET = 15;
const REST_SECONDS = 90;
const SKIP_AFTER_ELAPSED = 30;

// Angle thresholds (degrees from vertical)
const NEUTRAL_MAX = 18;   // below this = at top / ready
const HOLD_MIN = 55;      // above this can register a HOLD
const ARC_MAX = 90;       // gauge max

// Velocity / dwell
const MOVE_VELOCITY = 25; // °/s — minimum to count as actively moving
const HOLD_DWELL_MS = 200;

// Ghost pacing (Alfredson eccentric target)
const GHOST_LOWER_MS = 3000;
const GHOST_LIFT_MS = 1200;

// Smoothing
const SMOOTH_ALPHA = 0.35; // low-pass filter coefficient

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// ─── useAccelerometer ─────────────────────────────────────────────────────────

interface AccelOutput {
  angle: number;            // 0° = vertical, 90° = horizontal
  accelPhase: AccelPhase;
  permission: AccelPermission;
  isManualMode: boolean;
  requestPermission: () => Promise<AccelPermission>;
  enableManualMode: () => void;
}

function useAccelerometer(_mountAxis: MountAxis, hand: Hand, condition: Condition): AccelOutput {
  // Expected rotation direction for the eccentric drop in the YZ plane.
  // Phone is portrait, screen facing user. The wrist-flexion/extension axis
  // is the phone's X axis, so we measure signed angle in the YZ plane.
  // Direction flips with hand and with condition (tennis = extension drop,
  // golfers = flexion drop).
  const directionSign =
    (condition === 'tennis' ? 1 : -1) * (hand === 'R' ? 1 : -1);
  const [angle, setAngle] = useState(0);
  const [accelPhase, setAccelPhase] = useState<AccelPhase>('NEUTRAL');
  const [permission, setPermission] = useState<AccelPermission>('unknown');
  const [isManualMode, setIsManualMode] = useState(false);

  // Hot-path state — all in refs to avoid render loops
  const phaseRef = useRef<AccelPhase>('NEUTRAL');
  const angleRef = useRef(0);
  const prevAngleRef = useRef(0);
  const prevTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const holdStartRef = useRef(0);
  const lastEmittedAngleRef = useRef(0);

  const handleMotion = useCallback(
    (event: DeviceMotionEvent): void => {
      const g = event.accelerationIncludingGravity;
      if (!g) return;
      const x = g.x;
      const y = g.y;
      const z = g.z;
      if (x === null || y === null || z === null) return;

      const total = Math.sqrt(x * x + y * y + z * z);
      if (total === 0) return;

      // Constrain to rotation about the phone's Z axis (perpendicular to screen).
      // Signed angle in the XY plane: 0° = phone vertical (Y down),
      // positive = top tipping right (CW from user's view).
      const signedXY = (Math.atan2(x, -y) * 180) / Math.PI;
      // Apply hand+condition sign so the eccentric drop is always positive.
      const directional = signedXY * directionSign;
      // Clamp into [0, 90] — wrong-direction rotation reads as 0 (gauge ignores it).
      const rawAngle = Math.max(0, Math.min(90, directional));

      // Low-pass smoothing
      const smoothed = angleRef.current * (1 - SMOOTH_ALPHA) + rawAngle * SMOOTH_ALPHA;

      const now = performance.now();
      const dt = prevTimeRef.current === 0 ? 16 : Math.max(1, now - prevTimeRef.current);
      const velocity = ((smoothed - prevAngleRef.current) / dt) * 1000; // °/s

      prevAngleRef.current = smoothed;
      prevTimeRef.current = now;
      angleRef.current = smoothed;
      velocityRef.current = velocity;

      // Only re-render when angle change is visible (>=0.5°)
      if (Math.abs(smoothed - lastEmittedAngleRef.current) >= 0.5) {
        lastEmittedAngleRef.current = smoothed;
        setAngle(smoothed);
      }

      // ── Phase state machine ──
      const prev = phaseRef.current;
      let next: AccelPhase = prev;

      if (prev === 'NEUTRAL') {
        if (smoothed > NEUTRAL_MAX && velocity > MOVE_VELOCITY) {
          next = 'LOWER';
          holdStartRef.current = 0;
        }
      } else if (prev === 'LOWER') {
        if (smoothed >= HOLD_MIN && Math.abs(velocity) < MOVE_VELOCITY) {
          if (holdStartRef.current === 0) holdStartRef.current = now;
          else if (now - holdStartRef.current >= HOLD_DWELL_MS) {
            next = 'HOLD';
          }
        } else {
          holdStartRef.current = 0;
        }
      } else if (prev === 'HOLD') {
        if (velocity < -MOVE_VELOCITY) {
          next = 'LIFT';
          holdStartRef.current = 0;
        }
      } else if (prev === 'LIFT') {
        if (smoothed < NEUTRAL_MAX && Math.abs(velocity) < MOVE_VELOCITY * 2) {
          next = 'NEUTRAL';
        }
      }

      if (next !== prev) {
        phaseRef.current = next;
        setAccelPhase(next);
      }
    },
    [directionSign],
  );

  const startListening = useCallback((): void => {
    window.addEventListener('devicemotion', handleMotion);
  }, [handleMotion]);

  const requestPermission = useCallback(async (): Promise<AccelPermission> => {
    const DME = DeviceMotionEvent as unknown as IOSDeviceMotionEvent;
    if (typeof DME.requestPermission === 'function') {
      try {
        const result = await DME.requestPermission();
        const perm: AccelPermission = result === 'granted' ? 'granted' : 'denied';
        setPermission(perm);
        if (perm === 'granted') startListening();
        return perm;
      } catch {
        setPermission('denied');
        return 'denied';
      }
    } else if (typeof window.DeviceMotionEvent !== 'undefined') {
      setPermission('granted');
      startListening();
      return 'granted';
    } else {
      setPermission('unavailable');
      return 'unavailable';
    }
  }, [startListening]);

  const enableManualMode = useCallback((): void => {
    setIsManualMode(true);
    setPermission('unavailable');
  }, []);

  useEffect(() => {
    if (typeof window.DeviceMotionEvent === 'undefined') {
      setPermission('unavailable');
    }
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [handleMotion]);

  return { angle, accelPhase, permission, isManualMode, requestPermission, enableManualMode };
}

// ─── Ghost pacer ──────────────────────────────────────────────────────────────

// Drives a ghost angle (0→90 during LOWER, 90 during HOLD, 90→0 during LIFT)
// at the Alfredson target tempo. Resets when phase returns to NEUTRAL.
function useGhostAngle(phase: AccelPhase, isActive: boolean, lowerMs: number = GHOST_LOWER_MS): number | null {
  const [ghost, setGhost] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const phaseStartRef = useRef(0);
  const phaseRef = useRef<AccelPhase>('NEUTRAL');

  useEffect(() => {
    if (!isActive) {
      setGhost(null);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      return;
    }

    if (phase !== phaseRef.current) {
      phaseRef.current = phase;
      phaseStartRef.current = performance.now();
    }

    const tick = (): void => {
      const elapsed = performance.now() - phaseStartRef.current;
      let value: number | null = null;
      if (phase === 'LOWER') {
        value = Math.min(ARC_MAX, (elapsed / lowerMs) * ARC_MAX);
      } else if (phase === 'HOLD') {
        value = ARC_MAX;
      } else if (phase === 'LIFT') {
        value = Math.max(0, ARC_MAX - (elapsed / GHOST_LIFT_MS) * ARC_MAX);
      } else {
        value = null;
      }
      setGhost(value);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, isActive]);

  return ghost;
}

// ─── Session state ────────────────────────────────────────────────────────────

interface SessionState {
  internalPhase: InternalPhase;
  currentSet: number;
  currentRep: number;
  restSecondsLeft: number;
  startTime: number;
  repPulse: number;
}

type SessionAction =
  | { type: 'START'; timestamp: number }
  | { type: 'REP_COMPLETE' }
  | { type: 'REST_TICK' }
  | { type: 'SKIP_REST' };

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'START':
      return { ...state, internalPhase: 'ACTIVE', startTime: action.timestamp };

    case 'REP_COMPLETE': {
      if (state.internalPhase !== 'ACTIVE') return state;
      const nextRep = state.currentRep + 1;
      if (nextRep >= REPS_PER_SET) {
        if (state.currentSet >= TOTAL_SETS) {
          return { ...state, internalPhase: 'COMPLETE', currentRep: REPS_PER_SET, repPulse: state.repPulse + 1 };
        }
        return {
          ...state,
          internalPhase: 'REST',
          currentSet: state.currentSet + 1,
          currentRep: 0,
          restSecondsLeft: REST_SECONDS,
          repPulse: state.repPulse + 1,
        };
      }
      return { ...state, currentRep: nextRep, repPulse: state.repPulse + 1 };
    }

    case 'REST_TICK': {
      if (state.internalPhase !== 'REST') return state;
      const next = state.restSecondsLeft - 1;
      if (next <= 0) return { ...state, internalPhase: 'ACTIVE', restSecondsLeft: 0 };
      return { ...state, restSecondsLeft: next };
    }

    case 'SKIP_REST':
      if (state.internalPhase !== 'REST') return state;
      return { ...state, internalPhase: 'ACTIVE', restSecondsLeft: 0 };

    default:
      return state;
  }
}

function useSessionState() {
  const [state, dispatch] = useReducer(sessionReducer, {
    internalPhase: 'WAITING',
    currentSet: 1,
    currentRep: 0,
    restSecondsLeft: REST_SECONDS,
    startTime: 0,
    repPulse: 0,
  });

  useEffect(() => {
    if (state.internalPhase !== 'REST') return;
    const id = setInterval(() => dispatch({ type: 'REST_TICK' }), 1000);
    return () => clearInterval(id);
  }, [state.internalPhase]);

  return { state, dispatch };
}

// ─── Rep detection from phase cycle ───────────────────────────────────────────

function useRepDetection(
  accelPhase: AccelPhase,
  isActive: boolean,
  onRep: () => void,
): void {
  const cycleRef = useRef({ lower: false, hold: false, lift: false });
  const prevRef = useRef<AccelPhase>('NEUTRAL');
  const onRepRef = useRef(onRep);
  onRepRef.current = onRep;

  useEffect(() => {
    if (!isActive) return;
    if (accelPhase === prevRef.current) return;
    const prev = prevRef.current;
    prevRef.current = accelPhase;

    if (accelPhase === 'LOWER') {
      cycleRef.current = { lower: true, hold: false, lift: false };
    } else if (accelPhase === 'HOLD' && cycleRef.current.lower) {
      cycleRef.current.hold = true;
    } else if (accelPhase === 'LIFT' && cycleRef.current.lower && cycleRef.current.hold) {
      cycleRef.current.lift = true;
    } else if (
      accelPhase === 'NEUTRAL' &&
      prev === 'LIFT' &&
      cycleRef.current.lower &&
      cycleRef.current.hold &&
      cycleRef.current.lift
    ) {
      cycleRef.current = { lower: false, hold: false, lift: false };
      onRepRef.current();
    }
  }, [accelPhase, isActive]);
}

// ─── Visual config ────────────────────────────────────────────────────────────

interface Visual {
  bg: string;
  fg: string;
  label: string;
  sub: string;
}

function getVisual(accelPhase: AccelPhase, internalPhase: InternalPhase): Visual {
  if (internalPhase === 'REST')     return { bg: '#1A1A1A', fg: '#F5F0E1', label: 'REST', sub: '' };
  if (internalPhase === 'COMPLETE') return { bg: '#1C7AAF', fg: '#FFFFFF', label: 'DONE', sub: '' };
  if (internalPhase === 'WAITING')  return { bg: '#F5F0E1', fg: '#1A1A1A', label: '', sub: '' };
  switch (accelPhase) {
    case 'LOWER': return { bg: '#1C7AAF', fg: '#FFFFFF', label: 'LOWER', sub: '3 second target' };
    case 'HOLD':  return { bg: '#0F3D20', fg: '#FFFFFF', label: 'HOLD',  sub: 'pause at the bottom' };
    case 'LIFT':  return { bg: '#0A2E17', fg: '#FFFFFF', label: 'LIFT',  sub: 'controlled return' };
    default:      return { bg: '#111111', fg: '#F5F0E1', label: 'READY', sub: 'start your rep' };
  }
}

// ─── ArcGauge ─────────────────────────────────────────────────────────────────
//
// Visual model: device starts vertical (top of arc) and rotates toward
// horizontal (side of arc). Tennis (extension) = CCW (arc to the left);
// golfers (flexion) = CW (arc to the right). The ghost dot sets the
// Alfredson target pace; the real dot is the user's live angle.

interface ArcGaugeProps {
  angle: number;            // 0–90, real angle
  ghostAngle: number | null;
  condition: Condition;
  fg: string;
  active: boolean;          // whether to render the ghost / pace zone
}

function ArcGauge({ angle, ghostAngle, condition, fg, active }: ArcGaugeProps) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const r = 108;
  const cw = condition === 'golfers';
  const dirSign = cw ? 1 : -1;

  // Indicator position for a given arc angle (0 = top, 90 = side)
  const posFor = (a: number) => {
    const clamped = Math.max(0, Math.min(ARC_MAX, a));
    const rad = (clamped * Math.PI) / 180;
    return {
      x: cx + dirSign * r * Math.sin(rad),
      y: cy - r * Math.cos(rad),
    };
  };

  // Arc path: top → side, sweep flag depends on direction
  const arcEnd = posFor(ARC_MAX);
  const arcPath = `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${cw ? 1 : 0} ${arcEnd.x} ${arcEnd.y}`;

  const realPos = posFor(angle);
  const ghostPos = ghostAngle !== null ? posFor(ghostAngle) : null;

  // Tick marks at 0°, 30°, 60°, 90°
  const ticks = [0, 30, 60, 90];

  // Tempo deviation (only meaningful when ghost is pacing actively)
  const paceActive = ghostAngle !== null && active;
  const deviation = paceActive ? angle - (ghostAngle as number) : 0;
  const onPace = Math.abs(deviation) <= 8;
  const tooFast = deviation > 8;

  const realColor = !paceActive
    ? fg
    : onPace
      ? '#22C55E'
      : tooFast
        ? '#EF4444'
        : '#F59E0B';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Arc track */}
        <path
          d={arcPath}
          stroke={`${fg}22`}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
        />

        {/* Tick marks */}
        {ticks.map((t) => {
          const inner = posFor(t);
          const rad = (t * Math.PI) / 180;
          const ox = cx + dirSign * (r + 14) * Math.sin(rad);
          const oy = cy - (r + 14) * Math.cos(rad);
          const ix = cx + dirSign * (r - 6) * Math.sin(rad);
          const iy = cy - (r - 6) * Math.cos(rad);
          return (
            <g key={t}>
              <line x1={ix} y1={iy} x2={ox} y2={oy} stroke={`${fg}55`} strokeWidth={2} strokeLinecap="round" />
              <text
                x={cx + dirSign * (r + 30) * Math.sin(rad)}
                y={cy - (r + 30) * Math.cos(rad) + 4}
                fill={`${fg}80`}
                fontSize={11}
                fontFamily={FONT}
                fontWeight={600}
                textAnchor="middle"
              >
                {t === 0 ? 'top' : t === 90 ? 'btm' : `${t}°`}
              </text>
              <circle cx={inner.x} cy={inner.y} r={2.5} fill={`${fg}80`} />
            </g>
          );
        })}

        {/* Trail from top to ghost (the "completed by now" region) */}
        {ghostPos !== null && (
          <path
            d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 ${cw ? 1 : 0} ${ghostPos.x} ${ghostPos.y}`}
            stroke={`${fg}40`}
            strokeWidth={10}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Ghost indicator (pace setter) */}
        {ghostPos !== null && (
          <g>
            <circle
              cx={ghostPos.x}
              cy={ghostPos.y}
              r={14}
              fill="none"
              stroke={`${fg}AA`}
              strokeWidth={3}
              strokeDasharray="4 3"
            />
          </g>
        )}

        {/* Real indicator (user's actual angle) */}
        <motion.circle
          cx={realPos.x}
          cy={realPos.y}
          r={18}
          fill={realColor}
          stroke={fg}
          strokeWidth={3}
          animate={{ cx: realPos.x, cy: realPos.y }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </svg>

      {/* Center readouts */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            color: fg,
            fontFamily: FONT,
            fontSize: '54px',
            fontWeight: 800,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(angle)}°
        </span>
        {active && ghostAngle !== null && (
          <span
            style={{
              marginTop: '6px',
              color: realColor,
              fontFamily: FONT,
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {onPace ? 'ON PACE' : tooFast ? `+${Math.round(deviation)}° FAST` : `${Math.round(deviation)}° SLOW`}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── RestTimer ────────────────────────────────────────────────────────────────

function RestTimer({
  secondsLeft,
  onSkip,
  fg,
}: {
  secondsLeft: number;
  onSkip: () => void;
  fg: string;
}) {
  const elapsed = REST_SECONDS - secondsLeft;
  const canSkip = elapsed >= SKIP_AFTER_ELAPSED;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: `${fg}70`, fontFamily: FONT }}>
        Rest
      </p>
      <span
        style={{
          fontSize: 'clamp(5rem, 22vw, 8rem)',
          lineHeight: 1,
          fontWeight: 800,
          color: fg,
          fontFamily: FONT,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {mins}:{secs.toString().padStart(2, '0')}
      </span>
      <p style={{ color: `${fg}55`, fontSize: '14px', fontFamily: FONT }}>
        Next set begins automatically
      </p>
      <AnimatePresence>
        {canSkip && (
          <motion.button
            key="skip"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={onSkip}
            style={{
              height: '52px',
              minWidth: '160px',
              paddingLeft: '28px',
              paddingRight: '28px',
              borderRadius: '999px',
              border: `1.5px solid ${fg}45`,
              color: fg,
              backgroundColor: `${fg}18`,
              fontFamily: FONT,
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Skip rest
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SetProgress ──────────────────────────────────────────────────────────────

function SetProgress({ currentSet, fg }: { currentSet: number; fg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {Array.from({ length: TOTAL_SETS }, (_, i) => {
        const n = i + 1;
        const done = n < currentSet;
        const active = n === currentSet;
        return (
          <div
            key={i}
            style={{
              width: active ? '28px' : '10px',
              height: '10px',
              borderRadius: '999px',
              backgroundColor: done ? fg : active ? fg : `${fg}30`,
              transition: 'width 0.2s ease, background-color 0.15s ease',
            }}
          />
        );
      })}
      <span style={{ color: fg, fontFamily: FONT, fontSize: '16px', fontWeight: 600, marginLeft: '6px' }}>
        Set {currentSet} / {TOTAL_SETS}
      </span>
    </div>
  );
}

// ─── PermissionSplash ─────────────────────────────────────────────────────────

function PermissionSplash({
  condition,
  onBegin,
  onManual,
  denied,
}: {
  condition: Condition;
  onBegin: () => Promise<void>;
  onManual: () => void;
  denied: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleBegin = async () => {
    setLoading(true);
    await onBegin();
    setLoading(false);
  };

  const conditionLabel = condition === 'tennis' ? 'Tennis elbow protocol' : "Golfer's elbow protocol";

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F0E1',
        padding: '0 32px',
        gap: '40px',
        fontFamily: FONT,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1C7AAF', marginBottom: '16px' }}>
          {conditionLabel}
        </p>
        <h2 style={{ fontSize: 'clamp(1.75rem, 7vw, 2.5rem)', fontWeight: 800, lineHeight: 1.2, color: '#1A1A1A', marginBottom: '12px' }}>
          Mount your phone,
          <br />
          then begin
        </h2>
        {denied ? (
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#C0392B', maxWidth: '280px', margin: '0 auto' }}>
            Motion access was denied. Use manual tap mode, or allow motion access in Settings and reload.
          </p>
        ) : (
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#777', maxWidth: '280px', margin: '0 auto' }}>
            Rebow tracks the angle of the device through each rep. Ensure your phone is firmly mounted before starting.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
        {!denied && (
          <button
            onClick={handleBegin}
            disabled={loading}
            style={{
              height: '60px',
              width: '100%',
              borderRadius: '16px',
              backgroundColor: '#1C7AAF',
              color: '#FFFFFF',
              fontFamily: FONT,
              fontSize: '18px',
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.75 : 1,
            }}
          >
            {loading ? 'Starting…' : 'Begin session'}
          </button>
        )}
        <button
          onClick={onManual}
          style={{
            height: '52px',
            width: '100%',
            borderRadius: '12px',
            backgroundColor: 'transparent',
            color: '#888',
            fontFamily: FONT,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Use manual tap mode
        </button>
      </div>
    </div>
  );
}

// ─── SessionCompleteScreen ────────────────────────────────────────────────────

function SessionCompleteScreen({
  result,
  onLog,
  onDismiss,
}: {
  result: SessionResult;
  onLog: () => void;
  onDismiss: () => void;
}) {
  const totalMin = Math.floor(result.durationMs / 60000);
  const totalSec = Math.floor((result.durationMs % 60000) / 1000);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F0E1',
        padding: '0 32px',
        gap: '36px',
        fontFamily: FONT,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1C7AAF', marginBottom: '16px' }}>
          Session complete
        </p>
        <h1 style={{ fontSize: 'clamp(3rem, 16vw, 5rem)', fontWeight: 900, lineHeight: 1, color: '#1A1A1A' }}>
          {result.totalReps} reps
        </h1>
        <p style={{ fontSize: '20px', color: '#555', marginTop: '8px' }}>
          {result.totalSets} sets&nbsp;&nbsp;·&nbsp;&nbsp;
          {totalMin}:{totalSec.toString().padStart(2, '0')}
        </p>
      </div>

      <p style={{ textAlign: 'center', fontSize: '14px', lineHeight: 1.65, color: '#777', maxWidth: '300px' }}>
        Consistent eccentric loading is the primary evidence-based treatment for tendinopathy.
        Completing both daily sessions maximises adaptation.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
        <button
          onClick={onLog}
          style={{
            height: '60px',
            width: '100%',
            borderRadius: '16px',
            backgroundColor: '#1C7AAF',
            color: '#FFFFFF',
            fontFamily: FONT,
            fontSize: '18px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Log session
        </button>
        <button
          onClick={onDismiss}
          style={{
            height: '60px',
            width: '100%',
            borderRadius: '16px',
            backgroundColor: 'transparent',
            color: '#1C7AAF',
            fontFamily: FONT,
            fontSize: '18px',
            fontWeight: 600,
            border: '1.5px solid #1C7AAF',
            cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>
    </motion.div>
  );
}

// ─── SessionScreen ────────────────────────────────────────────────────────────

export default function SessionScreen({
  sessionNumber,
  condition = 'tennis',
  hand = 'R',
  paceMs,
  onComplete,
  onExit,
  mountAxis = 'y',
}: SessionScreenProps) {
  const accel = useAccelerometer(mountAxis, hand, condition);
  const { state, dispatch } = useSessionState();
  const startTimeRef = useRef<number>(0);

  const handleRep = useCallback(() => {
    dispatch({ type: 'REP_COMPLETE' });
  }, [dispatch]);

  const isActive = state.internalPhase === 'ACTIVE';
  useRepDetection(accel.accelPhase, isActive, handleRep);

  const ghostAngle = useGhostAngle(accel.accelPhase, isActive, paceMs ?? GHOST_LOWER_MS);

  const visual = getVisual(accel.accelPhase, state.internalPhase);
  const bgDuration =
    state.internalPhase === 'ACTIVE' && accel.accelPhase === 'LOWER' ? 0 : 0.15;

  const handleBegin = useCallback(async (): Promise<void> => {
    const perm = await accel.requestPermission();
    if (perm === 'granted') {
      startTimeRef.current = Date.now();
      dispatch({ type: 'START', timestamp: startTimeRef.current });
    } else if (perm === 'unavailable') {
      accel.enableManualMode();
      startTimeRef.current = Date.now();
      dispatch({ type: 'START', timestamp: startTimeRef.current });
    }
  }, [accel, dispatch]);

  const handleManual = useCallback((): void => {
    accel.enableManualMode();
    startTimeRef.current = Date.now();
    dispatch({ type: 'START', timestamp: startTimeRef.current });
  }, [accel, dispatch]);

  const buildResult = (): SessionResult => ({
    totalReps: TOTAL_SETS * REPS_PER_SET,
    totalSets: TOTAL_SETS,
    durationMs: startTimeRef.current > 0 ? Date.now() - startTimeRef.current : 0,
    completedAt: new Date(),
  });

  if (state.internalPhase === 'WAITING') {
    return (
      <PermissionSplash
        condition={condition}
        onBegin={handleBegin}
        onManual={handleManual}
        denied={accel.permission === 'denied'}
      />
    );
  }

  if (state.internalPhase === 'COMPLETE') {
    const result = buildResult();
    return (
      <SessionCompleteScreen
        result={result}
        onLog={() => onComplete(result)}
        onDismiss={onExit}
      />
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        userSelect: 'none',
        overflow: 'hidden',
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: visual.bg,
          transition: `background-color ${bgDuration}s ease`,
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            height: '64px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: `${visual.fg}90`, fontSize: '14px', fontWeight: 500 }}>
              Session {sessionNumber} of 2 today
            </span>
            <span style={{ color: `${visual.fg}60`, fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '2px' }}>
              {condition === 'tennis' ? 'Tennis elbow' : "Golfer's elbow"}
            </span>
          </div>
          <button
            onClick={onExit}
            aria-label="Exit session"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: `${visual.fg}18`,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <line x1="2" y1="2" x2="14" y2="14" stroke={visual.fg} strokeWidth="2.5" strokeLinecap="round" />
              <line x1="14" y1="2" x2="2" y2="14" stroke={visual.fg} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Set progress */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px 16px', flexShrink: 0 }}>
          <SetProgress currentSet={state.currentSet} fg={visual.fg} />
        </div>

        {/* Phase label */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '8px', flexShrink: 0 }}>
          {state.internalPhase !== 'REST' && (
            <>
              <motion.span
                key={accel.accelPhase}
                initial={{ opacity: 0.4, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12 }}
                style={{
                  color: visual.fg,
                  fontFamily: FONT,
                  fontSize: '36px',
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  lineHeight: 1,
                }}
              >
                {visual.label}
              </motion.span>
              <span style={{ color: `${visual.fg}80`, fontFamily: FONT, fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '6px' }}>
                {visual.sub}
              </span>
            </>
          )}
        </div>

        {/* Gauge (or rest timer) — flex-1 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {state.internalPhase === 'REST' ? (
            <RestTimer
              secondsLeft={state.restSecondsLeft}
              onSkip={() => dispatch({ type: 'SKIP_REST' })}
              fg={visual.fg}
            />
          ) : (
            <>
              {!accel.isManualMode ? (
                <ArcGauge
                  angle={accel.angle}
                  ghostAngle={ghostAngle}
                  condition={condition}
                  fg={visual.fg}
                  active={accel.accelPhase !== 'NEUTRAL'}
                />
              ) : (
                <button
                  onClick={handleRep}
                  style={{
                    height: '180px',
                    width: '260px',
                    borderRadius: '24px',
                    backgroundColor: `${visual.fg}1A`,
                    color: visual.fg,
                    border: `2px solid ${visual.fg}40`,
                    fontFamily: FONT,
                    fontSize: '22px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Tap to count rep
                </button>
              )}
            </>
          )}
        </div>

        {/* Rep counter */}
        <div style={{ height: '80px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {state.internalPhase !== 'REST' && (
            <AnimatePresence mode="popLayout">
              <motion.span
                key={state.currentRep}
                initial={{ y: -12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 12, opacity: 0 }}
                transition={{ duration: 0.14 }}
                style={{
                  fontSize: 'clamp(2rem, 9vw, 3.25rem)',
                  fontWeight: 700,
                  color: visual.fg,
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: FONT,
                }}
              >
                Rep {state.currentRep} / {REPS_PER_SET}
              </motion.span>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Rep flash overlay */}
      <AnimatePresence>
        {state.repPulse > 0 && (
          <motion.div
            key={state.repPulse}
            style={{ position: 'absolute', inset: 0, backgroundColor: '#FFFFFF', pointerEvents: 'none' }}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
