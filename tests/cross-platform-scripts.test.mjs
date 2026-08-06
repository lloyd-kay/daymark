import assert from "node:assert/strict";
import { test } from "node:test";

import { createVinextInvocation } from "../scripts/with-wrangler-log.mjs";

test("build invocation uses Node directly and sets the Wrangler log path", () => {
  const invocation = createVinextInvocation("build", {
    execPath: "C:\\Program Files\\nodejs\\node.exe",
    projectRoot: "C:\\Daymark",
    env: { PATH: "C:\\Windows\\System32" },
  });

  assert.equal(invocation.file, "C:\\Program Files\\nodejs\\node.exe");
  assert.deepEqual(invocation.args, ["C:\\Daymark\\node_modules\\vinext\\dist\\cli.js", "build"]);
  assert.equal(invocation.env.WRANGLER_LOG_PATH, ".wrangler/wrangler.log");
  assert.equal(invocation.shell, false);
});

test("existing Wrangler log configuration is preserved", () => {
  const invocation = createVinextInvocation("dev", {
    execPath: "/usr/bin/node",
    projectRoot: "/srv/daymark",
    env: { WRANGLER_LOG_PATH: "/var/log/daymark/wrangler.log" },
  });

  assert.equal(invocation.env.WRANGLER_LOG_PATH, "/var/log/daymark/wrangler.log");
  assert.deepEqual(invocation.args, ["/srv/daymark/node_modules/vinext/dist/cli.js", "dev"]);
});

test("unsupported commands are rejected before a child process starts", () => {
  assert.throws(
    () => createVinextInvocation("deploy", { execPath: process.execPath, projectRoot: process.cwd(), env: {} }),
    /Expected one of: dev, build, start/,
  );
});
