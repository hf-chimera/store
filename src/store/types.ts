import type { ChimeraDebugConfig } from "../debug/types.ts";
import type { ChimeraFilterConfig, ChimeraFilterDescriptor } from "../filter/types.ts";
import type { ChimeraOrderConfig, ChimeraOrderPriority } from "../order/types.ts";
import type { ChimeraQueryConfig } from "../query/types.ts";
import type { ChimeraEntityMap } from "../shared/types.ts";
import type { ChimeraEntityRepository } from "./ChimeraEntityRepository.ts";

export type ChimeraRepositoryMap<EntityMap extends ChimeraEntityMap, FilterConfig extends ChimeraFilterConfig> = {
	[K in keyof EntityMap]: ChimeraEntityRepository<EntityMap[K], FilterConfig>;
};

export type ChimeraCollectionParams<FilterConfig extends ChimeraFilterConfig, Entity, Meta = any> = {
	filter?: ChimeraFilterDescriptor<FilterConfig, Entity>;
	order?: ChimeraOrderPriority<Entity>;
	meta?: Meta;
};

export type ChimeraStoreConfig<
	EntityMap extends ChimeraEntityMap,
	FilterConfig extends ChimeraFilterConfig = ChimeraFilterConfig,
> = {
	query?: ChimeraQueryConfig<EntityMap, FilterConfig>;
	order?: ChimeraOrderConfig;
	filter?: FilterConfig;
	debug?: ChimeraDebugConfig;
};
