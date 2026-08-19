# Multi-stage build: compiles the React client, then runs the Express
# server (which also serves the built client) in a slim runtime image.
# Referenced by infra/ecs.tf as the image pushed to ECR for the Fargate task.

FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "src/index.js"]
