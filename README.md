# @tigerdata/bump-release

A small [Bun](https://bun.sh) CLI that automates a tag-driven release: it bumps
the version in `package.json`, commits the change, creates a matching annotated
git tag (`vX.Y.Z`), and pushes the commit and tag to the remote.

Pushing the tag is what triggers your publish workflow (e.g. an
"on push tag `v*.*.*`" GitHub Action that runs `npm publish`).

## What it does

Given a target version, the tool:

1. Verifies the working directory is clean.
2. Reads and validates the current version in `package.json`.
3. Computes the next version (explicit, or `major`/`minor`/`patch` bump) and
   confirms it is valid semver and strictly greater than the current version.
4. Confirms the matching tag does not already exist.
5. Confirms you are on the expected branch (default `main`) and not behind the
   remote.
6. Writes the new version, commits (`release: vX.Y.Z`), creates the tag, and
   pushes with `--follow-tags`.

If any check fails, it exits non-zero without modifying anything.

## Usage

```
bump-release <version | major | minor | patch> [options]
```

Options:

| Option            | Default            | Description                              |
| ----------------- | ------------------ | ---------------------------------------- |
| `--branch <name>` | `main` (`RELEASE_BRANCH`) | Branch that must be checked out to release. |
| `--remote <name>` | `origin` (`RELEASE_REMOTE`) | Remote to fetch from and push to.    |
| `-h`, `--help`    |                    | Show help.                               |

### As a devDependency (recommended)

```jsonc
{
  "devDependencies": {
    "@tigerdata/bump-release": "^0.1.0"
  },
  "scripts": {
    "release": "bump-release"
  }
}
```

Then:

```sh
bun run release patch       # 1.2.3 -> 1.2.4
bun run release minor       # 1.2.3 -> 1.3.0
bun run release 2.0.0       # explicit version
```

### Zero-install

```sh
bunx @tigerdata/bump-release patch
```

## Requirements

- [Bun](https://bun.sh) (the CLI is shipped as TypeScript and run by Bun).
- A git repository with a configured remote.
- A `package.json` with a valid semver `version` in the current directory.

## License

Apache-2.0
