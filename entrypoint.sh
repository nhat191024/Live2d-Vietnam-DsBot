#!/bin/bash
set -e

# Create logs directory if it doesn't exist
mkdir -p /app/logs

# Fix permissions for the logs directory
echo "Fixing permissions for logs directory..."
chown -R botuser:botuser /app/logs

# Execute the command passed to docker run as botuser
exec runuser -u botuser -- "$@"
