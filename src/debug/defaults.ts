import type { ChimeraDebugConfig } from "./types.ts";

export const chimeraDefaultDebugConfig = {
	name: "chimera",
	devMode: false,
	logs: false,
} satisfies Required<ChimeraDebugConfig>;
