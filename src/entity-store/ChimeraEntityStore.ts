import { chimeraDefaultQueryEntityConfig } from "../../packages/store/defaults.ts";
import { chimeraDefaultDebugConfig } from "../debug/defaults.ts";
import type { ChimeraDebugConfig } from "../debug/types.ts";
import { chimeraDefaultFilterConfig } from "../filter/defaults.ts";
import { compileFilter, isFilterSubset, simplifyFilter } from "../filter/filter.ts";
import type { ChimeraFilterConfig, ChimeraOperatorMap, ChimeraSimplifiedFilter } from "../filter/types.ts";
import { chimeraDefaultOrderConfig } from "../order/defaults.ts";
import { buildComparator, simplifyOrderBy } from "../order/order.ts";
import type { ChimeraOrderConfig } from "../order/types.ts";
import { ChimeraCollectionQuery } from "../query/ChimeraCollectionQuery.ts";
import { ChimeraItemQuery } from "../query/ChimeraItemQuery.ts";
import {
	ChimeraDeleteManySym,
	ChimeraDeleteOneSym,
	ChimeraGetParamsSym,
	ChimeraSetManySym,
	ChimeraSetOneSym,
} from "../query/constants.ts";
import type {
	ChimeraIdGetterFunction,
	ChimeraQueryEntityCollectionFetcherParams,
	ChimeraQueryEntityConfig,
	QueryEntityConfig,
} from "../query/types.ts";
import type { EventArgs, EventNames } from "../shared/ChimeraEventEmitter/index.ts";
import { ChimeraEventEmitter } from "../shared/ChimeraEventEmitter/index.ts";
import { ChimeraWeakValueMap } from "../shared/ChimeraWeakValueMap/index.ts";
import { ChimeraInternalError } from "../shared/errors.ts";
import type { ChimeraEntityId, DeepPartial } from "../shared/types.ts";
import type { ChimeraCollectionParams } from "./types.ts";

export type ChimeraEntityStoreEventMap<
	TEntityName extends string,
	TItem extends object,
	TOperatorsMap extends ChimeraOperatorMap,
> = {
	/** Once the repository is initialized */
	initialized: {
		instance: ChimeraEntityStore<TEntityName, TItem, TOperatorsMap>;
	};

	/** Each time item added */
	itemAdded: [
		{
			instance: ChimeraEntityStore<TEntityName, TItem, TOperatorsMap>;
			item: TItem;
		},
	];

	/** Each time many items updated */
	updated: [
		{
			instance: ChimeraEntityStore<TEntityName, TItem, TOperatorsMap>;
			items: TItem[];
		},
	];
	/** Each time item updated */
	itemUpdated: [
		{
			instance: ChimeraEntityStore<TEntityName, TItem, TOperatorsMap>;
			item: TItem;
			oldItem: TItem | null;
		},
	];

	/** Each time many items deleted */
	deleted: [
		{
			instance: ChimeraEntityStore<TEntityName, TItem, TOperatorsMap>;
			ids: ChimeraEntityId[];
		},
	];
	/** Each time item deleted */
	itemDeleted: [
		{
			instance: ChimeraEntityStore<TEntityName, TItem, TOperatorsMap>;
			oldItem: TItem | null;
		},
	];
};

type SkipParams<TEntityName extends string, TItem extends object, TOperatorsMap extends ChimeraOperatorMap> = {
	item?: ChimeraItemQuery<TEntityName, TItem>;
	collection?: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>;
};

export class ChimeraEntityStore<
	TEntityName extends string,
	TItem extends object,
	TOperatorsMap extends ChimeraOperatorMap,
