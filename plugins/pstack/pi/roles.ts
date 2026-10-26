import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerAgentViaEvents, type RuntimeAgentDefinition, type RuntimeAgentRegistration } from "pi-subagents/agents";
import { frontmatter, type Settings } from "./config.ts";

const ROLE_NAMES = ["comment-sicko", "poteto-agent", "thermo-nuclear-code-quality-review-subagent", "thermo-nuclear-review-subagent"] as const;

export function childPolicyPath(writer = false): string {
  return fileURLToPath(new URL(writer ? "./writer-child-policy.ts" : "./child-policy.ts", import.meta.url));
}

export function requiredChildPolicyPath(): string {
  return fileURLToPath(new URL("./required-child-policy.ts", import.meta.url));
}

export function projectNativeRoles(settings: Pick<Settings, "pluginRoot">): Map<string, RuntimeAgentDefinition> {
  return new Map(ROLE_NAMES.map(name => {
    const { fields, body } = frontmatter(readFileSync(join(settings.pluginRoot, "agents", `${name}.md`), "utf8"));
    const description = fields.get("description");
    if (fields.get("name") !== name || !description) throw new Error(`Invalid canonical role ${name}`);
    const writer = name === "poteto-agent";
    return [`pstack.${name}`, {
      description,
      systemPrompt: `${body}\n\n## Pi child boundary\nRead ${join(settings.pluginRoot, "skills", "poteto-mode", "SKILL.md")} by this absolute path; do not search the Claude plugin cache. Bundled skill names resolve under ${join(settings.pluginRoot, "skills")}. You are a leaf delegate, never the playbook owner. No nested subagents, even if the canonical prompt permits them. Do not load the parent mandate.`,
      tools: writer ? ["read", "grep", "find", "ls", "write", "edit", "bash"] : ["read", "grep", "find", "ls"],
      allowNestedSubagents: false,
      defaultContext: "fresh",
      systemPromptMode: "replace",
      inheritProjectContext: false,
      inheritGlobalContext: false,
      inheritSkills: false,
      skills: [],
      extensions: [],
      subagentOnlyExtensions: [childPolicyPath(writer)],
    }];
  }));
}

// Inert until PR 2: register through the installed native owner, never a second registry.
export function registerNativeRoles(pi: ExtensionAPI, settings: Pick<Settings, "pluginRoot">): RuntimeAgentRegistration {
  const registrations: RuntimeAgentRegistration[] = [];
  const dispose = () => { for (const registration of registrations.splice(0).reverse()) registration.dispose(); };
  try {
    for (const [name, definition] of projectNativeRoles(settings)) registrations.push(registerAgentViaEvents({ pi, name, definition }));
  } catch (error) {
    dispose();
    throw error;
  }
  return { dispose };
}
