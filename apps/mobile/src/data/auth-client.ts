import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

const origin = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
export const authAvailable = Boolean(origin);
export const authClient = createAuthClient({
  baseURL: origin || "https://ringmemo.invalid",
  plugins: [expoClient({ scheme: "ringmemo", storagePrefix: "ringmemo", storage: SecureStore })],
});
