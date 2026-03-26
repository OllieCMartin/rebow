import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS } from '../constants/theme';

/**
 * Arc gauge from 0° → 90° rendered as a 180° visual arc.
 *
 * Props:
 *   ghostAngle   – where the ghost pacer is (0–90)
 *   liveAngle    – real-time accelerometer angle (0–90)
 *   targetSpeed  – label string shown in centre
 *   size         – diameter of the gauge (default 260)
 *   running      – bool, whether exercise is active
 */
export default function ArcGauge({
  ghostAngle = 0,
  liveAngle = 0,
  targetSpeed = '',
  size = 260,
  running = false,
}) {
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2 + 10; // slight offset to sit nicely

  // We draw a 180° arc (from 180° to 0° in SVG coords = left to right)
  const startAngleRad = Math.PI; // 180°
  const endAngleRad = 0;        // 0°

  // Convert a 0–90 value to a position on the 180° arc
  const angleToPos = (val) => {
    const clamp = Math.min(90, Math.max(0, val));
    const frac = clamp / 90;
    const angle = Math.PI - frac * Math.PI; // 180° down to 0°
    return {
      x: cx + radius * Math.cos(angle),
      y: cy - radius * Math.sin(angle),
    };
  };

  // Background arc path
  const arcPath = (startA, endA) => {
    const sx = cx + radius * Math.cos(startA);
    const sy = cy - radius * Math.sin(startA);
    const ex = cx + radius * Math.cos(endA);
    const ey = cy - radius * Math.sin(endA);
    return `M ${sx} ${sy} A ${radius} ${radius} 0 0 1 ${ex} ${ey}`;
  };

  const bgPath = arcPath(startAngleRad, endAngleRad);
  const ghostPos = angleToPos(ghostAngle);
  const livePos = angleToPos(liveAngle);

  // Tick marks
  const ticks = [0, 15, 30, 45, 60, 75, 90];

  return (
    <View style={[styles.container, { width: size, height: size / 2 + 50 }]}>
      <Svg width={size} height={size / 2 + 40}>
        {/* Background track */}
        <Path
          d={bgPath}
          stroke={COLORS.gaugeTrack}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />

        {/* Tick labels */}
        {ticks.map((t) => {
          const pos = angleToPos(t);
          const tickInner = {
            x: cx + (radius - stroke / 2 - 12) * Math.cos(Math.PI - (t / 90) * Math.PI),
            y: cy - (radius - stroke / 2 - 12) * Math.sin(Math.PI - (t / 90) * Math.PI),
          };
          return (
            <React.Fragment key={t}>
              <Circle cx={pos.x} cy={pos.y} r={2} fill={COLORS.textMuted} />
            </React.Fragment>
          );
        })}

        {/* Ghost pacer dot (blue) */}
        {running && (
          <Circle
            cx={ghostPos.x}
            cy={ghostPos.y}
            r={14}
            fill={COLORS.ghostPacer}
            opacity={0.7}
          />
        )}

        {/* Live accelerometer dot (red) */}
        {running && (
          <Circle
            cx={livePos.x}
            cy={livePos.y}
            r={10}
            fill={COLORS.liveIndicator}
            opacity={0.9}
          />
        )}

        {/* Static indicator when not running */}
        {!running && (
          <Circle
            cx={angleToPos(0).x}
            cy={angleToPos(0).y}
            r={10}
            fill={COLORS.primaryDark}
          />
        )}
      </Svg>

      {/* Centre label */}
      <View style={styles.centreLabel}>
        <Text style={styles.centreValue}>
          {running ? `${Math.round(liveAngle)}°` : targetSpeed || '0°'}
        </Text>
        <Text style={styles.centreCaption}>
          {running ? 'current' : 'target speed'}
        </Text>
      </View>

      {/* Degree labels */}
      <View style={styles.degreeRow}>
        <Text style={styles.degreeText}>0°</Text>
        <Text style={styles.degreeText}>45°</Text>
        <Text style={styles.degreeText}>90°</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centreLabel: {
    position: 'absolute',
    bottom: 30,
    alignItems: 'center',
  },
  centreValue: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text,
  },
  centreCaption: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  degreeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    marginTop: -8,
  },
  degreeText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
