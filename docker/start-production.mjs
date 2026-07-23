import { spawn, spawnSync } from "node:child_process";

const children = new Set();
let shuttingDown = false;

function forwardSignal(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    child.kill(signal);
  }
}

function startProcess(label, command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  children.add(child);

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (shuttingDown) {
      if (children.size === 0) {
        process.exit(code ?? (signal ? 0 : 1));
      }
      return;
    }

    shuttingDown = true;
    console.error(`${label} exited unexpectedly${signal ? ` from ${signal}` : ` with code ${code}`}`);
    for (const otherChild of children) {
      otherChild.kill("SIGTERM");
    }
    process.exit(code && code > 0 ? code : 1);
  });

  child.on("error", (error) => {
    console.error(`Failed to start ${label}:`, error);
    forwardSignal("SIGTERM");
    process.exit(1);
  });

  return child;
}

process.on("SIGTERM", () => forwardSignal("SIGTERM"));
process.on("SIGINT", () => forwardSignal("SIGINT"));

if (process.env.FRESHWAX_SKIP_DB_PUSH !== "1") {
  const preparation = spawnSync(
    "npx",
    [
      "prisma",
      "db",
      "execute",
      "--schema",
      "prisma/schema.prisma",
      "--file",
      "prisma/upgrades/before-db-push.sql",
    ],
    {
      stdio: "inherit",
      env: process.env,
    },
  );

  if (preparation.status !== 0) {
    process.exit(preparation.status ?? 1);
  }

  const result = spawnSync("npx", ["prisma", "db", "push"], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.FRESHWAX_DISABLE_WORKER !== "1") {
  startProcess("Freshwax worker", "npx", ["tsx", "src/worker.ts"]);
}

startProcess("Freshwax web server", "node", [".next/standalone/server.js"]);
