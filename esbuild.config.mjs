import esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

const production = process.argv[2] === "production";
mkdirSync("dist", { recursive: true });

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron"],
  format: "cjs",
  target: "es2018",
  outfile: "dist/main.js",
  sourcemap: production ? false : "inline",
  minify: production,
  logLevel: "info"
});

copyFileSync("manifest.json", "dist/manifest.json");
copyFileSync("styles.css", "dist/styles.css");
copyFileSync("versions.json", "dist/versions.json");
