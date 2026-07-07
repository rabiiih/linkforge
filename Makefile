.PHONY: up down dev logs test sh psql clean

up:            ## Start full stack (production-like)
	docker compose -f compose.yaml up -d --build

dev:           ## Start with dev override (hot reload, exposed DB)
	docker compose up --build

down:          ## Stop everything
	docker compose down

logs:          ## Tail all logs
	docker compose logs -f

test:          ## Run unit tests locally
	npm test

sh:            ## Shell into the API container
	docker compose exec api sh

psql:          ## Open psql inside the DB container
	docker compose exec db psql -U $${DB_USER:-linkforge} $${DB_NAME:-linkforge}

clean:         ## Stop AND delete volumes (destroys data)
	docker compose down -v
