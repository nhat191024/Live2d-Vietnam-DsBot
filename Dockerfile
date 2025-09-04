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

# Create logs directory
RUN mkdir -p logs

# Create a non-root user for security
RUN groupadd -r botuser && useradd -r -g botuser botuser

# Change ownership of the app directory to the new user
RUN chown -R botuser:botuser /app

# Switch to the non-root user
USER botuser

# Start the application
CMD ["pnpm", "start"]
