#
# Czech and EU legal research workspace.
#
#   make setup      first run: check the machine, install, configure, build
#   make doctor     is everything working, reachable and current?
#   make update     refresh whatever has gone stale
#
# Everything else is listed by `make help`.
#
SHELL := /bin/bash
NODE  ?= node
LEX   := mcp-servers/lex

.DEFAULT_GOAL := help
.PHONY: help setup install doctor status test test-aliases update update-check \
        index-uoou index-mzp index-justice index-status schedule unschedule \
        clean-cache clean-indexes check-private

## help: show this list
help:
	@echo ""
	@echo "  Czech and EU legal research workspace"
	@echo ""
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## /  /' | awk -F': ' '{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  First time here?  make setup"
	@echo ""

## setup: first run - check, install, configure, build the indexes
setup:
	@$(NODE) setup/setup.mjs

## install: install the MCP server's npm dependencies
install:
	@cd $(LEX) && npm install --no-audit --no-fund

## doctor: full health check, including whether the registries are reachable
doctor:
	@$(NODE) setup/doctor.mjs

## status: quick local status - no network, safe during a background build
status:
	@$(NODE) setup/status.mjs

## test: end-to-end test of every tool against the live registries
test:
	@$(NODE) $(LEX)/selftest.js

## test-aliases: additionally verify every act and CELEX alias resolves
test-aliases:
	@$(NODE) $(LEX)/selftest.js --aliases

## update: refresh indexes that have gone stale
update:
	@$(NODE) setup/update.mjs

## update-check: report staleness without changing anything
update-check:
	@$(NODE) setup/update.mjs --check

## index-uoou: rebuild the data protection authority's guidance index (seconds)
index-uoou:
	@$(NODE) tools/uoou-index.mjs build

## index-mzp: rebuild the environment ministry's guidance index (hours, resumable)
index-mzp:
	@$(NODE) tools/mzp-index.mjs build

## index-justice: build the lower-court index from FROM=YYYY-MM-DD
index-justice:
	@$(NODE) tools/justice-index.mjs build --from $(or $(FROM),$(shell date -v-1y +%Y-01-01 2>/dev/null || date -d '1 year ago' +%Y-01-01))

## index-status: what each index holds and how stale it is
index-status:
	@$(NODE) tools/uoou-index.mjs stats   2>/dev/null || true
	@$(NODE) tools/mzp-index.mjs stats    2>/dev/null || true
	@$(NODE) tools/justice-index.mjs stats 2>/dev/null || true

## schedule: install a weekly refresh (launchd on macOS, cron on Linux)
schedule:
	@$(NODE) setup/schedule.mjs install

## unschedule: remove the weekly refresh
unschedule:
	@$(NODE) setup/schedule.mjs remove

## check-private: verify no personal file is about to be committed
check-private:
	@$(NODE) setup/check-private.mjs

## clean-cache: delete the HTTP cache (safe; it is rebuilt on demand)
clean-cache:
	@rm -rf .cache && echo "  HTTP cache deleted."

## clean-indexes: delete the built indexes (they take hours to rebuild)
clean-indexes:
	@read -p "  Delete all built indexes? They take hours to rebuild. [y/N] " a; \
	 case "$$a" in [yY]*) rm -rf .data && echo "  Indexes deleted.";; *) echo "  Left alone.";; esac
