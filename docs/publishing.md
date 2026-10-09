# Publish @main12/auth-login

## GitHub Actions: release a stable tag

Pushing `vX.Y.Z` to `MAIN-12/auth-login-plugin` runs `publish.yml` and publishes
publicly to npm with `latest`. The tag must exactly match `package.json`'s version;
prereleases and build metadata are rejected before dependency installation.
Versions are never bumped automatically. No npm token or GitHub secret is needed.

### One-time npm setup

The package must already exist on npm; if it does not, make its first publication
with the local flow below. A package maintainer then opens its npm **Settings →
Trusted publishing**, selects **GitHub Actions**, and configures:

| Field                | Value                                               |
| -------------------- | --------------------------------------------------- |
| Organization or user | `MAIN-12`                                           |
| Repository           | `auth-login-plugin`                                 |
| Workflow filename    | `publish.yml` (not its full path)                   |
| Environment name     | Leave empty; this workflow uses no environment      |
| Allowed actions      | Enable **Allow npm publish** for direct publication |

Do not leave the publisher stage-only: this workflow uses `npm publish`, not
`npm stage publish`. Complete the first successful publication within **2 days**
of creating the trusted publisher; recreate it if it expires. See the
[npm trusted publishing setup and expiry rules](https://docs.npmjs.com/trusted-publishers/).

### Release steps

1. Merge the workflow and release changes into the release commit.
2. Choose an unpublished stable version, update `package.json`, and commit/push it.
   Check `npm view @main12/auth-login versions --json` first. Use the current `3.0.0`
   only if it is still available; otherwise bump to the intended next version.
3. From that clean release commit, push its matching tag:

```sh
version=$(node -p "JSON.parse(require('node:fs').readFileSync('package.json', 'utf8')).version")
git tag "v$version"
git push origin "v$version"
```

4. Check **GitHub Actions → Publish to npm**, then verify
   `npm view @main12/auth-login version`.

The job uses Node 24, pnpm 10.19.0, npm 11 (OIDC requires npm ≥11.5.1), and no
dependency cache. It reuses `pnpm release:publish`: lint, typecheck, unit tests,
build, pack, and dry-run all precede uploading the exact checked tarball. Publishes
are serialized; a newer tag does not cancel a running publish. GitHub can replace
an older pending run with a newer tag, so release one version at a time. A failed
job does not roll back an upload: check npm before retrying; an existing
name/version cannot be reused.

Before the release checks, `pnpm test:consumer` verifies a packed-package external
installation, public exports, native ESM, and declarations. It is not database or
browser runtime acceptance.

Protect `v*` tags with a GitHub repository ruleset so only authorized maintainers
can create release tags, and restrict tag updates/deletion. Review the tagged
workflow before release: dependency installation and checks run with publishing
permissions. Do not add `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or registry credentials;
OIDC handles publishing, and npm generates provenance automatically for this
public repository/package. See [npm security guidance](https://docs.npmjs.com/trusted-publishers/).

## Check first

Use Node 22 or 24, pnpm, and npm. Install dependencies before running the release script:

```sh
pnpm install --frozen-lockfile
pnpm release:check
```

The check runs lint, typecheck, unit tests, and build, then creates a temporary tarball
with `pnpm pack` and checks that exact artifact with `npm publish --dry-run`.
It uploads nothing and removes the temporary tarball. Calling the script without
arguments also defaults to this safe mode. A dry run does not prove registry
permissions or version availability.

## Publish explicitly

1. Set the intended version in `package.json`, commit the release changes, and push.
2. Authenticate using `npm login --registry=https://registry.npmjs.org/` with an account
   allowed to publish `@main12/auth-login`. Never commit tokens or credentials.
3. Run:

```sh
pnpm release:publish
```

This requires a clean Git tree (tracked and untracked files) before checks and
again before uploading. It reruns all checks and publishes the checked tarball
to `https://registry.npmjs.org/` with public access and the `latest` tag.
Ignored build outputs do not dirty the Git tree. npm can prompt for 2FA.
The script never changes the version, creates commits/tags, or pushes Git changes.
A published name/version cannot be reused; bump the version for the next release.

Direct help: `node scripts/publish-package.mjs --help`.

References: [pnpm pack](https://pnpm.io/cli/pack),
[pnpm publishConfig](https://pnpm.io/package_json#publishconfig),
[npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/).
