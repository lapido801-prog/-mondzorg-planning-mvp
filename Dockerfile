FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=10000
ENV DATA_DIR=/var/data

EXPOSE 10000

CMD ["npm", "start"]
