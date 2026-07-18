import { spawnSync } from 'child_process';

const branch = process.env.BRANCH || process.env.NEXT_PUBLIC_BRANCH || 'main';
const buildScript = branch === 'dev' ? 'build:dev' : 'build';

console.log(`Netlify branch-aware build: branch=${branch}, running npm run ${buildScript}`);

const result = spawnSync('npm', ['run', buildScript], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

process.exit(result.status === null ? 1 : result.status);
