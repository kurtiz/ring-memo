# RingMemo

Android-first cellular call recorder research project. This standalone Expo SDK 57 workspace has its own app ID, auth scaffold, and update configuration.

## Start

```sh
pnpm install
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm start
```

Run `pnpm lint`, `pnpm typecheck`, and `pnpm check:expo`. Use an Android development build for native recording work: `pnpm android` with a local Android SDK, or `cd apps/mobile && pnpm dlx eas-cli build --profile development --platform android` after linking a **new** EAS project.

## Recording scope

The app currently does **not** record calls. Android restricts direct cellular uplink/downlink capture to privileged system apps. A real device feasibility test must determine any supported recording path before adding capture controls or promising automatic recording. Do not use Accessibility services to obtain remote call audio. Test with consent and a persistent visible recording indicator.

## Optional services

The app runs locally without an account or update service. To activate auth, create a new Cloudflare D1 database, copy `apps/worker/wrangler.example.jsonc` to `apps/worker/wrangler.jsonc`, set its new database ID and a unique `BETTER_AUTH_SECRET`, apply `apps/worker/migrations/0001_auth.sql`, and deploy the Worker. Then set `EXPO_PUBLIC_API_URL` to its HTTPS origin. Auth routes are scaffolded but no account UI is connected yet.

For Hot Updater, create new D1/R2 resources and credentials, copy `apps/mobile/.env.hotupdater.example` to `.env.hotupdater`, then set the public `EXPO_PUBLIC_HOT_UPDATER_URL` for the new service. Native changes require a fresh build.
