# syntax=docker/dockerfile:1
FROM nginx:1.27-alpine

# Remove the default site
RUN rm -f /etc/nginx/conf.d/default.conf

# App files
COPY . /usr/share/nginx/html

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost/ || exit 1

EXPOSE 80