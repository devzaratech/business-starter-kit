FROM dunglas/frankenphp:1-php8.4-bookworm

WORKDIR /app

ENV APP_ENV=dev

COPY public /app/public
COPY Caddyfile /etc/frankenphp/Caddyfile

EXPOSE 8000
