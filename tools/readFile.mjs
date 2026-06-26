import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const MAX_SIZE = 1024 * 1024; // 1 MB

function isBinary(buffer) {
  for (let i = 0; i < Math.min(buffer.length, 8000); i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export function register(server, projectRoot) {
  server.tool(
    'read_file',
    'Read a file from the project (relative to project root)',
    { path: z.string().describe('File path relative to project root') },
    async ({ path: filePath }) => {
      const resolved = path.resolve(projectRoot, filePath);
      if (!resolved.startsWith(projectRoot)) {
        return { content: [{ type: 'text', text: 'Error: path traversal denied' }], isError: true };
      }
      if (!fs.existsSync(resolved)) {
        return { content: [{ type: 'text', text: `Error: file not found: ${filePath}` }], isError: true };
      }
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        return { content: [{ type: 'text', text: 'Error: path is a directory, use list_files' }], isError: true };
      }
      if (stat.size > MAX_SIZE) {
        return { content: [{ type: 'text', text: `Error: file too large (${(stat.size / 1024).toFixed(0)} KB > 1024 KB). Use run_command with head/tail.` }], isError: true };
      }
      const raw = fs.readFileSync(resolved);
      if (isBinary(raw)) {
        return { content: [{ type: 'text', text: `Binary file (${stat.size} bytes): ${filePath}` }] };
      }
      const text = raw.toString('utf-8');
      const lines = text.split('\n').map((line, i) => `${i + 1}\t${line}`).join('\n');
      return { content: [{ type: 'text', text: lines }] };
    }
  );
}
