SHELL := /bin/bash

COMPOSE_VPS := infra/compose/docker-compose.vps.yml

.PHONY: help init up up-full down logs ps build-images \
        test test-spring test-node validate-compose validate-env quality sonar \
        deploy-local deploy-dev deploy-qa deploy-uat deploy-staging

help:
	@echo "Business Starter Kit commands"
	@echo "  make init               Copy .env.example to .env if missing"
	@echo "  make up                 Start lean infrastructure stack"
	@echo "  make up-full            Start infrastructure + application services (apps profile)"
	@echo "  make down               Stop the stack"
	@echo "  make logs               Follow Docker logs"
	@echo "  make ps                 Show running services"
	@echo "  make build-images       Build application Docker images"
	@echo "  make test               Run all unit tests + Compose validation"
	@echo "  make test-spring        Run Spring Boot tests"
	@echo "  make test-node          Run Node/web/worker workspace tests"
	@echo "  make validate-compose   Validate Docker Compose files"
	@echo "  make validate-env       Validate an env file (ENV_FILE=path, default .env)"
	@echo "  make quality            Run the full local quality gate"
	@echo "  make sonar              Run SonarQube analysis (skips if not configured)"
	@echo "  make deploy-dev         Restart the Dev environment stack"

init:
	@test -f .env || cp .env.example .env

up: init
	docker compose -f $(COMPOSE_VPS) up -d

up-full: init
	docker compose -f $(COMPOSE_VPS) --profile apps up -d

down:
	docker compose -f $(COMPOSE_VPS) --profile apps down

logs:
	docker compose -f $(COMPOSE_VPS) logs -f

ps:
	docker compose -f $(COMPOSE_VPS) --profile apps ps

build-images:
	docker compose -f $(COMPOSE_VPS) --profile apps build

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

validate-env:
	./scripts/quality/validate-env.sh $(ENV_FILE)

quality:
	./scripts/quality/run-all-tests.sh

sonar:
	./scripts/quality/run-sonar-scan.sh

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
