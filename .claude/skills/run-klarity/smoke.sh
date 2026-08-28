#!/usr/bin/env bash
# Driver for /run-klarity. Runs from a Windows Git-Bash/PowerShell session
# whose cwd is the \\wsl.localhost\... UNC mount of this repo. Everything
# that touches node/npm/git is dispatched into the WSL distro via wsl.exe
# so it runs against the real filesystem, never the UNC path — see SKILL.md
# "Gotchas" for why that distinction matters.
#
# Usage:
#   bash .claude/skills/run-klarity/smoke.sh setup    # one-time: native node + npm install
#   bash .claude/skills/run-klarity/smoke.sh start     # launch dev server in background
#   bash .claude/skills/run-klarity/smoke.sh check     # curl key routes, print pass/fail
#   bash .claude/skills/run-klarity/smoke.sh stop      # kill the dev server
#
# Must be run with MSYS_NO_PATHCONV=1 in the environment (Git Bash otherwise
# mangles the leading /home/... path before it reaches wsl.exe).

set -euo pipefail

DISTRO="Ubuntu"
WSL_PROJECT="/home/cowen/projects/klarity"
NODE_HOME="/home/cowen/.local/node"
NODE_VERSION="22.14.0"
WSL_PATH="$NODE_HOME/bin:/usr/bin:/bin:/usr/local/bin"
DEV_LOG="/tmp/klarity-dev.log"
PORT="3001" # Next.js falls back here when 3000 is taken; check the log for the real port.

wrun() {
  MSYS_NO_PATHCONV=1 wsl.exe -d "$DISTRO" -- bash -c "export PATH='$WSL_PATH'; cd '$WSL_PROJECT' && $1"
}

cmd="${1:-}"

case "$cmd" in
  setup)
    wrun "test -x $NODE_HOME/bin/node" || {
      echo "Installing native Linux Node $NODE_VERSION into $NODE_HOME ..."
      wrun "cd /tmp && curl -sL -o node.tar.xz https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz && tar xf node.tar.xz && mkdir -p \$(dirname $NODE_HOME) && rm -rf $NODE_HOME && mv node-v${NODE_VERSION}-linux-x64 $NODE_HOME"
    }
    wrun "node -v && npm -v"
    echo "Running npm install (native, no --ignore-scripts needed)..."
    wrun "npm install --no-audit --no-fund"
    ;;

  start)
    if wrun "curl -sf http://localhost:$PORT/ -o /dev/null"; then
      echo "Already up on http://localhost:$PORT/ -- not relaunching (run 'stop' first to restart)."
      exit 0
    fi
    # The trailing `sleep 2` matters: without it, the wsl.exe invocation can
    # tear down the session before the backgrounded+disowned process finishes
    # detaching, silently killing it (observed: 0-byte log, no process).
    wrun "setsid nohup node node_modules/next/dist/bin/next dev > $DEV_LOG 2>&1 < /dev/null & disown -a; sleep 2"
    echo "Waiting for dev server..."
    for i in $(seq 1 30); do
      if wrun "curl -sf http://localhost:$PORT/ -o /dev/null"; then
        echo "Up on http://localhost:$PORT/"
        exit 0
      fi
      sleep 1
    done
    echo "Server did not come up in 30s -- tail of $DEV_LOG:"
    wrun "tail -n 40 $DEV_LOG"
    exit 1
    ;;

  check)
    fail=0
    check_one() {
      local path="$1" expect="$2"
      code=$(wrun "curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT$path")
      if [ "$code" = "$expect" ]; then
        echo "OK   $path -> $code"
      else
        echo "FAIL $path -> $code (expected $expect)"
        fail=1
      fi
    }
    check_one "/" 200
    check_one "/connexion" 200
    check_one "/inscription" 200
    check_one "/legal/Klarity_CGU.docx" 200
    check_one "/legal/Klarity_Mentions_Legales.docx" 200
    check_one "/legal/Klarity_Politique_Confidentialite.docx" 200
    exit $fail
    ;;

  stop)
    # Avoid pkill (intermittently returns odd exit codes through wsl.exe even
    # with `|| true`) and avoid ps+awk+xargs (the awk '{print $2}' field
    # extraction gets mangled crossing the wsl.exe Windows-argv boundary --
    # confirmed empirically: it printed the USER column instead of the PID).
    # pgrep needs no field extraction, sidestepping the whole bug class.
    wrun "kill \$(pgrep -f 'next-server') 2>/dev/null || true"
    echo "Stopped."
    ;;

  *)
    echo "Usage: $0 {setup|start|check|stop}" >&2
    exit 1
    ;;
esac
