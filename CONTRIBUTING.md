# Contributing to CommentPulse

Thanks for your interest in contributing! This guide covers how to get started.

## What You Can Contribute

This repo contains the **extension client code** only. The backend worker is private.

Good contribution areas:

- **Bug fixes** in the extension UI or DOM extraction logic
- **UI/UX improvements** to popup, CSS, or HTML
- **New platform support** (e.g., adapting content.js for other video platforms)
- **Localization** improvements
- **Documentation** updates
- **Accessibility** enhancements

## Getting Started

1. Fork the repo and clone locally
2. Pick a plugin directory (`TubePulse/` or `BiliPulse-ext/`)
3. Copy `config.example.js` to `config.js` and configure your backend
4. Load as unpacked extension in `chrome://extensions` (Developer mode)
5. Make your changes and test

## Development Workflow

### Loading the Extension

```bash
git clone https://github.com/YOUR_USERNAME/commentpulse.git
cd commentpulse/TubePulse  # or BiliPulse-ext
cp config.example.js config.js
# Edit config.js with your backend URL
```

Then in Chrome:
1. Navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the plugin directory
4. Open a YouTube/Bilibili video to test

### File Overview

| File | Purpose |
|------|---------|
| `content.js` | Runs on video pages; extracts video metadata from the DOM |
| `popup.js` | Main extension logic; handles UI, API calls, result rendering |
| `popup.html` | Extension UI structure |
| `popup.css` | All styling |
| `background.js` | Service worker for side panel registration |
| `config.js` | Runtime configuration (API endpoint, mode) |
| `manifest.json` | Chrome extension manifest (permissions, scripts, icons) |

### Testing Changes

- Reload the extension in `chrome://extensions` after code changes
- Check the browser console (right-click extension popup → Inspect) for errors
- Test on multiple video pages to ensure DOM extraction works correctly

## Pull Request Guidelines

1. **One feature/fix per PR** — keep changes focused
2. **Test your changes** on at least 3 different video pages
3. **Describe what changed and why** in the PR description
4. **Don't modify** `config.js` (it's user-specific) — edit `config.example.js` if needed
5. **Don't add** new dependencies or build tools without discussion first

### Commit Messages

Use clear, descriptive commit messages:

```
fix: handle missing comment count on unlisted videos
feat: add keyboard shortcut to trigger analysis
docs: update self-hosting instructions
```

## Code Style

- Vanilla JS — no frameworks, no build step
- Use `const`/`let`, never `var`
- Descriptive variable names over comments
- Keep functions focused and reasonably short
- Match the existing code style in the file you're editing

## Reporting Issues

- **Security issues** → email `xiezhongyan2015@gmail.com` (see `SECURITY.md`)
- **Bugs** → open a GitHub issue with steps to reproduce
- **Feature requests** → open a GitHub issue describing the use case

## License

By contributing, you agree that your contributions will be licensed under Apache-2.0.
