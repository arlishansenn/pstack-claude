import { expect, test } from "bun:test";
import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePiLaunchToolPlan } from "pi-subagents/child-tool-plan";
import { registerRequiredChildExtensions } from "pi-subagents/required-child-extensions";
import { resolveSubagentLaunchContract } from "pi-subagents/preflight";
import { projectNativeRoles, registerNativeRoles, childPolicyPath, requiredChildPolicyPath } from "../../plugins/pstack/pi/roles.ts";
import requiredChildPolicy from "../../plugins/pstack/pi/required-child-policy.ts";
import writerChildPolicy from "../../plugins/pstack/pi/writer-child-policy.ts";
import childPolicy from "../../plugins/pstack/pi/child-policy.ts";
import { defaultSettings, frontmatter } from "../../plugins/pstack/pi/config.ts";
import { fakePi, fakeCtx } from "./harness.mjs";

const settings = defaultSettings(() => 0, {});

test("four canonical prompts project to explicit leaf-only native definitions", () => {
  const roles = projectNativeRoles(settings);
  expect(roles.size).toBe(4);
  for (const [name, definition] of roles) {
    const base = name.slice("pstack.".length);
    const source = frontmatter(readFileSync(join(settings.pluginRoot, "agents", `${base}.md`), "utf8"));
    expect(definition.description).toBe(source.fields.get("description"));
    expect(definition.systemPrompt).toContain(source.body);
    expect(definition.systemPrompt).toContain(join(settings.pluginRoot, "skills", "poteto-mode", "SKILL.md"));
    expect(definition).toMatchObject({ allowNestedSubagents: false, defaultContext: "fresh", inheritProjectContext: false, inheritGlobalContext: false, inheritSkills: false, skills: [], extensions: [], systemPromptMode: "replace" });
    expect(definition.subagentOnlyExtensions).toEqual([childPolicyPath(base === "poteto-agent")]);
    const plan = resolvePiLaunchToolPlan({ ...definition, cwd: settings.pluginRoot });
    expect(plan.fanoutAuthorized).toBe(false);
    expect(plan.disableAmbientExtensions).toBe(true);
    expect(plan.configuredExtensions).toContain(childPolicyPath(base === "poteto-agent"));
    if (base === "poteto-agent") expect(plan.effectiveToolAllowlist).toEqual(expect.arrayContaining(["read", "write", "edit", "bash"]));
    else expect(plan.effectiveToolAllowlist).toEqual(["read", "grep", "find", "ls"]);
    expect(plan.effectiveToolAllowlist).not.toContain("subagent");
  }
});

