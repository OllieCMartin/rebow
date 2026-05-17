// src/Help.tsx
// Help screen + reusable Mondah-style line illustrations.
// Illustrations are exported so Onboarding can reuse them without duplication.

import { type ReactNode } from 'react';
import { BLUE, CREAM, INK, MUTE, LINE, WARN, FONT } from './App';

type Condition = 'tennis' | 'golfers';

// ─── Help screen ─────────────────────────────────────────────────────────────

export default function HelpScreen({ onBack }: { onBack: () => void }) {
  return (
    <div style={page}>
      <div style={headerBar}>
        <button onClick={onBack} style={backBtn} aria-label="Back">←</button>
        <div style={{ fontSize: 22, fontWeight: 800, color: INK }}>Help</div>
        <div style={{ width: 36 }} />
      </div>

      <div style={scroller}>
        <Card>
          <Kicker>The protocol</Kicker>
          <Body>
            Alfredson’s heavy-slow eccentric loading: <b>3 sets of 15 reps</b>, twice daily.
            The slow lowering remodels the tendon collagen — pain during reps is expected and not a reason to stop.
          </Body>
        </Card>

        <Card>
          <Kicker>Mount the phone</Kicker>
          <MountIllustration />
          <Body>
            Strap the device to the back of your forearm with the screen facing away from you,
            top of the phone pointing toward your hand. Snug but not painful.
          </Body>
        </Card>

        <Card>
          <Kicker>One rep</Kicker>
          <RepStoryboard />
          <Body>
            Lift the wrist up with your <i>other</i> hand. Then let go: lower the weight under control over
            the configured pace. Reset with the other hand. The arc gauge will show your real angle against a ghost pacer.
          </Body>
        </Card>

        <Card>
          <Kicker>Tennis vs Golfer’s</Kicker>
          <ForearmAnatomy highlight={null} />
          <Body>
            <b>Tennis elbow</b> is <b>external</b> — pain at the lateral epicondyle, the wrist extensors. Lower from <i>extension</i>.<br />
            <b>Golfer’s elbow</b> is <b>internal</b> — medial epicondyle, the wrist flexors. Lower from <i>flexion</i>, palm up.
          </Body>
        </Card>

        <Card>
          <Kicker>Pace</Kicker>
          <PaceMeter />
          <Body>
            Start at <b>3s</b> if new to eccentrics. Build to <b>5–6s</b> for the therapeutic load Alfredson describes.
            Pace is the lowering time, not the round-trip.
          </Body>
        </Card>

        <Card variant="warn">
          <Kicker tone="warn">When to stop</Kicker>
          <Body>
            <b>Discomfort during reps is okay</b> (up to ~5/10) if it settles within 24 hours.<br /><br />
            Stop and see a clinician if you have: sharp shooting pain, swelling, loss of grip strength,
            numbness or tingling, or pain that worsens over a week of consistent loading.
          </Body>
        </Card>

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function Card({ children, variant }: { children: ReactNode; variant?: 'warn' }) {
  return (
    <div style={{
      background: '#FFF',
      border: `1px solid ${variant === 'warn' ? WARN + '55' : LINE}`,
      borderRadius: 14,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {children}
    </div>
  );
}

function Kicker({ children, tone }: { children: ReactNode; tone?: 'warn' }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: tone === 'warn' ? WARN : BLUE,
    }}>
      {children}
    </div>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 14, lineHeight: 1.5, color: INK }}>{children}</div>;
}

// ─── Illustrations (exported for Onboarding reuse) ───────────────────────────

const STROKE = INK;
const STROKE_W = 1.6;

export function MountIllustration() {
  // Forearm horizontal with a phone strapped on the back.
  return (
    <svg viewBox="0 0 300 140" width="100%" style={ilStyle} aria-label="Phone strapped to forearm">
      <g fill="none" stroke={STROKE} strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round">
        {/* upper arm stub */}
        <path d="M10 70 Q 30 50 60 60" />
        <path d="M10 96 Q 30 110 60 100" />
        {/* elbow bumps */}
        <circle cx="62" cy="60" r="3" />
        <circle cx="62" cy="100" r="3" />
        {/* forearm */}
        <path d="M60 60 Q 150 56 230 64" />
        <path d="M60 100 Q 150 104 230 96" />
        {/* wrist */}
        <path d="M230 64 Q 240 80 230 96" />
        {/* hand */}
        <path d="M232 70 Q 270 70 278 80 Q 282 84 280 92 Q 274 100 232 92" />
        {/* phone */}
        <rect x="90" y="48" width="120" height="64" rx="8" fill={CREAM} />
        {/* phone screen */}
        <rect x="98" y="56" width="104" height="48" rx="4" fill="#FFF" />
        <circle cx="150" cy="80" r="10" stroke={BLUE} />
        <path d="M150 80 L 158 74" stroke={BLUE} />
        {/* straps */}
        <rect x="106" y="40" width="14" height="80" rx="4" fill={CREAM} />
        <rect x="180" y="40" width="14" height="80" rx="4" fill={CREAM} />
      </g>
    </svg>
  );
}

