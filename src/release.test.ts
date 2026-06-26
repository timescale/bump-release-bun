import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const scriptPath = join(import.meta.dir, 'release.ts');

async function runScript(
  args: Array<string>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const child = Bun.spawn([process.execPath, scriptPath, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

  return { exitCode, stdout, stderr };
}

describe('release', () => {
  test('--help prints usage and exits 0', async () => {
    const { exitCode, stdout } = await runScript(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Usage: release');
  });

  test('no version argument fails with usage', async () => {
    const { exitCode, stderr } = await runScript([]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Usage: release');
  });

  test('unknown option fails', async () => {
    const { exitCode, stderr } = await runScript(['patch', '--nope']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown option '--nope'");
  });

  test('--branch without value fails', async () => {
    const { exitCode, stderr } = await runScript(['patch', '--branch']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Missing value for --branch');
  });
});
