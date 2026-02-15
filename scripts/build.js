import { $ } from "bun";

await $`tsup src/index.ts --format esm,cjs --dts --out-dir lib`;

await $`esbuild src/cli.ts --platform=node --bundle --outfile=./bin/secenvs --format=esm --minify --external:age-encryption --banner:js="#!/usr/bin/env node"`;

if (process.platform !== "win32") {
  require("fs").chmodSync("./bin/secenvs", "755");
}
