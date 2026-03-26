import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

/**
 * Simple 0–10 pain scale selector.
 */
export default function PainSlider({ value, onChange }) {
  const painColor = (v) => {
    if (v <= 3) return COLORS.painLow;
    if (v <= 6) return COLORS.painMid;
    return COLORS.painHigh;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Pain level</Text>
      <View style={styles.row}>
        {[...Array(11).keys()].map((i) => (
          <TouchableOpacity
            key={i}
            onPress={() => onChange(i)}
            style={[
              styles.dot,
              {
                backgroundColor: i <= value ? painColor(value) : COLORS.gaugeTrack,
                transform: [{ scale: i === value ? 1.3 : 1 }],
              },
            ]}
          >
            <Text
              style={[
                styles.dotText,
                { color: i <= value ? COLORS.white : COLORS.textMuted },
              ]}
            >
              {i}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.labelRow}>
        <Text style={[styles.endLabel, { color: COLORS.painLow }]}>None</Text>
        <Text style={[styles.endLabel, { color: COLORS.painHigh }]}>Worst</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontSize: 11,
    fontWeight: '700',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  endLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
