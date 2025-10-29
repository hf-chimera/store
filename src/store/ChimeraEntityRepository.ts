import { compileFilter, isFilterSubset, simplifyFilter } from "../filter/filter.ts";
import type { ChimeraFilterConfig, ChimeraOperatorMap, ChimeraSimplifiedFilter } from '../filter/types.ts';
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
	ChimeraUpdateMixedSym,
} from "../query/constants.ts";
import type { ChimeraQueryEntityCollectionFetcherParams, QueryEntityConfig } from "../query/types.ts";
import type { EventArgs, EventNames } from "../shared/ChimeraEventEmitter";
import { ChimeraEventEmitter } from "../shared/ChimeraEventEmitter";
import { ChimeraWeakValueMap } from "../shared/ChimeraWeakValueMap";
import { ChimeraInternalError } from "../shared/errors.ts";
import type { ChimeraEntityId, ChimeraIdGetterFunc, DeepPartial } from "../shared/types.ts";
import type { ChimeraCollectionParams } from "./types.ts";

export type ChimeraEntityRepositoryEventMap<Item extends object, OperatorsMap extends ChimeraOperatorMap> = {
	/** Once the repository is initialized */
	initialized: { instance: ChimeraEntityRepository<Item, OperatorsMap> };

	/** Each time item added */
	itemAdded: [{ instance: ChimeraEntityRepository<Item, OperatorsMap>; item: Item }];

	/** Each time many items updated */
	updated: [{ instance: ChimeraEntityRepository<Item, OperatorsMap>; items: Item[] }];
	/** Each time item updated */
	itemUpdated: [{ instance: ChimeraEntityRepository<Item, OperatorsMap>; item: Item; oldItem: Item | null }];

	/** Each time many items deleted */
	deleted: [{ instance: ChimeraEntityRepository<Item, OperatorsMap>; ids: ChimeraEntityId[] }];
	/** Each time item deleted */
	itemDeleted: [{ instance: ChimeraEntityRepository<Item, OperatorsMap>; oldItem: Item | null }];
};

type SkipParams<Item extends object, OperatorsMap extends ChimeraOperatorMap> = {
	item?: ChimeraItemQuery<Item>;
	collection?: ChimeraCollectionQuery<Item, OperatorsMap>;
};

export class ChimeraEntityRepository<
	Item extends object,
	OperatorsMap extends ChimeraOperatorMap,
