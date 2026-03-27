# Use the official Puppeteer image which includes Chrome and Node.js
FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to ensure we have permissions to install and copy
USER root
WORKDIR /app

# Copy package files first to leverage Docker's cache
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Hugging Face Spaces always uses port 7860
ENV PORT=7860
EXPOSE 7860

# Command to start your bot
CMD ["node", "index.js"]