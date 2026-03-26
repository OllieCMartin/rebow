import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Vibration,
  Platform,
} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import ArcGauge from '../components/ArcGauge';
import OptionPicker from '../components/OptionPicker';
import PainSlider from '../components/PainSlider';
import { addSession, loadSettings, saveSettings } from '../storage/localStorage';
import { COLORS, SHADOWS, DEFAULTS, MASS_OPTIONS, LENGTH_OPTIONS } from '../constants/theme';

// ─── helpers ──────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Map accelerometer data → tilt angle (0-90°) */
function accelToAngle(data) {
  if (!data) return 0;
  // Use the z-axis: when device is flat z≈1, when vertical z≈0
  // and x/y shift. We use pitch from gravity vector.
  const { x, y, z } = data;
  const pitch = Math.atan2(x, Math.sqrt(y * y + z * z)) * (180 / Math.PI);
  return clamp(Math.abs(pitch), 0, 90);
}

// ─── phases ───────────────────────────────────────────────
const PHASE = {
  CONFIG: 'config',     // picking options
  READY: 'ready',       // countdown
  ACTIVE: 'active',     // doing reps
  REST: 'rest',         // between sets
  DONE: 'done',         // finished, ask pain
};

export default function ExerciseScreen() {
  // ── config state ────────────────────────────────────────
  const [side, setSide] = useState('L');
  const [sport, setSport] = useState('tennis');
  const [mass, setMass] = useState(1.5);
  const [length, setLength] = useState(30);
  const [pacerDuration, setPacerDuration] = useState(DEFAULTS.pacerDuration);
  const [targetSets, setTargetSets] = useState(DEFAULTS.sets);
  const [targetReps, setTargetReps] = useState(DEFAULTS.reps);

  // ── exercise state ──────────────────────────────────────
  const [phase, setPhase] = useState(PHASE.CONFIG);
  const [currentSet, setCurrentSet] = useState(1);
  const [currentRep, setCurrentRep] = useState(0);
  const [ghostAngle, setGhostAngle] = useState(0);
  const [liveAngle, setLiveAngle] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [pain, setPain] = useState(0);
  const [notes, setNotes] = useState('');

  // ── refs ────────────────────────────────────────────────
  const accelSub = useRef(null);
  const timerRef = useRef(null);
  const ghostRef = useRef(null);
  const ghostDirection = useRef(1); // 1 = ascending, -1 = descending

  // ── load persisted settings ─────────────────────────────
  useEffect(() => {
    (async () => {
      const saved = await loadSettings();
      if (saved) {
        setSide(saved.side ?? 'L');
        setSport(saved.sport ?? 'tennis');
        setMass(saved.mass ?? 1.5);
        setLength(saved.length ?? 30);
        setPacerDuration(saved.pacerDuration ?? DEFAULTS.pacerDuration);
        setTargetSets(saved.targetSets ?? DEFAULTS.sets);
        setTargetReps(saved.targetReps ?? DEFAULTS.reps);
      }
    })();
  }, []);

  // ── persist settings on change ──────────────────────────
  useEffect(() => {
    saveSettings({ side, sport, mass, length, pacerDuration, targetSets, targetReps });
  }, [side, sport, mass, length, pacerDuration, targetSets, targetReps]);

  // ── accelerometer setup ─────────────────────────────────
  const startAccel = useCallback(() => {
    Accelerometer.setUpdateInterval(50); // 20 Hz
    accelSub.current = Accelerometer.addListener((data) => {
      setLiveAngle(accelToAngle(data));
    });
  }, []);

  const stopAccel = useCallback(() => {
    accelSub.current?.remove();
    accelSub.current = null;
  }, []);

  // ── ghost pacer logic ───────────────────────────────────
  const startGhostPacer = useCallback(() => {
    const stepMs = 50;
    const totalSteps = (pacerDuration * 1000) / stepMs;
    const degreePerStep = 90 / totalSteps;
    let angle = 0;
    let dir = 1;

    ghostRef.current = setInterval(() => {
      angle += degreePerStep * dir;

      if (angle >= 90) {
        angle = 90;
        dir = -1;
      } else if (angle <= 0) {
        angle = 0;
        dir = 1;
        // One full rep completed (out and back)
        setCurrentRep((prev) => {
          const next = prev + 1;
          if (Platform.OS !== 'web') Vibration.vibrate(40);
          return next;
        });
      }

      setGhostAngle(angle);
    }, stepMs);
  }, [pacerDuration]);

  const stopGhostPacer = useCallback(() => {
    if (ghostRef.current) clearInterval(ghostRef.current);
    ghostRef.current = null;
  }, []);

  // ── watch rep count to advance sets ─────────────────────
  useEffect(() => {
    if (phase !== PHASE.ACTIVE) return;
    if (currentRep >= targetReps) {
      stopGhostPacer();
      stopAccel();
      if (currentSet >= targetSets) {
        setPhase(PHASE.DONE);
      } else {
        setPhase(PHASE.REST);
      }
    }
  }, [currentRep, phase]);

  // ── countdown timer for READY phase ─────────────────────
  useEffect(() => {
    if (phase === PHASE.READY) {
      setCountdown(3);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setPhase(PHASE.ACTIVE);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // ── start active exercise when phase goes ACTIVE ────────
  useEffect(() => {
    if (phase === PHASE.ACTIVE) {
      setCurrentRep(0);
      setGhostAngle(0);
      startAccel();
      startGhostPacer();
    }
  }, [phase]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopAccel();
      stopGhostPacer();
    };
  }, []);

  // ── handlers ────────────────────────────────────────────
  const handleStart = () => {
    setCurrentSet(1);
    setCurrentRep(0);
    setPhase(PHASE.READY);
  };

  const handleNextSet = () => {
    setCurrentSet((s) => s + 1);
    setPhase(PHASE.READY);
  };

  const handleFinish = async () => {
    const session = {
      date: new Date().toISOString(),
      side,
      sport,
      mass,
      length,
      sets: currentSet,
      reps: targetReps,
      pacerDuration,
      pain,
      notes,
    };
    await addSession(session);
    Alert.alert('Session saved', 'Check the Logbook tab for your history.');
    // Reset
    setPhase(PHASE.CONFIG);
    setCurrentSet(1);
    setCurrentRep(0);
    setPain(0);
    setNotes('');
  };

  const handleStop = () => {
    stopGhostPacer();
    stopAccel();
    setPhase(PHASE.CONFIG);
    setGhostAngle(0);
    setLiveAngle(0);
  };

  // ── computed ────────────────────────────────────────────
  const targetSpeedLabel = `${Math.round(90 / pacerDuration)}°/s`;

  // ── render ──────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Rebow</Text>
        <Text style={styles.subtitle}>Elbow Rehab Trainer</Text>
      </View>

      {/* ═══ CONFIG PHASE ═══ */}
      {phase === PHASE.CONFIG && (
        <>
          <OptionPicker
            label="Side"
            options={[
              { label: 'Left', value: 'L' },
              { label: 'Right', value: 'R' },
            ]}
            selected={side}
            onSelect={setSide}
          />

          <OptionPicker
            label="Sport"
            options={[
              { label: '🎾 Tennis', value: 'tennis' },
              { label: '⛳ Golf', value: 'golf' },
            ]}
            selected={sport}
            onSelect={setSport}
          />

          <OptionPicker
            label="Mass (kg)"
            options={MASS_OPTIONS.map((m) => ({ label: `${m} kg`, value: m }))}
            selected={mass}
            onSelect={setMass}
          />

          <OptionPicker
            label="Bar length (cm)"
            options={LENGTH_OPTIONS.map((l) => ({ label: `${l} cm`, value: l }))}
            selected={length}
            onSelect={setLength}
          />

          <OptionPicker
            label="Rep pace (seconds)"
            options={[6, 8, 10, 12, 15].map((s) => ({
              label: `${s}s`,
              value: s,
            }))}
            selected={pacerDuration}
            onSelect={setPacerDuration}
          />

          <View style={styles.repsRow}>
            <OptionPicker
              label="Sets"
              options={[1, 2, 3, 4, 5].map((s) => ({ label: `${s}`, value: s }))}
              selected={targetSets}
              onSelect={setTargetSets}
            />
            <OptionPicker
              label="Reps"
              options={[5, 8, 10, 12, 15].map((r) => ({ label: `${r}`, value: r }))}
              selected={targetReps}
              onSelect={setTargetReps}
            />
          </View>
        </>
      )}

      {/* ═══ GAUGE ═══ */}
      <View style={styles.gaugeContainer}>
        <ArcGauge
          ghostAngle={ghostAngle}
          liveAngle={liveAngle}
          targetSpeed={targetSpeedLabel}
          running={phase === PHASE.ACTIVE}
          size={280}
        />
      </View>

      {/* ═══ COUNTDOWN ═══ */}
      {phase === PHASE.READY && (
        <View style={styles.overlay}>
          <Text style={styles.countdownText}>{countdown}</Text>
          <Text style={styles.countdownLabel}>Get ready...</Text>
        </View>
      )}

      {/* ═══ ACTIVE ═══ */}
      {phase === PHASE.ACTIVE && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{currentRep}</Text>
            <Text style={styles.statLabel}>Rep</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {currentSet}/{targetSets}
            </Text>
            <Text style={styles.statLabel}>Set</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{mass}kg</Text>
            <Text style={styles.statLabel}>Mass</Text>
          </View>
        </View>
      )}

      {/* ═══ REST BETWEEN SETS ═══ */}
      {phase === PHASE.REST && (
        <View style={styles.restContainer}>
          <Text style={styles.restTitle}>Set {currentSet} complete!</Text>
          <Text style={styles.restSubtitle}>
            Rest, then tap below for set {currentSet + 1}
          </Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleNextSet}>
            <Text style={styles.btnPrimaryText}>Start Next Set</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ═══ DONE – PAIN & SAVE ═══ */}
      {phase === PHASE.DONE && (
        <View style={styles.doneContainer}>
          <Text style={styles.doneTitle}>Session complete!</Text>
          <Text style={styles.doneSummary}>
            {targetSets} × {targetReps} reps · {mass}kg · {side === 'L' ? 'Left' : 'Right'} · {sport}
          </Text>

          <PainSlider value={pain} onChange={setPain} />

          <TouchableOpacity style={styles.btnPrimary} onPress={handleFinish}>
            <Text style={styles.btnPrimaryText}>Save to Logbook</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ═══ ACTION BUTTONS ═══ */}
      {phase === PHASE.CONFIG && (
        <TouchableOpacity style={styles.btnPrimary} onPress={handleStart}>
          <Text style={styles.btnPrimaryText}>Start Exercise</Text>
        </TouchableOpacity>
      )}

      {(phase === PHASE.ACTIVE || phase === PHASE.READY) && (
        <TouchableOpacity style={styles.btnDanger} onPress={handleStop}>
          <Text style={styles.btnDangerText}>Stop</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ─── styles ───────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 2,
  },
  repsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  gaugeContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  overlay: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  countdownText: {
    fontSize: 72,
    fontWeight: '900',
    color: COLORS.primary,
  },
  countdownLabel: {
    fontSize: 18,
    color: COLORS.textLight,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    ...SHADOWS.medium,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  restContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  restTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.success,
  },
  restSubtitle: {
    fontSize: 15,
    color: COLORS.textLight,
    marginTop: 8,
    marginBottom: 20,
  },
  doneContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    ...SHADOWS.medium,
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.success,
    marginBottom: 8,
  },
  doneSummary: {
    fontSize: 15,
    color: COLORS.textLight,
    marginBottom: 16,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
    ...SHADOWS.medium,
  },
  btnPrimaryText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  btnDanger: {
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
    borderColor: COLORS.danger,
  },
  btnDangerText: {
    color: COLORS.danger,
    fontSize: 17,
    fontWeight: '700',
  },
});
