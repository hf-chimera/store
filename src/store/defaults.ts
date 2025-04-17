import { chimeraDefaultDebugConfig } from "../debug/defaults.ts";
import { chimeraDefaultFilterConfig } from "../filter/defaults.ts";
import { chimeraDefaultOrderConfig } from "../order/defaults.ts";
import { chimeraDefaultQueryConfig } from "../query/defaults.ts";
import type { ChimeraEntityMap } from "../shared/types.ts";
import type { ChimeraStoreConfig } from "./types.ts";

export const chimeraDefaultStoreConfig = {
	order: chimeraDefaultOrderConfig,
	filter: chimeraDefaultFilterConfig,
	query: chimeraDefaultQueryConfig,
	debug: chimeraDefaultDebugConfig,
} satisfies ChimeraStoreConfig<ChimeraEntityMap>;
