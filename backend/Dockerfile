FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Temporary URL for Prisma Client generation.
# Docker Compose supplies the actual database URL at runtime.
ENV DATABASE_URL="postgresql://deskops_user:deskops_dev_password@localhost:5432/deskops_db?schema=public"

RUN npm run db:generate

RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
