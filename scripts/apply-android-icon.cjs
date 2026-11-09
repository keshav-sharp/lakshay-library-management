const fs = require('fs');
const path = require('path');

const iconSource = path.join(__dirname, '../public/app-icon.png');
const resDir = path.join(__dirname, '../android/app/src/main/res');

if (!fs.existsSync(iconSource)) {
  console.error('Source icon not found at', iconSource);
  process.exit(1);
}

if (!fs.existsSync(resDir)) {
  console.log('Android res dir not found yet:', resDir);
  process.exit(0);
}

const iconBuffer = fs.readFileSync(iconSource);

// 1. Walk and replace all ic_launcher*.png files
const walkSync = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkSync(filePath));
    } else {
      if (file.includes('ic_launcher') && file.endsWith('.png')) {
        results.push(filePath);
      }
    }
  });
  return results;
};

const launcherFiles = walkSync(resDir);
console.log(`Found ${launcherFiles.length} launcher icon PNG files to replace.`);
launcherFiles.forEach((file) => {
  fs.writeFileSync(file, iconBuffer);
  console.log(`Replaced PNG: ${file}`);
});

// 2. Update ic_launcher_background.xml color to deep teal (#0B192C) matching app icon
const bgXmlPath = path.join(resDir, 'values/ic_launcher_background.xml');
if (fs.existsSync(bgXmlPath)) {
  const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0B192C</color>
</resources>
`;
  fs.writeFileSync(bgXmlPath, xmlContent);
  console.log('Updated ic_launcher_background.xml to deep teal (#0B192C)');
}
