#!/usr/bin/env bun

import semver from 'semver';

interface PackageJson {
  version?: string;
  [key: string]: unknown;
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

const INCREMENT_TYPES = ['major', 'minor', 'patch'] as const;
type IncrementType = (typeof INCREMENT_TYPES)[number];

const USAGE = `Usage: release <version | major | minor | patch> [options]

Bumps the version in package.json, commits the change, creates a matching
git tag (vX.Y.Z), and pushes the commit and tag to the remote.

Arguments:
  <version>         An explicit semver version (e.g. 1.2.3), or one of:
                    major, minor, patch (to increment the current version).

Options:
  --branch <name>   Branch that must be checked out to release.
                    (default: "main", or env RELEASE_BRANCH)
  --remote <name>   Remote to fetch from and push to.
                    (default: "origin", or env RELEASE_REMOTE)
  -h, --help        Show this help.`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function run(args: Array<string>): Promise<CommandResult> {
  const child = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

  if (exitCode !== 0) {
    const command = args.join(' ');
    fail(stderr.trim() || `Command failed: ${command}`);
  }

  return { stdout, stderr };
}

function validateVersion(version: string): void {
  if (!semver.valid(version)) {
    fail(`Invalid version '${version}'. Expected semver like 0.7.0.`);
  }
}

function isIncrementType(value: string): value is IncrementType {
  return (INCREMENT_TYPES as ReadonlyArray<string>).includes(value);
}

interface ParsedArgs {
  versionArg: string;
  branch: string;
  remote: string;
}

function parseArgs(argv: Array<string>): ParsedArgs {
  let versionArg: string | undefined;
  let branch = process.env.RELEASE_BRANCH || 'main';
  let remote = process.env.RELEASE_REMOTE || 'origin';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '-h' || arg === '--help') {
      console.log(USAGE);
      process.exit(0);
    } else if (arg === '--branch') {
      const value = argv[index + 1];
      if (!value) {
        fail('Missing value for --branch.');
      }
      branch = value;
      index += 1;
    } else if (arg === '--remote') {
      const value = argv[index + 1];
      if (!value) {
        fail('Missing value for --remote.');
      }
      remote = value;
      index += 1;
    } else if (arg.startsWith('-')) {
      fail(`Unknown option '${arg}'.\n\n${USAGE}`);
    } else if (versionArg === undefined) {
      versionArg = arg;
    } else {
      fail(`Unexpected argument '${arg}'.\n\n${USAGE}`);
    }
  }

  if (!versionArg) {
    fail(USAGE);
  }

  return { versionArg, branch, remote };
}

const { versionArg, branch, remote } = parseArgs(process.argv.slice(2));

const releaseStatus = await run(['git', 'status', '--porcelain']);
if (releaseStatus.stdout.trim().length > 0) {
  fail(
    'Working directory is not clean. Commit, stash, or discard changes before releasing.',
  );
}

const packageFile = Bun.file('package.json');
if (!(await packageFile.exists())) {
  fail('package.json not found in current directory.');
}

const packageJson = (await packageFile.json()) as PackageJson;
const currentVersion = packageJson.version;

if (!currentVersion || !semver.valid(currentVersion)) {
  fail(
    `Current version '${currentVersion ?? '(missing)'}' in package.json is not valid semver.`,
  );
}

const nextVersion = isIncrementType(versionArg)
  ? semver.inc(currentVersion, versionArg)
  : versionArg;

if (!nextVersion) {
  fail(`Failed to compute next version from '${versionArg}'.`);
}

validateVersion(nextVersion);

if (!semver.gt(nextVersion, currentVersion)) {
  fail(
    `Version ${nextVersion} is not greater than current version ${currentVersion}.`,
  );
}

const tagName = `v${nextVersion}`;
const tagCheck = await run(['git', 'tag', '-l', tagName]);
if (tagCheck.stdout.trim() === tagName) {
  fail(`Tag ${tagName} already exists.`);
}

const branchResult = await run(['git', 'rev-parse', '--abbrev-ref', 'HEAD']);
const currentBranch = branchResult.stdout.trim();
if (currentBranch !== branch) {
  fail(
    `Must be on the '${branch}' branch to release. Currently on '${currentBranch}'.`,
  );
}

await run(['git', 'fetch', remote, branch]);
const behindResult = await run([
  'git',
  'rev-list',
  '--count',
  `${branch}..${remote}/${branch}`,
]);
const behindCount = Number.parseInt(behindResult.stdout.trim(), 10);
if (behindCount > 0) {
  fail(
    `Local '${branch}' is ${behindCount} commit(s) behind '${remote}/${branch}'. Pull before releasing.`,
  );
}

packageJson.version = nextVersion;
await Bun.write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

await run(['git', 'add', 'package.json']);
await run(['git', 'commit', '-m', `release: ${tagName}`]);
await run(['git', 'tag', '-a', tagName, '-m', tagName]);
await run(['git', 'push', '--follow-tags', remote, branch]);

console.log(`Released ${tagName}.`);
