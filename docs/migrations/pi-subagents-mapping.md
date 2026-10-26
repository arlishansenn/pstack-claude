# Pi native child mapping — pending activation

**Inactive preparation only.** Production still uses the existing Pi extension
and its live `pi-tools.md` mapping. Nothing in this document registers agents or
changes execution. Activation and legacy execution removal belong to PR 2.

## Role publication

The four Markdown files in `plugins/pstack/agents` remain canonical. The inert
`projectNativeRoles` helper preserves their bodies and descriptions and appends
Pi path and leaf-policy guidance. `registerNativeRoles` publishes them through
the installed pi-subagents 0.82.1 owner's public event API, rolls back partial
registration on failure, and returns an idempotent disposer. Missing native
ownership and name collisions fail closed; there is no static discovery,
fallback runner, compatibility wrapper, or coordinator.

| Canonical basename | Runtime name | Tools |
| --- | --- | --- |
| poteto-agent | pstack.poteto-agent | read, grep, find, ls, write, edit, bash |
| comment-sicko | pstack.comment-sicko | read, grep, find, ls |
| thermo-nuclear-review-subagent | pstack.thermo-nuclear-review-subagent | read, grep, find, ls |
| thermo-nuclear-code-quality-review-subagent | pstack.thermo-nuclear-code-quality-review-subagent | read, grep, find, ls |

Every role uses fresh context, replacement prompt mode, no inherited project or
global context, no discovered skills, no selected skills, no ambient extensions,
and no nested subagents. Skills are read explicitly by installed absolute path.
The native `contact_supervisor` tool is the sole control-channel exception if
provided by the host; it is not an extra delegated execution capability.

## Child policies

- `required-child-policy.ts` supplies sheet/tool guidance and blocks delegation
  tools and parallel wrappers. It never filters active tools or removes writer
  permissions. `requiredChildPolicyPath()` exposes its module-relative path for
  future mandatory native registration; PR 1 does not register it in production.
- `child-policy.ts` applies shared guidance plus a strict allowlist and a
  tool-call guard for review roles. Mutation, shell, image generation, delegation,
  unknown tools and wrappers are excluded.
- `writer-child-policy.ts` uses the same guard with write/edit/bash additionally
  permitted. No delegation is permitted.

Neither policy installs the parent mandate, ask, wakeup, role publication, or
lifecycle ownership. The public required-child extension fixture verifies that
a mandatory path survives an agent's empty extension list. The role-specific
child-only entrypoints supply the stricter per-role boundary.

## Routing and effort

The 17 `models.json` role lines are routing entries, not agent definitions.
`resolveNativeRoles` keeps their order and tier/pool values, applying the last
matching sheet line for each complete role name (including names with commas).
Each comma-separated pool entry resolves independently through the existing
`resolveModel` authority and `checkEffort` validation.

- Aliases follow the parent provider, or the canonical fallback table, with
  `pi models:` overrides taking precedence over the table.
- Explicit provider/model IDs pass through, including IDs with embedded slashes.
- `auto`, `inherit-parent`, and omitted model values use the actual parent model;
  an unavailable parent is an error, never a native-default fallback.
- Effort precedence is model suffix, role `@effort`, sheet default effort, then
  canonical default effort. `session` uses the parent's actual thinking level.
- The forwarded value is always `provider/id:effort`. A separate native
  top-level `thinking` value is not relied on. Malformed inputs fail closed.

## Isolated live evidence and follow-up procedure

The parent orchestrator ran an isolated native provider smoke and supplied a
verification artifact with 21 passing checks and no failures. The implementation
worker inspected that artifact; it did not independently launch the live smoke.

| Run | Runtime role | Recorded model/effort | Actual calls |
| --- | --- | --- | --- |
| b8f82939-a5c2-4498-b7a2-9fca51de06d3 | pstack.poteto-agent | litellm/codex/sol-latest:high | read, bash |
| 9f64a305-1b5c-4ef3-b630-791bc4ce5634 | pstack.thermo-nuclear-review-subagent | litellm/codex/sol-latest:medium | read |

Both runs have one exact native notice, observed runner termination with exit 0,
the injected sheet, and no parent mandate. The reviewer tool registry contains
only read, grep, find, ls and contact_supervisor. These are isolated fixture
results, not production activation or proof of every model/provider combination.
The following procedure remains useful for reproducing discovery and expanding
coverage to inherited/session cases:

1. Create a throwaway Pi agent/config directory and working directory. Provide
   only the credentials/provider configuration needed for the chosen smoke
   models; do not edit the operator's normal settings or model sheet.
2. Load pi-subagents 0.82.1 and a temporary fixture extension explicitly. The
   fixture imports this checkout's helpers, registers runtime roles after the
   native owner is ready, and registers `requiredChildPolicyPath()` through
   `registerRequiredChildExtensions` with the actual parent session identity and
   `requireForAllRunners: true`. Dispose both registrations on shutdown. Do not
   load the production composition root as an activation mechanism.
3. Call native `subagent({ action: "list" })`; verify exactly the four pstack
   runtime names and no static pstack definitions or shadowing candidates.
4. Resolve representative explicit provider/model, alias, `auto`/`inherit-parent`,
   role effort, suffix-precedence, and `session` cases with the real parent model
   and thinking. Launch fresh native children with the returned model string:
   `subagent({ agent: "pstack.poteto-agent", task: "Return a unique marker",
   model: resolved, async: true })`.
5. Read each native child transcript and status artifact. Assert actual provider,
   model ID and thinking records equal the resolved values, the marker is
   present, and exactly one native terminal notification uses that run ID.
   Do not substitute a child's prose self-report for transcript evidence.
6. Launch strict review and writer probes. Inspect actual provider tool schemas:
   strict children must have no write/edit/bash/image/delegation/wrapper tools;
   writers must retain write/edit/bash but no delegation. Verify mandatory
   extension evidence, hostile direct/wrapper call blocking, and no inherited
   parent mandate or ambient AGENTS playbook. Clean up the isolated directory.

Native management `get` does not select runtime definitions in the tested
version; runtime `list` and actual child launch/transcript evidence are the
relevant public discovery checks. Lifecycle activation, stop-on-parent-exit,
missed-start recovery, and atomic legacy removal remain PR 2 work.
