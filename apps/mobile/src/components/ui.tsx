import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = { background: '#10171A', surface: '#1B262A', ink: '#F6F8F7', muted: '#A9B8B8', accent: '#78D9C2', danger: '#FFAAA0' };

export function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18, paddingBottom: 48 }}>{children}</ScrollView>
  </SafeAreaView>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={{ color: colors.ink, fontSize: 32, fontWeight: '700', letterSpacing: -0.8 }}>{children}</Text>;
}

export function Body({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return <Text style={{ color: accent ? colors.accent : colors.muted, fontSize: 15, lineHeight: 23 }}>{children}</Text>;
}

export function Panel({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: colors.surface, padding: 20, borderRadius: 18, gap: 12 }}>{children}</View>;
}

export function Action({ label, onPress, disabled = false, secondary = false, danger = false }: {
  label: string; onPress: () => void | Promise<unknown>; disabled?: boolean; secondary?: boolean; danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const inactive = disabled || busy;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: inactive, busy }} disabled={inactive}
    onPress={async () => {
      setBusy(true);
      try { await onPress(); }
      catch (error) { Alert.alert('RingMemo', error instanceof Error ? error.message : 'The action could not be completed.'); }
      finally { setBusy(false); }
    }} style={({ pressed }) => ({ minHeight: 48, padding: 14, borderRadius: 12, borderWidth: 1,
      borderColor: danger ? colors.danger : colors.accent, backgroundColor: secondary || danger ? 'transparent' : colors.accent,
      opacity: inactive ? 0.35 : pressed ? 0.7 : 1, justifyContent: 'center' })}>
    <Text style={{ textAlign: 'center', fontSize: 15, fontWeight: '600', color: danger ? colors.danger : secondary ? colors.accent : colors.background }}>{busy ? 'Working…' : label}</Text>
  </Pressable>;
}

export function Field({ label, value, onChangeText, multiline = false }: {
  label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean;
}) {
  return <View style={{ gap: 8 }}><Body>{label}</Body><TextInput accessibilityLabel={label} placeholder={label}
    placeholderTextColor={colors.muted} value={value} onChangeText={onChangeText} multiline={multiline}
    style={{ color: colors.ink, backgroundColor: colors.surface, borderRadius: 12, padding: 14, minHeight: multiline ? 110 : 48, textAlignVertical: multiline ? 'top' : 'center' }} /></View>;
}
