# AngryBirdGodAI preview runbook

## How to reproduce the artifacts

- Use the worktree containing `package.json`, `server.js`, `index.html`, `app.js`, and `styles.css`.
- There are no environment files or external runtime dependencies in this project. If a future `.env.local` is added, copy it from the main checkout into this worktree; never symlink it.
- No dependency installation is required for the current dependency-free server. If dependencies are added later, install them with the package manager selected by the lockfile.

## How to run the server

- Run `npm run dev` from the worktree root for an attached development session.
- For a detached Windows preview, start `node.exe` with `server.js` using PowerShell `Start-Process`, redirecting stdout and stderr to separate log files; this avoids the npm.cmd wrapper being reaped by the terminal runner.
- The server listens on `http://127.0.0.1:4173` by default. Use `PORT=<free-port> npm run dev` when that port is occupied.
- Keep Ollama running separately on `127.0.0.1:11434`; the app proxies local Ollama traffic and uses its `/api/research` route for web sources.
