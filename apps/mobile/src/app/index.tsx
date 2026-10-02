import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function Home() {
  return <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24, paddingTop: 72, paddingBottom: 40 }}>
    <Text className="text-accent text-sm font-semibold uppercase tracking-widest">RingMemo</Text>
    <Text className="mt-4 text-ink text-4xl font-bold">Keep the conversations that matter.</Text>
    <Text className="mt-4 text-muted text-base leading-6">Your private place for call recordings, once the Android device can capture them reliably.</Text>
    <View className="mt-10 rounded-3xl bg-surface p-6">
      <Text className="text-ink text-xl font-semibold">Recording availability</Text>
      <Text className="mt-3 text-muted text-base leading-6">Cellular call capture depends on the phone and Android privileges. Recording is disabled until a real-device test confirms a supported path.</Text>
    </View>
    <Link href="/settings" asChild><Pressable accessibilityRole="button" className="mt-7 rounded-2xl border border-accent p-4"><Text className="text-center text-accent text-base font-semibold">Project settings</Text></Pressable></Link>
  </ScrollView>;
}
