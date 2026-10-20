// Home learning path (spec §6.1): Continue card, unit nodes on a vertical path, snackbar.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  SAMPLE_UNIT,
  getUnits,
  mapRows,
  nextNode,
  nodeTitleKey,
  type MapNode,
  type MapRow,
} from '@/lessons';
import { useProgress } from '@/store';
import { ChevronIcon, LockIcon, PlayIcon, StarIcon } from '@/theme/icons';
import { color, radius, spacing, stone, typography } from '@/theme/tokens';

/** How long the "locked" snackbar stays (ms). */
export const SNACKBAR_MS = 2500;
const CARD_HEIGHT = 72;
const DOT = 44;
const SMALL_DOT = 28;

type T = ReturnType<typeof useTranslation>['t'];

/** Caption of a node: "Unit 2", "Checkpoint" or "Sample (developer)". */
function captionOf(row: Pick<MapRow, 'kind' | 'unit'>, t: T): string {
  if (row.kind === 'checkpoint') return t('home.checkpoint.label');
  if (row.unit === SAMPLE_UNIT) return t('home.sample.label');
  return t('home.unit.label', { n: row.unit });
}

/** Map data for the home screen: rows, the *Continue* target and whether storage is read. */
export function useHomeMap() {
  const hydrated = useProgress((s) => s.hydrated);
  const lessons = useProgress((s) => s.lessons);
  const units = useMemo(() => getUnits(), []);
  return useMemo(() => {
    const next = nextNode(units, lessons);
    return {
      hydrated,
      rows: mapRows(units, lessons),
      next,
      /** The Continue card's title: the unit title, or a later lesson's / checkpoint's own. */
      nextTitleKey: next ? nodeTitleKey(units, next) : null,
      started: Object.keys(lessons).length > 0,
      hasContent: units.some((u) => u.lesson !== null),
    };
  }, [hydrated, units, lessons]);
}

