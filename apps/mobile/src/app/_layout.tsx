import "../global.css";
import { createDefaultResolver, HotUpdater } from "@hot-updater/react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RecorderProvider } from "../recording/provider";

function RootLayout() {
  return <SafeAreaProvider><RecorderProvider><View className="flex-1 bg-background"><StatusBar style="light" /><Stack screenOptions={{ headerShown: false }} /></View></RecorderProvider></SafeAreaProvider>;
}

const updateUrl = process.env.EXPO_PUBLIC_HOT_UPDATER_URL;
export default updateUrl
  ? HotUpdater.wrap({ resolver: createDefaultResolver(updateUrl), updateStrategy: "appVersion" })(RootLayout)
  : RootLayout;
