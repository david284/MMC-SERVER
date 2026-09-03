const fs = require('fs');
const path = require('path');

const rootDirectory = path.resolve(__dirname, '../..');

const packageJson = require(path.join(rootDirectory, 'package.json'));
const requiredVersion = packageJson.version;

const clientVersionFile = path.join(
  rootDirectory,
  'public',
  '.mmc-client-version'
);

if (!fs.existsSync(clientVersionFile)) {
  console.error(
    'MMC-CLIENT is not installed.\n' +
    'Run: npm run install:client'
  );
  process.exit(1);
}

const installedVersion = fs.readFileSync(clientVersionFile, 'utf8').trim();

if (installedVersion !== requiredVersion) {
  console.error(
    `MMC-CLIENT ${installedVersion} is installed, but ` +
    `MMC-SERVER requires ${requiredVersion}.\n` +
    'Run: npm run install:client'
  );
  process.exit(1);
}
