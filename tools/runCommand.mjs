import { execFile } from 'node:child_process';
import { z } from 'zod';
import { validateCommand, EXEC_TIMEOUT, MAX_OUTPUT } from '../lib/safety.mjs';

export function register(server, projectRoot) {
  server.tool(
    'run_command',
    'Run a shell command (allowlisted: git, php, composer, npm, ls, grep, etc.)',
    {
      command: z.string().describe('Command to run (e.g. "git", "php", "ls")'),
      args: z.array(z.string()).optional().describe('Command arguments as an array'),
    },
    async ({ command, args }) => {
      try {
        validateCommand(command);
      } catch (err) {
        return { content: [{ type: 'text', text: err.message }], isError: true };
      }
      return new Promise((resolve) => {
        execFile(command, args || [], {
          cwd: projectRoot,
          timeout: EXEC_TIMEOUT,
          maxBuffer: MAX_OUTPUT,
          encoding: 'utf-8',
        }, (err, stdout, stderr) => {
          const output = [stdout, stderr].filter(Boolean).join('\n---stderr---\n');
          if (err) {
            resolve({
              content: [{ type: 'text', text: output || err.message }],
              isError: true,
            });
            return;
          }
          resolve({ content: [{ type: 'text', text: output || '(no output)' }] });
        });
      });
    }
  );
}
