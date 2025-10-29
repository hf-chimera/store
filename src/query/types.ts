import type { ChimeraOperatorMap, ChimeraSimplifiedFilter } from '../filter/types.ts';
import type { ChimeraSimplifiedOrderDescriptor } from "../order/types.ts";
import type { ChimeraEntityId, ChimeraEntityMap, ChimeraIdGetterFunc, DeepPartial, StrKeys } from "../shared/types.ts";

export enum ChimeraQueryFetchingState {
	/** Query just initialized. */
	Initialized = "initialized",

	/** Not used yet. */
	Scheduled = "scheduled",

	/** Fetching in progress. */
	Fetching = "fetching",

	/** Creating in progress */
	Creating = "creating",

	/** Updating in progress. */
	Updating = "updating",

	/** Deleting in progress. */
	Deleting = "deleting",

	/** Fetch requested after reaching the Fetched, Errored, or Prefetched states. */
	Refetching = "refetching",

	/** Data retrieved from existing queries without initiating a fetch. */
	Prefetched = "prefetched",

	/** Fetch ended successfully; data is ready for use. */
	Fetched = "fetched",

	/** Fetch ended with an error; no data is available. */
	Errored = "errored",

	/** Refetch ended with an error, but old data is still available. */
	ReErrored = "reErrored",

	/**
	 * Only for the item query, data is deleted, but the local value is still present,
	 * no longer allows updates, but `refetch` still works (in case of strange errors, allows recovering state)
	 */
	Deleted = "deleted",

	/** Only for the item query, data was actualized from an external event */
	Actualized = "actualized",
}

export interface ChimeraQueryFetchingStatable {
	get state(): ChimeraQueryFetchingState;

	get inProgress(): boolean;

	get ready(): boolean;
}

/**
 * Id getter types
 */

export type ChimeraQueryEntityIdGetter<Entity> = keyof Entity | ChimeraIdGetterFunc<Entity>;

export type ChimeraQueryDefaultEntityIdGetterFunction<EntityMap extends ChimeraEntityMap> = <
	EntityName extends StrKeys<EntityMap>,
>(
	name: EntityName,
	newEntity: EntityMap[EntityName],
) => ChimeraEntityId;
export type ChimeraQueryDefaultEntityIdGetter<EntityMap extends ChimeraEntityMap> =
	| keyof EntityMap[keyof EntityMap]
	| ChimeraQueryDefaultEntityIdGetterFunction<EntityMap>;

/**
 * Response types
 */

export type ChimeraQueryCollectionFetcherResponse<Entity, Meta = any> = {
	data: Entity[];
	meta?: Meta;
};

export type ChimeraQueryItemFetcherResponse<Entity, Meta = any> = {
	data: Entity;
	meta?: Meta;
};

export type ChimeraQueryDeletionResult<Success extends boolean = boolean> = {
	id: ChimeraEntityId;
	success: Success;
};

export type ChimeraQueryItemDeleteResponse<Meta = any> = {
	result: ChimeraQueryDeletionResult;
	meta?: Meta;
};

export type ChimeraQueryBatchedDeleteResponse<Meta = any> = {
	result: ChimeraQueryDeletionResult[];
	meta?: Meta;
};

/**
 * Fetcher types
 */

export type ChimeraQueryEntityFetcherRequestParams = {
	signal: AbortSignal;
};

export type ChimeraQueryEntityCollectionFetcherParams<Entity, OperatorsMap extends ChimeraOperatorMap, Meta = any> = {
	order: ChimeraSimplifiedOrderDescriptor<keyof Entity & string>[] | null;
	filter: ChimeraSimplifiedFilter<OperatorsMap, keyof Entity & string> | null;
	meta: Meta;
};

// biome-ignore lint/correctness/noUnusedVariables: May be required later
export type ChimeraQueryEntityItemFetcherParams<Entity, Meta = any> = {
	id: ChimeraEntityId;
	meta: Meta;
};

