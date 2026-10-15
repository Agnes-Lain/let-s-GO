import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, radius, spacing, tapTarget, typography } from './tokens';

type PlaceholderBodyProps = {
  title: string;
  /** Route id shown as a caption (e.g. `u01-board`). */
  id?: string;
  body?: string;
  /** Optional primary button under the text. */
  action?: { label: string; onPress: () => void };
};

/** Centered "coming soon" content shared by the lesson, practice and not-found screens. */
export function PlaceholderBody({ title, id, body, action }: PlaceholderBodyProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {id ? <Text style={styles.id}>{id}</Text> : null}
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 120 },
  title: { ...typography.title, color: color.textPrimary, textAlign: 'center' },
  id: { ...typography.caption, color: color.textSecondary, marginTop: spacing.xs },
  body: {
    ...typography.body,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  button: {
    marginTop: spacing.xl,
    minHeight: tapTarget.min,
    minWidth: tapTarget.min,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { ...typography.label, color: color.onAccent },
  pressed: { opacity: 0.7 },
});
