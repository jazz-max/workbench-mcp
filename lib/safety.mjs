import path from 'node:path';

const ALLOWED_COMMANDS = new Set([
  'git', 'php', 'composer', 'npm', 'node', 'npx',
  'ls', 'cat', 'head', 'tail', 'find', 'grep', 'rg',
  'wc', 'diff', 'file', 'which', 'pwd', 'echo',
]);

export const EXEC_TIMEOUT = 30_000;
export const MAX_OUTPUT = 1024 * 1024; // 1 MB

export function validateCommand(command) {
  const base = path.basename(command);
  if (!ALLOWED_COMMANDS.has(base)) {
    throw new Error(
      `Command not allowed: "${command}". Allowed: ${[...ALLOWED_COMMANDS].join(', ')}`
    );
  }
}
