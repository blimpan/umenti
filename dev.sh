#!/bin/bash
SESSION="metis"
ROOT=$(pwd)
PINO_PRETTY="$ROOT/node_modules/.bin/pino-pretty"

# Kill existing session if any
tmux kill-session -t $SESSION 2>/dev/null

# Clear logs from previous session
rm -f "$ROOT/apps/api/logs/llm.log" "$ROOT/apps/api/logs/prisma.log"

# Window 0: Frontend
tmux new-session -d -s $SESSION -n "frontend"
tmux send-keys -t $SESSION:0 "pnpm --filter './apps/web' dev" Enter

# Window 1: Backend — general logs (HTTP requests, auth, route errors) via stdout
tmux new-window -t $SESSION -n "backend"
tmux send-keys -t $SESSION:1 "pnpm --filter './apps/api' dev | $PINO_PRETTY" Enter

# Window 2: LLM — course generation pipeline
tmux new-window -t $SESSION -n "llm"
tmux send-keys -t $SESSION:2 "tail -F $ROOT/apps/api/logs/llm.log | $PINO_PRETTY" Enter

# Window 3: Prisma — database queries
tmux new-window -t $SESSION -n "prisma"
tmux send-keys -t $SESSION:3 "tail -F $ROOT/apps/api/logs/prisma.log | $PINO_PRETTY" Enter

# Mouse support — scroll with mouse wheel at any time
tmux set-option -t $SESSION mouse on

# Ctrl+A / Ctrl+D — navigate windows left/right (no prefix needed)
tmux bind-key -n C-a previous-window
tmux bind-key -n C-d next-window

# Ctrl+B, Ctrl+C — kill entire session (all processes)
tmux bind-key -T prefix C-c kill-session -t $SESSION

# Status bar with controls reference
tmux set-option -t $SESSION status-position bottom
tmux set-option -t $SESSION status-style "bg=colour235,fg=colour245"
tmux set-option -t $SESSION status-left ""
tmux set-option -t $SESSION status-right " [Ctrl+A/D] switch · [Ctrl+B d] detach · [z] zoom · [Ctrl+B Ctrl+C] quit all "
tmux set-option -t $SESSION status-right-length 75

# Focus window 1
tmux select-window -t $SESSION:1
tmux attach-session -t $SESSION
