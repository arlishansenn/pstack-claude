import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import requiredChildPolicy from "./required-child-policy.ts";

export function registerChildPolicy(pi: ExtensionAPI, writer = false): void {
  requiredChildPolicy(pi);
  const allowed = new Set(["read", "grep", "find", "ls", "contact_supervisor", ...(writer ? ["write", "edit", "bash"] : [])]);
  const filterTools = () => pi.setActiveTools(pi.getActiveTools().filter(name => allowed.has(name)));
  pi.on("session_start", filterTools);
  pi.on("before_agent_start", filterTools);
  pi.on("tool_call", event => {
    if (!allowed.has(event.toolName)) return { block: true, reason: `pstack leaf policy forbids ${event.toolName}` };
  });
}

export default function childPolicy(pi: ExtensionAPI): void {
  registerChildPolicy(pi);
}
