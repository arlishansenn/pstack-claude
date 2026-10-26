# PR 1 verification evidence

Base: `356c6e0f978df729eb16f227d795f34d221c5aad`. Commands ran in the
exclusive PR 1 worker worktree with Bun 1.3.9. No production activation.

## TDD RED → GREEN

Initial behavior tests preceded the implementation:

```sh
bun test tests/pi/native-models.test.mjs tests/pi/native-roles.test.mjs
```

Expected RED (exit 1; 0 pass, 2 fail, 2 errors):

```text
SyntaxError: Export named 'resolveNativeModel' not found in module '…/plugins/pstack/pi/config.ts'.
error: Cannot find module '../../plugins/pstack/pi/roles.ts' from '…/tests/pi/native-roles.test.mjs'
```

Initial implementation GREEN: 8 pass, 0 fail, 112 assertions. Subsequent fixture
isolation retained 8 pass, 0 fail, 109 assertions; native discovery now runs in a
subprocess with throwaway HOME, agent directory and native temp root.

After approval of the shared required policy, tests were extended before adding
the module, changed all projected roles to expect no inherited project context,
and changed the mandatory-extension fixture to `requiredChildPolicyPath()`.
The same command produced expected RED (exit 1; 4 pass, 1 fail, 1 error):

```text
error: Cannot find module '../../plugins/pstack/pi/required-child-policy.ts' from '…/tests/pi/native-roles.test.mjs'
```

After implementation: 10 pass, 0 fail, 128 assertions. The mandatory fixture
registers the shared path through the public required-child API and verifies
its retained identity via native preflight and tool-plan resolution. The shared
policy test makes `setActiveTools` throw, verifies writer/control tools remain
permitted, and verifies delegation is blocked.

Parent review requested more delegation names. Tests were extended first:

```sh
bun test tests/pi/native-roles.test.mjs
```

Expected RED (exit 1; 5 pass, 1 fail):

```text
(fail) shared required policy preserves writer permissions and denies delegation without filtering tools
error: expect(received).toMatchObject(expected)
Matcher error: received value must be a non-null object
```

The first newly tested `workflow` call returned undefined rather than a block.
The guard now also blocks workflow, send_message, list_agents and stop_agent.

Final targeted GREEN, including all 17 role pools:

```sh
bun test tests/pi/native-models.test.mjs tests/pi/native-roles.test.mjs
```

11 pass, 0 fail, 149 assertions.

## Final verification

| Exact command | Result |
| --- | --- |
| `bun install` | Dependencies installed and lockfile saved; Bun blocked two dependency postinstalls. |
| `bun install --frozen-lockfile` | 128 installs across 127 packages checked, no changes. |
| `bun test tests/pi/` | 244 pass, 13 skip, 0 fail; 765 assertions. |
| `bun tools/generate.mjs --check` | 85 generated files current; all generator invariants pass. |
| `PI_PACKAGE_DIR=/Users/admin/.pi/agent/install/releases/1.4.0/node_modules/@earendil-works/pi-coding-agent bun tools/typecheck-pi.mjs` | Exit 0. The machine-specific path is only a verification command, never production or fixture resolution. |
| `bun test tests/` | 1320 pass, 36 skip, 1 fail; 3839 assertions. Only the known baseline concurrent-writer timeout remains. |
| `git diff --check` | Exit 0. |

Full-suite failure content:

```text
(fail) 40 concurrent writers with 400 KB rows leave every row intact [5001.78ms]
  ^ this test timed out after 5000ms.
```

Unchanged-runtime check (empty output):

```sh
git diff --name-only 356c6e0f978df729eb16f227d795f34d221c5aad -- plugins/pstack/.codex-plugin plugins/pstack/.github plugins/pstack/.muse-plugin plugins/pstack/hooks plugins/pstack/skills plugins/pstack/agents plugins/pstack/models.json plugins/pstack/pi/index.ts
```

All generated outputs remain current and byte-identical to the base. Production
index, live Pi guidance, package discovery metadata, canonical prompts and
models.json remain unchanged. Self-review removed unchecked JSON casts and a
non-null assertion from the new implementation; no runtime fallback or lifecycle
scaffolding was added.

## Live evidence provenance and limits

The parent orchestrator ran the isolated live smoke, not the implementation
worker. The worker inspected `/tmp/pstack-pr1-live/verification.json`: passed,
21 checks, zero failures. These temporary artifacts are external evidence, not
production dependencies or committed test imports. Recorded writer/reviewer
run IDs and model/effort/tool evidence, plus the reproduction procedure, are in
[the pending mapping](pi-subagents-mapping.md#isolated-live-evidence-and-follow-up-procedure).

Explicit high/medium launches are verified by that smoke. Representative
inherited/session model cases remain candidates for expanded live transcript
coverage; they are covered by pure tests. Production lifecycle activation,
missed-start recovery and atomic legacy execution removal remain PR 2 work.