test("public runtime discovery, transactional collision rollback and disposal", () => {
  const root = mkdtempSync(join(tmpdir(), "pstack-native-isolation-"));
  try {
    const env = { ...process.env, HOME: root, PI_CODING_AGENT_DIR: join(root, "agent"), PI_SUBAGENTS_TEMP_ROOT: join(root, "native") };
    delete env.PI_SUBAGENT_CHILD;
    delete env.PI_SUBAGENT_PARENT_SESSION;
    const result = Bun.spawnSync([process.execPath, new URL("./fixtures/native-role-host.mjs", import.meta.url).pathname], { env, cwd: root });
    expect(result.stderr.toString()).toBe("");
    expect(result.stdout.toString()).toContain("native registration/discovery/disposal/rollback passed");
    expect(result.exitCode).toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("missing native owner fails closed and required-child paths survive empty extensions", async () => {
  const h = fakePi();
  h.api.events = { emit() {} };
  expect(() => registerNativeRoles(h.api, settings)).toThrow(/not installed|not ready/);
  const path = requiredChildPolicyPath();
  expect(existsSync(path)).toBe(true);
  const root = mkdtempSync(join(tmpdir(), "pstack-required-child-"));
  const registration = registerRequiredChildExtensions({ sessionId: root, extensions: [{ id: "pstack-child-policy", path }], requireForAllRunners: true });
  try {
    mkdirSync(join(root, ".pi", "agents"), { recursive: true });
    writeFileSync(join(root, ".pi", "agents", "leaf.md"), "---\nname: leaf\ndescription: fixture\ntools: read\nextensions:\n---\nRead only.");
    const result = await resolveSubagentLaunchContract({ agent: "leaf", cwd: root, parentSessionId: root, model: "fixture/model:medium", availableModels: [{ provider: "fixture", id: "model", reasoning: true }] });
    expect(result.ok).toBe(true);
    expect(result.contract.tools.requiredExtensionIds).toEqual(["pstack-child-policy"]);
    const plan = resolvePiLaunchToolPlan({ tools: ["read"], extensions: [], requiredExtensions: [{ id: "pstack-child-policy", path }], cwd: root });
    expect(plan.requiredExtensions[0].path).toBe(path);
  } finally { registration.dispose(); rmSync(root, { recursive: true, force: true }); }
});

test("child-only guard blocks hostile direct and wrapper calls with no parent mandate", async () => {
  const h = fakePi();
  let tools = ["read", "grep", "find", "ls", "contact_supervisor", "write", "edit", "bash", "image_gen", "delegate", "subagent", "multi_tool_use.parallel"];
  h.api.getActiveTools = () => tools;
  h.api.setActiveTools = active => { tools = active; };
  childPolicy(h.api);
  const ctx = fakeCtx();
  await h.emit("session_start", {}, ctx);
  expect(tools).toEqual(["read", "grep", "find", "ls", "contact_supervisor"]);
  for (const toolName of ["write", "edit", "bash", "image_gen", "image_gen.imagegen", "delegate", "subagent", "multi_tool_use.parallel", "unknown"]) {
    expect((await h.emit("tool_call", { toolName, input: { tool_uses: [{ recipient_name: "functions.write" }] } }, ctx)).some(result => result?.block)).toBe(true);
  }
  expect((await h.emit("tool_call", { toolName: "read", input: {} }, ctx))[0]).toBeUndefined();
  const event = { systemPromptOptions: { sections: {} } };
  await h.emit("before_agent_start", event, ctx);
  expect(event.systemPromptOptions.sections).not.toHaveProperty("pstack-session-start");
  expect(JSON.stringify(event)).toContain("No nested subagents");
  expect(h.tools.size).toBe(0);
  expect(h.commands.size).toBe(0);
});


test("shared required policy preserves writer permissions and denies delegation without filtering tools", async () => {
  const h = fakePi();
  const tools = ["read", "write", "edit", "bash", "contact_supervisor", "subagent", "delegate"];
  h.api.getActiveTools = () => tools;
  h.api.setActiveTools = () => { throw new Error("shared required policy must not filter tools"); };
  requiredChildPolicy(h.api);
  const ctx = fakeCtx();
  await h.emit("session_start", {}, ctx);
  const event = { systemPromptOptions: { sections: {} } };
  await h.emit("before_agent_start", event, ctx);
  expect(h.api.getActiveTools()).toEqual(tools);
  for (const toolName of ["write", "edit", "bash", "contact_supervisor"]) {
    expect((await h.emit("tool_call", { toolName, input: {} }, ctx))[0]).toBeUndefined();
  }
  for (const toolName of ["agent", "subagent", "delegate", "workflow", "send_message", "list_agents", "stop_agent", "multi_tool_use.parallel", "functions.subagent"]) {
    expect((await h.emit("tool_call", { toolName, input: {} }, ctx))[0]).toMatchObject({ block: true });
  }
  expect(event.systemPromptOptions.sections).not.toHaveProperty("pstack-session-start");
  expect(JSON.stringify(event)).toContain("No nested subagents");
});

test("writer guard retains write/edit/bash while rejecting delegation and ambient tools", async () => {
  const h = fakePi();
  let tools = ["read", "write", "edit", "bash", "contact_supervisor", "subagent", "image_gen"];
  h.api.getActiveTools = () => tools;
  h.api.setActiveTools = active => { tools = active; };
  writerChildPolicy(h.api);
  const ctx = fakeCtx();
  await h.emit("session_start", {}, ctx);
  expect(tools).toEqual(["read", "write", "edit", "bash", "contact_supervisor"]);
  for (const toolName of ["write", "edit", "bash"]) {
    expect((await h.emit("tool_call", { toolName, input: {} }, ctx)).every(result => result === undefined)).toBe(true);
  }
  for (const toolName of ["subagent", "image_gen", "multi_tool_use.parallel"]) {
    expect((await h.emit("tool_call", { toolName, input: {} }, ctx)).some(result => result?.block)).toBe(true);
  }
});
