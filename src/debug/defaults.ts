import type { ChimeraDebugConfig } from "./types.ts";

export const chimeraDefaultDebugConfig = {
	devMode: false,
	logs: false,
	name: "chimera",
} satisfies Required<ChimeraDebugConfig>;
