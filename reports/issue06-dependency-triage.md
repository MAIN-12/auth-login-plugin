# Issue 06 — dependency reachability triage

Snapshot: 2026-10-06, pnpm 10.19.0; registry advisories are time-dependent.
Commands: `pnpm audit --prod --json` and `pnpm audit --json`.
Raw local evidence: `/tmp/issue06-audit-{prod,full}-before.json` (not committed).
Initial production audit: **4 high**; full audit: **45 findings: 2 critical, 21 high, 16 moderate, 6 low**.
These are findings, not 45 demonstrated plugin exploits; duplicate package/version advisories remain separately listed.

## Dependency boundary

- Keep runtime `@libsql/client` and `drizzle-orm`: server static imports implement SQLite transactions; even PostgreSQL entrypoints resolve the static imports. Moving these to dev breaks packaged consumers.
- Keep runtime `jose`, `oauth4webapi`, `zod`: server JWT/provider and domain/endpoint validation use them directly.
- Removed unused runtime `@iconify/react`: no source, asset, script, or public-export references. Manifest/lockfile removal installed successfully.
- `payload`, `next`, `react`, `framer-motion` are dev dependencies here **and runtime peers in a host**; dev classification is not proof of production safety.
- Optional `next-intl` peer is not imported; locale helpers intentionally use explicit configuration/cookies. Its auto-resolved Next subtree accounts for the four prod flags (nanoid, braces, source-map-js, sharp). Removed the unused optional peer declaration; this is not a vulnerability fix for a host that uses Next anyway.
- Direct dev `@eslint/eslintrc` is not imported by the current flat config. Removed the redundant direct declaration; re-audit confirms ESLint retains its YAML path and copyfiles retains brace-expansion 1.x.

## Reachability legend and disposition

These are code-path inferences, not exploit proofs. Host configuration can widen reachability.

| Code | Environment / prerequisite / disposition |
| --- | --- |
| E | Database migration tooling: esbuild loader transforms TS; no `serve()` in plugin. Keep dev server disabled; no forced 0.x override across API compatibility seam. |
| D | SWC `swcx` downloader chain: archive/sniff/cache functionality, not the configured `swc` build. Never run swcx on untrusted downloads; no shared cache configured. Decompress/file-type patched releases exist; http-cache-semantics has **no patch**. |
| M | Host Payload admin Monaco markdown sanitizer: hook/config pollution or rawtext/custom-element mode preconditions. Plugin does not call DOMPurify or register hooks; host admin remains potentially exposed. Patch to >=3.4.16 after host compatibility validation. |
| A | Payload AJV schema URI resolution (trusted application config). Auth URL checks use native URL / oauth4webapi, not fast-uri. Do not accept untrusted schema refs; compatible 3.1.8 patch available. |
| G | Build/lint glob patterns and Next Sass watcher, not HTTP auth input. Trusted project files/patterns only. brace-expansion patches available; braces **no patch**, prohibit untrusted patterns. |
| Y | Legacy ESLint YAML config parsing, not auth request schemas. Trusted config only; js-yaml 4.3.2 available. |
| N | PostCSS calls `nanoid/non-secure` with fixed size 6, not the vulnerable custom generator/zero-size API. Patch 3.3.18 available; no demonstrated auth exposure. |
| V | Tests use run-mode/happy-dom, not standalone unauthenticated mocker HMR server. Keep network-facing mocker disabled; Vitest 4.1.11 patch available. |
| U | Host Payload remote uploads call undici fetch. Compressed-response DoS is plausibly reachable when remote uploads are enabled (**release limitation**); WebSocket/Retry/cache/BalancedPool/dump-specific cases not invoked by plugin. Patched root/consumer to 7.29.1; host override is still required. |
| P | SWC build constructs Piscina workers. Critical RCE requires a separate prototype-pollution primitive in compiler process; no untrusted runtime request route. Build trusted source/config only; patch 4.9.4 available. |
| S | Next/PostCSS/Sass source-map parsing, trusted build maps; untrusted indexed source maps could exhaust event loop. Patch 1.2.2 available. |
| L | Payload pino-pretty logging copy: deeply nested input needed; custom host logging could expose it. Plugin avoids logging attacker secrets; patch 3.1.0 available. |
| I | Host Sharp SVG decoding: memory/RCE conditions specifically glibc Linux/non-PIE Node; Darwin acceptance cannot dismiss exposure. Patched root/consumer to 0.35.5; other hosts must patch or block SVG globally. Linux acceptance remains host-owned. |

## Every initial finding

Advisory links are the official GitHub disclosure/database records, checked on snapshot date. Patch column reports the current branch's minimum fixed version, not an applied upgrade. Paths omit leading project dot.

