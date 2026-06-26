import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// .env lives next to the server.
dotenv.config({ path: path.join(__dirname, '.env') });

// The project this server operates on. Set MCP_PROJECT_ROOT to the project you
// want to expose; defaults to the parent directory (when the server lives
// inside the project it serves).
const PROJECT_ROOT = process.env.MCP_PROJECT_ROOT
  ? path.resolve(process.env.MCP_PROJECT_ROOT)
  : path.resolve(__dirname, '..');

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

// Import tools
import { register as registerProjectInfo } from './tools/projectInfo.mjs';
import { register as registerReadFile } from './tools/readFile.mjs';
import { register as registerWriteFile } from './tools/writeFile.mjs';
import { register as registerListFiles } from './tools/listFiles.mjs';
import { register as registerSearchCode } from './tools/searchCode.mjs';
import { register as registerRunCommand } from './tools/runCommand.mjs';
import { register as registerGitStatus } from './tools/gitStatus.mjs';
import { registerClaudeStart, registerClaudeResult } from './tools/claude.mjs';

const PORT = parseInt(process.env.MCP_PORT || '3100', 10);
const TOKEN = process.env.MCP_AUTH_TOKEN || '';

function createServer() {
  const server = new McpServer({
    name: 'workbench-mcp',
    version: '1.0.0',
  });
  registerProjectInfo(server, PROJECT_ROOT);
  registerReadFile(server, PROJECT_ROOT);
  registerWriteFile(server, PROJECT_ROOT);
  registerListFiles(server, PROJECT_ROOT);
  registerSearchCode(server, PROJECT_ROOT);
  registerRunCommand(server, PROJECT_ROOT);
  registerGitStatus(server, PROJECT_ROOT);
  registerClaudeStart(server, PROJECT_ROOT);
  registerClaudeResult(server);
  return server;
}

// Express app
const app = express();
app.use(express.json());

function ts() {
  return new Date().toLocaleTimeString('ru-RU', { hour12: false });
}

function checkAuth(req, res) {
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
    console.log(`[${ts()}] 401 Unauthorized (ip: ${req.ip})`);
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Unauthorized' },
      id: null,
    });
    return false;
  }
  return true;
}

// Stateless: each request creates a new transport+server, closes after response
app.post('/mcp', async (req, res) => {
  if (!checkAuth(req, res)) return;
  const body = req.body;
  if (body?.method === 'tools/call') {
    const name = body.params?.name || '?';
    const args = JSON.stringify(body.params?.arguments || {});
    console.log(`[${ts()}] ${name} ${args}`);
  } else if (body?.method) {
    console.log(`[${ts()}] ${body.method}`);
  }
  const server = createServer();
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

app.get('/mcp', (req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
});

app.delete('/mcp', (req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const authNote = TOKEN ? 'auth enabled' : 'NO AUTH (set MCP_AUTH_TOKEN in .env)';
  console.log(`MCP server listening on http://0.0.0.0:${PORT}/mcp (${authNote})`);
  console.log(`Project root: ${PROJECT_ROOT}`);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  process.exit(0);
});
