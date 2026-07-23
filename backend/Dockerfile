FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy all source files
COPY . .

# Set environment variable to production
ENV NODE_ENV=production

# The port is generally provided by cloud providers like Render via the PORT environment variable
# Exposing 5000 as a default fallback
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
