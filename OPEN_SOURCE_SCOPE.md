# Open Source Scope

This repo currently uses an open-core model:
the extension client is public, while the hosted backend stays private.

## Public

- `TubePulse/` client code and assets
- `BiliPulse-ext/` client code and assets
- UI code, page data extraction, local storage logic
- Build scripts, packaging scripts, and store asset scripts
- Public docs such as `README`, `SECURITY`, `CONTRIBUTING`, and `TRADEMARK`
- Config templates for self-hosting

## Private

- Backend worker code and API implementation
- AI prompts and hosted analysis workflow
- Billing, trial, rate-limit, and abuse prevention logic
- Production secrets, tokens, and webhook credentials
- Internal admin tools and operating data
- Outreach execution data and sender credentials

## What This Means

- You can inspect the extension, fork it, and modify the client code.
- You can point the client to your own backend and self-host it.
- You can submit pull requests for UI, extraction logic, docs, and related client-side work.
- The official hosted API is not included in this repo.

## Why

Opening the client code makes the product easier to inspect, trust, and extend.
The hosted service still has real operating cost and production-only code that is tied to billing, monitoring, and abuse control, so that part stays private for now.