> extends ChimeraEventEmitter<ChimeraEntityRepositoryEventMap<Item, OperatorsMap>> {
	readonly #entityConfig: QueryEntityConfig<Item, OperatorsMap>;
	readonly #filterConfig: Required<ChimeraFilterConfig<OperatorsMap>>;
	readonly #orderConfig: Required<ChimeraOrderConfig>;
	readonly #idGetter: ChimeraIdGetterFunc<Item>;

	readonly #itemsMap: ChimeraWeakValueMap<ChimeraEntityId, Item>;

	readonly #collectionQueryMap: ChimeraWeakValueMap<string, ChimeraCollectionQuery<Item, OperatorsMap>>;
	readonly #itemQueryMap: ChimeraWeakValueMap<ChimeraEntityId, ChimeraItemQuery<Item>>;

	#emit<T extends EventNames<ChimeraEntityRepositoryEventMap<Item, OperatorsMap>>>(
		event: T,
		arg: EventArgs<ChimeraEntityRepositoryEventMap<Item, OperatorsMap>, T>,
	) {
		queueMicrotask(() => super.emit(event, arg));
	}

	override emit(): never {
		throw new ChimeraInternalError("External events dispatching is not supported.");
	}

	#registerUpdate(item: Item, skipItem?: ChimeraItemQuery<Item>) {
		const id = this.#idGetter(item);
		const oldItem = this.#itemsMap.get(id);
		this.#itemsMap.set(id, item);

		const itemQuery = this.#itemQueryMap.get(id);
		itemQuery && skipItem !== itemQuery && itemQuery[ChimeraSetOneSym](item);

		!oldItem && this.#emit('itemAdded', { instance: this, item });
		this.#emit('itemUpdated', { instance: this, item, oldItem: oldItem ?? null });
	}
	#registerDelete(id: ChimeraEntityId, skipItem?: ChimeraItemQuery<Item>) {
		const oldItem = this.#itemsMap.get(id);
		if (!oldItem) return;
		this.#itemsMap.delete(id);

		const itemQuery = this.#itemQueryMap.get(id);
		itemQuery && skipItem !== itemQuery && itemQuery[ChimeraDeleteOneSym](id);

		this.#emit('itemDeleted', { instance: this, oldItem: oldItem ?? null });
	}

	#propagateUpdateOne(item: Item, { item: skipItem, collection: skipCollection }: SkipParams<Item, OperatorsMap> = {}) {
		this.#registerUpdate(item, skipItem);
		for (const c of this.#collectionQueryMap.values()) c !== skipCollection && c[ChimeraSetOneSym](item);
	}

	#propagateDeleteOne(
		id: ChimeraEntityId,
		{ item: skipItem, collection: skipCollection }: SkipParams<Item, OperatorsMap> = {},
	) {
		this.#registerDelete(id, skipItem);
		for (const c of this.#collectionQueryMap.values()) c !== skipCollection && c[ChimeraDeleteOneSym](id);
	}

	#propagateUpdateMany(
		items: Item[],
		{ item: skipItem, collection: skipCollection }: SkipParams<Item, OperatorsMap> = {},
	) {
		for (const item of items) this.#registerUpdate(item, skipItem);
		this.#emit('updated', { instance: this, items });
		for (const c of this.#collectionQueryMap.values()) c !== skipCollection && c[ChimeraSetManySym](items);
	}

	#propagateDeleteMany(
		ids: ChimeraEntityId[],
		{ item: skipItem, collection: skipCollection }: SkipParams<Item, OperatorsMap> = {},
	) {
		for (const id of ids) this.#registerDelete(id, skipItem);
		this.#emit('deleted', { ids, instance: this });
		for (const c of this.#collectionQueryMap.values()) c !== skipCollection && c[ChimeraDeleteManySym](ids);
	}

	#itemUpdateHandler(query: ChimeraItemQuery<Item>, item: Item) {
		this.#propagateUpdateOne(item, { item: query });
	}
	#itemDeleteHandler(query: ChimeraItemQuery<Item>, id: ChimeraEntityId) {
		this.#itemQueryMap.delete(id);
		this.#propagateDeleteOne(id, { item: query });
	}
	#prepareItemQuery(query: ChimeraItemQuery<Item>): ChimeraItemQuery<Item> {
		if (query.id !== "") this.#itemQueryMap.set(query.id, query);
		query.on('selfCreated', ({ instance }) => this.#itemQueryMap.set(instance.id, instance));
		query.on("selfUpdated", ({ instance, item }) => this.#itemUpdateHandler(instance, item));
		query.on("selfDeleted", ({ instance, id }) => this.#itemDeleteHandler(instance, id));
		return query;
	}

	#simplifyCollectionParams(
		params: ChimeraCollectionParams<OperatorsMap, Item>,
	): ChimeraQueryEntityCollectionFetcherParams<Item, OperatorsMap> {
		return {
			filter: simplifyFilter(params.filter),
			meta: params.meta,
			order: simplifyOrderBy(params.order),
		};
	}

	#getCollectionKey({ order, filter }: ChimeraQueryEntityCollectionFetcherParams<Item, OperatorsMap>): string {
		return `ORDER<${order ? this.#orderConfig.getKey(order) : ""}>\nFILTER<${filter ? this.#filterConfig.getFilterKey(filter) : ""}>`;
	}

	#collectionUpdateHandler(query: ChimeraCollectionQuery<Item, OperatorsMap>, items: Item[]) {
		this.#propagateUpdateMany(items, { collection: query });
	}

	#collectionCreateHandler(query: ChimeraCollectionQuery<Item, OperatorsMap>, item: Item) {
		this.#propagateUpdateOne(item, { collection: query });
	}

	#collectionItemUpdated(query: ChimeraCollectionQuery<Item, OperatorsMap>, item: Item) {
		this.#propagateUpdateOne(item, { collection: query });
	}

	#collectionItemDeleted(query: ChimeraCollectionQuery<Item, OperatorsMap>, id: ChimeraEntityId) {
		this.#propagateDeleteOne(id, { collection: query });
	}

	#prepareCollectionQuery(
		query: ChimeraCollectionQuery<Item, OperatorsMap>,
	): ChimeraCollectionQuery<Item, OperatorsMap> {
		this.#collectionQueryMap.set(this.#getCollectionKey(query[ChimeraGetParamsSym]), query);
		query.on("selfUpdated", ({ instance, items }) => this.#collectionUpdateHandler(instance, items));
		query.on("selfItemCreated", ({ instance, item }) => this.#collectionCreateHandler(instance, item));
		query.on("selfItemUpdated", ({ instance, item }) => this.#collectionItemUpdated(instance, item));
		query.on("selfItemDeleted", ({ instance, id }) => this.#collectionItemDeleted(instance, id));
		return query;
	}

	#getParentQuery(
		filter: ChimeraSimplifiedFilter<OperatorsMap, keyof Item & string>,
	): ChimeraCollectionQuery<Item, OperatorsMap> | null {
		for (const q of this.#collectionQueryMap.values())
			if (q.ready && isFilterSubset(q[ChimeraGetParamsSym].filter, filter, this.#filterConfig.getOperatorKey)) return q;
		return null;
	}

	constructor(
		config: QueryEntityConfig<Item, OperatorsMap>,
		filterConfig: Required<ChimeraFilterConfig<OperatorsMap>>,
		orderConfig: Required<ChimeraOrderConfig>,
	) {
		super();

		this.#entityConfig = config;
		this.#filterConfig = filterConfig;
		this.#orderConfig = orderConfig;
		this.#idGetter = config.idGetter;

		this.#itemsMap = new ChimeraWeakValueMap();
		this.#collectionQueryMap = new ChimeraWeakValueMap();
		this.#itemQueryMap = new ChimeraWeakValueMap();

		this.#emit('initialized', { instance: this });
	}

	[ChimeraSetOneSym](item: Item) {
		this.#propagateUpdateOne(item);
	}
	[ChimeraDeleteOneSym](id: ChimeraEntityId) {
		this.#propagateDeleteOne(id);
	}

	[ChimeraSetManySym](items: Item[]) {
		this.#propagateUpdateMany(items);
	}

	[ChimeraDeleteManySym](ids: ChimeraEntityId[]) {
		this.#propagateDeleteMany(ids);
	}

	[ChimeraUpdateMixedSym](toAdd: Item[], toDelete: ChimeraEntityId[]) {
		this.#propagateUpdateMany(toAdd);
		this.#propagateDeleteMany(toDelete);
	}

	createItem(item: DeepPartial<Item>, meta?: any): ChimeraItemQuery<Item> {
		return this.#prepareItemQuery(new ChimeraItemQuery(this.#entityConfig, { id: '', meta }, null, item));
	}

	getItem(id: ChimeraEntityId, meta?: any): ChimeraItemQuery<Item> {
		const query = this.#itemQueryMap.get(id);
		if (query) return query;

		return this.#prepareItemQuery(
			new ChimeraItemQuery(this.#entityConfig, { id, meta }, this.#itemsMap.get(id) ?? null, null),
		);
	}

	getCollection(params: ChimeraCollectionParams<OperatorsMap, Item>): ChimeraCollectionQuery<Item, OperatorsMap> {
		const simplifiedParams = this.#simplifyCollectionParams(params);
		const key = this.#getCollectionKey(simplifiedParams);
		const query = this.#collectionQueryMap.get(key);
		if (query) return query;

		return this.#prepareCollectionQuery(
			new ChimeraCollectionQuery(
				this.#entityConfig,
				simplifiedParams,
				this.#getParentQuery(simplifiedParams.filter),
				buildComparator(this.#orderConfig.primitiveComparator, params.order),
				compileFilter(this.#filterConfig, params.filter),
				false,
			),
		);
	}
}
