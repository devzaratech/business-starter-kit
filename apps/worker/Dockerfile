# syntax=docker/dockerfile:1
FROM node:20-alpine AS runtime
WORKDIR /app
COPY package.json ./
# Worker currently has no runtime dependencies; this stays valid if some are added.
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
USER node
# The worker writes a heartbeat file the healthcheck can read.
ENV WORKER_HEARTBEAT_FILE=/tmp/worker-heartbeat.json
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const fs=require('fs');const f=process.env.WORKER_HEARTBEAT_FILE||'/tmp/worker-heartbeat.json';try{const s=JSON.parse(fs.readFileSync(f));process.exit(Date.now()-s.ts<60000?0:1)}catch(e){process.exit(1)}"
CMD ["node", "src/index.js"]
