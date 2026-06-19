const { withXcodeProject, withPodfileProperties } = require('expo/config-plugins');
const path = require('path');

module.exports = function withSwiftSupport(config) {
  config = withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const swiftPath = path.join(config.modRequest.platformProjectRoot, 'app', 'Empty.swift');

    // Create empty Swift file
    const fs = require('fs');
    if (!fs.existsSync(swiftPath)) {
      fs.writeFileSync(swiftPath, 'import Foundation\n', 'utf8');
    }

    // Add to project sources
    const target = proj.getTarget('app');
    if (target) {
      proj.addSourceFile('app/Empty.swift', target, {});
    }

    // Disable Mac Catalyst to avoid ITMS-90863 warnings from ExpoModulesCore
    proj.addBuildProperty('SUPPORTS_MACCATALYST', 'NO');

    return config;
  });

  return config;
};
