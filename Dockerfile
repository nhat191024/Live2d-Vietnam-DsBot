# Use the official Node.js 18 LTS image based on Debian
FROM node:18-bullseye-slim

# Set the working directory inside the container
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@10.12.4

# Copy package.json and pnpm-lock.yaml first for better caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy the rest of the application code
COPY . .

# Create a non-root user for security
RUN groupadd -r botuser && useradd -r -g botuser botuser

# Create logs directory and set proper permissions
RUN mkdir -p logs && chown -R botuser:botuser /app && chmod -R 755 /app/logs

# Switch to the non-root user
USER botuser

# Verify permissions (optional, for debugging)
RUN ls -la logs/

# Start the application
CMD ["pnpm", "start"]
