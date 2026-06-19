const { withXcodeProject } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

module.exports = function withSwiftSupport(config) {
  return withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const swiftPath = path.join(config.modRequest.platformProjectRoot, 'app', 'Empty.swift');

    if (!fs.existsSync(swiftPath)) {
      fs.writeFileSync(swiftPath, 'import Foundation\n', 'utf8');
    }

    const target = proj.getTarget('app');
    if (target) {
      proj.addSourceFile('app/Empty.swift', target, {});
    }

    return config;
  });
};
