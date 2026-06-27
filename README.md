# Workbench MCP Server

An MCP server for **remote access to a project over the network**. It lets a
Claude CLI running on another machine read/write files, search code, run
allow-listed commands and work with git in the context of a chosen project — and
also launch a Claude CLI on the host machine in the background (`claude_start`).

Originally built for [Workbench](https://github.com/jazz-max/workbench), but it
works with any project — the path is set via `MCP_PROJECT_ROOT`.

## Quick start

```bash
git clone https://github.com/jazz-max/workbench-mcp.git && cd workbench-mcp
npm install
cp .env.example .env
# edit .env: set MCP_AUTH_TOKEN and MCP_PROJECT_ROOT
npm start
```

On a successful start you'll see:
```
MCP server listening on http://0.0.0.0:3100/mcp (auth enabled)
Project root: /path/to/your/project
```

### Install via npm / npx

Without cloning the repository:

```bash
# one-off run, no install
MCP_AUTH_TOKEN=<token> MCP_PROJECT_ROOT=/path/to/project npx workbench-mcp

# or install globally
npm install -g workbench-mcp
MCP_AUTH_TOKEN=<token> MCP_PROJECT_ROOT=/path/to/project workbench-mcp
```

> When run via `npx`/global install there is no `.env` next to the server — set
> the configuration via **environment variables** directly. In this case
> `MCP_PROJECT_ROOT` is **required** (otherwise the server doesn't know which
> project to serve).

### Run via pm2 (recommended for long-running use)

```bash
pm2 start server.mjs --name workbench-mcp
pm2 save
pm2 startup          # start on boot (one-time)

pm2 logs workbench-mcp     # logs
pm2 restart workbench-mcp  # restart after changes
```

## Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PORT` | `3100` | Server port |
| `MCP_AUTH_TOKEN` | *(empty)* | Bearer token. **Without a token the server runs without authentication** (use only on a trusted local network) |
| `MCP_PROJECT_ROOT` | parent directory | Absolute path to the project the server serves |

Generate a token: `node -e "console.log(crypto.randomUUID())"`

## Connecting Claude CLI (from another machine)

```bash
# host IP (macOS): ipconfig getifaddr en0
claude mcp add workbench \
  --transport http \
  --url http://<IP>:3100/mcp \
  --header "Authorization: Bearer <TOKEN_FROM_.env>"

claude mcp list      # verify
claude mcp remove workbench
```

## Tools

| Tool | Description |
|------|-------------|
| `project_info` | Project overview: `CLAUDE.md`, servlet list (if `servlets.json` exists), `docs/`, current branch |
| `read_file` | Read a file (path relative to project root), up to 1 MB, with line numbers |
| `write_file` | Write a file (creates directories). Forbidden: `.env*`, `node_modules/`, `vendor/` |
| `list_files` | List a directory (optionally recursive, name filter), up to 500 entries |
| `search_code` | Search by content (regex/grep), glob filter, excludes `node_modules/vendor/.git/storage/public` |
| `run_command` | A command from the allowlist, `execFile` (no shell), 30s timeout, output up to 1 MB |
| `git_status` | Current branch, `git status --porcelain`, last 10 commits |
| `claude_start` | Launch `claude -p` in the background with a prompt → returns a `taskId` |
| `claude_result` | Status and result of a background task by `taskId` (`running`/`done`/`error`) |

**allowlist for `run_command`:** `git, php, composer, npm, node, npx, ls, cat, head, tail, find, grep, rg, wc, diff, file, which, pwd, echo`

## Scenario: remote development from two machines

**Machine A** — the project and the MCP server. **Machine B** — the Claude CLI for exploration.

```
                    LAN (port 3100)
  Machine B  ──────────────────────>  Machine A
  Claude CLI                          MCP server
  (research, specs)                   (project files, git, commands)
```

> **Note:** [Claude Code CLI](https://docs.claude.com/claude-code) must be
> installed on **both** machines — on B as the client that connects to the MCP
> server and drives the work, and on A, where `claude_start` runs Claude locally
> on the host for coding.

A typical flow for a new feature:

1. The MCP server is running on machine A.
2. In the Claude CLI on machine B:
   ```
   > Use project_info to understand the project structure
   > Read app/Servlets/BaseServlet.php — the base class
   > Read app/Servlets/DemoBooksScraper.php — an example
   > Research example.com and write a spec to docs/spec.md
   ```
3. Without switching to machine A, ask your Claude to delegate the coding to the host:
   ```
   > Ask claude on the workbench to write the parser per docs/spec.md
   ```
   Claude on machine B calls `claude_start` → a separate Claude CLI launches on
   machine A ("the workbench") and writes the code. Collect the result via
   `claude_result`.

## Security

- Requests are protected by a Bearer token (`MCP_AUTH_TOKEN`). Without a token the server runs **without authentication** — only expose it on a trusted network.
- `run_command` is restricted to an allowlist and uses `execFile` (no shell injection).
- `write_file` forbids writing to `.env*`, `node_modules/`, `vendor/`.
- The server grants remote access to files and command execution — **do not expose it to the public internet** without a separate reverse proxy with TLS and authentication.

## Troubleshooting

- **Cannot connect:** both machines on the same network; check the IP; `curl http://localhost:3100/mcp` should return 405; check the firewall (macOS may ask to allow Node.js).
- **Unauthorized:** the token in `--header` must match `MCP_AUTH_TOKEN`.
- **Command not allowed:** the command is not in the allowlist.
- **Port in use:** `lsof -ti:3100 | xargs kill -9`.

## License

[MIT](LICENSE).
