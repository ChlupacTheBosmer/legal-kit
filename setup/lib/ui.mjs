/**
 * Terminal helpers for the setup scripts.
 *
 * No dependencies on purpose: this runs before `npm install` has been offered,
 * and a setup script that cannot run until you have installed something is not
 * a setup script.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const useColour = stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (useColour ? `[${code}m${s}[0m` : s);

export const bold = c("1");
export const dim = c("2");
export const green = c("32");
export const yellow = c("33");
export const red = c("31");
export const cyan = c("36");

export const ok = (s) => console.log(`  ${green("ok")}    ${s}`);
export const warn = (s) => console.log(`  ${yellow("note")}  ${s}`);
export const bad = (s) => console.log(`  ${red("fail")}  ${s}`);
export const info = (s) => console.log(`  ${dim("·")}     ${s}`);
export const step = (s) => console.log(`\n${bold(s)}`);

export function rule(title = "") {
  const w = Math.min(stdout.columns || 78, 78);
  if (!title) return console.log(dim("-".repeat(w)));
  console.log(`\n${bold(title)}\n${dim("-".repeat(Math.min(w, title.length + 8)))}`);
}

/**
 * Input handling, in two modes.
 *
 * On a terminal we use readline, which gives editing and history. When stdin is
 * a pipe or a file we read it once up front and serve the lines in order: a
 * piped `question()` from readline/promises never settles when the stream ends,
 * so the script would hang forever at whichever prompt ran out of input. Both
 * modes return null once there is nothing left, and every caller turns that
 * into the documented default.
 */
const interactive = Boolean(stdin.isTTY);

let rl = null;
let piped = null;
let pipedAt = 0;
let inputClosed = false;

const iface = () => (rl ??= createInterface({ input: stdin, output: stdout }));
export const closeInput = () => { rl?.close(); rl = null; };

async function readAllStdin() {
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").split("\n");
}

async function readLine(prompt) {
  if (inputClosed) return null;
  if (interactive) {
    try {
      return await iface().question(prompt);
    } catch {
      inputClosed = true;
      return null;
    }
  }
  piped ??= await readAllStdin();
  stdout.write(prompt);
  if (pipedAt >= piped.length) { inputClosed = true; stdout.write("\n"); return null; }
  const line = piped[pipedAt++];
  stdout.write(`${line}\n`);
  return line;
}

/** A free-text question with an optional default. */
export async function ask(question, fallback = "") {
  const suffix = fallback ? dim(` [${fallback}]`) : "";
  const answer = await readLine(`  ${question}${suffix} `);
  if (answer === null) { console.log(dim(`  (no input — using "${fallback}")`)); return fallback; }
  return answer.trim() || fallback;
}

/** A yes/no question. `fallback` is what an empty answer means. */
export async function confirm(question, fallback = true) {
  const hint = fallback ? "Y/n" : "y/N";
  for (;;) {
    const raw = await readLine(`  ${question} ${dim(`[${hint}]`)} `);
    if (raw === null) { console.log(dim(`  (no input — using ${fallback ? "yes" : "no"})`)); return fallback; }
    const a = raw.trim().toLowerCase();
    if (!a) return fallback;
    if (["y", "yes", "a", "ano"].includes(a)) return true;
    if (["n", "no", "ne"].includes(a)) return false;
    console.log(dim("    Answer y or n."));
  }
}

/** Pick one of a list. Returns the chosen item's `value`. */
export async function choose(question, options, fallbackIndex = 0) {
  console.log(`  ${question}`);
  options.forEach((o, i) => {
    const mark = i === fallbackIndex ? cyan("*") : " ";
    console.log(`   ${mark} ${bold(String(i + 1))}. ${o.label}${o.hint ? dim(`  ${o.hint}`) : ""}`);
  });
  for (;;) {
    const raw = await readLine(`  ${dim(`1-${options.length}`)} `);
    if (raw === null) { console.log(dim(`  (no input — using ${options[fallbackIndex].label})`)); return options[fallbackIndex].value; }
    const a = raw.trim();
    if (!a) return options[fallbackIndex].value;
    const n = Number(a);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1].value;
    console.log(dim(`    Enter a number from 1 to ${options.length}.`));
  }
}

/** Pick any number from a list. Returns an array of `value`s. */
export async function chooseMany(question, options, fallback = []) {
  console.log(`  ${question} ${dim("(comma-separated numbers, or blank for none)")}`);
  options.forEach((o, i) => console.log(`     ${bold(String(i + 1))}. ${o.label}${o.hint ? dim(`  ${o.hint}`) : ""}`));
  const raw = await readLine("  > ");
  if (raw === null) { console.log(dim("  (no input — using none)")); return fallback; }
  const a = raw.trim();
  if (!a) return fallback;
  const picked = a
    .split(/[,\s]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= options.length)
    .map((n) => options[n - 1].value);
  return [...new Set(picked)];
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Human duration from milliseconds. */
export function humanMs(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
