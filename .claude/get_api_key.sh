#!/bin/bash
# Reads the Anthropic API key from a local secrets file.
# The file .anthropic_key should contain only the API key on a single line.
KEY_FILE="$(dirname "$0")/../.anthropic_key"

if [ ! -f "$KEY_FILE" ]; then
  echo "Error: API key file not found at $KEY_FILE" >&2
  exit 1
fi

cat "$KEY_FILE"
