# CommentPulse (Open Core)

AI-powered comment analysis for content creators. Get actionable insights from viewer feedback.

This repository contains two browser extensions:

| Plugin | Platform | Directory |
|--------|----------|-----------|
| **BiliPulse** | Bilibili | `BiliPulse-ext/` |
| **TubePulse** | YouTube | `TubePulse/` |

## Features

- **Comment Analysis** — AI extracts quantified problems, viewer questions, and actionable suggestions from comments
- **Danmaku Analysis** (BiliPulse) — Analyze bullet comments for engagement patterns and drop-off points
- **Niche Insights** (Pro) — Compare your video's comment section against competitors
- **Trend Tracking** — Track how viewer feedback evolves across your videos
- **Improvement Comparison** — See which problems were fixed between videos

## Open-Core Model

- Plugin client code is open source (Apache-2.0)
- Hosted backend (billing, anti-abuse, production secrets) stays private
- Self-hosting is supported — point `config.js` to your own backend

See `OPEN_SOURCE_SCOPE.md` for details.

## Self-Hosting Setup

1. Clone this repo
2. Copy `config.example.js` to `config.js` in the plugin directory you want to use
3. Edit `config.js` — set `API_BASE_URL` to your own backend endpoint
4. Update `manifest.json` — add your backend URL to `host_permissions`
5. Load the extension as an unpacked extension in Chrome (`chrome://extensions`)

### Config Fields

| Field | Description |
|-------|-------------|
| `API_BASE_URL` | Your backend API endpoint |
| `OFFICIAL_SITE_URL` | Your site URL (for links in the UI) |
| `BRAND_NAME` | Display name |
| `MODE` | `selfhost` or `official` |

## Security

See `SECURITY.md` for reporting vulnerabilities and secret handling guidelines.

## License

Apache-2.0 — see `LICENSE`.

Brand names and logos are trademarked — see `TRADEMARK.md`.
