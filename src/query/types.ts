import type { ChimeraOperatorMap, ChimeraSimplifiedFilter } from "../filter/types.ts";
import type { ChimeraSimplifiedOrderDescriptor } from "../order/types.ts";
import type { ChimeraEntityId, DeepPartial } from "../shared/types.ts";

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

export type ChimeraIdGetterFunction<TEntityName extends string, TEntity> = (
	entity: TEntity,
	entityName: TEntityName,
) => ChimeraEntityId;

export type ChimeraQueryEntityIdGetter<TEntityName extends string, TEntity> =
	| keyof TEntity
	| ChimeraIdGetterFunction<TEntityName, TEntity>;

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

export type ChimeraQueryEntityCollectionFetcher<
	TEntityName extends string,
	TEntity,
	TOperatorsMap extends ChimeraOperatorMap,
	TMeta = any,
> = (
	params: ChimeraQueryEntityCollectionFetcherParams<TEntity, TOperatorsMap, TMeta>,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
	entityName: TEntityName,
) => Promise<ChimeraQueryCollectionFetcherResponse<TEntity>>;

export type ChimeraQueryEntityItemFetcher<TEntityName extends string, TEntity> = (
	params: ChimeraQueryEntityItemFetcherParams<TEntity>,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
	entityName: TEntityName,
) => Promise<ChimeraQueryItemFetcherResponse<TEntity>>;

/**
 * Updater types
 */

export type ChimeraQueryEntityItemUpdater<TEntityName extends string, TEntity> = (
	updatedEntity: TEntity,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
	entityName: TEntityName,
) => Promise<ChimeraQueryItemFetcherResponse<TEntity>>;

export type ChimeraQueryEntityBatchedUpdater<TEntityName extends string, TEntity> = (
	updatedEntities: TEntity[],
	requestParams: ChimeraQueryEntityFetcherRequestParams,
	entityName: TEntityName,
) => Promise<ChimeraQueryCollectionFetcherResponse<TEntity>>;

/**
 * Deleter types
 */

export type ChimeraQueryEntityItemDeleter<TEntityName extends string = string> = (
	deleteId: ChimeraEntityId,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
	entityName: TEntityName,
) => Promise<ChimeraQueryItemDeleteResponse>;

export type ChimeraQueryEntityBatchedDeleter<TEntityName extends string = string> = (
	deletedIds: ChimeraEntityId[],
	requestParams: ChimeraQueryEntityFetcherRequestParams,
	entityName: TEntityName,
) => Promise<ChimeraQueryBatchedDeleteResponse>;

/**
 * Creator type
 */

export type ChimeraQueryEntityItemCreator<TEntityName extends string, TEntity> = (
	item: DeepPartial<TEntity>,
	requestParams: ChimeraQueryEntityFetcherRequestParams,
	entityName: TEntityName,
) => Promise<ChimeraQueryItemFetcherResponse<TEntity>>;

export type ChimeraQueryEntityBatchedCreator<TEntityName extends string, TEntity> = (
	items: DeepPartial<TEntity>[],
	requestParams: ChimeraQueryEntityFetcherRequestParams,
	entityName: TEntityName,
) => Promise<ChimeraQueryCollectionFetcherResponse<TEntity>>;

/**
 * Config types
 */

export type ChimeraQueryEntityConfig<
	TEntityName extends string,
	TEntity,
	TOperatorsMap extends ChimeraOperatorMap,
	TMeta = any,
> = {
	name: TEntityName;
	trustQuery?: boolean;
	updateDebounceTimeout?: number;

	idGetter: ChimeraQueryEntityIdGetter<TEntityName, TEntity>;

	collectionFetcher?: ChimeraQueryEntityCollectionFetcher<TEntityName, TEntity, TOperatorsMap, TMeta>;
	itemFetcher?: ChimeraQueryEntityItemFetcher<TEntityName, TEntity>;

	itemUpdater?: ChimeraQueryEntityItemUpdater<TEntityName, TEntity>;
	batchedUpdater?: ChimeraQueryEntityBatchedUpdater<TEntityName, TEntity>;

	itemDeleter?: ChimeraQueryEntityItemDeleter<TEntityName>;
	batchedDeleter?: ChimeraQueryEntityBatchedDeleter<TEntityName>;

	itemCreator?: ChimeraQueryEntityItemCreator<TEntityName, TEntity>;
	batchedCreator?: ChimeraQueryEntityBatchedCreator<TEntityName, TEntity>;
};

export type QueryEntityConfig<
	TEntityName extends string,
	TEntity,
	TOperatorsMap extends ChimeraOperatorMap,
	TMeta = any,
> = Required<ChimeraQueryEntityConfig<TEntityName, TEntity, TOperatorsMap, TMeta>> & {
	idGetter: ChimeraIdGetterFunction<TEntityName, TEntity>;
};
