FROM node:22-bullseye

# Install dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install dependencies, build and install the CLI
RUN npm install && npm run build && npm install -g .

# Copy the entrypoint script
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Use the script as the entrypoint
ENTRYPOINT ["/entrypoint.sh"]
