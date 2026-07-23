import { spawnSync, execSync } from 'child_process';
import fs from 'fs';

const branch = process.env.BRANCH || process.env.NEXT_PUBLIC_BRANCH || 'main';
const buildScript = branch === 'dev' ? 'build:dev' : 'build';

console.log(`Netlify branch-aware build: branch=${branch}, running npm run ${buildScript}`);

// Write build-info
const commitHash = process.env.COMMIT_REF || process.env.GIT_COMMIT || 'local-dev';
const shortHash = commitHash !== 'local-dev' ? commitHash.substring(0, 7) : 'local-dev';
const deployId = process.env.DEPLOY_ID || 'local-dev';

let finalId = deployId !== 'local-dev' ? deployId : shortHash;
if (finalId === 'local-dev') {
  try {
    const gitSha = execSync('git rev-parse --short HEAD').toString().trim();
    if (gitSha) finalId = gitSha;
  } catch (e) {
    // ignore
  }
}

const buildInfoContent = `export const BUILD_INFO = {
  buildId: '${finalId}',
  timestamp: '${new Date().toISOString()}'
};
`;

fs.writeFileSync('src/app/build-info.ts', buildInfoContent);
console.log(`Generated build-info with buildId=${finalId}`);

const result = spawnSync('npm', ['run', buildScript], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

process.exit(result.status === null ? 1 : result.status);
