# Momentum

Personal React + Vite PWA (routines, tasks, shopping lists, birthdays, work log) on Firebase (Auth, Firestore, Cloud Functions). The owner works on it from both a Mac and phone (cloud) sessions.

## Git workflow

- Sessions start with an automatic `git pull` (SessionStart hook in `.claude/settings.json`).
- After every change: commit and push to `main` automatically, without asking. Don't leave work on a side branch or open a PR unless asked.
- Before pushing, `git pull --rebase` so work from the other device isn't overwritten. Resolve conflicts rather than force-pushing.

## Deploys

- Push to `main` → GitHub Pages deploys the site (`.github/workflows/deploy.yml`).
- Changes under `functions/` or to `firestore.rules` → Cloud Functions and rules deploy (`.github/workflows/deploy-functions.yml`).
