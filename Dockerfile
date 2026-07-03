# Base stage for common dependencies
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/api/package.json ./packages/api/
COPY packages/worker/package.json ./packages/worker/
COPY packages/dashboard/package.json ./packages/dashboard/
RUN npm ci

# Builder stage
FROM base AS builder
COPY . .
# Generate Prisma Client
RUN cd packages/api && npx prisma generate
# Build all packages
RUN npm run build

# --- API Production Image ---
FROM node:20-alpine AS api
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma
COPY --from=builder /app/packages/api/package.json ./packages/api/
EXPOSE 3000
CMD ["npm", "start", "-w", "packages/api"]

# --- Worker Production Image ---
FROM node:20-alpine AS worker
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/worker/node_modules ./packages/worker/node_modules
COPY --from=builder /app/packages/worker/dist ./packages/worker/dist
COPY --from=builder /app/packages/worker/package.json ./packages/worker/
CMD ["npm", "start", "-w", "packages/worker"]

# --- Dashboard Production Image (Nginx) ---
FROM nginx:alpine AS dashboard
COPY --from=builder /app/packages/dashboard/dist /usr/share/nginx/html
# SPA routing fallback
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
