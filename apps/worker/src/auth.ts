import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";

export type Env = { DB: D1Database; BETTER_AUTH_SECRET?: string; BETTER_AUTH_URL?: string };

export function createAuth(env: Env, origin: string) {
  return betterAuth({
    appName: "RingMemo",
    baseURL: env.BETTER_AUTH_URL || origin,
    secret: env.BETTER_AUTH_SECRET!,
    database: env.DB,
    trustedOrigins: ["ringmemo://"],
    emailAndPassword: { enabled: true },
    plugins: [expo()],
  });
}
