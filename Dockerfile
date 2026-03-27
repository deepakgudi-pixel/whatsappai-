# 1. Use the official Puppeteer image (Includes Node.js + Chrome)
FROM ghcr.io/puppeteer/puppeteer:latest

# 2. Switch to root to handle file permissions
USER root
WORKDIR /app

# 3. Copy and Install dependencies
COPY package*.json ./
RUN npm install

# 4. Copy the rest of the code
COPY . .

# 5. FIX: Ensure the 'pptruser' has permission to write session data
RUN chown -R pptruser:pptruser /app

# 6. Switch back to the non-root user for security (Hugging Face Best Practice)
USER pptruser

# 7. Set Port for Hugging Face
ENV PORT=7860
EXPOSE 7860

# 8. Start the bot
CMD ["node", "index.js"]