> extends ChimeraEventEmitter<ChimeraEntityStoreEventMap<TEntityName, TItem, TOperatorsMap>> {
	readonly #entityConfig: QueryEntityConfig<TEntityName, TItem, TOperatorsMap>;
	readonly #filterConfig: Required<ChimeraFilterConfig<TOperatorsMap>>;
	readonly #orderConfig: Required<ChimeraOrderConfig>;
	readonly #debugConfig: Required<ChimeraDebugConfig>;
	readonly #idGetter: ChimeraIdGetterFunction<TEntityName, TItem>;

	readonly #itemsMap: ChimeraWeakValueMap<ChimeraEntityId, TItem>;

	readonly #collectionQueryMap: ChimeraWeakValueMap<string, ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>>;
	readonly #itemQueryMap: ChimeraWeakValueMap<ChimeraEntityId, ChimeraItemQuery<TEntityName, TItem>>;

	#emit<T extends EventNames<ChimeraEntityStoreEventMap<TEntityName, TItem, TOperatorsMap>>>(
		event: T,
		arg: EventArgs<ChimeraEntityStoreEventMap<TEntityName, TItem, TOperatorsMap>, T>,
	) {
		queueMicrotask(() => super.emit(event, arg as any));
	}

	override emit(): never {
		throw new ChimeraInternalError("External events dispatching is not supported.");
	}

	#registerUpdate(item: TItem, skipItem?: ChimeraItemQuery<TEntityName, TItem>) {
		const id = this.#idGetter(item, this.#entityConfig.name);
		const oldItem = this.#itemsMap.get(id);
		this.#itemsMap.set(id, item);

		const itemQuery = this.#itemQueryMap.get(id);
		itemQuery && skipItem !== itemQuery && itemQuery[ChimeraSetOneSym](item);

		!oldItem && this.#emit("itemAdded", { instance: this, item });
		this.#emit("itemUpdated", {
			instance: this,
			item,
			oldItem: oldItem ?? null,
		});
	}

	#registerDelete(id: ChimeraEntityId, skipItem?: ChimeraItemQuery<TEntityName, TItem>) {
		const oldItem = this.#itemsMap.get(id);
		if (!oldItem) return;
		this.#itemsMap.delete(id);

		const itemQuery = this.#itemQueryMap.get(id);
		itemQuery && skipItem !== itemQuery && itemQuery[ChimeraDeleteOneSym](id);

		this.#emit("itemDeleted", { instance: this, oldItem: oldItem ?? null });
	}

	#propagateUpdateOne(
		item: TItem,
		{ item: skipItem, collection: skipCollection }: SkipParams<TEntityName, TItem, TOperatorsMap> = {},
	) {
		this.#registerUpdate(item, skipItem);
		for (const c of this.#collectionQueryMap.values()) c !== skipCollection && c[ChimeraSetOneSym](item);
	}

	#propagateDeleteOne(
		id: ChimeraEntityId,
		{ item: skipItem, collection: skipCollection }: SkipParams<TEntityName, TItem, TOperatorsMap> = {},
	) {
		this.#registerDelete(id, skipItem);
		for (const c of this.#collectionQueryMap.values()) c !== skipCollection && c[ChimeraDeleteOneSym](id);
	}

	#propagateUpdateMany(
		items: TItem[],
		{ item: skipItem, collection: skipCollection }: SkipParams<TEntityName, TItem, TOperatorsMap> = {},
	) {
		for (const item of items) this.#registerUpdate(item, skipItem);
		this.#emit("updated", { instance: this, items });
		for (const c of this.#collectionQueryMap.values()) c !== skipCollection && c[ChimeraSetManySym](items);
	}

	#propagateDeleteMany(
		ids: ChimeraEntityId[],
		{ item: skipItem, collection: skipCollection }: SkipParams<TEntityName, TItem, TOperatorsMap> = {},
	) {
		for (const id of ids) this.#registerDelete(id, skipItem);
		this.#emit("deleted", { ids, instance: this });
		for (const c of this.#collectionQueryMap.values()) c !== skipCollection && c[ChimeraDeleteManySym](ids);
	}

	#itemUpdateHandler(query: ChimeraItemQuery<TEntityName, TItem>, item: TItem) {
		this.#propagateUpdateOne(item, { item: query });
	}

	#itemDeleteHandler(query: ChimeraItemQuery<TEntityName, TItem>, id: ChimeraEntityId) {
		this.#itemQueryMap.delete(id);
		this.#propagateDeleteOne(id, { item: query });
	}

	#prepareItemQuery(query: ChimeraItemQuery<TEntityName, TItem>): ChimeraItemQuery<TEntityName, TItem> {
		if (query.id !== "") this.#itemQueryMap.set(query.id, query);
		query.on("selfCreated", ({ instance }) => this.#itemQueryMap.set(instance.id, instance));
		query.on("selfUpdated", ({ instance, item }) => this.#itemUpdateHandler(instance, item));
		query.on("selfDeleted", ({ instance, id }) => this.#itemDeleteHandler(instance, id));
		return query;
	}

	#simplifyCollectionParams(
		params: ChimeraCollectionParams<TOperatorsMap, TItem>,
	): ChimeraQueryEntityCollectionFetcherParams<TItem, TOperatorsMap> {
		return {
			filter: simplifyFilter(params.filter),
			order: simplifyOrderBy(params.order),
			meta: params.meta,
		};
	}

	#getCollectionKey({ order, filter }: ChimeraQueryEntityCollectionFetcherParams<TItem, TOperatorsMap>): string {
		return `${this.#entityConfig.name}:ORDER<${order ? this.#orderConfig.getKey(order) : ""}>:FILTER<${filter ? this.#filterConfig.getFilterKey(filter) : ""}>`;
	}

	#collectionUpdateHandler(query: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>, items: TItem[]) {
		this.#propagateUpdateMany(items, { collection: query });
	}

	#collectionCreateHandler(query: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>, item: TItem) {
		this.#propagateUpdateOne(item, { collection: query });
	}

	#collectionItemUpdated(query: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>, item: TItem) {
		this.#propagateUpdateOne(item, { collection: query });
	}

	#collectionItemDeleted(query: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>, id: ChimeraEntityId) {
		this.#propagateDeleteOne(id, { collection: query });
	}

	#prepareCollectionQuery(
		query: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>,
	): ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap> {
		this.#collectionQueryMap.set(this.#getCollectionKey(query[ChimeraGetParamsSym]), query);
		query.on("selfUpdated", ({ instance, items }) => this.#collectionUpdateHandler(instance, items));
		query.on("selfItemCreated", ({ instance, item }) => this.#collectionCreateHandler(instance, item));
		query.on("selfItemUpdated", ({ instance, item }) => this.#collectionItemUpdated(instance, item));
		query.on("selfItemDeleted", ({ instance, id }) => this.#collectionItemDeleted(instance, id));
		return query;
	}

	#getParentQuery(
		filter: ChimeraSimplifiedFilter<TOperatorsMap, keyof TItem & string>,
	): ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap> | null {
		for (const q of this.#collectionQueryMap.values())
			if (q.ready && isFilterSubset(q[ChimeraGetParamsSym].filter, filter, this.#filterConfig.getOperatorKey)) return q;
		return null;
	}

	constructor(
		config: QueryEntityConfig<TEntityName, TItem, TOperatorsMap>,
		filterConfig: Required<ChimeraFilterConfig<TOperatorsMap>>,
		orderConfig: Required<ChimeraOrderConfig>,
		debugConfig: Required<ChimeraDebugConfig>,
	) {
		super();

		this.#entityConfig = config;
		this.#filterConfig = filterConfig;
		this.#orderConfig = orderConfig;
		this.#debugConfig = debugConfig;
		this.#idGetter =
			typeof this.#entityConfig.idGetter === "function"
				? this.#entityConfig.idGetter
				: (entity) => entity[this.#entityConfig.idGetter as keyof TItem] as unknown as ChimeraEntityId;

		this.#itemsMap = new ChimeraWeakValueMap();
		this.#collectionQueryMap = new ChimeraWeakValueMap();
		this.#itemQueryMap = new ChimeraWeakValueMap();

		this.#emit("initialized", { instance: this });
	}

	get name(): TEntityName {
		return this.#entityConfig.name;
	}

	updateOne(TItem: TItem) {
		this.#propagateUpdateOne(TItem);
	}

	deleteOne(id: ChimeraEntityId) {
		this.#propagateDeleteOne(id);
	}

	updateMany(items: TItem[]) {
		this.#propagateUpdateMany(items);
	}

	deleteMany(ids: ChimeraEntityId[]) {
		this.#propagateDeleteMany(ids);
	}

	updateMixed(toAdd: TItem[], toDelete: ChimeraEntityId[]) {
		this.#propagateUpdateMany(toAdd);
		this.#propagateDeleteMany(toDelete);
	}

	createItem(TItem: DeepPartial<TItem>, meta?: any): ChimeraItemQuery<TEntityName, TItem> {
		return this.#prepareItemQuery(
			new ChimeraItemQuery(
				this.#entityConfig,
				this.#debugConfig,
				{
					id: "",
					meta,
				},
				null,
				TItem,
			),
		);
	}

	getItem(id: ChimeraEntityId, meta?: any): ChimeraItemQuery<TEntityName, TItem> {
		const query = this.#itemQueryMap.get(id);
		if (query) return query;

		return this.#prepareItemQuery(
			new ChimeraItemQuery(this.#entityConfig, this.#debugConfig, { id, meta }, this.#itemsMap.get(id) ?? null, null),
		);
	}

	getCollection(
		params: ChimeraCollectionParams<TOperatorsMap, TItem>,
	): ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap> {
		const simplifiedParams = this.#simplifyCollectionParams(params);
		const key = this.#getCollectionKey(simplifiedParams);
		const query = this.#collectionQueryMap.get(key);
		if (query) return query;

		return this.#prepareCollectionQuery(
			new ChimeraCollectionQuery(
				this.#entityConfig,
				this.#debugConfig,
				simplifiedParams,
				this.#getParentQuery(simplifiedParams.filter),
				buildComparator(this.#orderConfig.primitiveComparator, params.order),
				compileFilter(this.#filterConfig, params.filter),
				false,
			),
		);
	}
}

/**
 * Creates a ChimeraEntityStore instance with populated default values
 * @param entityConfig Entity-specific configuration (idGetter is required)
 * @param filterConfig Optional filter configuration (defaults to chimeraDefaultFilterConfig)
 * @param orderConfig Optional order configuration (defaults to chimeraDefaultOrderConfig)
 * @param debugConfig Optional debug configuration (defaults to chimeraDefaultDebugConfig)
 * @returns ChimeraEntityStore instance
 */
export function createChimeraEntityStore<
	TEntityName extends string,
	TItem extends object,
	TOperatorsMap extends ChimeraOperatorMap,
>(
	entityConfig: ChimeraQueryEntityConfig<TEntityName, TItem, TOperatorsMap>,
	filterConfig: Required<ChimeraFilterConfig<TOperatorsMap>>,
	orderConfig: Required<ChimeraOrderConfig>,
	debugConfig: Required<ChimeraDebugConfig>,
): ChimeraEntityStore<TEntityName, TItem, TOperatorsMap>;
export function createChimeraEntityStore<
	TEntityName extends string,
	TItem extends object,
	TOperatorsMap extends ChimeraOperatorMap,
>(
	entityConfig: ChimeraQueryEntityConfig<TEntityName, TItem, TOperatorsMap>,
	filterConfig: Required<ChimeraFilterConfig<TOperatorsMap>>,
	orderConfig: Required<ChimeraOrderConfig>,
): ChimeraEntityStore<TEntityName, TItem, TOperatorsMap>;
export function createChimeraEntityStore<
	TEntityName extends string,
	TItem extends object,
	TOperatorsMap extends ChimeraOperatorMap,
>(
	entityConfig: ChimeraQueryEntityConfig<TEntityName, TItem, TOperatorsMap>,
	filterConfig: Required<ChimeraFilterConfig<TOperatorsMap>>,
): ChimeraEntityStore<TEntityName, TItem, TOperatorsMap>;
export function createChimeraEntityStore<TEntityName extends string, TItem extends object>(
	entityConfig: ChimeraQueryEntityConfig<TEntityName, TItem, typeof chimeraDefaultFilterConfig.operators>,
): ChimeraEntityStore<TEntityName, TItem, typeof chimeraDefaultFilterConfig.operators>;
export function createChimeraEntityStore<
	TEntityName extends string,
	TItem extends object,
	TOperatorsMap extends ChimeraOperatorMap,
>(
	entityConfig: ChimeraQueryEntityConfig<TEntityName, TItem, TOperatorsMap>,
	filterConfig?: Required<ChimeraFilterConfig<TOperatorsMap>>,
	orderConfig?: Required<ChimeraOrderConfig>,
	debugConfig?: Required<ChimeraDebugConfig>,
): ChimeraEntityStore<TEntityName, TItem, TOperatorsMap> {
	return new ChimeraEntityStore(
		{
			...chimeraDefaultQueryEntityConfig,
			...entityConfig,
			idGetter:
				typeof entityConfig.idGetter === "function"
					? entityConfig.idGetter
					: (entity) => entity[entityConfig.idGetter as keyof TItem] as ChimeraEntityId,
		},
		filterConfig ?? (chimeraDefaultFilterConfig as unknown as Required<ChimeraFilterConfig<TOperatorsMap>>),
		orderConfig ?? chimeraDefaultOrderConfig,
		debugConfig ?? chimeraDefaultDebugConfig,
	);
}

export type AnyChimeraEntityStore = ChimeraEntityStore<any, any, any>;
type ExtractedChimeraEntityStore<TStore extends AnyChimeraEntityStore> =
	TStore extends ChimeraEntityStore<infer TEntityName, infer TItem, infer TOperatorsMap>
		? { entityName: TEntityName; item: TItem; operatorsMap: TOperatorsMap }
		: never;
export type ChimeraEntityStoreName<TStore extends AnyChimeraEntityStore> =
	ExtractedChimeraEntityStore<TStore>["entityName"];
export type ChimeraEntityStoreEntity<TStore extends AnyChimeraEntityStore> =
	ExtractedChimeraEntityStore<TStore>["item"];
export type ChimeraEntityStoreOperatorsMap<TStore extends AnyChimeraEntityStore> =
	ExtractedChimeraEntityStore<TStore>["operatorsMap"];
