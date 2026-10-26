import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import native from "pi-subagents";
import { registerAgent } from "pi-subagents/agents";
import { defaultSettings } from "../../../plugins/pstack/pi/config.ts";
import { registerNativeRoles, projectNativeRoles } from "../../../plugins/pstack/pi/roles.ts";
import { fakePi, fakeCtx } from "../harness.mjs";
const settings = defaultSettings(() => 0, {});
function host() {
  const h = fakePi();
  const bus = new EventEmitter();
  Object.assign(h.api, {
    events: { emit: (n, v) => bus.emit(n, v), on: (n, f) => { bus.on(n, f); return () => bus.off(n, f); } },
    registerMessageRenderer() {}, registerShortcut() {}, getActiveTools: () => [...h.tools.keys()],
    setActiveTools() {}, setToolPolicy() {}, getFlag() {},
  });
  const childEnv = process.env.PI_SUBAGENT_CHILD;
  delete process.env.PI_SUBAGENT_CHILD;
  try { native(h.api); } finally { if (childEnv !== undefined) process.env.PI_SUBAGENT_CHILD = childEnv; }
  return h;
}


const h = host();
const root = mkdtempSync(join(tmpdir(), "pstack-native-host-"));
const ctx = fakeCtx({ cwd: root });
ctx.sessionManager.getSessionFile = () => undefined;
try {
  const blocker = registerAgent({ pi: h.api, name: "pstack.poteto-agent", definition: { description: "collision", systemPrompt: "blocked" } });
  assert.throws(() => registerNativeRoles(h.api, settings), /collid|already/i);
  blocker.dispose();
  const registration = registerNativeRoles(h.api, settings);
  const tool = h.tools.get("subagent");
  const list = await tool.execute("list", { action: "list" }, undefined, undefined, ctx);
  const text = JSON.stringify(list);
  for (const name of projectNativeRoles(settings).keys()) assert.ok(text.includes(name));
  registration.dispose();
  registration.dispose();
  const after = JSON.stringify(await tool.execute("list2", { action: "list" }, undefined, undefined, ctx));
  assert.ok(!after.includes("pstack.poteto-agent"));
  const again = registerNativeRoles(h.api, settings);
  again.dispose();
} finally {
  await h.emit("session_shutdown", { reason: "quit" }, ctx);
  rmSync(root, { recursive: true, force: true });
}
console.log("native registration/discovery/disposal/rollback passed");
