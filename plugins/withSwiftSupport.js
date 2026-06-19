const { withXcodeProject } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

module.exports = function withSwiftSupport(config) {
  return withXcodeProject(config, (config) => {
    const proj = config.modResults;

    // Add empty Swift file to ensure Swift runtime is embedded
    const swiftPath = path.join(config.modRequest.platformProjectRoot, 'app', 'Empty.swift');
    if (!fs.existsSync(swiftPath)) {
      fs.writeFileSync(swiftPath, 'import Foundation\n', 'utf8');
    }
    const target = proj.getTarget('app');
    if (target) {
      proj.addSourceFile('app/Empty.swift', target, {});
    }

    // Set EXCLUDED_ARCHS for macOS to suppress ITMS-90863 warnings
    // The xcode library is patched (via patch-package) to quote keys with [sdk=]
    const configs = proj.pbxXCBuildConfigurationSection();
    for (const key in configs) {
      const bs = configs[key]?.buildSettings;
      if (bs) {
        bs["EXCLUDED_ARCHS[sdk=macosx*]"] = "arm64";
      }
    }

    return config;
  });
};
