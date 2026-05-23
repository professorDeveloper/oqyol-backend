FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.js ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
# Regenerate Prisma client at container start to guarantee it matches the schema.
# (BuildKit layer caching has been unreliable for prisma generate on this setup.)
CMD ["sh", "-c", "npx prisma generate && node src/server.js"]
