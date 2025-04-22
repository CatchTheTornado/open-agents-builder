# Stage 1: Base image
FROM node:22-bullseye AS base

# Install system dependencies
RUN apt-get update && \
    apt-get install -y python3-pip poppler-utils && \
    pip install markitdown && \
    apt-get clean

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install Node.js dependencies
RUN yarn install

# Expose default dev port
EXPOSE 3000

# Command to run dev server
CMD ["yarn", "dev"]
