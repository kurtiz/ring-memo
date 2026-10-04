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

The app includes an experimental Shizuku-backed cellular capture diagnostic, a native call-monitoring service, and an offline recording library. **Capture on the Galaxy A21s / Android 12 remains unproven.** Automatic recording starts disabled and requires five incoming and five outgoing handset tests with both voices confirmed, including background and locked-screen tests, on the current firmware/helper configuration.

Arm one test call from Recording setup, inspect its result in the library, and save an honest intelligibility review. Shizuku/ADB or root does not guarantee VOICE_CALL access. There is no Accessibility capture or microphone-only fallback. Record only with the required consent; armed and recording sessions have visible notifications. Reopen and rearm after a reboot or process interruption.

The library supports playback/seeking, title and note editing, search, deletion, and explicit WAV export. Audio stays in app-private storage, metadata in SQLite, and Android app backup is disabled. No account or cloud service is needed. Uninstalling deletes local recordings.

See [device testing and APK build instructions](docs/device-testing.md) and the [current feasibility report](docs/feasibility-report.md). Run `pnpm test` for recording policy tests in addition to lint/typecheck/Expo Doctor. Native policy tests run through the Android module's Gradle unit-test task.

## Optional services

The app runs locally without an account or update service. To activate auth, create a new Cloudflare D1 database, copy `apps/worker/wrangler.example.jsonc` to `apps/worker/wrangler.jsonc`, set its new database ID and a unique `BETTER_AUTH_SECRET`, apply `apps/worker/migrations/0001_auth.sql`, and deploy the Worker. Then set `EXPO_PUBLIC_API_URL` to its HTTPS origin. Auth routes are scaffolded but no account UI is connected yet.

For Hot Updater, create new D1/R2 resources and credentials, copy `apps/mobile/.env.hotupdater.example` to `.env.hotupdater`, then set the public `EXPO_PUBLIC_HOT_UPDATER_URL` for the new service. Native changes require a fresh build.
