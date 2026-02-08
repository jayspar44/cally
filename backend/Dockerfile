FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY . .

# Run as non-root user (node user is included in node:22-slim)
USER node

# Cloud Run uses PORT env var (defaults to 8080)
EXPOSE 8080
ENV PORT=8080

CMD ["node", "src/index.js"]