export function RepStoryboard() {
  return (
    <svg viewBox="0 0 300 130" width="100%" style={ilStyle} aria-label="Performing one rep">
      {[0, 1, 2].map((i) => {
        const x = 20 + i * 95;
        // wrist angles: lifted up, mid, dropped
        const angle = i === 0 ? -55 : i === 1 ? -10 : 40;
        const labels = ['1 · Lift', '2 · Lower', '3 · Reset'];
        return (
          <g key={i} transform={`translate(${x},0)`} fill="none" stroke={STROKE} strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round">
            {/* forearm */}
            <path d="M0 50 L 50 50" />
            <path d="M0 70 L 50 70" />
            <circle cx="0" cy="60" r="3" />
            {/* wrist pivot */}
            <circle cx="50" cy="60" r="2.5" fill={STROKE} />
            {/* hand at angle */}
            <g transform={`rotate(${angle} 50 60)`}>
              <path d="M50 50 L 78 50 Q 86 50 86 58 L 86 62 Q 86 70 78 70 L 50 70" />
              {/* weight */}
              <rect x="78" y="44" width="10" height="32" rx="2" fill={CREAM} />
            </g>
            <text x="40" y="118" fontFamily={FONT} fontSize="11" fontWeight="600" fill={INK} textAnchor="middle">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function ForearmAnatomy({ highlight }: { highlight: Condition | null }) {
  const lateralActive = highlight === 'tennis';
  const medialActive = highlight === 'golfers';
  return (
    <svg viewBox="0 0 300 200" width="100%" style={ilStyle} aria-label="Forearm with lateral and medial epicondyles labeled">
      <g fill="none" stroke={STROKE} strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round">
        {/* upper arm */}
        <path d="M120 12 Q 100 30 108 70" />
        <path d="M180 12 Q 200 30 192 70" />
        {/* elbow joint band */}
        <path d="M108 70 Q 150 84 192 70" />
        {/* epicondyle bumps */}
        <circle cx="106" cy="74" r="5" fill={medialActive ? BLUE : '#FFF'} stroke={medialActive ? BLUE : STROKE} />
        <circle cx="194" cy="74" r="5" fill={lateralActive ? BLUE : '#FFF'} stroke={lateralActive ? BLUE : STROKE} />
        {/* forearm */}
        <path d="M108 70 Q 116 130 124 184" />
        <path d="M192 70 Q 184 130 176 184" />
        {/* wrist line */}
        <path d="M124 184 Q 150 192 176 184" />
        {/* hand */}
        <path d="M126 186 Q 124 210 132 218" />
        <path d="M174 186 Q 176 210 168 218" />
        <path d="M132 218 Q 150 224 168 218" />
      </g>

      {/* Labels */}
      <g fontFamily={FONT} fontSize="11" fontWeight="600">
        {/* Medial (Golfer's) — inside, left side from viewer */}
        <line x1="100" y1="74" x2="60" y2="60" stroke={medialActive ? BLUE : MUTE} strokeWidth="1" />
        <text x="56" y="56" textAnchor="end" fill={medialActive ? BLUE : INK}>Medial</text>
        <text x="56" y="70" textAnchor="end" fill={MUTE} fontSize="10" fontWeight="500">Golfer’s · Internal</text>

        {/* Lateral (Tennis) — outside, right side */}
        <line x1="200" y1="74" x2="240" y2="60" stroke={lateralActive ? BLUE : MUTE} strokeWidth="1" />
        <text x="244" y="56" fill={lateralActive ? BLUE : INK}>Lateral</text>
        <text x="244" y="70" fill={MUTE} fontSize="10" fontWeight="500">Tennis · External</text>

        {/* Limb labels */}
        <text x="150" y="22" textAnchor="middle" fill={MUTE} fontSize="10" fontWeight="500">Upper arm</text>
        <text x="150" y="140" textAnchor="middle" fill={MUTE} fontSize="10" fontWeight="500">Forearm</text>
      </g>
    </svg>
  );
}

export function PaceMeter() {
  // A horizontal scale 2s → 8s with the 5s sweet-spot highlighted.
  return (
    <svg viewBox="0 0 300 90" width="100%" style={ilStyle} aria-label="Pace scale from 2 to 8 seconds">
      <g fontFamily={FONT}>
        {/* track */}
        <line x1="30" y1="50" x2="270" y2="50" stroke={LINE} strokeWidth="4" strokeLinecap="round" />
        {/* therapeutic zone (4-6s) */}
        <line x1="110" y1="50" x2="190" y2="50" stroke={BLUE} strokeWidth="4" strokeLinecap="round" />
        {/* ticks */}
        {[2, 3, 4, 5, 6, 7, 8].map((s) => {
          const x = 30 + ((s - 2) / 6) * 240;
          return (
            <g key={s}>
              <line x1={x} y1="44" x2={x} y2="56" stroke={INK} strokeWidth="1" />
              <text x={x} y="72" textAnchor="middle" fontSize="11" fontWeight="600" fill={INK}>{s}s</text>
            </g>
          );
        })}
        {/* labels */}
        <text x="60" y="28" textAnchor="middle" fontSize="10" fontWeight="600" fill={MUTE}>Beginner</text>
        <text x="150" y="28" textAnchor="middle" fontSize="10" fontWeight="700" fill={BLUE}>Therapeutic</text>
        <text x="240" y="28" textAnchor="middle" fontSize="10" fontWeight="600" fill={MUTE}>Advanced</text>
      </g>
    </svg>
  );
}

// ─── Local styles ────────────────────────────────────────────────────────────

const page: React.CSSProperties = {
  position: 'fixed', inset: 0, background: CREAM, fontFamily: FONT,
  display: 'flex', flexDirection: 'column',
};

const headerBar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '20px 20px 12px',
  flexShrink: 0,
};

const scroller: React.CSSProperties = {
  flex: 1, overflowY: 'auto',
  padding: '4px 20px 32px',
  display: 'flex', flexDirection: 'column', gap: 14,
};

const backBtn: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 999, border: `1.5px solid ${BLUE}`,
  background: 'transparent', color: BLUE, fontSize: 20, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const ilStyle: React.CSSProperties = {
  display: 'block', background: CREAM, borderRadius: 10, padding: 6,
};
