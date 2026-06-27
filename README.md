# Workbench MCP Server

MCP-сервер для **удалённого доступа к проекту по сети**. Позволяет Claude CLI с
другого компьютера читать/писать файлы, искать код, запускать allow-listed
команды и работать с git в контексте указанного проекта — а также запускать
Claude CLI на хост-машине в фоне (`claude_start`).

Изначально написан для [Workbench](https://github.com/jazz-max/workbench), но работает с любым проектом — путь задаётся через `MCP_PROJECT_ROOT`.

## Быстрый старт

```bash
git clone <repo-url> workbench-mcp && cd workbench-mcp
npm install
cp .env.example .env
# отредактируй .env: задай MCP_AUTH_TOKEN и MCP_PROJECT_ROOT
npm start
```

Вывод при успешном запуске:
```
MCP server listening on http://0.0.0.0:3100/mcp (auth enabled)
Project root: /path/to/your/project
```

### Установка через npm / npx

Без клонирования репозитория:

```bash
# разовый запуск без установки
MCP_AUTH_TOKEN=<токен> MCP_PROJECT_ROOT=/путь/к/проекту npx workbench-mcp

# или поставить глобально
npm install -g workbench-mcp
MCP_AUTH_TOKEN=<токен> MCP_PROJECT_ROOT=/путь/к/проекту workbench-mcp
```

> При запуске через `npx`/глобально файла `.env` рядом с сервером нет — задавай
> настройки **переменными окружения** напрямую. `MCP_PROJECT_ROOT` в этом случае
> **обязателен** (иначе сервер не поймёт, какой проект обслуживать).

### Запуск через pm2 (рекомендуется для постоянной работы)

```bash
pm2 start server.mjs --name workbench-mcp
pm2 save
pm2 startup          # автозапуск при перезагрузке (один раз)

pm2 logs workbench-mcp     # логи
pm2 restart workbench-mcp  # перезапуск после изменений
```

## Конфигурация (`.env`)

| Переменная | По умолчанию | Описание |
|------------|-------------|----------|
| `MCP_PORT` | `3100` | Порт сервера |
| `MCP_AUTH_TOKEN` | *(пусто)* | Bearer-токен. **Без токена — доступ без авторизации** (только для доверенной локальной сети) |
| `MCP_PROJECT_ROOT` | родительская папка | Абсолютный путь к проекту, который обслуживает сервер |

Сгенерировать токен: `node -e "console.log(crypto.randomUUID())"`

## Подключение Claude CLI (с другого компьютера)

```bash
# IP хоста (macOS): ipconfig getifaddr en0
claude mcp add workbench \
  --transport http \
  --url http://<IP>:3100/mcp \
  --header "Authorization: Bearer <ТОКЕН_ИЗ_.env>"

claude mcp list      # проверить
claude mcp remove workbench
```

## Инструменты

| Инструмент | Описание |
|------------|----------|
| `project_info` | Обзор проекта: `CLAUDE.md`, список сервлетов (если есть `servlets.json`), `docs/`, текущая ветка |
| `read_file` | Чтение файла (путь относительно корня проекта), до 1 MB, с номерами строк |
| `write_file` | Запись файла (создаёт директории). Запрещено: `.env*`, `node_modules/`, `vendor/` |
| `list_files` | Листинг директории (опц. рекурсивный, фильтр по имени), до 500 записей |
| `search_code` | Поиск по содержимому (regex/grep), фильтр по glob, исключает `node_modules/vendor/.git/storage/public` |
| `run_command` | Команда из allowlist, `execFile` (без shell), таймаут 30с, вывод до 1 MB |
| `git_status` | Текущая ветка, `git status --porcelain`, последние 10 коммитов |
| `claude_start` | Запуск `claude -p` в фоне с промптом → возвращает `taskId` |
| `claude_result` | Статус и результат фоновой задачи по `taskId` (`running`/`done`/`error`) |

**allowlist для `run_command`:** `git, php, composer, npm, node, npx, ls, cat, head, tail, find, grep, rg, wc, diff, file, which, pwd, echo`

## Сценарий: удалённая разработка с двух машин

**Машина A** — проект и MCP-сервер. **Машина B** — Claude CLI для исследования.

```
                    LAN (порт 3100)
  Машина B  ──────────────────────>  Машина A
  Claude CLI                         MCP-сервер
  (исследование, спеки)              (файлы проекта, git, команды)
```

> **Важно:** [Claude Code CLI](https://docs.claude.com/claude-code) должен стоять на **обеих** машинах — на B как клиент, который подключается к MCP-серверу и драйвит работу, и на A, где `claude_start` запускает Claude локально на хосте для кодинга.

Типичный поток для нового сервлета:

1. На машине A запущен MCP-сервер.
2. На машине B в Claude CLI:
   ```
   > Используй project_info, чтобы понять структуру проекта
   > Прочитай app/Servlets/BaseServlet.php — базовый класс
   > Прочитай app/Servlets/DemoBooksScraper.php — пример сервлета
   > Исследуй сайт example.com и напиши спецификацию в docs/spec.md
   ```
3. Не переключаясь на машину A, просто попроси своего Claude делегировать кодинг хосту:
   ```
   > Попроси claude на верстаке закодить парсер по спеке docs/spec.md
   ```
   Claude на машине B вызовет `claude_start` → на машине A («верстаке») запустится
   отдельный Claude CLI, который напишет код. Результат заберёшь через `claude_result`.

## Безопасность

- Запросы защищены Bearer-токеном (`MCP_AUTH_TOKEN`). Без токена сервер работает **без авторизации** — открывай его только в доверенной сети.
- `run_command` ограничен allowlist и использует `execFile` (без shell-инъекций).
- `write_file` запрещает запись в `.env*`, `node_modules/`, `vendor/`.
- Сервер даёт удалённый доступ к файлам и выполнению команд — **не выставляй его в публичный интернет** без отдельного reverse-proxy с TLS и аутентификацией.

## Устранение проблем

- **Cannot connect:** обе машины в одной сети; проверь IP; `curl http://localhost:3100/mcp` должен вернуть 405; проверь firewall (macOS может спросить разрешение для Node.js).
- **Unauthorized:** токен в `--header` должен совпадать с `MCP_AUTH_TOKEN`.
- **Command not allowed:** команда не в allowlist.
- **Порт занят:** `lsof -ti:3100 | xargs kill -9`.

## Лицензия

[MIT](LICENSE).
