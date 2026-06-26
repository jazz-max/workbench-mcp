import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

/** @type {Map<string, { status: 'running'|'done'|'error', output: string, code: number|null, startedAt: number }>} */
const tasks = new Map();

const TASK_TTL = 30 * 60_000; // 30 min — auto-cleanup

export function registerClaudeStart(server, projectRoot) {
  server.tool(
    'claude_start',
    'Start Claude Code CLI in background with a prompt. Returns a taskId to poll with claude_result.',
    {
      prompt: z.string().describe('The prompt to send to Claude'),
      allowedTools: z.string().optional().describe('Comma-separated tool names (default: Bash,Read,Edit,Write,Glob,Grep)'),
    },
    async ({ prompt, allowedTools }) => {
      const taskId = randomUUID().slice(0, 8);
      const args = ['-p', prompt, '--allowedTools', allowedTools || 'Bash,Read,Edit,Write,Glob,Grep'];

      const task = { status: 'running', output: '', code: null, startedAt: Date.now() };
      tasks.set(taskId, task);

      const child = spawn('claude', args, {
        cwd: projectRoot,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.on('data', (chunk) => { task.output += chunk.toString(); });
      child.stderr.on('data', (chunk) => { task.output += chunk.toString(); });

      child.on('close', (code) => {
        task.status = code === 0 ? 'done' : 'error';
        task.code = code;
      });

      child.on('error', (err) => {
        task.status = 'error';
        task.output += `\nSpawn error: ${err.message}`;
      });

      // Auto-cleanup old tasks
      for (const [id, t] of tasks) {
        if (Date.now() - t.startedAt > TASK_TTL) tasks.delete(id);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ taskId, status: 'running' }) }],
      };
    }
  );
}

export function registerClaudeResult(server) {
  server.tool(
    'claude_result',
    'Check the status and output of a background Claude task started with claude_start.',
    {
      taskId: z.string().describe('The taskId returned by claude_start'),
    },
    async ({ taskId }) => {
      const task = tasks.get(taskId);
      if (!task) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found', taskId }) }],
          isError: true,
        };
      }

      const result = {
        taskId,
        status: task.status,
        code: task.code,
        output: task.output,
      };

      // Keep finished tasks for re-reads; TTL cleanup handles eviction

      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );
}
