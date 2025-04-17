import type { ChimeraDebugConfig } from "../debug/types.ts";
import type { ChimeraFilterConfig } from "../filter/types.ts";
import type { ChimeraOrderConfig } from "../order/types.ts";
import type { ChimeraQueryConfig } from "../query/types.ts";
import type { ChimeraEntityMap } from "../shared/types.ts";

export type ChimeraStoreConfig<
	EntityMap extends ChimeraEntityMap,
	FilterConfig extends ChimeraFilterConfig = ChimeraFilterConfig,
> = {
	query?: ChimeraQueryConfig<EntityMap, FilterConfig>;
	order?: ChimeraOrderConfig;
	filter?: FilterConfig;
	debug?: ChimeraDebugConfig;
};
