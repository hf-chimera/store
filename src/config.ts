import type { EntityId, IdGetterFunc, MayBePromise, OneOrMany, Todo } from "./internal/utils.ts";
import type { ChimeraPrimitiveComparator } from "./order.ts";
import type { ChimeraEntityFetcher, ChimeraEntityMutator } from "./communication.ts";

export type ChimeraEntityMap = Record<string, object>;

export type ChimeraEntityIdGetter<Entity> = keyof Entity | IdGetterFunc<Entity>;

export type ChimeraStoreConfigEntity<Entity> = {
	trustQuery?: boolean;
	updateDebounceTimeout?: number;
	idGetter?: ChimeraEntityIdGetter<Entity>;
	fetcher?: ChimeraEntityFetcher<Entity>;
	mutator?: ChimeraEntityMutator<Entity>;
};

export type ChimeraEntityConfigMap<EntityMap extends ChimeraEntityMap> = {
	[K in keyof EntityMap]: ChimeraStoreConfigEntity<EntityMap[K]>;
};

export type ChimeraDefaultEntityGetter<EntityMap extends ChimeraEntityMap> =
	| keyof EntityMap[keyof EntityMap]
	| (<EntityName extends keyof EntityMap>(name: EntityName, newEntity: EntityMap[EntityName]) => EntityId);

export type ChimeraDefaultFetcher<EntityMap extends ChimeraEntityMap> = <EntityName extends keyof EntityMap>(
	name: EntityName,
	params: Todo,
) => MayBePromise<OneOrMany<EntityMap[EntityName]>>;

export type ChimeraDefaultMutator<EntityMap extends ChimeraEntityMap> = <EntityName extends keyof EntityMap>(
	name: EntityName,
	newEntity: EntityMap[EntityName],
) => MayBePromise<EntityMap[EntityName]>;

export type ChimeraDefaultsConfig<EntityMap extends ChimeraEntityMap> = {
	trustQuery?: boolean; // Disable extra filtering and sorting while creating a new query
	updateDebounceTimeout?: number; // If set, will debounce updates with specified timeout in ms
	idGetter?: ChimeraDefaultEntityGetter<EntityMap>;
	fetcher?: ChimeraDefaultFetcher<EntityMap>;
	mutator?: ChimeraDefaultMutator<EntityMap>;
};

export type ChimeraDebugConfig = {
	name?: string;
	logs?: boolean;
	devMode?: boolean;
};

export type ChimeraOrderConfig<EntityMap extends ChimeraEntityMap> = {
	primitiveComparator: ChimeraPrimitiveComparator;
};

export type ChimeraStoreConfig<EntityMap extends ChimeraEntityMap> = {
	debug?: ChimeraDebugConfig;
	defaults?: ChimeraDefaultsConfig<EntityMap>;
	entities: ChimeraEntityConfigMap<EntityMap>;
	order?: ChimeraOrderConfig<EntityMap>;
};
