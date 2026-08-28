---
name: run-klarity
description: FALLBACK ONLY for when Docker Compose is blocked on this Windows/UNC session — Docker Compose (`docker compose up`) remains Klarity's primary day-to-day dev workflow. Use this skill's native-WSL-Node driver to start/build/check the Next.js app only if `docker compose up` itself fails to launch or fails to serve on this specific machine.
---

**Docker Compose is the project's primary way to run Klarity day-to-day** —
`docker compose up -d` (app + worker + postgres + redis), matching Phase 0 and
the CDC's deployment target (§3, §10). The worker/postgres/redis are Docker
regardless, so partially running just `app` natively defeats the point and
reintroduces the exact file-ownership conflicts this skill exists to avoid
(see Gotchas). **Reach for this skill only when Docker itself is blocked** on
this specific Windows/UNC session — e.g. the daemon won't respond, or a build
fails for reasons unrelated to app code — as a documented, already-debugged
fallback rather than rediscovering the fix from scratch.

Klarity is a Next.js 15 web app. This repo's working tree lives on a path Windows
only reaches through the `\\wsl.localhost\Ubuntu\...` UNC mount — but Node, npm,
and git are all fundamentally broken against that UNC path (see Gotchas). This
fallback driver runs **natively inside WSL** instead, dispatched via
`wsl.exe -d Ubuntu -- bash -c '...'`, against the real filesystem path
`/home/cowen/projects/klarity` — bypassing Docker (and its `app` container)
entirely, which is exactly why it must not be left running alongside Docker
(same port, same `.next`/`node_modules` paths on the host — see Gotchas).

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

- **Don't run this alongside `docker compose up`.** Both want port 3000 (this
  driver falls back to 3001 when 3000 is taken, which is usually *because*
  Docker's `app` container already holds it), and both write into
  `.next`/`node_modules` on the same host path — Docker's are anonymous
  volumes so they don't collide with a native run's files directly, but
  running native Node against the same bind-mounted directory Docker also
  writes to is exactly the kind of split-brain state that produces
  root-owned-file conflicts (see below). `smoke.sh stop` before switching
  back to `docker compose up`.

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
  (the normal "no match") a moment earlier.
- **`ps aux | awk '{print $2}'` to extract a PID gets mangled** crossing the
  wsl.exe Windows-argv boundary — confirmed empirically: it printed the
  `USER` column (`cowen`) instead of the PID column, causing `kill` to fail
  with `kill: failed to parse argument: 'cowen'`. Exact quoting root cause
  wasn't fully pinned down (single-quoting the awk program should in theory
  survive intact through nested `bash -c` calls, but doesn't in practice
  here). `smoke.sh stop` avoids both `pkill` and `ps|awk` and uses
  `kill $(pgrep -f 'next-server')` instead — `pgrep` needs no field
  extraction at all, sidestepping the bug class, and was reliable in
  repeated testing.
- **wsl.exe itself has occasional real connectivity hiccups** beyond the
  quoting issues above — trivial commands (`ps`, `pgrep`) sometimes just
  hang for the full timeout, or a `Wsl/Service/0x8007274c` connection error
  appears. Unrelated to this project; retry the command.
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
