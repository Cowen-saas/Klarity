---
name: run-klarity
description: Build, run, and drive Klarity (the Next.js app). Use when asked to start Klarity, run its dev server, install/build it, or check that a route/page works. Also load this before troubleshooting any npm/node/git command that hangs or errors mysteriously on this repo.
---

Klarity is a Next.js 15 web app. This repo's working tree lives on a path Windows
only reaches through the `\\wsl.localhost\Ubuntu\...` UNC mount — but Node, npm,
and git are all fundamentally broken against that UNC path (see Gotchas). Every
command in this skill instead runs **natively inside WSL**, dispatched via
`wsl.exe -d Ubuntu -- bash -c '...'`, against the real filesystem path
`/home/cowen/projects/klarity`.

The driver is `.claude/skills/run-klarity/smoke.sh` — a curl-based smoke script.
There is no `chromium-cli` (or any headless browser) installed in this
Windows/Git-Bash host, so this driver proves the server starts and serves the
right HTML/status codes, not pixel-level visual correctness. **If chromium-cli
(or another headless-browser tool) ever becomes available in this environment,
prefer it for real UI/visual verification** — see the standard
`examples/playwright.md` pattern in the `run` skill.

All paths below are relative to the repo root (`<unit-dir>/` = the Klarity repo).

## Prerequisites

- WSL2 with an **Ubuntu** distro already installed, reachable via `wsl.exe -d Ubuntu`.
- Docker Desktop with WSL integration enabled — used only as a one-off
  root-owned-file cleanup tool (see Gotchas), not to run the app itself.
- No `sudo`/`apt-get` needed for anything in this skill. `sudo` in this WSL
  distro requires an interactive password and is not available to an agent.
- Every command below must be run from a Windows Git-Bash session with
  `export MSYS_NO_PATHCONV=1` set first — otherwise Git Bash mangles the
  leading `/home/...`-style paths before `wsl.exe` ever sees them.

## Setup

```bash
export MSYS_NO_PATHCONV=1
bash .claude/skills/run-klarity/smoke.sh setup
```

This installs a **native Linux** Node.js 22.14.0 binary directly inside WSL, at
`~/.local/node` (downloaded straight from nodejs.org, no package manager, no
sudo), then runs a clean `npm install` against `/home/cowen/projects/klarity`.
This exists because the project's own Windows-node.exe-over-UNC setup does not
work: `npm install` on this repo runs `@prisma/client`'s postinstall script,
which npm spawns via `cmd.exe` — and `cmd.exe` refuses a UNC working directory
outright ("UNC paths are not supported"), aborting the entire install. Running
a real Linux Node/npm inside WSL against the repo's real filesystem path
sidesteps this category of problem entirely — no `--ignore-scripts` workaround
needed, `npm install` runs clean including Prisma's `postinstall`.

## Run (agent path)

```bash
export MSYS_NO_PATHCONV=1
bash .claude/skills/run-klarity/smoke.sh start   # launches the dev server in the background
bash .claude/skills/run-klarity/smoke.sh check   # curls key routes, prints OK/FAIL per route
bash .claude/skills/run-klarity/smoke.sh stop    # kills the dev server
```

| command | what it does |
|---|---|
| `setup` | Installs native WSL Node (if missing) + `npm install` |
| `start` | Backgrounds `node node_modules/next/dist/bin/next dev` inside WSL, polls up to 30s for it to respond |
| `check` | Curls `/`, `/connexion`, `/inscription`, and the 3 `/legal/*.docx` files; prints `OK <path> -> <code>` or `FAIL` |
| `stop` | Finds and kills the `next-server` process via `ps`/`awk` (see Gotchas for why not `pkill`) |

Dev server log: `/tmp/klarity-dev.log` inside WSL (read it with
`wsl.exe -d Ubuntu -- bash -c 'tail -n 40 /tmp/klarity-dev.log'`).

Port: the script targets **3001**, because port 3000 was occupied by another
process on this machine during testing and Next.js fell back to 3001. This
isn't a hardcoded guarantee — if 3000 is free when you run this, check the
`- Local:` line in the dev log and adjust `PORT` in `smoke.sh` accordingly.

## Run (human path)

Run `setup` then `start` as above, then open `http://localhost:3001` in a
browser on the **Windows host** — WSL2 forwards ports opened inside WSL to
`localhost` on Windows automatically, no extra config needed. `Ctrl-C` doesn't
apply since the server runs detached; use `smoke.sh stop` instead.

## Gotchas

- **npm's `cmd.exe`-spawned lifecycle scripts reject a UNC cwd.** Any
  `postinstall`/`preinstall` script (Prisma's included) fails with `UNC paths
  are not supported. Defaulting to Windows directory.` if npm runs against
  `\\wsl.localhost\...`. This is the root cause the native-WSL-Node setup
  above exists to avoid.
- **Next.js/webpack's internal loader resolution breaks against a UNC root**
  even after `npm install` succeeds — every route 500s with `Module not
  found: Error: Can't resolve 'next-flight-client-entry-loader'` (or
  `next-client-pages-loader`, `next-route-loader`). No config flag fixes
  this; it only goes away by running Next natively inside WSL.
- **Next's file watcher (Watchpack) spams `EISDIR` errors** against a UNC
  path — harmless to serving but floods the log (300KB+ in minutes). Another
  symptom of not being on the native WSL path; doesn't occur there.
- **git reports "detected dubious ownership"** against the UNC path. Do
  **not** run `git config --global --add safe.directory ...` to silence
  this (touching global git config should be avoided) — instead run
  `git status`/`commit`/`push` the same way as everything else in this
  skill: `wsl.exe -d Ubuntu -- bash -c 'cd /home/cowen/projects/klarity && git ...'`.
- **`pkill -f ...` through `wsl.exe -d Ubuntu -- bash -c` is flaky** —
  observed to intermittently return odd exit codes (seen: `15`) even when
  guarded by `|| true`, sometimes on the very same command that returned `1`
  (the normal "no match") a moment earlier. `smoke.sh stop` avoids `pkill`
  entirely and uses `ps aux | grep ... | awk '{print $2}' | xargs -r kill`
  instead, which was reliable in testing.
- **A backgrounded+disowned process can die silently right after launch.**
  `setsid nohup node ... & disown -a` alone isn't enough — if the
  `wsl.exe -- bash -c '...'` script ends immediately after, the session can
  tear down before the child fully detaches (observed: 0-byte log, no
  process, no error). `smoke.sh start` appends `; sleep 2` after
  backgrounding specifically to avoid this race.
- **Files under `.next` can end up owned by `root`**, apparently from an
  earlier Docker run against this repo's `docker-compose.yml` bind-mounting
  the same directory. Since there's no passwordless `sudo`, a plain
  `rm -rf .next` as the normal WSL user fails with `Permission denied` on
  every root-owned file. Fix: a one-off container as root —
  `docker run --rm -v /home/cowen/projects/klarity:/app -w /app alpine rm -rf .next`
  (works because `cowen` is in the `docker` group, no sudo needed for `docker` itself).
- **Occasional transient `Wsl/Service/0x8007274c` connection errors** from
  `wsl.exe` itself (unrelated to this project) — just retry the command.

## Troubleshooting

- **Every route 500s with `Module not found` errors right after a fresh
  `npm install`**: stale `.next` build cache from before the reinstall.
  Fix: remove it (`wsl.exe -d Ubuntu -- bash -c 'rm -rf /home/cowen/projects/klarity/.next'`,
  or the Docker one-liner above if it's root-owned) and re-run `smoke.sh start`.
