import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { defaultSettings, parseSheet, resolveNativeRoles, resolveNativeModel } from "../../plugins/pstack/pi/config.ts";

const settings = defaultSettings(() => 0, {});
const models = JSON.parse(readFileSync(settings.modelsFile, "utf8"));
const parent = { model: "openai-codex/parent", effort: "medium" };
const resolve = (value, sheet, p = parent) => resolveNativeModel(value, settings, sheet && parseSheet(sheet), p);

test("all seventeen routing lines and panel values use the canonical tiers", () => {
  const roles = resolveNativeRoles(settings, undefined, parent);
  expect([...roles.keys()]).toEqual(models.roles.map(r => r.role));
  expect(roles.size).toBe(17);
  for (const role of models.roles) {
    const values = [models.tiers[role.models]].flat();
    expect(roles.get(role.role)).toEqual(values.map(alias => `${models.pi.models["openai-codex"][alias]}:medium`));
  }
});

test("sheet role names containing commas, pools and last value win", () => {
  const sheet = parseSheet("feature, refactoring: auto @low\nreflect judgment, divergent, synthesizer: inherit-parent\narena cross-judge pool: opus @high, litellm/codex/sol:low @max\ndefault effort: xhigh\nbug-fix: haiku\nbug-fix: sonnet");
  const roles = resolveNativeRoles(settings, sheet, parent);
  expect(roles.get("feature, refactoring")).toEqual(["openai-codex/parent:low"]);
  expect(roles.get("reflect judgment, divergent, synthesizer")).toEqual(["openai-codex/parent:xhigh"]);
  expect(roles.get("arena cross-judge pool")).toEqual([`${models.pi.models["openai-codex"].opus}:high`, "litellm/codex/sol:low"]);
  expect(roles.get("bug-fix")).toEqual([`${models.pi.models["openai-codex"].sonnet}:xhigh`]);
});

test("provider aliases, override aliases, explicit model, auto, inheritance and session effort", () => {
  expect(resolve("opus")).toBe(`${models.pi.models["openai-codex"].opus}:medium`);
  expect(resolve("opus", undefined, { model: "other/parent", effort: "off" })).toBe(`${models.pi.models.anthropic.opus}:off`);
  expect(resolve("opus", "pi models: opus=litellm/codex/sol:high\ndefault effort: low")).toBe("litellm/codex/sol:high");
  for (const value of [undefined, "auto", "inherit-parent"]) expect(resolve(value)).toBe("openai-codex/parent:medium");
  expect(resolve("litellm/codex/sol @high", "default effort: low")).toBe("litellm/codex/sol:high");
  expect(resolve("auto @session", "default effort: low")).toBe("openai-codex/parent:medium");
  expect(resolve("auto", "default effort: low")).toBe("openai-codex/parent:low");
});

test("suffix outranks role/default effort and malformed inputs fail closed", () => {
  expect(resolve("p/id:xhigh @low", "default effort: high")).toBe("p/id:xhigh");
  for (const value of ["", "unknown", "p/", "/id", "p/id:wat", "auto @wat", "p/id @low extra", "p/id,,auto"]) expect(() => resolve(value)).toThrow();
  expect(() => resolve("auto", undefined, {})).toThrow(/parent/i);
  expect(() => resolve("p/id", undefined, { model: "p/parent" })).toThrow(/effort|thinking/i);
  expect(() => resolve("p/id", "default effort: wat")).toThrow();
  expect(() => resolveNativeRoles(settings, parseSheet("arena runners: opus,,haiku"), parent)).toThrow();
});

test("every sheet role accepts its own pool without splitting commas in role names", () => {
  const sheet = parseSheet(models.roles.map(({ role }, index) => `${role}: auto @low, fixture/model-${index}:high @max`).join("\n"));
  const roles = resolveNativeRoles(settings, sheet, parent);
  for (const [index, { role }] of models.roles.entries()) {
    expect(roles.get(role)).toEqual(["openai-codex/parent:low", `fixture/model-${index}:high`]);
  }
});
