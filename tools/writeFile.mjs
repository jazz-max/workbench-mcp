import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export function register(server, projectRoot) {
  server.tool(
    'write_file',
    'Write/create a file in the project (creates directories as needed)',
    {
      path: z.string().describe('File path relative to project root'),
      content: z.string().describe('File content to write'),
    },
    async ({ path: filePath, content }) => {
      const resolved = path.resolve(projectRoot, filePath);
      if (!resolved.startsWith(projectRoot)) {
        return { content: [{ type: 'text', text: 'Error: path traversal denied' }], isError: true };
      }
      // Block writing to sensitive locations
      const rel = path.relative(projectRoot, resolved);
      if (rel.startsWith('.env') || rel.includes('node_modules') || rel.includes('vendor')) {
        return { content: [{ type: 'text', text: `Error: writing to ${rel} is not allowed` }], isError: true };
      }
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, content, 'utf-8');
      return { content: [{ type: 'text', text: `Written ${content.length} bytes to ${filePath}` }] };
    }
  );
}