export type ChimeraQueryEntityCollectionFetcher<Entity, OperatorsMap extends ChimeraOperatorMap, Meta = any> = (
	params: ChimeraQueryEntityCollectionFetcherParams<Entity, OperatorsMap, Meta>,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryCollectionFetcherResponse<Entity>>;

export type ChimeraQueryEntityItemFetcher<Entity> = (
	params: ChimeraQueryEntityItemFetcherParams<Entity>,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryItemFetcherResponse<Entity>>;

export type ChimeraQueryDefaultCollectionFetcher<
	EntityMap extends ChimeraEntityMap,
	OperatorsMap extends ChimeraOperatorMap,
> = <EntityName extends StrKeys<EntityMap>>(
	entityName: EntityName,
	params: ChimeraQueryEntityCollectionFetcherParams<EntityMap[EntityName], OperatorsMap>,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryCollectionFetcherResponse<EntityMap[EntityName]>>;

export type ChimeraQueryDefaultItemFetcher<EntityMap extends ChimeraEntityMap> = <
	EntityName extends StrKeys<EntityMap>,
>(
	entityName: EntityName,
	params: ChimeraQueryEntityItemFetcherParams<EntityMap[EntityName]>,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryItemFetcherResponse<EntityMap[EntityName]>>;

/**
 * Updater types
 */

export type ChimeraQueryEntityItemUpdater<Entity> = (
	updatedEntity: Entity,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryItemFetcherResponse<Entity>>;

export type ChimeraQueryEntityBatchedUpdater<Entity> = (
	updatedEntities: Entity[],
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryCollectionFetcherResponse<Entity>>;

export type ChimeraQueryDefaultItemUpdater<EntityMap extends ChimeraEntityMap> = <
	EntityName extends StrKeys<EntityMap>,
>(
	entityName: EntityName,
	updatedEntity: EntityMap[EntityName],
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryItemFetcherResponse<EntityMap[EntityName]>>;

export type ChimeraQueryDefaultBatchedUpdater<EntityMap extends ChimeraEntityMap> = <
	EntityName extends StrKeys<EntityMap>,
>(
	entityName: EntityName,
	updatedEntities: EntityMap[EntityName][],
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryCollectionFetcherResponse<EntityMap[EntityName]>>;

/**
 * Deleter types
 */

export type ChimeraQueryEntityItemDeleter = (
	deleteId: ChimeraEntityId,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryItemDeleteResponse>;

export type ChimeraQueryEntityBatchedDeleter = (
	deletedIds: ChimeraEntityId[],
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryBatchedDeleteResponse>;

export type ChimeraQueryDefaultItemDeleter<EntityMap extends ChimeraEntityMap> = <
	EntityName extends StrKeys<EntityMap>,
>(
	entityName: EntityName,
	deleteId: ChimeraEntityId,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryItemDeleteResponse>;

export type ChimeraQueryDefaultBatchedDeleter<EntityMap extends ChimeraEntityMap> = <
	EntityName extends StrKeys<EntityMap>,
>(
	entityName: EntityName,
	deletedIds: ChimeraEntityId[],
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryBatchedDeleteResponse>;

/**
 * Creator type
 */

export type ChimeraQueryEntityItemCreator<Entity> = (
	item: DeepPartial<Entity>,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryItemFetcherResponse<Entity>>;

export type ChimeraQueryEntityBatchedCreator<Entity> = (
	items: DeepPartial<Entity>[],
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryCollectionFetcherResponse<Entity>>;

export type ChimeraQueryDefaultItemCreator<EntityMap extends ChimeraEntityMap> = <
	EntityName extends StrKeys<EntityMap>,
>(
	entityName: EntityName,
	item: DeepPartial<EntityMap[EntityName]>,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryItemFetcherResponse<EntityMap[EntityName]>>;

export type ChimeraQueryDefaultBatchedCreator<EntityMap extends ChimeraEntityMap> = <
	EntityName extends StrKeys<EntityMap>,
>(
	entityName: EntityName,
	items: DeepPartial<EntityMap[EntityName]>[],
	requestParams: ChimeraQueryEntityFetcherRequestParams,
) => Promise<ChimeraQueryCollectionFetcherResponse<EntityMap[EntityName]>>;

/**
 * Config types
 */

export type QueryEntityConfig<Entity extends object, OperatorsMap extends ChimeraOperatorMap> = {
	name: string;

	devMode: boolean;
	trustQuery: boolean;
	updateDebounceTimeout: number;

	idGetter: ChimeraIdGetterFunc<Entity>;

	collectionFetcher: ChimeraQueryEntityCollectionFetcher<Entity, OperatorsMap>;
	itemFetcher: ChimeraQueryEntityItemFetcher<Entity>;

	itemUpdater: ChimeraQueryEntityItemUpdater<Entity>;
	batchedUpdater: ChimeraQueryEntityBatchedUpdater<Entity>;

	itemDeleter: ChimeraQueryEntityItemDeleter;
	batchedDeleter: ChimeraQueryEntityBatchedDeleter;

	itemCreator: ChimeraQueryEntityItemCreator<Entity>;
	batchedCreator: ChimeraQueryEntityBatchedCreator<Entity>;
};

export type ChimeraQueryEntityConfig<Entity, OperatorsMap extends ChimeraOperatorMap, Meta = any> = {
	trustQuery?: boolean;
	updateDebounceTimeout?: number;

	idGetter?: ChimeraQueryEntityIdGetter<Entity>;

	collectionFetcher?: ChimeraQueryEntityCollectionFetcher<Entity, OperatorsMap, Meta>;
	itemFetcher?: ChimeraQueryEntityItemFetcher<Entity>;

	itemUpdater?: ChimeraQueryEntityItemUpdater<Entity>;
	batchedUpdater?: ChimeraQueryEntityBatchedUpdater<Entity>;

	itemDeleter?: ChimeraQueryEntityItemDeleter;
	batchedDeleter?: ChimeraQueryEntityBatchedDeleter;

	itemCreator?: ChimeraQueryEntityItemCreator<Entity>;
	batchedCreator?: ChimeraQueryEntityBatchedCreator<Entity>;
};

export type ChimeraQueryDefaultsConfig<EntityMap extends ChimeraEntityMap, OperatorsMap extends ChimeraOperatorMap> = {
	trustQuery?: boolean; // Disable extra filtering and sorting while creating a new query
	updateDebounceTimeout?: number; // If set, will debounce updates with specified timeout in ms

	idGetter?: ChimeraQueryDefaultEntityIdGetter<EntityMap>;

	collectionFetcher?: ChimeraQueryDefaultCollectionFetcher<EntityMap, OperatorsMap>;
	itemFetcher?: ChimeraQueryDefaultItemFetcher<EntityMap>;

	itemUpdater?: ChimeraQueryDefaultItemUpdater<EntityMap>;
	batchedUpdater?: ChimeraQueryDefaultBatchedUpdater<EntityMap>;

	itemDeleter?: ChimeraQueryDefaultItemDeleter<EntityMap>;
	batchedDeleter?: ChimeraQueryDefaultBatchedDeleter<EntityMap>;

	itemCreator?: ChimeraQueryDefaultItemCreator<EntityMap>;
	batchedCreator?: ChimeraQueryDefaultBatchedCreator<EntityMap>;
};

export type ChimeraEntityConfigMap<EntityMap extends ChimeraEntityMap, OperatorsMap extends ChimeraOperatorMap> = {
	[K in keyof EntityMap]: ChimeraQueryEntityConfig<EntityMap[K], OperatorsMap>;
};

export type ChimeraQueryConfig<EntityMap extends ChimeraEntityMap, OperatorsMap extends ChimeraOperatorMap> = {
	defaults: ChimeraQueryDefaultsConfig<EntityMap, OperatorsMap>;
	entities: ChimeraEntityConfigMap<EntityMap, OperatorsMap>;
};
