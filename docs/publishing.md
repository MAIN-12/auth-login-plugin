# Publish @main12/auth-login

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
