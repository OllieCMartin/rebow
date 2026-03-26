import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadSessions, deleteSession } from '../storage/localStorage';
import { COLORS, SHADOWS } from '../constants/theme';

// ─── helpers ──────────────────────────────────────────────
const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const painColor = (p) => {
  if (p <= 3) return COLORS.painLow;
  if (p <= 6) return COLORS.painMid;
  return COLORS.painHigh;
};

const painEmoji = (p) => {
  if (p === 0) return '😊';
  if (p <= 3) return '🙂';
  if (p <= 6) return '😐';
  if (p <= 8) return '😣';
  return '😫';
};

// ─── session card ─────────────────────────────────────────
function SessionCard({ item, onDelete }) {
  const totalVolume = item.sets * item.reps * item.mass;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{fmtDate(item.date)}</Text>
        <TouchableOpacity onPress={() => onDelete(item.id)}>
          <Text style={styles.deleteBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardBody}>
        {/* Config badges */}
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {item.side === 'L' ? 'Left' : 'Right'}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {item.sport === 'tennis' ? '🎾 Tennis' : '⛳ Golf'}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.mass} kg</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.length} cm</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {item.sets}×{item.reps}
            </Text>
            <Text style={styles.statLabel}>sets × reps</Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalVolume.toFixed(1)}</Text>
            <Text style={styles.statLabel}>kg total</Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statValue}>{item.pacerDuration}s</Text>
            <Text style={styles.statLabel}>pace</Text>
          </View>

          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: painColor(item.pain) }]}>
              {painEmoji(item.pain)} {item.pain}
            </Text>
            <Text style={styles.statLabel}>pain</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── main screen ──────────────────────────────────────────
export default function LogbookScreen() {
  const [sessions, setSessions] = useState([]);

  // Refresh when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadSessions().then(setSessions);
    }, [])
  );

  const handleDelete = (id) => {
    Alert.alert('Delete session?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = await deleteSession(id);
          setSessions(updated);
        },
      },
    ]);
  };

  // ── summary stats ─────────────────────────────────────
  const totalSessions = sessions.length;
  const totalVolume = sessions.reduce(
    (sum, s) => sum + s.sets * s.reps * s.mass,
    0
  );
  const avgPain =
    totalSessions > 0
      ? (sessions.reduce((sum, s) => sum + s.pain, 0) / totalSessions).toFixed(1)
      : '—';

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Logbook</Text>
      </View>

      {/* Summary strip */}
      {totalSessions > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalSessions}</Text>
            <Text style={styles.summaryLabel}>sessions</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalVolume.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>kg moved</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{avgPain}</Text>
            <Text style={styles.summaryLabel}>avg pain</Text>
          </View>
        </View>
      )}

      {/* List */}
      {totalSessions === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No sessions yet</Text>
          <Text style={styles.emptySubtext}>
            Complete an exercise to see your history here
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SessionCard item={item} onDelete={handleDelete} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary,
  },
  summary: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardDate: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  deleteBtn: {
    fontSize: 18,
    color: COLORS.textMuted,
    paddingLeft: 12,
  },
  cardBody: {},
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
  },
});
