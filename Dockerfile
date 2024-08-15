ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine

# Use production node environment by default.
ENV NODE_ENV production

# install and use yarn 4.x
RUN corepack prepare yarn@4.3.1

# Run as a root user.
USER root

# Init local-cache dir
RUN mkdir -p /home/node/app/local-cache
RUN chown -R node:node /home/node/app

# Set working directory
WORKDIR /home/node/app

# Run the application as a non-root user.
USER node

# Copy the rest of the source files into the image.
COPY --chown=node . .

# Expose the port that the application listens on.
EXPOSE 8008

# Run the application.
CMD yarn workspaces focus --production && yarn run pm2 start --attach --env ${NODE_ENV}
