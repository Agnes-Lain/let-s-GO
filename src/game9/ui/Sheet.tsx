// A bottom sheet with a title, lines and buttons (Count now, Resign, Pass explainer, dead-stone
// dispute, Leave — spec docs/specs/M6-bot-levels.md AC 19, 21, 22, 24, 29). Same look as the
// practice LeaveSheet.
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/theme/Button';
import { color, radius, spacing, typography } from '@/theme/tokens';

export interface SheetAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  testID: string;
}

export function Sheet({
  visible,
  title,
  lines = [],
  actions,
  onDismiss,
  onDismissed,
  testID,
}: {
  visible: boolean;
  title: string;
  lines?: readonly string[];
  actions: readonly SheetAction[];
  /** Tap outside or system back. */
  onDismiss: () => void;
  /** Called once the sheet has fully closed. */
  onDismissed?: () => void;
  testID: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      onDismiss={onDismissed}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onDismiss} accessible={false} />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          testID={testID}
          accessibilityViewIsModal
        >
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {lines.map((line, i) => (
            <Text key={i} style={styles.body}>
              {line}
            </Text>
          ))}
          {actions.map((action) => (
            <Button
              key={action.testID}
              label={action.label}
              variant={action.variant ?? 'primary'}
              onPress={action.onPress}
              testID={action.testID}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(38, 41, 43, 0.35)' },
  dismiss: { flex: 1 },
  sheet: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
  },
  title: { ...typography.title, color: color.textPrimary },
  body: { ...typography.body, color: color.textSecondary },
});
