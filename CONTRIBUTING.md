# Contributing

Small project, strict edges. Read [docs/SPEC.md](docs/SPEC.md) before changing behaviour.

## Setup

```bash
pnpm install
pnpm check        # lint + tests + build
pnpm dev
```

## Rules

1. **Evidence over inference.** Anything the UI shows must be traceable to a capture URL. Do not add "insights", scores or causal language.
2. **Pure logic stays pure.** Extraction, diffing and validation live in `server/core.ts` and must not import Vite, React or Node HTTP.
3. **Tests come with behaviour.** A change to parsing or diffing needs a test that fails without it. `pnpm test` must stay green.
4. **One handler.** Dev and production both use `server/api.ts`. Do not add a second server path.
5. **No new network hosts.** The only outbound host is `web.archive.org`. A PR that fetches the target site directly will be rejected on SSRF grounds.
6. **Accessibility is not optional.** New controls need a label, focus state and keyboard path. Run the UI at 390px and 1280px.

## Commits

Conventional-ish: `feat:`, `fix:`, `docs:`, `test:`, `chore:`. One concern per commit. Include the command you ran to verify in the body.

## Pull requests

- Describe the user-visible change in one sentence.
- List the verification you ran (`pnpm check`, plus a manual URL if relevant).
- Screenshots for UI changes, at desktop and mobile width.

## Reporting bugs

Include the target URL, the response status, and what you expected. Do not paste credentials or private data — this tool only handles public pages.
