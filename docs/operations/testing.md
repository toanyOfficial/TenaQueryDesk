# Regression, staging and deployment verification

## Test layers

- `bun run test:unit`: fast server unit and service tests with no production dependency.
- `bun run test:contract`: Agent tool and HTTP structural contracts.
- `bun run test:regression`: deterministic golden, security, failure and feature-flag regression tests.
- `bun run test:integration`: isolated MySQL fixture and migration contracts. The DB test is skipped unless a database named `tq_test_*` is explicitly configured.
- `bun run quality`: required lint, typecheck, full tests and production build; emits only a structured report to `.quality/latest.json`.
- `bun run smoke`: read-only health, commit and unauthenticated-session production/staging smoke checks.
- `bun run test:model`: opt-in, at most three requests, disabled unless the server feature flag and isolated credentials are explicitly configured.

## Environment isolation

Never point `TEST_TARGET_DB_*` at production. The runner rejects database names that do not start with `tq_test_`. The fixture contains synthetic `.invalid` email addresses and deterministic data only. CI creates a disposable MySQL service and always drops fixture objects after the test.

## Staging gate

Before production, run the required quality workflow, deploy the exact commit to staging, then perform login, safe general chat, document/schema questions, readonly SQL validation/execution against the fixture, conversation restore/reset, permission denial, GitHub/runtime/UI mocks or configured inspection services, and prompt-injection denial. Browser and actual-model jobs remain optional and must use dedicated staging accounts.

## Production smoke and recovery

The deployment workflow checks `/api/health`, the full deployed commit and the unauthenticated session contract without issuing SQL or mutations. Login failure, Agent-wide failure, credential disclosure, authorization bypass, cross-tenant disclosure, DML availability, destructive migration or UI mutation bypass blocks deployment and requires rollback review. GitHub, runtime, screenshot or document-index failures should disable only the affected server feature flag. This repository does not implement or claim automatic rollback; the operator must use the deployment system's approved rollback process.

## Artifacts and flaky tests

Reports and artifacts have a 14-day CI retention. Never include cookies, tokens, prompts, full SQL results, personal data, production screenshots or system prompts. Security and permission suites have no retry. Optional browser/model checks may be marked flaky only after preserving the first failure and are limited to one controlled retry by workflow policy.
