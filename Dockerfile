FROM node:24-alpine as builder

WORKDIR app
COPY package*.json .

RUN npm ci

FROM node:24-alpine

WORKDIR app

COPY --from=builder app .
COPY . .

RUN ls -la

CMD [ "node", "index.ts" ]
