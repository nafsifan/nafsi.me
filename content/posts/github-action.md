---
title: "GitHub Actions Self-Hosted Runner 部署实践"
slug: "github-action"
date: "2025-12-03"
description: "GitHub Actions Runner 在国内服务器上部署实践，包含 Docker 环境配置、Java/Maven 工具链集成,以及 CI/CD 自动化部署"
category: "笔记"
tags: ['GitHub Actions', 'Docker', 'CI/CD', 'Self-Hosted Runner', 'Java', 'Maven']
---

## 前言

最近帮团队伙伴搭建了 JAVA 项目的 CI/CD 自动化部署工作流，过程中遇到的问题:

1. **重复下载**: 每次构建都要从 Gihub 重新拉取 JDK、Maven,浪费大量时间
2. **打包到服务器**: Github Runner 打包构建完成后，上传到国内服务器速度慢

于是决定在自己的服务器上部署一个 Self-Hosted Runner,预装所有构建工具，同时持久化 Maven 本地仓库。

## 核心思路

**常规做法的问题:**
- 使用 GitHub 官方的 `actions/setup-java` 每次都要下载 JDK
- 使用 `actions/cache` 缓存 Maven 依赖,但首次构建还是慢
- 网络波动导致构建失败率高

**优化方案:**
- 基于 `myoung34/github-runner` 构建自定义镜像
- 预装 JDK 21 和 Maven 3.9.11
- 通过 Docker 卷映射持久化 Maven 本地仓库
- 所有下载都走国内镜像源

## 准备工作

### 1. 获取 Runner Token

首先需要在 GitHub 仓库中生成 Runner 注册令牌:

*仓库 Settings → Actions → Runners → New self-hosted runner*

选择对应的系统，我这里服务器是 Ubuntu 20.04, 选择 Linux x64

![new-runner](https://imgs.nafsi.me/blog/new-runner.png "new-runner")

### 2. 服务器环境准备

确保服务器已安装 Docker 和 Docker Compose:

```bash
# 检查版本
docker --version
docker-compose --version

# 创建工作目录
mkdir -p /data/github-runner/{_work,.m2,actions-temp}
```

**目录规划说明:**
- `/data/github-runner/_work`: GitHub Actions 的工作目录,存放代码和构建产物
- `/data/github-runner/.m2`: Maven 本地仓库,持久化依赖避免重复下载
- `/data/github-runner/actions-temp`: Actions 临时文件目录

## 构建自定义 Runner 镜像

### 编写 Dockerfile

创建 `Dockerfile`:

```dockerfile title="Dockerfile"
# 基于社区维护的 GitHub Runner 镜像
FROM myoung34/github-runner:latest

USER root

# 安装基础工具
RUN apt-get update && apt-get install -y \
    tar \
    curl \
    git \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# 安装 JDK 21 (使用清华大学 TUNA 镜像源)
ARG JDK_URL=https://mirrors.tuna.tsinghua.edu.cn/Adoptium/21/jdk/x64/linux/OpenJDK21U-jdk_x64_linux_hotspot_21.0.9_10.tar.gz
RUN mkdir -p /opt/java && \
    curl -fsSL "$JDK_URL" -o /opt/java/jdk.tar.gz && \
    tar -xzf /opt/java/jdk.tar.gz -C /opt/java && \
    rm /opt/java/jdk.tar.gz && \
    ln -s /opt/java/jdk-21* /opt/java/current

# 安装 Maven 3.9.11 (使用阿里云镜像源)
ARG MAVEN_VERSION=3.9.11
RUN curl -fsSL "https://mirrors.aliyun.com/apache/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz" \
    -o /opt/maven.tar.gz && \
    tar -xzf /opt/maven.tar.gz -C /opt && \
    ln -s /opt/apache-maven-${MAVEN_VERSION} /opt/maven && \
    rm /opt/maven.tar.gz

# 配置环境变量
ENV JAVA_HOME=/opt/java/current
ENV PATH=$JAVA_HOME/bin:/opt/maven/bin:$PATH

WORKDIR /actions-runner
```

### 构建镜像

```bash
# 构建自定义 Runner 镜像
docker build -t github-runner:latest .
```

## Docker Compose 配置

创建 `docker-compose.yml`:

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
      # Docker Socket 映射 - 允许容器内执行 docker 命令(Docker-in-Docker)
      - /var/run/docker.sock:/var/run/docker.sock
      # 工作目录映射 - 存放代码和构建产物
      - /data/github-runner/_work:/_work
      # Maven 本地仓库映射 - 持久化依赖避免重复下载
      - /data/github-runner/.m2:/home/runner/.m2
      # Actions 临时文件目录
      - /data/github-runner/actions-temp:/opt/actions/temp
```

### 启动 Runner

```bash
# 启动服务
docker-compose up -d

# 查看日志确认注册成功
docker-compose logs -f runner
```

此时在 GitHub 仓库的 *Settings → Actions → Runners* 页面应该能看到绿色的 "Idle" 状态。

![status-idle](https://imgs.nafsi.me/blog/status-idle.png "status-idle")

## GitHub Actions 工作流配置

创建 `.github/workflows/deploy.yml`:

```yaml title=".github/workflows/deploy.yml" {9}
name: CI/CD Deploy

on:
  push:
    branches: [ "main" ]

jobs:
  build-deploy:
    runs-on: self-hosted  # 指定使用自托管 Runner
    env:
      # 显式声明环境变量
      JAVA_HOME: /opt/java/current
      MAVEN_HOME: /opt/maven
      PATH: /opt/java/current/bin:/opt/maven/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

    steps:
      - uses: actions/checkout@v4

      # 验证工具链可用性
      - name: Verify toolchain
        run: |
          tar --version
          java -version
          mvn -v

      # Maven 构建
      - name: Build with Maven
        run: mvn -B -T1C package --file pom.xml

      # Docker 部署
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

      # 清理悬空镜像
      - name: Clean dangling Docker images
        run: docker image prune -f
```

## Docker-in-Docker 原理解析

为什么在 `github-runner` 容器内能执行 `docker build` 和 `docker run` 部署另一个容器?

### 核心原理

这里并不是真正的 "容器套容器",而是通过 **Docker Socket 共享** 实现的:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock  # 关键配置
```

通过将宿主机的 Docker Socket 映射到容器内,容器内的 `docker` 命令实际上是在调用 **宿主机的 Docker Daemon**,所有新创建的容器都运行在宿主机层面,与 `github-runner` 容器平级。

### 完整流程解析

![workflow-mermaid](https://imgs.nafsi.me/blog/workflow-mermaid.png "workflow-mermaid")

**关键步骤说明:**

1. **构建阶段**: GitHub Actions 触发 `docker build` 命令
2. **请求转发**: Runner 容器内的 Docker Client 通过映射的 Socket 将请求发送到宿主机
3. **镜像构建**: 宿主机的 Docker Daemon 执行实际的镜像构建工作
4. **容器创建**: `docker run` 同样通过 Socket 转发,在宿主机层面创建新容器

## 参考资料

- [GitHub Actions Self-Hosted Runners 官方文档](https://docs.github.com/en/actions/hosting-your-own-runners)
- [myoung34/docker-github-actions-runner](https://github.com/myoung34/docker-github-actions-runner)
