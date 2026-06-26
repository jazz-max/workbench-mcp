import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function register(server, projectRoot) {
  server.tool('project_info', 'Project overview: CLAUDE.md, servlets list, docs, git branch', {}, async () => {
    const sections = [];

    // CLAUDE.md
    const claudeMd = path.join(projectRoot, 'CLAUDE.md');
    if (fs.existsSync(claudeMd)) {
      sections.push('=== CLAUDE.md ===\n' + fs.readFileSync(claudeMd, 'utf-8'));
    }

    // Servlets list
    const servletsPath = path.join(projectRoot, 'resources/data/servlets.json');
    if (fs.existsSync(servletsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(servletsPath, 'utf-8'));
        const parsers = data.parsers || {};
        const list = Object.entries(parsers).map(([key, val]) => `  ${key}: ${val.title || '(no title)'}`);
        sections.push('=== Servlets (' + list.length + ') ===\n' + list.join('\n'));
      } catch {
        sections.push('=== Servlets === (parse error)');
      }
    }

    // Docs directory
    const docsDir = path.join(projectRoot, 'docs');
    if (fs.existsSync(docsDir)) {
      const files = fs.readdirSync(docsDir);
      sections.push('=== docs/ ===\n' + files.map(f => '  ' + f).join('\n'));
    }

    // Git branch
    try {
      const branch = execFileSync('git', ['branch', '--show-current'], {
        cwd: projectRoot,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      sections.push('=== Git branch ===\n  ' + branch);
    } catch {
      sections.push('=== Git branch === (unavailable)');
    }

    return { content: [{ type: 'text', text: sections.join('\n\n') }] };
  });
}
