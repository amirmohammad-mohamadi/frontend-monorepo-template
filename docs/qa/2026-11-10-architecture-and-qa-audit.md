# Architecture and QA audit, 2026-11-10

Scope: the whole repository at commit `acf54f8` ("Add Next.js and Nx frontend starter workspace"). Investigation only: no source file was changed, no dependency installed in this repository, nothing committed. The only file this audit adds is this report.

Method:

- Static review of every tracked file in `apps/`, `libs/`, `tools/`, `e2e/`, the root configs and docs.
- A clean clone into a temporary folder outside both repositories, with `npm ci`, every gate, production builds, the dev servers with HTTP probes, Playwright, the domain generator, the example-removal script, `npm outdated` and `npm audit`. The clone was deleted afterwards except for its 3 MB source tree.
- Toolchain on this machine: Node 26.4.0, npm 11.17.0 (the repo requires Node ≥ 24, npm ≥ 11). Docker CLI 29.8.0 present, daemon not running.

Each finding is labelled **Verified** (reproduced with a command or confirmed by reading the exact code), **Potential risk** (follows from the code but was not exercised) or **Unverified** (needs a setup this machine lacks).

## Summary

| Severity | Count | Headline |
|---|---|---|
| Critical | 1 | BFF proxy allow-list bypass with an encoded slash |
| High | 4 | Dockerfile copies paths that do not exist; `next@16.2.10` has critical advisories; `example:remove` leaves the workspace broken; web password-reset flow has no page |
| Medium | 12 | no React hooks lint rules, no CSP, cookie `Secure` default, session loss on any upstream 401, unbounded request bodies, session schema too strict for other backends, missing tests, duplicated app infrastructure, generator deviations, server-side transport untested, unused dependencies, `remember` has no effect |
| Low | 13 | design decisions to confirm and clean-ups |

Isolation from the origin repository: **pass**. Backend independence: **pass with two gaps** (M6, M12). Generator: **functional, with convention deviations** (M9). Clean install, lint, typecheck, unit tests, both production builds and all four smoke tests: **pass** from a fresh clone.

## 1. Architecture and isolation

**Result: no dependency on the origin repository or its infrastructure. Verified.**

Evidence:

- `git grep` over tracked files for the origin repository name, the company name, machine paths (`D:\…`, `/d/…`), the developer's name, the origin's hosted git service, private registries and `.cursor`/`.claude` references: only hits are the `.gitignore` entry for `.claude/` and the generic hostname pattern in `tools/scripts/check-words.config.json`.
- `package-lock.json`: all 1885 `resolved` URLs point at `https://registry.npmjs.org`.
- `.npmrc` sets only `engine-strict`, `fund`, `audit`. No registry override.
- `nx.json`: no Nx Cloud token or plugin.
- No symlinks tracked (`git ls-files -s` mode 120000: none).
- `process.env` reads outside the two `env.ts` modules: `apps/web/src/i18n/locales.ts:24` (see L2), a doc comment in `apps/web/src/lib/observability.ts`, `e2e/playwright.config.ts` (`CI`), `tools/mock-api/server.mjs` (`MOCK_API_PORT`). Nothing points at an internal host.
- Dockerfile base image: public `node:24-bookworm-slim`. CI: public GitHub actions only.
- Word gate with the origin-project word list (kept in the untracked `.check-words.local` on this machine): `check:words passed (291 files, 21 patterns)`.

Origin repository untouched. **Verified**: in the origin checkout on this machine, `git status --short` is empty, `HEAD` is still `166276a9`, `git stash list` is empty, `git diff HEAD --stat` is empty, and the local `.claude/launch.json` keeps its 2 November timestamp.

## 2. Findings

### Critical

#### C1. BFF proxy forwards paths outside its allow-list when a segment contains an encoded slash

**Verified** by runtime probe against the clean clone with the mock API behind the web app.

```
GET /api/backend/api/v1/examples/../admin/me      → 404 {"message":"Not found"}
GET /api/backend/api/v1/examples/%2e%2e/admin/me  → 404 {"message":"Not found"}
GET /api/backend/api/v1/examples/..%2fadmin/me    → 401 {"message":"Unauthenticated"}   ← reached /api/v1/admin/me
```

