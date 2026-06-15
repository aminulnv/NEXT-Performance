# NEXT-Performance — production container (Node.js + Express + Vite-built SPA)
# See DEPLOYMENT.md for build args, env vars, and platform wiring.

FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src

# Production builds must not bypass auth (see src/env.ts).
ARG VITE_BYPASS_AUTH=false
ENV VITE_BYPASS_AUTH=${VITE_BYPASS_AUTH}

RUN npm run build:app

FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup -S app && adduser -S app -G app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=build /app/dist ./dist

USER app

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
