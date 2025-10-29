import type { ChimeraDebugConfig } from "./types.ts";

export const chimeraDefaultDebugConfig = {
	devMode: false,
	logs: "info",
	name: "chimera",
} satisfies Required<ChimeraDebugConfig>;