| Package / severity | Official advisory | Initial dependency path | Patch | Reachability |
| --- | --- | --- | --- | --- |
| esbuild / moderate | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) | `@payloadcms/db-postgres>drizzle-kit>@esbuild-kit/esm-loader>@esbuild-kit/core-utils>esbuild` | 0.25.0 | E |
| file-type / moderate | [GHSA-5v7r-6r5c-r473](https://github.com/advisories/GHSA-5v7r-6r5c-r473) | `@swc/cli>@xhmikosr/bin-wrapper>@xhmikosr/downloader>file-type` | 21.3.1 | D |
| file-type / moderate | [GHSA-j47w-4g3g-c36v](https://github.com/advisories/GHSA-j47w-4g3g-c36v) | `@swc/cli>@xhmikosr/bin-wrapper>@xhmikosr/downloader>file-type` | 21.3.2 | D |
| dompurify / moderate | [GHSA-cmwh-pvxp-8882](https://github.com/advisories/GHSA-cmwh-pvxp-8882) | `@payloadcms/ui>@monaco-editor/react>monaco-editor>dompurify` | 3.4.11 | M |
| dompurify / low | [GHSA-vxr8-fq34-vvx9](https://github.com/advisories/GHSA-vxr8-fq34-vvx9) | `@payloadcms/ui>@monaco-editor/react>monaco-editor>dompurify` | 3.4.9 | M |
| fast-uri / high | [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7) | `payload>ajv>fast-uri` | 3.1.5 | A |
| brace-expansion / high | [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | `@swc/cli>minimatch>brace-expansion` | 2.1.4 | G |
| brace-expansion / high | [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | `@eslint/eslintrc>minimatch>brace-expansion` | 1.1.18 | G |
| js-yaml / high | [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | `@eslint/eslintrc>js-yaml` | 4.3.1 | Y |
| dompurify / moderate | [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7) | `@payloadcms/ui>@monaco-editor/react>monaco-editor>dompurify` | 3.4.13 | M |
| nanoid / high | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | `@tailwindcss/postcss>postcss>nanoid` | 3.3.18 | N |
| fast-uri / high | [GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8) | `payload>ajv>fast-uri` | 3.1.6 | A |
| fast-uri / high | [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) | `payload>ajv>fast-uri` | 3.1.6 | A |
| fast-uri / high | [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf) | `payload>ajv>fast-uri` | 3.1.6 | A |
| fast-uri / high | [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) | `payload>ajv>fast-uri` | 3.1.6 | A |
| vitest / moderate | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) | `vitest` | 4.1.11 | V |
| @vitest/mocker / moderate | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) | `vitest>@vitest/mocker` | 4.1.11 | V |
| js-yaml / high | [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | `@eslint/eslintrc>js-yaml` | 4.3.2 | Y |
| undici / moderate | [GHSA-3wwx-pv8p-q78v](https://github.com/advisories/GHSA-3wwx-pv8p-q78v) | `payload>undici` | 7.29.1 | U |
| fast-uri / high | [GHSA-qw65-cvwx-89v3](https://github.com/advisories/GHSA-qw65-cvwx-89v3) | `payload>ajv>fast-uri` | 3.1.7 | A |
| undici / moderate | [GHSA-pmjh-fq2x-6v4x](https://github.com/advisories/GHSA-pmjh-fq2x-6v4x) | `payload>undici` | 7.29.1 | U |
| undici / low | [GHSA-r53p-7pc4-xj5r](https://github.com/advisories/GHSA-r53p-7pc4-xj5r) | `payload>undici` | 7.29.1 | U |
| undici / high | [GHSA-rfgv-xxqx-mfg5](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5) | `payload>undici` | 7.29.1 | U |
| undici / moderate | [GHSA-3xpg-4rpp-hhhm](https://github.com/advisories/GHSA-3xpg-4rpp-hhhm) | `payload>undici` | 7.29.1 | U |
| undici / moderate | [GHSA-2jfj-6hjv-fm6j](https://github.com/advisories/GHSA-2jfj-6hjv-fm6j) | `payload>undici` | 7.29.1 | U |
| undici / low | [GHSA-2gqq-gqf2-x968](https://github.com/advisories/GHSA-2gqq-gqf2-x968) | `payload>undici` | 7.29.1 | U |
| undici / high | [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3) | `payload>undici` | 7.29.1 | U |
| undici / low | [GHSA-8436-99hf-9mmv](https://github.com/advisories/GHSA-8436-99hf-9mmv) | `payload>undici` | 7.29.1 | U |
| undici / moderate | [GHSA-rx4f-c7p8-82vq](https://github.com/advisories/GHSA-rx4f-c7p8-82vq) | `payload>undici` | 7.29.1 | U |
| fast-uri / moderate | [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) | `payload>ajv>fast-uri` | 3.1.8 | A |
| @xhmikosr/decompress / critical | [GHSA-hrh2-vp3x-79xf](https://github.com/advisories/GHSA-hrh2-vp3x-79xf) | `@swc/cli>@xhmikosr/bin-wrapper>@xhmikosr/downloader>@xhmikosr/decompress` | 10.2.2 | D |
| brace-expansion / moderate | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | `@eslint/eslintrc>minimatch>brace-expansion` | 1.1.21 | G |
| brace-expansion / moderate | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | `@swc/cli>minimatch>brace-expansion` | 2.1.7 | G |
| brace-expansion / high | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | `@eslint/eslintrc>minimatch>brace-expansion` | 1.1.20 | G |
| brace-expansion / high | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | `@swc/cli>minimatch>brace-expansion` | 2.1.6 | G |
| brace-expansion / high | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | `@eslint/eslintrc>minimatch>brace-expansion` | 1.1.19 | G |
| brace-expansion / high | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | `@swc/cli>minimatch>brace-expansion` | 2.1.5 | G |
| piscina / critical | [GHSA-67c8-pqhq-4rmx](https://github.com/advisories/GHSA-67c8-pqhq-4rmx) | `@swc/cli>piscina` | 4.9.4 | P |
| dompurify / low | [GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4) | `@payloadcms/ui>@monaco-editor/react>monaco-editor>dompurify` | 3.4.12 | M |
| http-cache-semantics / high | [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) | `@swc/cli>@xhmikosr/bin-wrapper>@xhmikosr/downloader>got>cacheable-request>http-cache-semantics` | none | D |
| braces / high | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | `@payloadcms/next>sass>chokidar>braces` | none | G |
| dompurify / low | [GHSA-6688-9rhm-gjv2](https://github.com/advisories/GHSA-6688-9rhm-gjv2) | `@payloadcms/ui>@monaco-editor/react>monaco-editor>dompurify` | 3.4.16 | M |
| source-map-js / high | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | `@payloadcms/next>sass>source-map-js` | 1.2.2 | S |
| fast-copy / moderate | [GHSA-jggr-w7fw-pc2j](https://github.com/advisories/GHSA-jggr-w7fw-pc2j) | `payload>pino-pretty>fast-copy` | 3.1.0 | L |
| sharp / high | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | `sharp` | 0.35.5 | I |

## Release and verification gates

No blanket `pnpm update` / `audit fix` and no ignored advisory list: patches require path-specific review and packed-consumer validation. Consumers do not inherit this repository's pnpm overrides. The release maintainer must record whether host remote uploads/SVG are disabled or patched; absent that evidence, **security acceptance is pending**, not zero-vulnerability or P1-clean.

Node 22 and Node 24 are supported release lines according to [Node's official release schedule](https://nodejs.org/en/about/previous-releases); engine declaration is not execution evidence. Root actor owns clean frozen-lockfile installation, lint/typecheck, full tests and packed-consumer runs on both lines. No full-suite or Node24 pass is claimed by this report.

### Applied narrow changes / after-audit

- Root and consumer explicitly pin Sharp 0.35.5 and `payload>undici` 7.29.1; no unrelated dependency upgrade performed. Root override does not propagate to installed package consumers.
- `pnpm install`: EXIT 0; `/tmp/issue06-dependency-install.log`. Resolved lockfile contains only Sharp 0.35.5 / Undici 7.29.1 for these paths.
- After-audit JSON: `/tmp/issue06-audit-{prod,full}-after.json`: **prod 0; full 34 (2 critical / 18 high / 11 moderate / 3 low)**. This is not host-wide zero-vulnerability evidence. The initial table remains an immutable baseline; its Undici/Sharp rows are patched locally.
- The 34 remaining rows match initial table minus Undici/Sharp. Legacy YAML now resolves through `eslint>@eslint/eslintrc`; brace-expansion 1.x through `copyfiles>minimatch`, not the removed direct eslintrc declaration. No finding was suppressed.
- Node 22.23.2 `pnpm typecheck` and `pnpm lint`: EXIT 0 with no lint warnings; `/tmp/issue06-dependency-{typecheck,lint}.log`. These checks ran against current shared workspace, not clean isolation.
- Clean frozen-lockfile and packed SQLite/PostgreSQL/browser validation on Node 22/24: root actor records final evidence separately.
- Installation still warns about an unmet transitive `@emnapi/runtime@^2.0.0-alpha.3` peer (1.11.1), deprecated ESLint 9/rimraf 3 and five older transitive packages; warnings were not silently presented as compatibility proof.
- Residual DOMPurify admin and deeply nested host logging must be reviewed in the consuming application. Constrained trusted compiler paths do not justify exposing compiler/config ingestion to unauthenticated requests.
