FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY prisma prisma
COPY src src
COPY data data
RUN npm ci && npm run db:generate && npm run build
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
EXPOSE 4000
CMD ["npm","start"]
