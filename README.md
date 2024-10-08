# Maven Repository Mirroring and Caching Tool

This repository provides a solution for mirroring and caching multiple Maven repositories, providing a unified endpoint.This endpoint can then be utilized in `gradle.build` files to streamline your Gradle-based projects.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Introduction

Managing multiple Maven repositories can become cumbersome, especially when dealing with Gradle projects. This project aims to simplify the process by creating a unified endpoint that mirrors and caches the artifacts from various Maven repositories. This can lead to reduced build times and improved overall development efficiency.

## Features

- **Unified Endpoint**: Access all your Maven dependencies through a single, local endpoint.
- **Caching**: Store downloaded artifacts locally to minimize redundant network requests.
- **Mirroring**: Mirror remote Maven repositories for offline development and increased reliability.
- **Customization**: Configure the tool to handle specific repositories and dependencies.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following prerequisites:

- [Node.js](https://nodejs.org/) installed.
- [Yarn](https://classic.yarnpkg.com/en/docs/install/) installed.

### Installation

Follow these steps to set up the Maven repository mirroring and caching project:

1. Clone the repository:

```bash
git clone https://github.com/hexboy/maven-mirror-tool.git
cd maven-mirror-tool
```

2. Install dependencies using Yarn:

```bash
yarn install
```

### Configuration

1. Duplicate the `config.yml` file and rename the copy to `config.local.yml` in the project root directory.
2. Open the `config.local.yml` file.
3. Customize the `REPOSITORIES` array to include the Maven repositories you want to mirror and cache.
4. Modify any other settings as needed, such as port number or caching options or proxy servers.

Here's an example configuration snippet:

```yaml
PROXIES:
  fodev: # The key is utilized in the proxy section of the repository configuration.
    host: fodev.org
    port: 8118
    protocol: http # The following protocols are supported: http, https, and socks.

  private:
    host: myserver.com
    port: 1080
    protocol: socks
    auth:                  # optional: Authentication info
      username: myusername #
      password: mypassword #

  local:
    host: 127.0.0.1
    port: 1080
    protocol: socks

REPOSITORIES:
  - name: central
    url: https://repo1.maven.org/maven2
    fileTypes:   # optional: FileTypes can be specified to be cached.
      - '.jar'   #
      - '.aar'   #
    proxy: fodev # optional: Select a proxy server

  - name: private-repo
    url: https://repo.mycompany.com/maven
    auth:                  # optional: Authentication info
      username: myusername #
      password: mypassword #
```

## Usage

1. Start the Maven Repository Mirroring and Caching Tool:

```bash
yarn start
```

2. Update your Gradle `build.gradle` files to use the local endpoint for Maven dependencies:

```groovy
buildscript {
    repositories {
        mavenLocal();
        maven { url "http://127.0.0.1:8008/v1"; allowInsecureProtocol true } // Replace with your configured port
        ...
    }
}
allprojects {
    buildscript {
        repositories {
            mavenLocal()
            maven { url "http://127.0.0.1:8008/v1"; allowInsecureProtocol true }
            ...
        }
    }
    repositories {
        mavenLocal()
        maven { url "http://127.0.0.1:8008/v1"; allowInsecureProtocol true }
        ...
    }
}
```

3. Run your Gradle builds as usual. The tool will intercept and resolve dependencies from the local endpoint, caching them if needed.

## Using the Docker Image

You can also run the Maven Repository Mirroring and Caching Tool using Docker. This can simplify deployment and ensure consistency across different environments.

To use the Docker image `hexboy2011/maven-mirror-tool:latest`, follow these steps:

1. Pull the Docker image:

```bash
docker pull hexboy2011/maven-mirror-tool:latest
```

2. Run the Docker container, mapping port 8008 and binding the cache directory:

```bash
docker run -d \
-p 8008:8008 \
-v /your/custom/cache/dir:/home/node/app/local-cache \
-v /your/config.local.yml:/home/node/app/config.local.yml \
hexboy2011/maven-mirror-tool:latest
```

### In this example

- `-d`: Starts the container as a daemon, running it in the background.

- `-p 8008:8008`: Maps port 8008 on your host to port 8008 in the container.

- `-v /your/custom/cache/dir:/home/node/app/local-cache`: Binds the directory /your/custom/cache/dir on your host to /home/node/app/local-cache in the container, allowing the container to store cached artifacts locally.

- `-v /your/config.local.yml:/home/node/app/config.local.yml`: Binds the file /your/config.local.yml on your host to /home/node/app/config.local.yml in the container, allowing the container to use your custom config file.

## Contributing

Contributions are welcome! If you find any issues or would like to enhance the project, feel free to submit a pull request. Please follow the existing code style and provide clear commit messages.

## License

This project is licensed under the [MIT License](LICENSE), allowing you to use, modify, and distribute the code freely. Make sure to read and understand the license terms before using the project.

---

By following this README, you should be able to set up and use the Maven Repository Mirroring and Caching Tool for your Gradle projects seamlessly. If you encounter any issues or have further questions, don't hesitate to reach out to the project contributors.
