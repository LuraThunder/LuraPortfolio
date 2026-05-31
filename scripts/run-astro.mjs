import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.argv[2] ?? "build";
const passthroughArgs = process.argv.slice(3);
const astroBin = fileURLToPath(new URL("../node_modules/astro/astro.js", import.meta.url));

const child = spawn(
  process.execPath,
  [astroBin, command, ...passthroughArgs],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: "1",
    },
    shell: false,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
