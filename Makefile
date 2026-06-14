SHELL := /bin/bash

.PHONY: help up down logs ps init

help:
	@echo "Business Starter Kit commands"
	@echo "  make up      Start lean VPS stack"
	@echo "  make down    Stop lean VPS stack"
	@echo "  make logs    Follow Docker logs"
	@echo "  make ps      Show running services"
	@echo "  make init    Copy .env.example to .env if missing"

init:
	@test -f .env || cp .env.example .env

up: init
	docker compose -f infra/compose/docker-compose.vps.yml up -d

down:
	docker compose -f infra/compose/docker-compose.vps.yml down

logs:
	docker compose -f infra/compose/docker-compose.vps.yml logs -f

ps:
	docker compose -f infra/compose/docker-compose.vps.yml ps
