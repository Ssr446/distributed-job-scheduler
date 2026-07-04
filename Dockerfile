# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — install all deps (including devDeps needed for build)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy manifests first so npm ci layer is cached when only source changes
COPY package.json package-lock.json ./
COPY packages/api/package.json     ./packages/api/
COPY packages/worker/package.json  ./packages/worker/
COPY packages/dashboard/package.json ./packages/dashboard/

# Install *everything* (prod + dev) so the build step has tsc, vite, etc.
RUN npm ci --include=dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — build all three packages
# ─────────────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY . .

# Generate Prisma client (must run before tsc compiles api)
RUN cd packages/api && npx prisma generate

# Build API and Worker (TypeScript → dist/)
RUN npm run build -w packages/api
RUN npm run build -w packages/worker

# Build Dashboard (Vite → dist/). VITE_API_URL is baked in at build time;
# leave it empty so the browser falls back to a relative /api/v1 path that
# Nginx will proxy-pass to the same origin — works for any domain with zero
# config changes.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w packages/dashboard

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — API production image
# Render expects a single service that listens on $PORT (default 10000).
# We run migrations then start the server in one command.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS api
WORKDIR /app

# Copy only the runtime artefacts + root node_modules
COPY --from=builder /app/node_modules          ./node_modules
COPY --from=builder /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=builder /app/packages/api/dist     ./packages/api/dist
COPY --from=builder /app/packages/api/prisma   ./packages/api/prisma
COPY --from=builder /app/packages/api/package.json ./packages/api/

# Expose the default local dev port; Render overrides via $PORT at runtime.
EXPOSE 3000

# run migrations then seed (--skip-generate because the client was already
# generated in the builder stage), then start the server.
CMD ["sh", "-c", "cd packages/api && npx prisma migrate deploy && node dist/server.js"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 4 — Worker production image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS worker
WORKDIR /app

COPY --from=builder /app/node_modules           ./node_modules
COPY --from=builder /app/packages/worker/node_modules ./packages/worker/node_modules
COPY --from=builder /app/packages/worker/dist   ./packages/worker/dist
COPY --from=builder /app/packages/worker/package.json ./packages/worker/

CMD ["node", "packages/worker/dist/worker.js"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 5 — Dashboard static site (Nginx)
# Deploy this separately as a Render Static Site pointing to packages/dashboard/dist,
# OR keep it as an image and serve via Nginx (port 80).
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS dashboard
COPY --from=builder /app/packages/dashboard/dist /usr/share/nginx/html

# SPA routing: send all paths to index.html so React Router handles them.
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
  # Forward /api and /socket.io to the API service at runtime.\n\
  # Set API_BACKEND env var to your Render API service URL when running the container.\n\
  location /api/ {\n\
    proxy_pass ${API_BACKEND:-http://api:3000};\n\
    proxy_set_header Host $host;\n\
    proxy_set_header X-Real-IP $remote_addr;\n\
  }\n\
  location /socket.io/ {\n\
    proxy_pass ${API_BACKEND:-http://api:3000};\n\
    proxy_http_version 1.1;\n\
    proxy_set_header Upgrade $http_upgrade;\n\
    proxy_set_header Connection "upgrade";\n\
    proxy_set_header Host $host;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
