ARG NODE_VERSION=24
ARG ALPINE_VERSION=3.24

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION}

# Use production node environment by default.
ENV NODE_ENV=production

# install and use yarn 4.x
RUN corepack prepare yarn@4.17.0

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

# Install packages
RUN yarn workspaces focus --production && yarn cache clean

# Expose the port that the application listens on.
EXPOSE 8008

# Run the application.
ENTRYPOINT ["yarn", "run", "pm2", "start", "ecosystem.config.cjs", "--attach", "--env", "$NODE_ENV"]
