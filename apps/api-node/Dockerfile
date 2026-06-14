# syntax=docker/dockerfile:1
FROM node:20-alpine AS runtime
WORKDIR /app
# Install only production dependencies.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
# Run as the built-in non-root node user.
USER node
EXPOSE 3001
ENV PORT=3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
