import { execFile } from 'node:child_process';
import path from 'node:path';
import { z } from 'zod';
import { EXEC_TIMEOUT, MAX_OUTPUT } from '../lib/safety.mjs';

export function register(server, projectRoot) {
  server.tool(
    'search_code',
    'Search file contents with grep (regex). Excludes node_modules, vendor, .git.',
    {
      pattern: z.string().describe('Regex pattern to search for'),
      path: z.string().optional().describe('Subdirectory to search in (default: project root)'),
      glob: z.string().optional().describe('File glob filter, e.g. "*.php" or "*.vue"'),
      maxResults: z.number().optional().describe('Max results (default: 50)'),
    },
    async ({ pattern, path: subPath, glob, maxResults }) => {
      const searchDir = path.resolve(projectRoot, subPath || '.');
      if (!searchDir.startsWith(projectRoot)) {
        return { content: [{ type: 'text', text: 'Error: path traversal denied' }], isError: true };
      }
      const limit = maxResults || 50;
      const args = [
        '-rn',
        '--exclude-dir=node_modules',
        '--exclude-dir=vendor',
        '--exclude-dir=.git',
        '--exclude-dir=storage',
        '--exclude-dir=public/build',
      ];
      if (glob) {
        args.push(`--include=${glob}`);
      }
      args.push('-m', String(limit), '-E', pattern, searchDir);

      return new Promise((resolve) => {
        execFile('grep', args, {
          cwd: projectRoot,
          timeout: EXEC_TIMEOUT,
          maxBuffer: MAX_OUTPUT,
          encoding: 'utf-8',
        }, (err, stdout, stderr) => {
          if (err && !stdout) {
            if (err.code === 1) {
              resolve({ content: [{ type: 'text', text: 'No matches found.' }] });
              return;
            }
            resolve({ content: [{ type: 'text', text: `Error: ${stderr || err.message}` }], isError: true });
            return;
          }
          // Make paths relative to project root
          const output = stdout.replace(new RegExp(projectRoot + '/?', 'g'), '');
          resolve({ content: [{ type: 'text', text: output.trimEnd() || 'No matches found.' }] });
        });
      });
    }
  );
}
