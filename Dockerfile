FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Skip Cypress binary download during container build.
ENV CYPRESS_INSTALL_BINARY=0
RUN npm ci

FROM node:18-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/public ./public
COPY --from=build /app/fixtures ./fixtures
EXPOSE 3000
CMD ["./node_modules/.bin/remix-serve", "./build/index.js"]
