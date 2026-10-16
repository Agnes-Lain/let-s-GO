import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/theme/Button';
import { color, radius, spacing, typography } from '@/theme/tokens';

/** "Leave practice?" bottom sheet (spec §6.5). Leaving records nothing. */
export function LeaveSheet({
  visible,
  onStay,
  onLeave,
  onDismissed,
}: {
  visible: boolean;
  onStay: () => void;
  onLeave: () => void;
  /** Called once the sheet has fully closed. */
  onDismissed?: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onStay}
      onDismiss={onDismissed}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onStay} accessible={false} />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          testID="leave-sheet"
          accessibilityViewIsModal
        >
          <Text style={styles.title} accessibilityRole="header">
            {t('practice.leave.title')}
          </Text>
          <Text style={styles.body}>{t('practice.leave.body')}</Text>
          <Button label={t('practice.leave.stay')} onPress={onStay} testID="leave-stay" />
          <Button
            variant="secondary"
            label={t('practice.leave.confirm')}
            onPress={onLeave}
            testID="leave-confirm"
          />
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
