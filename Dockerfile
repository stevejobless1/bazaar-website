# Build stage
FROM node:24-alpine AS build

WORKDIR /app

# Accept build arguments
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Install dependencies
COPY package*.json ./
# Using --legacy-peer-deps or --no-frozen-lockfile if needed, 
# but let's stick to standard npm install first.
RUN npm install

# Build the app
COPY . .
RUN export NODE_OPTIONS=--max-old-space-size=2048 && npm run build

# Production stage
FROM nginx:stable-alpine

# Install curl for healthcheck (wget is not available in alpine nginx)
RUN apk add --no-cache curl

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
