const fs = require('fs');
const path = require('path');

const pbxprojPath = path.join(__dirname, '..', 'ios', 'app.xcodeproj', 'project.pbxproj');

if (!fs.existsSync(pbxprojPath)) {
  console.error('pbxproj not found at', pbxprojPath);
  process.exit(1);
}

let content = fs.readFileSync(pbxprojPath, 'utf8');

const marker = 'EXCLUDED_ARCHS[sdk=macosx*]';
if (!content.includes(marker)) {
  content = content.replace(
    /(buildSettings\s*=\s*\{)(\s*)/g,
    (match, prefix, ws) => {
      const indent = ws || '\n\t\t\t\t';
      return `${prefix}${indent}"${marker}" = "arm64";${indent}`;
    }
  );
  fs.writeFileSync(pbxprojPath, content, 'utf8');
  console.log('Added EXCLUDED_ARCHS[sdk=macosx*] to pbxproj');
} else {
  console.log('EXCLUDED_ARCHS[sdk=macosx*] already present');
}
