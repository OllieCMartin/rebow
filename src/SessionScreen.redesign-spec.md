# SessionScreen redesign spec

> **Locked direction:** D-style boldness + Clinic palette + upper-quadrant pendulum geometry.
> Approved 2026-05-17. The accelerometer math and prop contract on `SessionScreen` stay; only the rendering changes.

## Tokens

Imported from `App.tsx` — keep these in sync.

```
CREAM   #F4EFE0   background
LINE    #E2DCC9   gauge track
INK     #13181C   pivot dot, primary text
BRAND   #1C7AAF   Mondah blue — DO NOT use on the rep page (wordmark only)
BLUE    #0F4E72   gauge progress fill (the pacer wedge)
ACCENT  #5C8C6C   needle + needle tip (the real wrist)
WARN    #B2533A   needle tint when |real − pacer| > 0.18
MUTE    #6F7780   secondary text
```

## Geometry (390 × 760 portrait, scale to viewport)

```
PIVOT_INSET   44      // distance from the side wall to the pivot
PIVOT_Y       480     // y of the pivot — well above the rep counter
GAUGE_R       280
GAUGE_STROKE  48      // round caps
```

| State                     | cx                    | sweep              |
| ------------------------- | --------------------- | ------------------ |
| Right-hand, Tennis        | `PIVOT_INSET`         | −90° → 0°  (CW)    |
| Left-hand **OR** Golfer's | `390 − PIVOT_INSET`   | −90° → 180° (CCW)  |

The 12 o'clock end of the arc = wrist fully extended (start of eccentric).
The 3 o'clock (or 9 o'clock) end = neutral (end of eccentric).

## Layout

| y range   | element                                                                |
| --------- | ---------------------------------------------------------------------- |
| 60–104    | Top bar: ✕ close · set-indicator bars + "SET N" · spacer               |
| 200–504   | Gauge bounding box (track / fill / needle / pivot)                     |
| 552–648   | Rep counter — "n" 96pt INK + "/15" 24pt MUTE, baseline-aligned, centered |
| 666–696   | Pace bar — 6px LINE track, ACCENT fill, "LOWER · n.ns" / "5.0s" caption |

## Elements

1. **Track**: full quarter-arc, stroke = `GAUGE_STROKE`, color = `LINE`.
2. **Progress fill**: same arc, drawn from start to pacer angle, color = `BLUE`. This is the eye-target — when the needle tip is at the leading edge of the fill, the user is on pace.
3. **Tick marks**: at 25/50/75% along the arc. 2px round-cap `INK` lines extending ±(stroke/2 + 4) from the arc. Opacity 0.2 while un-filled, 0 once the pacer fill passes them.
4. **Needle**: line from pivot to the real-wrist angle endpoint. Stroke 8, color `ACCENT` (or `WARN` if drift > 0.18).
5. **Needle tip**: outer disc r=18 in `ACCENT`/`WARN`, inner disc r=8 in `CREAM` for a focusable bullseye.
6. **Pivot dot**: r=7, `INK`.

## State transitions

- **Mid-rep**: phase clock 0..1 over `paceMs`. Compute pacer angle from phase; real angle from accelerometer (existing math).
- **Rep complete** (~600ms hold): fade entire gauge to `opacity: 0.25`. Center the screen with a 3-line stack:
  - kicker "REP COMPLETE" 14pt 700 letter-spacing 0.2em, color `ACCENT`
  - rep numeral, 280pt 900 weight, color `INK`
  - caption "of 15 · reset and lift" 16pt 700, color `MUTE`
- **Set complete → rest**: see Rest screen below.

## Rest screen (between sets)

- Same top bar; set indicator shows the *next* set as active (so "SET 2" if you just finished set 1).
- Centered circular countdown: 200×200 ring, 14px stroke, sweep clockwise; `LINE` track + `ACCENT` fill. Inner numeral `m:ss` at 70pt 900 `INK`.
- Below: "Set N of 3 starts soon" 18pt 700 `INK`, "15 reps · Xs lower" 13pt `MUTE`.
- Primary CTA at bottom: **"Skip rest · start now"** — interaction `BLUE`, 60px tall, white text.

## What does NOT change

- The accelerometer math and Z-axis mapping.
- `condition`, `hand`, `paceMs`, `onComplete`, `onExit` prop contract.
- The CCW (tennis) / CW (golfer's) direction convention — only the visual mapping of "extended → neutral" flips.

## Off-pace tinting (optional)

If `Math.abs(realPhase - pacerPhase) > 0.18`:
- Needle stroke + tip color = `WARN` (`#B2533A`) instead of `ACCENT`.
- No text alert. The color shift alone is the feedback.

Reset to `ACCENT` immediately when back within tolerance.

## Mounting hint

When `paceMs` changes mid-protocol or before the first rep of a new set, briefly animate the pacer from 0→1 over 600ms with the needle dimmed so the user can see the pacer's full sweep once before starting. Optional polish — not required for v1.
