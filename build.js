const esbuild = require("esbuild");

esbuild.build({
  entryPoints: ["src.js"], // ← ВАЖНО
  bundle: true,
  outfile: "main.js",      // ← сюда собираем
  format: "cjs",
  platform: "node",
  external: ["obsidian"],
}).catch(() => process.exit(1));