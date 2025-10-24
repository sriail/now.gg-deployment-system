FROM node:18-slim

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production || npm install --production

COPY src ./src
COPY .env.example .env.example

EXPOSE 3000
CMD ["node", "src/server.js"]
