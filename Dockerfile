FROM node:24-alpine as installer

WORKDIR app

COPY package*.json .

RUN npm install

FROM node:24-alpine as builder

WORKDIR app

COPY --from=installer app .
COPY . .

RUN npm run build

FROM node:24-alpine

WORKDIR app

COPY --from=builder app/dist .

RUN ls -la

CMD [ "node", "index.js" ]
