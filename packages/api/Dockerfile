FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/
RUN npm install --workspace=packages/api

COPY packages/api ./packages/api
WORKDIR /app/packages/api
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/packages/api/node_modules ./node_modules
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/prisma ./prisma
COPY --from=builder /app/packages/api/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