export function ContinueCard({
  node,
  titleKey,
  started,
  onPress,
}: {
  node: MapNode;
  /** Default: the unit title for a lesson, the checkpoint's title for a checkpoint. */
  titleKey?: string | null;
  started: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const label = started ? t('home.continue') : t('home.start');
  const caption =
    node.kind === 'lesson' && node.unit === SAMPLE_UNIT
      ? captionOf({ kind: 'unit', unit: node.unit }, t)
      : `${captionOf({ kind: node.kind === 'lesson' ? 'unit' : 'checkpoint', unit: node.unit }, t)} · ${t(
          titleKey ?? (node.kind === 'lesson' ? `unit.${node.unit}.title` : node.lesson.titleKey),
        )}`;
  return (
    <Pressable
      testID="home-continue"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${caption}`}
      style={({ pressed }) => [styles.continue, pressed && styles.pressed]}
    >
      <PlayIcon color={color.onAccent} size={22} />
      <View style={styles.continueBody}>
        <Text style={styles.continueLabel}>{label}</Text>
        <Text style={styles.continueCaption} numberOfLines={1}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

function Stars({ stars }: { stars: number }) {
  return (
    <View style={styles.stars}>
      {[0, 1, 2].map((i) => (
        <StarIcon
          key={i}
          size={16}
          color={i < stars ? color.hint : color.border}
          filled={i < stars}
        />
      ))}
    </View>
  );
}

function NodeDot({ row }: { row: MapRow }) {
  const size = row.kind === 'checkpoint' ? SMALL_DOT : DOT;
  const base = { width: size, height: size, borderRadius: size / 2 };
  const style =
    row.state === 'done'
      ? styles.dotDone
      : row.state === 'available'
        ? styles.dotAvailable
        : styles.dotLocked;
  return (
    <View style={styles.dotColumn}>
      <View style={[base, style]} testID={`home-dot-${row.state}`} />
    </View>
  );
}

function NodeCard({
  row,
  onOpen,
  onLocked,
}: {
  row: MapRow;
  onOpen: (lessonId: string) => void;
  onLocked: () => void;
}) {
  const { t } = useTranslation();
  const caption = captionOf(row, t);
  const title = t(row.titleKey);
  const a11y = t(`home.node.a11y.${row.state}`, { label: caption, title, stars: row.stars });
  const dimmed = row.state === 'locked' || row.state === 'soon';
  const body = (
    <>
      <View style={styles.cardBody}>
        <Text style={[styles.caption, dimmed && styles.dimText]} numberOfLines={1}>
          {caption}
        </Text>
        <Text style={[styles.title, dimmed && styles.dimText]} numberOfLines={2}>
          {title}
        </Text>
        {row.state === 'done' ? <Stars stars={row.stars} /> : null}
        {row.state === 'soon' ? (
          // M4 decision 1: the badge sits on its own line under the title (long fr/zh titles).
          <View style={styles.badge} testID={`home-badge-${row.key}`}>
            <Text style={styles.badgeLabel}>{t('home.unit.comingSoon')}</Text>
          </View>
        ) : null}
      </View>
      {row.state === 'soon' ? null : row.state === 'locked' ? (
        <LockIcon color={color.hint} size={20} />
      ) : (
        <ChevronIcon color={color.textSecondary} size={22} />
      )}
    </>
  );

  return (
    <View style={[styles.row, row.kind === 'checkpoint' && styles.checkpointRow]}>
      <NodeDot row={row} />
      {row.state === 'soon' ? (
        <View
          style={[styles.card, styles.cardSoon]}
          testID={`home-node-${row.key}`}
          accessible
          accessibilityLabel={a11y}
        >
          {body}
        </View>
      ) : (
        <Pressable
          testID={`home-node-${row.key}`}
          onPress={() => {
            if (row.state === 'locked') onLocked();
            else if (row.lesson) onOpen(row.lesson.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={a11y}
          style={({ pressed }) => [
            styles.card,
            row.state === 'locked' && styles.cardLocked,
            pressed && styles.pressed,
          ]}
        >
          {body}
        </Pressable>
      )}
    </View>
  );
}

function SkeletonRow({ row }: { row: MapRow }) {
  return (
    <View style={[styles.row, row.kind === 'checkpoint' && styles.checkpointRow]}>
      <View style={styles.dotColumn}>
        <View
          style={[
            styles.skeletonDot,
            row.kind === 'checkpoint' && { width: SMALL_DOT, height: SMALL_DOT },
          ]}
        />
      </View>
      <View style={[styles.card, styles.skeleton]} testID="home-skeleton" />
    </View>
  );
}

/** The vertical path of unit nodes (skeleton bars until progress is read). */
export function UnitPath({
  rows,
  hydrated,
  onOpen,
  onLocked,
}: {
  rows: readonly MapRow[];
  hydrated: boolean;
  onOpen: (lessonId: string) => void;
  onLocked: () => void;
}) {
  return (
    <View style={styles.path}>
      <View style={styles.line} />
      {rows.map((row) =>
        hydrated ? (
          <NodeCard key={row.key} row={row} onOpen={onOpen} onLocked={onLocked} />
        ) : (
          <SkeletonRow key={row.key} row={row} />
        ),
      )}
    </View>
  );
}

/** `show()` opens the "finish the previous unit" snackbar for ~2.5 s and announces it. */
export function useLockedSnackbar() {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (count === 0) return;
    const timer = setTimeout(() => setCount(0), SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, [count]);
  return {
    visible: count > 0,
    show: () => {
      setCount((n) => n + 1);
      AccessibilityInfo.announceForAccessibility(t('home.locked.hint'));
    },
  };
}

/** Dark bar at the bottom of the screen. */
export function LockedSnackbar({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <View style={styles.snackbar} testID="home-snackbar" accessibilityLiveRegion="polite">
      <Text style={styles.snackbarText}>{t('home.locked.hint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  continue: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: color.accent,
  },
  continueBody: { flex: 1 },
  continueLabel: { ...typography.label, fontSize: 17, color: color.onAccent },
  continueCaption: { ...typography.caption, color: color.onAccent, marginTop: 2 },
  path: { gap: spacing.sm },
  line: {
    position: 'absolute',
    left: DOT / 2 - 1,
    top: CARD_HEIGHT / 2,
    bottom: CARD_HEIGHT / 2,
    width: 2,
    backgroundColor: color.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  checkpointRow: { paddingLeft: spacing.lg },
  dotColumn: { width: DOT, alignItems: 'center' },
  dotDone: { backgroundColor: stone.black },
  dotAvailable: { backgroundColor: stone.white, borderWidth: 2, borderColor: color.accent },
  dotLocked: {
    backgroundColor: color.background,
    borderWidth: 1,
    borderColor: color.border,
  },
  card: {
    flex: 1,
    // Grows for a two-line title or the "coming soon" badge line (M4 §5).
    minHeight: CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
  },
  cardLocked: { opacity: 0.5 },
  cardSoon: { opacity: 0.75 },
  cardBody: { flex: 1, justifyContent: 'center' },
  caption: { ...typography.caption, color: color.textSecondary },
  title: { ...typography.label, color: color.textPrimary },
  dimText: { color: color.textSecondary },
  stars: { flexDirection: 'row', gap: 2, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: color.badge,
  },
  badgeLabel: { ...typography.caption, color: color.onBadge },
  // Skeleton bars keep the fixed M3 height (M3 AC 105); real cards only set minHeight.
  skeleton: { height: CARD_HEIGHT, backgroundColor: color.border, opacity: 0.35, borderWidth: 0 },
  skeletonDot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: color.border,
    opacity: 0.35,
  },
  snackbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: color.textPrimary,
  },
  snackbarText: { ...typography.body, color: color.surface },
});
