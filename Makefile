SHELL := /bin/bash

.PHONY: help init up down logs ps test test-spring test-node validate-compose deploy-local deploy-dev deploy-qa deploy-uat deploy-staging

help:
	@echo "Business Starter Kit commands"
	@echo "  make init               Copy .env.example to .env if missing"
	@echo "  make up                 Start lean VPS stack"
	@echo "  make down               Stop lean VPS stack"
	@echo "  make logs               Follow Docker logs"
	@echo "  make ps                 Show running services"
	@echo "  make test               Run all available unit tests"
	@echo "  make test-spring        Run Spring Boot tests"
	@echo "  make test-node          Run Node/web/worker workspace tests"
	@echo "  make validate-compose   Validate Docker Compose files"
	@echo "  make deploy-dev         Restart the Dev environment stack"

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

test: test-spring test-node validate-compose

test-spring:
	cd apps/api-spring && mvn --batch-mode test

test-node:
	npm install
	npm test

validate-compose:
	for file in infra/compose/docker-compose.*.yml; do \
		echo "Validating $$file"; \
		docker compose -f "$$file" config >/dev/null; \
	done

deploy-local:
	./scripts/deploy/restart-compose.sh local

deploy-dev:
	./scripts/deploy/restart-compose.sh dev

deploy-qa:
	./scripts/deploy/restart-compose.sh qa

deploy-uat:
	./scripts/deploy/restart-compose.sh uat

deploy-staging:
	./scripts/deploy/restart-compose.sh staging
