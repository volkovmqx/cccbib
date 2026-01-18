# syntax=docker/dockerfile:1

# Build stage: compile static assets
FROM node:25-alpine AS builder
WORKDIR /app

# Install dependencies with Yarn (classic)
COPY package.json yarn.lock ./
RUN apk add --no-cache yarn \
	&& yarn install --frozen-lockfile

# Copy source and build
COPY . .
ENV NODE_ENV=production
RUN yarn build

# Runtime stage: serve via Nginx
FROM nginx:1.27-alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace default server config with SPA-friendly config
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]