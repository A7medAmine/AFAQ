FROM node:20-alpine AS build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server.js ./

RUN mkdir -p /data/uploads && ln -s /data/uploads ./upload

EXPOSE 80
ENV PORT=80
ENV NODE_ENV=production
VOLUME /data/uploads
CMD ["node", "server.js"]
