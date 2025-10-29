import type { ChimeraDebugConfig } from "../debug/types.ts";
import type { ChimeraFilterConfig, ChimeraFilterDescriptor, ChimeraOperatorMap } from '../filter/types.ts';
import type { ChimeraOrderConfig, ChimeraOrderPriority } from "../order/types.ts";
import type { ChimeraQueryConfig, QueryEntityConfig } from "../query/types.ts";
import type { ChimeraEntityMap, StrKeys } from "../shared/types.ts";
import type { ChimeraEntityRepository } from "./ChimeraEntityRepository.ts";

export type ChimeraRepositoryMap<
	EntityMap extends ChimeraEntityMap,
	OperatorsMap extends ChimeraOperatorMap,
> = Partial<{
	[K in StrKeys<EntityMap>]: ChimeraEntityRepository<EntityMap[K], OperatorsMap>;
}>;

export type ChimeraRepositoryConfigMap<EntityMap extends ChimeraEntityMap, OperatorsMap extends ChimeraOperatorMap> = {
	[K in StrKeys<EntityMap>]: QueryEntityConfig<EntityMap[K], OperatorsMap>;
};

export type ChimeraCollectionParams<OperatorsMap extends ChimeraOperatorMap, Entity, Meta = any> = {
	filter?: ChimeraFilterDescriptor<OperatorsMap, Entity> | null;
	order?: ChimeraOrderPriority<Entity> | null;
	meta?: Meta;
};

export type ChimeraStoreConfig<EntityMap extends ChimeraEntityMap, OperatorsMap extends ChimeraOperatorMap> = {
	query?: ChimeraQueryConfig<EntityMap, OperatorsMap>;
	order?: ChimeraOrderConfig;
	filter?: ChimeraFilterConfig<OperatorsMap>;
	debug?: ChimeraDebugConfig;
};
