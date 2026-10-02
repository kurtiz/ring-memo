import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { authAvailable } from "../data/auth-client";

export default function Settings() {
  return <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24, paddingTop: 72 }}>
    <Link href="/" className="text-accent text-base">Back</Link>
    <Text className="mt-8 text-ink text-3xl font-bold">Settings</Text>
    <View className="mt-8 rounded-3xl bg-surface p-6"><Text className="text-ink text-lg font-semibold">Account</Text><Text className="mt-2 text-muted">{authAvailable ? "Private auth endpoint configured" : "Local mode · no account required"}</Text></View>
    <View className="mt-4 rounded-3xl bg-surface p-6"><Text className="text-ink text-lg font-semibold">Updates</Text><Text className="mt-2 text-muted">{process.env.EXPO_PUBLIC_HOT_UPDATER_URL ? "Independent update endpoint configured" : "Bundled app updates only"}</Text></View>
  </ScrollView>;
}
