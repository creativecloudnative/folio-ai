# ADR-002: SDLC & GitOps Pipeline

**Date:** 2026-06-09  
**Status:** Accepted

---

## Context

folio-ai needs a deployment process that reflects the same GitOps and continuous delivery practices described in the portfolio's case studies. The pipeline itself is an architecture artifact — technical visitors can inspect it directly in the repo. The bar is therefore higher than a typical personal project: it should look like something a principal engineer would propose to a team, not just a script that ships code.

---

## Decision

### Branch Model

Three tiers, each mapped to an environment:

| Branch | Environment | URL | Trigger |
|---|---|---|---|
| `feature/*` | Preview | Vercel-generated URL | PR opened/updated |
| `staging` | Staging | staging.creativecloudnative.com | Push to `staging` |
| `main` | Production | creativecloudnative.com | Push to `main` (via PR) |

`main` is protected — merges require a passing CI run. No direct pushes.

### GitHub Actions Workflows

**`ci.yml`** — triggered on any PR targeting `main` or `staging`:
1. Type check (`tsc --noEmit`)
2. Lint (`eslint`)
3. Build (`next build`)
4. Deploy preview to Vercel (preview environment)
5. Post preview URL as a PR comment (updates in-place on re-push)

**`deploy-staging.yml`** — triggered on push to `staging`:
1. Full validation (same three checks)
2. Vercel preview deploy
3. Alias the deploy to `staging.creativecloudnative.com`

**`deploy-production.yml`** — triggered on push to `main`:
1. Full validation
2. Vercel production deploy (`--prod`)

Concurrency groups prevent redundant runs: CI cancels in-progress runs for the same branch; production deploy never cancels (safe to let it finish).

### Why GitHub Actions over Vercel's Native GitHub Integration

Vercel's native integration auto-deploys on push with zero config — faster to set up, but opaque. GitHub Actions makes the quality gates explicit and inspectable: type errors and lint failures block deployment visibly, with line-level feedback in the PR. For a portfolio demonstrating DevOps/platform instincts, the workflow file *is* part of the artifact.

### Why Vercel CLI (three-step) over `vercel --prod` directly

The `vercel pull → vercel build → vercel deploy --prebuilt` pattern separates environment resolution, build, and upload into discrete steps. This means:
- Build failures are caught and reported before any upload attempt
- The same built artifact is what gets deployed (no rebuild on upload)
- Each step is auditable in the Actions log

---

## Consequences

- **Three GitHub secrets required:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- **Staging domain alias:** `staging.creativecloudnative.com` must be added as a domain in the Vercel project settings
- **Branch protection:** `main` requires passing `Type check, lint, build` status check — configure in GitHub repo settings → Branches
- **Developer workflow:** `git push` to a feature branch → open PR → CI runs and posts preview URL → merge to `staging` to test in the staging environment → merge to `main` to ship
