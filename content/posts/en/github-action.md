---
title: "Deploying a Self-Hosted GitHub Actions Runner: A Practical Guide"
slug: "github-action"
date: "2025-12-03"
description: "A practical guide to deploying a GitHub Actions Runner on a server in mainland China, covering Docker setup, Java/Maven toolchain integration, and automated CI/CD pipelines."
category: "笔记"
tags: ['GitHub Actions', 'Docker', 'CI/CD', 'Self-Hosted Runner', 'Java', 'Maven']
summary: "While setting up automated Java deployments for our team, I grew tired of the painfully slow network speeds caused by re-downloading the JDK and dependencies on every run. I opted to run a self-hosted Runner via Docker directly on our server—pre-configuring the environment, persisting Maven cache, and enabling seamless deployment. Here is the complete setup guide and hard-learned troubleshooting tips."
---

## Introduction

Recently, while helping my team set up a CI/CD automated deployment workflow for a Java project, I ran into two major pain points:

1. **Redundant Downloads**: Every build downloaded the JDK and Maven from scratch via GitHub, wasting a massive amount of time.
2. **Artifact Transfer Bottlenecks**: Once GitHub's hosted runner finished packaging the application, uploading the artifacts to our domestic server was painfully slow due to cross-border network constraints.

To eliminate these bottlenecks, I decided to deploy a Self-Hosted Runner directly on our server, pre-installing all the required build tools and persisting the local Maven cache.

## Core Strategy

**Problems with the Standard Approach:**
- Relying on GitHub's official `actions/setup-java` requires downloading the JDK on every run.
- Using `actions/cache` caches Maven dependencies, but initial builds remain slow, and cache restore/save actions add network overhead.
- Cross-border network instability often causes builds to fail.

**The Optimized Strategy:**
- Build a custom Docker image based on `myoung34/github-runner`.
- Pre-install JDK 21 and Maven 3.9.11 directly inside the image.
- Persist the local Maven repository across builds via Docker volume mounts.
- Route all toolchain and dependency downloads through mainland China mirror sources.

## Prerequisites

### 1. Obtain a Runner Token

First, generate a runner registration token in your GitHub repository:

*Repository Settings → Actions → Runners → New self-hosted runner*

Select the corresponding operating system and architecture. Since my server runs Ubuntu 20.04, I selected **Linux x64**.

