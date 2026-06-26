import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export function register(server, projectRoot) {
  server.tool(
    'list_files',
    'List files in a directory',
    {
      path: z.string().optional().describe('Directory path relative to project root (default: root)'),
      recursive: z.boolean().optional().describe('List recursively (default: false)'),
      pattern: z.string().optional().describe('Filter by filename pattern (substring match)'),
    },
    async ({ path: dirPath, recursive, pattern }) => {
      const resolved = path.resolve(projectRoot, dirPath || '.');
      if (!resolved.startsWith(projectRoot)) {
        return { content: [{ type: 'text', text: 'Error: path traversal denied' }], isError: true };
      }
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
        return { content: [{ type: 'text', text: `Error: not a directory: ${dirPath || '.'}` }], isError: true };
      }

      const results = [];
      const SKIP = new Set(['node_modules', 'vendor', '.git', 'storage', 'public']);
      const MAX_ENTRIES = 500;

      function walk(dir, depth) {
        if (results.length >= MAX_ENTRIES) return;
        let entries;
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (results.length >= MAX_ENTRIES) break;
          if (depth === 0 && SKIP.has(entry.name)) continue;
          const rel = path.relative(projectRoot, path.join(dir, entry.name));
          if (pattern && !entry.name.includes(pattern)) {
            if (entry.isDirectory() && recursive) {
              walk(path.join(dir, entry.name), depth + 1);
            }
            continue;
          }
          const type = entry.isDirectory() ? 'd' : 'f';
          let size = '';
          if (!entry.isDirectory()) {
            try {
              const s = fs.statSync(path.join(dir, entry.name)).size;
              size = s < 1024 ? ` ${s}B` : ` ${(s / 1024).toFixed(0)}K`;
            } catch { /* skip */ }
          }
          results.push(`${type} ${rel}${size}`);
          if (entry.isDirectory() && recursive) {
            walk(path.join(dir, entry.name), depth + 1);
          }
        }
      }

      walk(resolved, 0);
      if (results.length === 0) {
        return { content: [{ type: 'text', text: '(empty directory)' }] };
      }
      const suffix = results.length >= MAX_ENTRIES ? `\n... (truncated at ${MAX_ENTRIES})` : '';
      return { content: [{ type: 'text', text: results.join('\n') + suffix }] };
    }
  );
}
