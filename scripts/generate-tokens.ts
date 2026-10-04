/**
 * Generates src/styles/tokens.css from src/styles/tokens.json.
 * Runs automatically before `dev` and `build` (package.json pre-scripts).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildTokensCss, type Tokens } from "../src/styles/build-tokens";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "src/styles/tokens.json");
const target = join(root, "src/styles/tokens.css");

const tokens = JSON.parse(readFileSync(source, "utf8")) as Tokens;
writeFileSync(target, buildTokensCss(tokens), "utf8");
console.log(`tokens: wrote ${target}`);