![new-runner](https://imgs.nafsi.me/blog/new-runner.png "new-runner")

### 2. Prepare the Server Environment

Ensure that Docker and Docker Compose are installed on your server:

```bash
# Verify versions
docker --version
docker-compose --version

# Create working directories
mkdir -p /data/github-runner/{_work,.m2,actions-temp}
```

**Directory Structure Overview:**
- `/data/github-runner/_work`: GitHub Actions working directory, holding source checkouts and build artifacts.
- `/data/github-runner/.m2`: Local Maven repository, persisting dependencies to prevent repetitive downloads.
- `/data/github-runner/actions-temp`: Directory for Actions temporary runtime files.

## Building the Custom Runner Image

### Creating the Dockerfile

Create a `Dockerfile`:

```dockerfile title="Dockerfile"
# Base image from the community-maintained GitHub Runner
FROM myoung34/github-runner:latest

USER root

# Install basic utilities
RUN apt-get update && apt-get install -y \
    tar \
    curl \
    git \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install JDK 21 (using Tsinghua TUNA mirror)
ARG JDK_URL=https://mirrors.tuna.tsinghua.edu.cn/Adoptium/21/jdk/x64/linux/OpenJDK21U-jdk_x64_linux_hotspot_21.0.9_10.tar.gz
RUN mkdir -p /opt/java && \
    curl -fsSL "$JDK_URL" -o /opt/java/jdk.tar.gz && \
    tar -xzf /opt/java/jdk.tar.gz -C /opt/java && \
    rm /opt/java/jdk.tar.gz && \
    ln -s /opt/java/jdk-21* /opt/java/current

# Install Maven 3.9.11 (using Aliyun mirror)
ARG MAVEN_VERSION=3.9.11
RUN curl -fsSL "https://mirrors.aliyun.com/apache/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz" \
    -o /opt/maven.tar.gz && \
    tar -xzf /opt/maven.tar.gz -C /opt && \
    ln -s /opt/apache-maven-${MAVEN_VERSION} /opt/maven && \
    rm /opt/maven.tar.gz

# Configure environment variables
ENV JAVA_HOME=/opt/java/current
ENV PATH=$JAVA_HOME/bin:/opt/maven/bin:$PATH

WORKDIR /actions-runner
```

### Building the Image

```bash
# Build the custom Runner image
docker build -t github-runner:latest .
```

## Docker Compose Configuration

Create `docker-compose.yml`:

```yaml title="docker-compose.yml"
version: '3'

services:
  runner:
    image: github-runner:latest
    container_name: github-runner
    restart: always
    environment:
      REPO_URL: "https://github.com/YOUR_ORG/YOUR_REPO"
      RUNNER_NAME: "github-runner"
      RUNNER_TOKEN: "YOUR_RUNNER_TOKEN"
      RUNNER_WORKDIR: "/_work"
    volumes:
      # Docker Socket mount - allows running docker commands inside the container (Docker-out-of-Docker)
      - /var/run/docker.sock:/var/run/docker.sock
      # Working directory mount - stores source code and build outputs
      - /data/github-runner/_work:/_work
      # Maven local repository mount - persists dependencies to avoid re-downloading
      - /data/github-runner/.m2:/home/runner/.m2
      # Actions temporary files directory
      - /data/github-runner/actions-temp:/opt/actions/temp
```

### Starting the Runner

```bash
# Start the service
docker-compose up -d

# Follow logs to verify successful registration
docker-compose logs -f runner
```

At this point, visiting *Settings → Actions → Runners* in your GitHub repository should display the runner with a green **Idle** status badge.

![status-idle](https://imgs.nafsi.me/blog/status-idle.png "status-idle")

## GitHub Actions Workflow Configuration

Create `.github/workflows/deploy.yml`:

```yaml title=".github/workflows/deploy.yml" {9}
name: CI/CD Deploy

on:
  push:
    branches: [ "main" ]

jobs:
  build-deploy:
    runs-on: self-hosted  # Target the self-hosted Runner
    env:
      # Explicitly declare environment variables
      JAVA_HOME: /opt/java/current
      MAVEN_HOME: /opt/maven
      PATH: /opt/java/current/bin:/opt/maven/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

    steps:
      - uses: actions/checkout@v4

      # Verify toolchain availability
      - name: Verify toolchain
        run: |
          tar --version
          java -version
          mvn -v

      # Build with Maven
      - name: Build with Maven
        run: mvn -B -T1C package --file pom.xml

      # Deploy application with Docker
      - name: Deploy app with Docker
        run: |
          docker stop my-app || true
          docker rm my-app || true
          docker build -t my-app:latest .
          docker run -d -p 8888:8888 \
            --name my-app \
            --network app-network \
            --restart always \
            my-app:latest

      # Clean up dangling images
      - name: Clean dangling Docker images
        run: docker image prune -f
```

## Understanding Docker-in-Docker (DooD)

How can the `github-runner` container run `docker build` and `docker run` to deploy another container on the host?

### Core Concept

This setup is not true nested virtualization ("Docker-in-Docker"); rather, it uses **Docker Socket Sharing** (commonly known as Docker-outside-of-Docker):

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock  # Key configuration
```

By mounting the host's Docker socket into the runner container, the `docker` CLI inside the container communicates directly with the **host's Docker daemon**. Consequently, all newly created containers run at the host level, side-by-side with the `github-runner` container itself.

### Workflow Breakdown

![workflow-mermaid](https://imgs.nafsi.me/blog/workflow-mermaid.png "workflow-mermaid")

**Key Step Explanations:**

1. **Trigger Phase**: The GitHub Actions runner executes a `docker build` command.
2. **Request Forwarding**: The Docker client inside the runner container sends the build request to the host through the mounted Unix socket.
3. **Image Building**: The host's Docker daemon builds and stores the image directly on the host machine.
4. **Container Instantiation**: Similarly, `docker run` commands are delegated over the socket, spinning up the new application container as a sibling container on the host.

## References

- [GitHub Actions Self-Hosted Runners Official Documentation](https://docs.github.com/en/actions/hosting-your-own-runners)
- [myoung34/docker-github-actions-runner](https://github.com/myoung34/docker-github-actions-runner)
