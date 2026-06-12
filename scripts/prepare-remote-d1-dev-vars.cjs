const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const accountId = '0f7122ab026d40f60676d876f61c3c98';
const databaseId = '2539afd9-931b-444b-8bc7-2e0816242ba8';
const wranglerConfigPath = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'xdg.config',
  '.wrangler',
  'config',
  'default.toml'
);

if (process.platform === 'win32') {
  execFileSync('cmd.exe', ['/c', 'npx', 'wrangler', 'whoami'], { stdio: 'ignore' });
} else {
  execFileSync('npx', ['wrangler', 'whoami'], { stdio: 'ignore' });
}
const config = fs.readFileSync(wranglerConfigPath, 'utf8');
const token = config.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];

if (!token) {
  throw new Error('Cloudflare OAuth token not found. Run `npx wrangler login` first.');
}

const devVarsPath = path.resolve(process.cwd(), '.dev.vars');
const existing = fs.existsSync(devVarsPath) ? fs.readFileSync(devVarsPath, 'utf8') : '';
const managedKeys = new Set([
  'USE_D1_HTTP',
  'CF_ACCOUNT_ID',
  'CF_D1_DATABASE_ID',
  'CF_D1_API_TOKEN',
]);

const preservedLines = existing
  .split(/\r?\n/)
  .filter(line => {
    const key = line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1];
    return key ? !managedKeys.has(key) : line.trim() !== '';
  });

const managedLines = [
  'USE_D1_HTTP="true"',
  `CF_ACCOUNT_ID="${accountId}"`,
  `CF_D1_DATABASE_ID="${databaseId}"`,
  `CF_D1_API_TOKEN="${token.replace(/"/g, '\\"')}"`,
];

fs.writeFileSync(devVarsPath, [...preservedLines, ...managedLines, ''].join(os.EOL));
console.log('Prepared local remote D1 HTTP vars in .dev.vars');
