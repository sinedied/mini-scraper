#!/bin/bash

# Exit on error
set -e

# Variables
params=("$@")
model_name="gemma2:2b"
model_required=false

# Check if AI is required and get the model name
for arg in "$@"; do
    if [[ "$arg" == "-a" || "$arg" == "--ai" ]]; then
        model_required=true
    elif [[ "$arg" == "-m" || "$arg" == "--ai-model" ]]; then
        model_name="$2"
    fi
    shift
done

# If AI is required, start Ollama and download the model
if $model_required; then
    # Start Ollama in the background
    ollama serve &

    # Wait for Ollama to be ready
    until curl -s http://localhost:11434/api/tags > /dev/null; do
        echo "Waiting for Ollama to start..."
        sleep 2
    done

    # Download the model
    ollama pull "$model_name"
fi

# Run mscraper with the provided arguments
exec mscraper "${params[@]}"
