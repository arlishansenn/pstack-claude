import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerChildPolicy } from "./child-policy.ts";

export default function writerChildPolicy(pi: ExtensionAPI): void {
  registerChildPolicy(pi, true);
}
