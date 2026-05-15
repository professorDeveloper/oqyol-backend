FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.js ./

RUN npm ci --omit=dev
RUN npx prisma generate

COPY . .

EXPOSE 3000
CMD ["node", "src/server.js"]
