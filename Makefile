SHELL := /bin/bash

COMPOSE_VPS := infra/compose/docker-compose.vps.yml
SUPABASE_ENV ?= local
ifneq ($(origin ENV), undefined)
SUPABASE_ENV := $(ENV)
endif

.PHONY: help init up up-full down logs ps build-images \
        test test-spring test-node architecture-check validate-compose validate-env quality sonar \
        env-local env-dev env-qa env-uat env-staging env-prod deploy-local deploy-dev deploy-qa deploy-uat deploy-staging deploy-prod supabase-use supabase-start supabase-stop supabase-status supabase-db-reset supabase-studio supabase-studio-enable supabase-studio-disable

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
	@echo "  make architecture-check Validate BSK module manifests and dependency rules"
	@echo "  make validate-compose   Validate Docker Compose files"
	@echo "  make validate-env       Validate an env file (ENV_FILE=path, default .env)"
	@echo "  make env-dev            Create config/env/.env.dev from its template if missing"
	@echo "  make quality            Run the full local quality gate"
	@echo "  make sonar              Run SonarQube analysis (skips if not configured)"
	@echo "  make deploy-dev         Restart the Dev environment stack"
	@echo "  make deploy-prod        Restart Prod only with CONFIRM_PROD_DEPLOY=yes"
	@echo "  make supabase-use ENV=dev              Generate Supabase config for an environment"
	@echo "  make supabase-start ENV=dev            Start Supabase CLI stack for an environment"
	@echo "  make supabase-studio                   Print the active Supabase Studio URL"
	@echo "  make supabase-studio-enable ENV=prod   Enable Studio in active config; prod requires CONFIRM_SUPABASE_PROD_STUDIO=yes"
	@echo "  make supabase-studio-disable ENV=prod  Disable Studio in active config"

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
	npm ci
	npm test

architecture-check:
	npm run architecture:check

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


env-local:
	@test -f config/env/.env.local || cp config/env/.env.local.example config/env/.env.local
	@echo "Created config/env/.env.local if it was missing. Replace placeholders before deployment."

env-dev:
	@test -f config/env/.env.dev || cp config/env/.env.dev.example config/env/.env.dev
	@echo "Created config/env/.env.dev if it was missing. Replace placeholders before deployment."

env-qa:
	@test -f config/env/.env.qa || cp config/env/.env.qa.example config/env/.env.qa
	@echo "Created config/env/.env.qa if it was missing. Replace placeholders before deployment."

env-uat:
	@test -f config/env/.env.uat || cp config/env/.env.uat.example config/env/.env.uat
	@echo "Created config/env/.env.uat if it was missing. Replace placeholders before deployment."

env-staging:
	@test -f config/env/.env.staging || cp config/env/.env.staging.example config/env/.env.staging
	@echo "Created config/env/.env.staging if it was missing. Replace placeholders before deployment."

env-prod:
	@test -f config/env/.env.prod || cp config/env/.env.prod.example config/env/.env.prod
	@echo "Created config/env/.env.prod if it was missing. Replace every placeholder before deployment."

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


deploy-prod:
	@if [[ "$(CONFIRM_PROD_DEPLOY)" != "yes" ]]; then echo "Refusing production deploy. Re-run with CONFIRM_PROD_DEPLOY=yes after reviewing config/env/.env.prod."; exit 1; fi
	./scripts/deploy/restart-compose.sh prod


supabase-use:
	./scripts/supabase/use-env.sh $(SUPABASE_ENV)

supabase-start:
	./scripts/supabase/start.sh $(SUPABASE_ENV)

supabase-stop:
	./scripts/supabase/supabase-cli.sh stop

supabase-status:
	./scripts/supabase/supabase-cli.sh status

supabase-db-reset:
	./scripts/supabase/use-env.sh $(SUPABASE_ENV)
	supabase db reset

supabase-studio:
	./scripts/supabase/studio-url.sh

supabase-studio-enable:
	./scripts/supabase/toggle-studio.sh enable $(SUPABASE_ENV)

supabase-studio-disable:
	./scripts/supabase/toggle-studio.sh disable $(SUPABASE_ENV)
