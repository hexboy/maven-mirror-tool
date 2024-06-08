FROM node:22-alpine AS builder

USER node

RUN mkdir -p /home/node/app

WORKDIR /home/node/app

COPY --chown=node . .
# Building the production-ready application code - alias to 'nest build'
RUN yarn install --production

FROM node:22-alpine

USER node

WORKDIR /home/node/app

RUN mkdir -p /home/node/app/local-cache
COPY --from=builder --chown=node /home/node/app/node_modules ./node_modules

COPY --from=builder --chown=node /home/node/app/src ./src
COPY --from=builder --chown=node /home/node/app/package.json .

COPY config.yml .
COPY ecosystem.config.js .

EXPOSE 8008
CMD [ "yarn", "start" ]