const { withProjectBuildGradle } = require('expo/config-plugins');

// pnpm's dependency paths can exceed Ninja's Windows path limit. Keep native
// staging outputs near the workspace root rather than inside node_modules.
const marker = '// RingMemo: short Windows native staging paths';
const gradle = `
${marker}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
  def ninjaPath = System.getenv('RINGMEMO_NINJA')
  def ninjaExecutable = ninjaPath ? new File(ninjaPath) : rootProject.file('../../../.tools/ninja/ninja.exe')
  subprojects { nativeProject ->
    ['com.android.library', 'com.android.application'].each { pluginId ->
      nativeProject.plugins.withId(pluginId) {
        def androidExtension = nativeProject.extensions.getByName('android')
        androidExtension.externalNativeBuild.cmake.buildStagingDirectory =
          rootProject.file("../../../.cxx/" + nativeProject.name)
        if (ninjaExecutable.exists()) {
          androidExtension.defaultConfig.externalNativeBuild.cmake.arguments.add(
            '-DCMAKE_MAKE_PROGRAM=' + ninjaExecutable.absolutePath.replace('\\\\', '/'))
        }
      }
    }
  }
}
`;

module.exports = function withNativeBuildPaths(config) {
  return withProjectBuildGradle(config, (result) => {
    if (result.modResults.language !== 'groovy') {
      throw new Error('RingMemo native path configuration requires Groovy Gradle.');
    }
    if (!result.modResults.contents.includes(marker)) {
      const anchor = 'apply plugin: "expo-root-project"';
      if (!result.modResults.contents.includes(anchor)) {
        throw new Error('RingMemo could not locate the Expo root Gradle plugin.');
      }
      // React Native's root plugin evaluates the app eagerly. Register the
      // Android-plugin callbacks before either root plugin configures modules.
      result.modResults.contents = result.modResults.contents.replace(anchor, gradle + '\n' + anchor);
    }
    return result;
  });
};
