# Build stage
FROM node:24-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
# Using --legacy-peer-deps or --no-frozen-lockfile if needed, 
# but let's stick to standard npm install first.
RUN npm install

# Build the app
COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config if we had one, but default is fine for SPA
# If using React Router, we need to handle client-side routing
RUN printf "server {\n  listen 80;\n  location / {\n    root /usr/share/nginx/html;\n    index index.html index.htm;\n    try_files \$uri \$uri/ /index.html;\n  }\n}\n" > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
