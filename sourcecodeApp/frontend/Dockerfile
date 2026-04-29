# Use Node 20 (you can use any version you need)
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps


# Copy the rest of your code
COPY . .

# Expose port 3000 (React default)
EXPOSE 3000

# Start React app
CMD ["npm", "start"]
