import { execFile } from 'node:child_process';
import { EXEC_TIMEOUT } from '../lib/safety.mjs';

function git(args, cwd) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, timeout: EXEC_TIMEOUT, encoding: 'utf-8' }, (err, stdout) => {
      resolve(err ? `(error: ${err.message})` : stdout.trimEnd());
    });
  });
}

export function register(server, projectRoot) {
  server.tool('git_status', 'Show git branch, status, and recent commits', {}, async () => {
    const [branch, status, log] = await Promise.all([
      git(['branch', '--show-current'], projectRoot),
      git(['status', '--porcelain'], projectRoot),
      git(['log', '--oneline', '-10'], projectRoot),
    ]);
    const text = [
      `Branch: ${branch}`,
      '',
      '=== Status ===',
      status || '(clean)',
      '',
      '=== Recent commits ===',
      log,
    ].join('\n');
    return { content: [{ type: 'text', text }] };
  });
}
