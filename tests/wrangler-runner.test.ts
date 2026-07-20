import { describe, expect, test } from "bun:test";
import {
  buildWranglerInvocation,
  buildWranglerEnvironment,
  buildWranglerSpawnOptions,
  isD1MigrationApplyCommand,
  resolveWranglerCliPath,
  runWranglerSync,
} from "../scripts/wrangler-runner.mjs";

describe("cross-platform Wrangler runner", () => {
  test("uses the installed JavaScript CLI instead of a platform shell shim", () => {
    const invocation = buildWranglerInvocation(["--version"], {
      cwd: process.cwd(),
      runtimeExecutable: process.execPath,
    });

    expect(invocation.executable).toBe(process.execPath);
    expect(invocation.args).toEqual([resolveWranglerCliPath(process.cwd()), "--version"]);
    expect(invocation.args[0]).toEndWith("node_modules/wrangler/bin/wrangler.js");
    expect(invocation.args[0]).not.toEndWith("wrangler.cmd");
  });

  test("runs the project-local Wrangler without a global installation", () => {
    const result = runWranglerSync(["--version"], { cwd: process.cwd(), encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("forces D1 migration apply into non-interactive CI mode", () => {
    const args = ["--config", "generated.toml", "d1", "migrations", "apply", "DB", "--remote"];

    expect(isD1MigrationApplyCommand(args)).toBe(true);
    expect(buildWranglerEnvironment(args, { EXISTING: "value" })).toMatchObject({
      EXISTING: "value",
      CI: "true",
    });
    expect(buildWranglerEnvironment(["d1", "migrations", "list", "DB"], {})).not.toHaveProperty("CI");
    expect(buildWranglerSpawnOptions(args, { stdio: "inherit" })).toEqual({
      input: "y\n",
      stdio: ["pipe", "inherit", "inherit"],
    });
  });
});
