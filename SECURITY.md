# Security Policy

## Reporting

If you discover a security issue, do not open a public issue with exploit details.
Report privately to: `xiezhongyan2015@gmail.com`.

## Secret Handling

- Never commit real API keys, OAuth client secrets, refresh tokens, SMTP passwords, or admin keys.
- Keep local secrets in `.local` files that are ignored by git.
- Commit only templates/examples.

## If Secrets Were Exposed

1. Rotate compromised credentials immediately.
2. Revoke old tokens/keys in upstream providers.
3. Purge sensitive commits/history before public release.
4. Audit logs for abuse after rotation.

