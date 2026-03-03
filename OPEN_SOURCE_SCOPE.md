# Open Source Scope

This project is maintained as open-core.

## Public

- `BiliPulse-ext/` plugin client code and assets
- `TubePulse/` plugin client code and assets
- Open-source documentation and policy files

## Private

- Backend worker code (API logic, AI prompts, billing, rate limiting)
- Production secrets and tokens
- Billing implementation details and webhook credentials
- Internal admin tooling
- Outreach execution data and sender credentials
- Abuse prevention internals tied to production operations

## Why

The hosted service includes operating costs (LLM/API usage, monitoring, abuse prevention, support).
Open client code improves transparency and contribution, while hosted APIs remain a paid service.
