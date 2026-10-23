// A bottom sheet with a title, lines and buttons (Count now, Resign, Pass explainer, dead-stone
// dispute, Leave — spec docs/specs/M6-bot-levels.md AC 19, 21, 22, 24, 29; Settings → Erase
// progress, M6-settings AC 20–22). Same look as the practice LeaveSheet.
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { color, radius, spacing, typography } from './tokens';

export interface SheetAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
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
        {/* The tap-outside area is not a screen-reader stop (the sheet has its own buttons). Not
            the `accessible` false prop: react-native-web would pass it to the DOM (AC 43). */}
        <Pressable
          style={styles.dismiss}
          onPress={onDismiss}
          testID={`${testID}-dismiss`}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          testID={testID}
          accessibilityViewIsModal
        >
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={2}>
            {title}
          </Text>
          {/* Lines scroll when the text is large (AC 42: sheets follow the phone up to 200 %). */}
          <ScrollView style={styles.lines} contentContainerStyle={styles.linesContent}>
            {lines.map((line, i) => (
              <Text key={i} style={styles.body} maxFontSizeMultiplier={2}>
                {line}
              </Text>
            ))}
          </ScrollView>
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
    maxHeight: '90%',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
  },
  title: { ...typography.title, color: color.textPrimary },
  lines: { flexGrow: 0, flexShrink: 1 },
  linesContent: { gap: spacing.md },
  body: { ...typography.body, color: color.textSecondary },
});
