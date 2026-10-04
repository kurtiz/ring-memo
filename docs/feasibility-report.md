# RingMemo feasibility report

## Current verdict

**Unproven.** The intended physical target is a Samsung Galaxy A21s running Android 12. No phone was connected during implementation, so both-voice cellular capture, background capture, locked-screen capture, speakerphone, and Bluetooth have no measured result.

## Implemented experiment

- Local Expo module with a Kotlin foreground call-monitoring service.
- Shizuku UserService running the VOICE_CALL AudioRecord experiment at the helper's actual shell/root identity.
- PCM16 mono 16 kHz WAV saved through a descriptor to app-private storage.
- No microphone-only fallback and no Accessibility capture.
- Atomic recording journal, interruption recovery, exportable diagnostic report, and manual intelligibility reviews.
- Firmware/helper-specific verification gate before automatic recording.

## Device results

Use [the physical-device checklist](device-testing.md). Attach the exported JSON report and fill in the actual results after testing. Do not treat package installation, a successful build, permission grants, nonzero audio samples, or a passing unit test as proof that the remote voice is captured.

## Software validation

- `pnpm lint`: passed.
- `pnpm typecheck`: passed for mobile and Worker.
- `pnpm test`: 11 JavaScript tests passed, including real SQLite queries.
- `pnpm check:expo`: all 21 Expo Doctor checks passed.
- Android JavaScript export: passed.
- Recorder module native compilation: passed using Java 21.
- `:ringmemo-recorder:testReleaseUnitTest`: seven native tests passed, including actual interrupted WAV file repair.
- Full release APK build and Android release lint checks: passed through `scripts/build-apk.ps1`.
- APK signature verification: passed (APK Signature Scheme v2).
- Packaged artifact: `artifacts/ringmemo-a21s.apk`, 46,805,157 bytes, arm64-v8a, app version 0.1.0, minimum API 26, target API 36. JavaScript and the app's native library are embedded.
- Packaged manifest: backup disabled; recording service and action receiver are not exported; microphone foreground service and Shizuku provider are present. No call-log or contacts permission is requested.

Android Studio's Java 25 runtime failed during native C++ configuration; the workspace uses Microsoft OpenJDK 21 for the build. Windows also rejected long C++ paths. The workspace now uses shorter pnpm package paths, native staging at the workspace root, and checksum-verified Ninja 1.13.2. Expo Doctor passed all 21 checks on retry using the configured network proxy after an Expo API TLS connection failure. These software results leave the physical-device verdict unchanged.

## Next research step if capture fails

Compare the ADB error with the exact firmware's audio permissions. Research root provisioning for the exact hardware variant without making device changes. Repeat the identical experiment on an already root-provisioned test device if available. If it still fails, retain the disabled state and report that this capture path is unsupported on the tested configuration.

## References

- [Android: sharing audio input](https://developer.android.com/media/platform/sharing-audio-input)
- [Shizuku API and helper-process privileges](https://github.com/RikkaApps/Shizuku-API)
- [Shizuku setup](https://shizuku.rikka.app/guide/setup/)
- [Expo: local native modules](https://docs.expo.dev/modules/get-started/)