Where: `libs/services/src/lib/auth/server/create-auth-server.ts`, function `proxy`:

```ts
const { path } = await context.params;
const target = `/${path.join("/")}`;
if (!config.proxyPrefixes.some((prefix) => target === prefix || target.startsWith(`${prefix}/`))) { … 404 }
…
authenticatedFetch(req, `${target}${req.nextUrl.search}`, …)
```

Next.js decodes catch-all segments, so `..%2fadmin` arrives as one segment `../admin`. The joined target `/api/v1/examples/../admin/me` passes the prefix check, and `fetch` normalises `..` before the backend sees it. Any backend path becomes reachable through the proxy with the caller's session token, which defeats the purpose of `WEB_PROXY_PREFIXES` / `ADMIN_PROXY_PREFIXES` as an allow-list. The same code serves the admin app.

Side effect observed in the probe: the upstream 401 made the proxy clear the caller's cookies (see M4).

Suggested fix (not applied): normalise before checking, and refuse any segment that contains `/`, `\`, or equals `.`/`..` after decoding, for example `const target = new URL(path.join("/"), "http://x/").pathname` combined with a segment check; add a unit test with the three probe paths.

### High

#### H1. Dockerfile copies from paths the build never creates

**Verified** (static, build outputs measured; the image build itself is Unverified because the Docker daemon was not running).

`npm run build` writes to `apps/web/.next` and `apps/admin/.next` (44 MB / 40 MB; standalone 23 MB / 22 MB). No `dist/` folder is created: the `@nx/next/plugin` inferred `build` target runs `next build` with the app as cwd. `Dockerfile` lines in the `runner` stage reference `/repo/dist/apps/${APP}/.next/standalone`, `/repo/dist/apps/${APP}/.next/static` and run `node dist/apps/${APP}/server.js`. The real locations are `apps/${APP}/.next/standalone/apps/${APP}/server.js` and `apps/${APP}/.next/static`. The two `COPY --from=build` lines would fail the image build.

Where: `Dockerfile` lines 25–29. Related: `README.md` and `docs/` do not mention the Docker image at all.

#### H2. Production dependency `next@16.2.10` carries critical advisories

**Verified**: `npm audit --omit=dev` in the clean clone reports `3 vulnerabilities (2 high, 1 critical)`: `next 9.3.4-canary.0 – 16.4.0` (critical; advisories include a middleware/proxy bypass, an RCE on Windows-hosted servers, image-optimisation RCEs and cache poisoning), `postcss ≤ 8.5.22` (high, transitive), `sharp ≤ 0.35.5-rc.1` (high, transitive). The fix is `next@16.4.6`, which the exact pin in `package.json` (`"next": "16.2.10"`) excludes. Full audit: `53 vulnerabilities (9 low, 34 moderate, 9 high, 1 critical)`, the rest in dev tooling.

Note: the version was carried over from the origin workspace. A starter should ship on the current patch line of its framework.

#### H3. `npm run example:remove` leaves the workspace uncompilable and out of sync

**Verified** in the clone, after generating a `product` domain and then removing the example:

- `npm run typecheck` fails: `apps/admin/src/features/overview/overview.tsx(4,26): error TS2305: Module '"@services"' has no exported member 'useExamples'.`
- `npm run build` fails before compiling: `NX The workspace is out of sync` (`apps/admin/tsconfig.json` keeps a stale reference to `libs/models`). The script neither runs `nx sync` nor mentions it.
- After a manual `nx sync`, the admin build still fails on `overview.tsx`.
- Not listed in the script's "still to do by hand": `e2e/smoke.spec.ts` tests 2 and 4 target `/en/examples` and the "New example" button; `.env.example` and both `env.ts` defaults keep `/api/v1/examples` in the proxy prefixes; `texts.ts` has `nav.examples` and `cards.examples`; `messages/en.json` and `messages/fa.json` have `nav.examples` besides the `examples` namespace.

Where: `tools/scripts/remove-example.mjs`, `docs/generator.md`, `README.md` step 5.

#### H4. The web password-reset flow has a route but no page

**Verified** by reading: `apps/web/src/app/api/auth/reset-password/route.ts` and `useResetPassword` in `libs/services/src/lib/auth/auth.hooks.ts` exist, but there is no `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx` and no form. The forgot-password form tells the user a link is on its way, and that link has nowhere to land. The admin app has the same gap (`PUBLIC_PATHS` lists `/reset-password`, no page exists). `useResetPassword` has zero consumers.

### Medium

#### M1. React hooks rules are not linted

**Verified**: neither `package.json` nor `eslint.config.mts` references `eslint-plugin-react-hooks`; `@next/eslint-plugin-next` is absent too. `rules-of-hooks` and `exhaustive-deps` are the two rules most likely to catch bugs in a hooks-heavy codebase. The origin workspace had the same gap, so this is inherited, not introduced.

#### M2. No Content-Security-Policy or HSTS header

**Verified**: `apps/web/next.config.js` and `apps/admin/next.config.js` send `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` (and `X-Robots-Tag` for admin) and nothing else. A starter that calls itself production-ready should at least ship a report-only CSP and leave HSTS to the deployment docs.

#### M3. Cookie `Secure` flag defaults from the backend scheme, not the app scheme

**Verified** by reading `create-auth-server.ts`: `secure = config.secureCookies ?? (process.env.NODE_ENV === "production" && backend.baseUrl.startsWith("https"))`. An app served over https with an http internal backend (a common cluster layout) ships session cookies without `Secure` unless `AUTH_COOKIE_SECURE=true` is set. `.env.example` documents the override, but a safer default is "production ⇒ Secure" with an explicit opt-out for plain-http staging.

#### M4. Any upstream 401 through the proxy ends the session

**Verified** in the C1 probe: the proxy answered an upstream 401 by clearing both cookies (`set-cookie: web_access=; … Max-Age=0`). The code treats a 401 after a refresh attempt as "session gone", but a backend may answer 401 for a single endpoint (scope, step-up, a bypassed path) while the session is valid. The refresh attempt only runs when a refresh cookie exists; when the refresh itself fails, clearing is right; when the retried request still gets a 401 the session is also cleared, which is the questionable case.

Where: `create-auth-server.ts`, `proxy`, lines `if (rotated) setSession(res, rotated); else if (upstream.status === 401) clearSession(res);`.

#### M5. Request bodies are read without a size cap

**Potential risk** (read, not exercised). `credentialHandler` and `passthroughHandler` call `req.json()`; `proxy` does `Buffer.from(await req.arrayBuffer())`. Both run before authentication. `readBodyWithCap` in `libs/utils/src/lib/read-body-with-cap.ts` exists for exactly this and has no caller. A reverse proxy usually bounds bodies in production, but the starter should not rely on that.

#### M6. `sessionUserSchema` requires `name` and `email` keys

**Verified** by reading `libs/dtos/src/lib/auth/session.dto.ts`: `name: z.string().nullable()` and `email: z.string().nullable()` are nullable but not optional. A backend whose current-user object has `username` or omits `email` fails `readUser`, and `/api/auth/me` answers 502 "unexpected answer" until `readUser` is overridden in `lib/auth/server.ts`. The override exists, but the default is stricter than the "works out of the box" goal; `.optional()` on both would cost nothing.

#### M7. No tests for the security-relevant server code; the apps have no unit tests

**Verified**: the five spec files are `libs/utils` (3), `libs/services/shared/backend-adapter` (1) and `e2e/smoke.spec.ts`. Untested: `create-auth-server.ts` (cookies, refresh single flight, CSRF check, proxy allow-list, the C1 case), `guard.ts`, `jwt.ts`, `api-client.ts` (deadline, error mapping, events), `bff-client.ts`, both `proxy.ts` middlewares, `permissions.ts`. `apps/web` and `apps/admin` run Jest with `passWithNoTests`. The e2e suite depends on the example domain (H3).

#### M8. Infrastructure files are duplicated between the two apps

**Verified** by diff: `src/lib/observability.ts` (15 lines differ), `src/lib/api-client-setup.ts` (20), `src/features/auth/form-error.tsx` (6), `src/components/theme-toggle.tsx` (19), `src/components/auth-event-handler.tsx` (18), `src/components/providers.tsx` (8); identical: `api/backend/[...path]/route.ts`, `api/health/route.ts`, `public/favicon.svg`. A third app would copy all of them again. Candidates to lift: a `createApiTransport({ proxyPrefixes, publicBase, internalBase })` helper and the health route into `@services`; the development reporter into `@utils`; `FormError` and `ThemeToggle` into `@components`.

#### M9. Generated domains deviate from the written conventions

**Verified** by running `npx nx g ./tools/generators:domain product` in the clone. Lint, typecheck and build pass afterwards, `nx sync:check` stays clean, Prettier is satisfied, no deep imports, `apiClient` only in `product.api.ts`. Deviations from `AGENTS.md`:

1. "JSDoc on every exported function": the five generated hooks, the query keys, the four schemas and the model have none. The `example` domain the template mirrors has the same gap.
2. "Admin strings live in `apps/admin/src/texts.ts`": `products-table.tsx` defines a local `TEXTS` object.
3. `formatDate(item.getCreatedAt(), "en-GB")` hard-codes a locale in the admin table (template and example alike).
4. The mock API gains no routes for the new domain, so the generated page shows the error state until a backend exists (expected, but undocumented).

Where: `tools/generators/domain/files/**`, `docs/generator.md`.

#### M10. Server-side data fetching is wired but never exercised

**Potential risk**. `configureApiClientTransport` runs when `src/lib/api-client-setup.ts` is imported, which happens through the client `Providers` component (executed during SSR of the layout as well). A server component or route handler that calls `apiClient` without that import first would hit the unconfigured transport (`resolveUrl: path`), and the server branch of `resolveUrl` (`INTERNAL_API_BASE_URL`, no token) is used by no page today. Nothing fails now; the first server-side fetch a project adds will discover whether this holds.

#### M11. Unused and questionable dependencies

**Verified** (import scan in the clone):

- `zustand` (dependency): zero imports, zero mentions. Remove or add the documented store pattern.
- `@nx/eslint-plugin` (devDependency): not referenced by `eslint.config.mts`; boundaries are hand-written `no-restricted-imports` blocks.
- `@swc/helpers`, `@types/react-dom`, `@types/jest`, `@swc-node/register`: no direct reference. The last one is what Nx uses to load TypeScript generators and `eslint.config.mts`, so it stays; the others need a decision.
- `react-dom`: no direct import, required as a peer; keep.

`npm outdated`: every package is on its wanted version; majors behind: Nx 22 → 24, ESLint 9 → 10 (npm prints "eslint@9.39.5: This version is no longer supported"), Jest 29 → 30, TypeScript 5.9 → 7.0, `lucide-react` 0.563 → 1.71, `@hookform/resolvers` 5 → 7, `react-resizable-panels` 3 → 4, `globals` 15 → 17, `@eslint/js` 9 → 10, `@types/jest` 29 → 30, `@types/node` 24 → 26. These are informational; H2 is the one that matters.

#### M12. The `remember` sign-in flag has no effect

**Verified** by reading: `loginSchema` accepts `remember`, the web login form renders the checkbox, `credentialHandler` forwards the body, and `setSession` sizes both cookies from the token lifetimes only. Unless the backend changes token lifetimes on `remember`, the checkbox is decorative. Either wire it (longer refresh `maxAge`) or drop it from the starter.

### Low

- **L1. `/api/auth/me` answers 200 `{ data: { user: null } }` without a session.** Verified. This is a deliberate design (a signed-out visitor is a normal state and keeps the console free of 401 noise); confirm that the team accepts it, and document it in `docs/auth.md`, which still describes the earlier 401 behaviour implicitly.
- **L2. `apps/web/src/i18n/locales.ts:24` reads `process.env.NEXT_PUBLIC_DEFAULT_LOCALE` directly** instead of through `env.ts` (the module avoids importing `env.ts` because the edge middleware loads it). Verified. Document or route through a tiny shared reader.
- **L3. Dead or unconsumed exports.** Verified by grep. Runtime code with no caller anywhere: `createConcurrencyLimiter`, `readBodyWithCap`, `htmlToSummary`, `htmlToPlainText`, `truncateAtWord`, `slugify`, `formatDateTime`, `formatRelativeTime`, `formatPercent`, `formatFileSize`, `formatMoney`, `formatIndex`, `localizeHref`, `switchLocaleInPath`, `setErrorReportingUser`, `SortDirection`, `idParamSchema`, `apiErrorSchema` (type used, schema not), `tokenPairSchema` (same), `paginationQuerySchema`, `API_FORBIDDEN_EVENT` (dispatched, never listened to), `CLIENT_ERROR_CODES`, `useResetPassword` (H4). Intentional public seams with no caller yet: `configureBackendAdapter`, `createQueryClient`, `bffRequest`, `credentialHandler`/`passthroughHandler`. The AGENTS rule "no dead code" argues for trimming the first group or giving each a test and a doc line.
- **L4. `README.md` home-page button "Read the architecture notes" links to `https://github.com`** (placeholder) in `apps/web/src/app/[locale]/page.tsx`. Verified.
- **L5. `@ts-expect-error` in `apps/web/src/components/locale-switcher.tsx:38`** works around next-intl's typed `router.replace`. Verified. A typed `pathnames` config or `switchLocaleInPath` from `@utils` (currently unused, L3) would remove it.
- **L6. CI gaps.** Verified by reading `.github/workflows/ci.yml`: every `run:` script exists; no `nx sync:check` step (a stale reference fails the build loudly, so this is Low); Node is pinned to a major only and npm not at all although `packageManager` says 11.6.2; Playwright browsers are not cached; `npm run lint` (`nx run-many -t lint`) does not cover `tools/` and `e2e/` because `mock-api` has no lint target and `e2e` is not a project, so only a root `npx eslint .` lints them and CI never runs that; Prettier is not checked.
- **L7. `WEB_PROXY_PREFIXES` default lists `/api/v1/account`, which the mock API does not serve.** Verified. Harmless, but the example configuration should match the example backend.
- **L8. `next dev` and `next build` rewrite `apps/*/next-env.d.ts`**, so `git status` shows them modified after running the dev servers. Verified in the clone. Either ignore the files or accept the noise (Next regenerates them).
- **L9. Backend error bodies pass through to the browser verbatim** (`upstreamError` in `create-auth-server.ts`, `readError` in the adapter). Potential risk: an internal message or stack from a misconfigured backend would reach the user. By design for user-facing validation messages; worth a one-line allow-list of fields (`message`, `code`, `errors`).
- **L10. ESLint turns `@typescript-eslint/no-explicit-any` off** (`eslint.config.mts`). Verified. Inherited; the codebase currently has no `any` outside the shadcn files, so the rule could be enabled.
- **L11. Lib `package.json` files declare no dependencies.** Verified. Fine inside the workspace; they are not publishable as-is, and the `@starter/source` custom condition in `exports` is unused by any tool.
- **L12. The admin app hard-codes `en-GB`** for dates in `examples-table.tsx` (and the generator template). Verified. Acceptable for a single-language admin, but it should be one constant.
- **L13. npm 11.17 reports five packages with install scripts not yet approved** (`@parcel/watcher`, `@swc/core`, `less`, `nx`, `sharp`). Informational; relevant once the team adopts `allowScripts`.

## 3. Authentication review

Reviewed: `libs/services/src/lib/auth/server/{create-auth-server,guard,jwt,config}.ts`, `apps/*/src/proxy.ts`, `apps/*/src/lib/auth/*`, `apps/*/src/app/api/**`, `libs/services/src/lib/auth/*`, `libs/utils/src/lib/safe-next-path.ts`.

What holds up (Verified by probe or reading):

- Tokens live only in `httpOnly` cookies (`web_access`, `web_refresh`; `admin_*` for the admin app). Probe: `set-cookie: web_access=…; Path=/; Max-Age=900; HttpOnly; SameSite=lax`. The browser receives only the user object.
- CSRF: every non-GET BFF route compares `Origin` to `Host`/`X-Forwarded-Host`. Probe: a cross-origin `POST /api/auth/login` answers 403; same-origin answers 200. Cookies are `SameSite=Lax` as a second layer.
- Open redirects: `getSafeNextPath` (tested) guards the `next` parameter in the middleware guard, the web `useAfterSignIn` and the admin login form.
- Refresh: single flight per refresh token, evicted after five seconds; the proxy retries once with the rotated pair and sets the new cookies on the response.
- Every session-bearing response carries `Cache-Control: no-store, private` and `Vary: Cookie` (probe).
- Edge guard: decides from cookies only, fails open on an unreadable `exp`, documented as not the security boundary. Probe: `/en/account` → 307 to `/en/login?next=%2Fen%2Faccount`; admin `/` → 307 to `/login?next=%2F`.
- Two apps on one host use different cookie prefixes.
- Allow-list of proxied prefixes: `GET /api/backend/api/v1/admin/anything` → 404 (probe). Defeated by C1.

Weaknesses: C1, M3, M4, M5, M12, L9. Not in scope of the starter but worth a doc line: rate limiting and lockout are left to the backend; there is no logout-everywhere or token revocation list on the frontend side (correct for a BFF).

## 4. Backend independence

Seams available without touching shared code (Verified by reading):

| Concern | Seam | File |
|---|---|---|
| Response payload shape | `configureBackendAdapter({ unwrap })` | `libs/services/src/lib/shared/backend-adapter.ts` |
| List and pagination shape | `configureBackendAdapter({ readList })` | same |
| Error body shape | `configureBackendAdapter({ readError })` | same |
| Request URL, headers, token | `configureApiClientTransport` | `libs/services/src/lib/shared/api-client.ts` |
| Auth endpoint paths | `AUTH_BACKEND_PATHS` | `apps/*/src/lib/auth/config.ts` |
| Sign-in answer shape | `backend.readAuthPayload` | `libs/services/src/lib/auth/server/config.ts` |
| Current-user shape | `backend.readUser` | same |
| Refresh request body | `backend.refreshBody` | same |
| Extra backend headers (API key, tenant) | `backend.headers` | same |
| Request body schemas | `config.schemas` | same |
| Extra strategies | `credentialHandler` / `passthroughHandler` | `create-auth-server.ts` |

Defaults verified against the mock: `data` wrapper, `meta.current_page/last_page/per_page/total`, `errors` as a map of arrays. Unit tests cover root-level `page/pageSize/total`, bare arrays, maps of strings and lists of `{ field_name | path }` entries.

Gaps:

- M6: the default `sessionUserSchema` requires `name` and `email` keys.
- No seam for request-body transformation in `apiClient` (a backend that wants `camelCase` bodies while the DTOs are `snake_case`, or form-encoded sign-in). `ApiRequestOptions` lets a caller set `body`, but there is no global hook. Potential gap, not a blocker.
- `credentialHandler` always posts JSON; an OAuth code exchange that needs `application/x-www-form-urlencoded` would need a custom route (possible, since `backendFetch` is not exported it would duplicate some code).
- The proxy forwards only `content-type`, `accept`, `accept-language` unless `forwardHeaders` is set (seam exists, not documented in `docs/backend-adapter.md`).

Conclusion: a different backend is integrated through configuration for the common cases; the two gaps above are documentation and a one-line schema change away from the goal.

## 5. Clean installation (clean clone)

All **Verified** in the temporary clone:

| Step | Result |
|---|---|
| `git clone` | 313 files, HEAD `acf54f8` |
| `npm ci` | exit 0, 61 s, 1688 packages, no engine or peer warnings; deprecation notices for `inflight`, `glob` 7/8/10, `whatwg-encoding`, `uuid@8`, `eslint@9.39.5` |
| `npm run lint` | exit 0, 9 projects |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0, 17 tests (utils 11, services 6), apps "no tests found" |
| `npm run check:words` | exit 0 |
| `nx sync:check` | up to date |
| `npm run build` | exit 0, 44 s; route tables as expected; outputs in `apps/*/.next`, no `dist/` (see H1) |
| dev servers | all three healthy; `/en` 200 `dir="ltr"`, `/fa` 200 `dir="rtl"` |
| Playwright | 4 passed (11 s) |
| generator | 12 files created, 4 updated, lint/typecheck/build pass, no sync needed |
| `example:remove` | fails afterwards (H3) |

## 6. Docker and CI

- Docker: CLI 29.8.0 present, daemon not running on this machine, so the image build is **Unverified**. The static comparison in H1 shows the `runner` stage cannot succeed as written. The `deps` stage copies nine `package.json` files that all exist; `.dockerignore` keeps `.env.example` and excludes `.env*`, `**/.next`, `dist`, `node_modules`.
- GitHub Actions: **Unverified** (no remote, `act` not installed). Static comparison: all referenced npm scripts exist; the `e2e` job installs Chromium and uploads `e2e/test-results` on failure, which is Playwright's default output directory for this config; see L6 for the gaps.

## 7. Code quality

Beyond the findings above (M7 tests, M8 duplication, M9 generator, L3 dead code):

- Conventions hold: no `interface` declarations in new code; named exports everywhere except framework files; `type` over `interface`; no `console.*` in shipped code; no deep imports; the ESLint boundary blocks cover services, components, models, dtos, utils and enums and were exercised by the clean lint run.
- JSDoc coverage: 30 exported functions have no JSDoc, mostly page-level components (`LoginForm`, `ExamplesList`, `Overview`, …) and the domain hooks. The rule in AGENTS.md says "every exported function"; either relax it to "every exported function in `libs/`" or add the comments.
- One abstraction to question: `BaseQuery`, `BaseQueryOptions`, `BaseQueryWithParams` in `libs/services/src/lib/shared/types.ts` have no consumer; they were carried from the origin pattern and could go until a hook needs them.
- `ApiClient.getList` duplicates most of `request` (fetch, error mapping, deadline). One private `send` would remove about forty lines.
- The admin `(dashboard)` layout is `force-dynamic` with a Suspense boundary; the web `account` page is prerendered as a static shell with client-side session reading. Both are defensible; they are different answers to the same question and should be documented as such.

## 9. Resolution of Critical and High findings (applied after approval, same day)

| Finding | Commit | What changed | Verification |
|---|---|---|---|
| C1 proxy bypass | `694615a` | New `resolveProxyTarget` (`libs/services/src/lib/auth/server/proxy-target.ts`) refuses empty, `.`, `..` segments and any decoded segment containing `/` or `\`, re-encodes segments and re-checks the path through the URL parser before matching the allow-list; the proxy uses it | 5 unit tests incl. the three probe shapes; new e2e test `the proxy refuses a path outside its allow-list, encoded or not` (404 for `..%2f` and `%2e%2e` forms) |
| Found during fix | `0b05636` | The proxy crashed on a 204/205/304 from the backend (`Response` refuses a body with those statuses); body-less answers are now forwarded without a body | Admin delete e2e re-run with no server error in the log |
| H2 `next` advisories | `465c9ff` | `next` 16.2.10 → `^16.4.6` | `npm audit --omit=dev`: `found 0 vulnerabilities`; lint, typecheck, unit tests, both production builds and all e2e tests pass on 16.4.6 |
| H1 Dockerfile | `18eb8af` | Runner stage copies `apps/<app>/.next/standalone`, `apps/<app>/.next/static` and `apps/<app>/public`, runs `node apps/<app>/server.js`; `tools/generators/package.json` added to the deps stage; `NX_DAEMON=false` in the build stage | Static only: paths match the measured build output. The Docker daemon was still not running on this machine, so the image build remains **Unverified** |
| H4 reset-password pages | `f72e2a9` | `/[locale]/reset-password` (web) and `/reset-password` (admin) with forms that read `token` and `email` from the link and sign the user in on success; messages and texts added | e2e test `the reset-password link sets a new password and signs the user in` passes against the mock |
| H3 `example:remove` | `02353f6`, `eebad73` | App code that mentions the domain is fenced with `example-domain:start/end` markers which the script cuts; the script also drops the message keys and proxy-prefix defaults, deletes the separate `e2e/examples.spec.ts`, runs `nx sync` and the typecheck | In a temp clone: `npm run example:remove` exit 0, then `npm run check` exit 0 (lint, typecheck, 22 tests, word gate) and both production builds exit 0; zero remaining mentions of `examples` in messages, texts and env defaults |

Also changed in passing: the home page's placeholder "architecture notes" link (L4) now points at the account page; `docs/auth.md` documents the 200-with-null session answer (L1); `docs/generator.md` describes the removal. `apps/*/AGENTS.md` are files `next dev` 16.4 generates and asks to be committed; they contain Next's own guidance only.

## 10. Resolution of Medium findings (applied after approval, same day)

| Finding | What changed | Verification |
|---|---|---|
| M1 hooks lint | `eslint-plugin-react-hooks` (rules-of-hooks error, exhaustive-deps warn) and `@next/eslint-plugin-next` recommended rules for `apps/**` added to `eslint.config.mts`; the root not-found page now uses `next/link` | lint passes with zero warnings |
| M2 CSP | `Content-Security-Policy-Report-Only` on every response of both apps (self + the public API origin for `connect-src`; admin `frame-ancestors 'none'`); HSTS documented as the TLS terminator's job | production builds; header present in e2e-served pages |
| M3 Secure cookies | Default is now `NODE_ENV === "production"`; `AUTH_COOKIE_SECURE=false` is the plain-http staging opt-out | unit test for the cookie attributes; `.env.example` updated |
| M4 401 ends session | `authenticatedFetch` reports `sessionLost` only when the refresh token is missing or rejected; a 401 after a successful refresh passes through and keeps the cookies | unit test `does not end the session when the endpoint itself answers 401 after a good refresh` |
| M5 body caps | Auth routes read at most 64 KiB and the proxy 10 MiB through `readBodyWithCap`, answering 413 before parsing; both configurable | unit tests for 413 on both paths |
| M6 session schema | `name` and `email` are optional in `sessionUserSchema` | typecheck; the model already tolerated missing values |
| M7 tests | New suites: `jwt.spec`, `guard.spec`, `create-auth-server.spec` (CSRF, validation, cookies, remember, refresh single flight, proxy allow-list, 204, session loss), `api-client.spec` (transport, unwrap, list, error mapping, network, deadline), `proxy-target.spec`, admin `permissions.spec` | 56 unit tests pass (was 17) |
| M8 duplication | Lifted into libs: `installApiTransport`/`createApiTransport` and `describeApiError` (`@services`), `FormError` and `ThemeToggle` (`@components`), `consoleErrorReporter` (`@utils`); the per-app copies are deleted | lint, typecheck, e2e |
| M9 generator | Templates carry JSDoc on every exported symbol, the admin table reads its copy from `apps/admin/src/texts.ts` (the generator appends the section) and formats dates with `ADMIN_LOCALE` from `src/config/locale.ts` | generator run in a temp copy, then lint, typecheck, Prettier check and admin build |
| M10 server transport | `apps/*/src/instrumentation.ts` installs the transport at server start, so route handlers and server components can call `apiClient` without the client bundle having loaded the setup module | typecheck; builds |
| M11 dependencies | `zustand` and `@nx/eslint-plugin` removed; the two lint plugins added | install, lint |
| M12 remember | A boolean `remember: false` in a sign-in body writes browser-session cookies (no `Max-Age`); strategies can decide with `persistent` | unit test `writes session cookies without Max-Age when remember is false` |

Still open: the Low findings.

## 8. Recommended order of work (for approval, nothing applied)

1. C1 proxy allow-list fix with unit tests; while there, M4 (narrow when a 401 clears the session) and M5 (body cap using `readBodyWithCap`).
2. H2 bump `next` to the current 16.4.x patch, re-run the gates and audit.
3. H1 Dockerfile paths, then verify with a real `docker build` once the daemon is available.
4. H3 make `example:remove` leave a green workspace: run `nx sync`, patch `overview.tsx`, `navigation.ts`, `texts.ts`, messages, env defaults and the e2e spec, or move the example-dependent pieces behind the script.
5. H4 add the reset-password page (web and admin) or remove the route and hook.
6. M1 add `eslint-plugin-react-hooks` (and the Next plugin), M2 a report-only CSP, M3 the `Secure` default, M6 the optional session fields, M12 `remember`.
7. M8 lift the duplicated app infrastructure into libs; M9 align the generator templates with the conventions; M11 drop `zustand` and `@nx/eslint-plugin`.
8. M7 tests for the auth server, guard, JWT helpers and api client; L-items as a clean-up pass.
