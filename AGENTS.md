# Project workflow

The user wants completed implementation changes committed and pushed to GitHub with descriptive names.

- Work on a descriptive `fix/...` or `feat/...` branch, preserving unrelated existing work.
- Use clear commit messages describing the resulting behavior. Save substantial pre-existing uncommitted work as a separate checkpoint when it must be included.
- Run relevant regression tests, `npm test` and `npm run build` before the final push.
- Inspect the staged diff and confirm `origin` targets `https://github.com/Sinammon/Dilemma.git`.
- Keep `.env`, credentials, dependencies and build outputs out of commits.
- Push the completed branch with upstream tracking and report the branch, commit and verification results.
- Do not force-push, merge into `main` or change deployment settings unless the user requests it. Respect requests to leave work local.
