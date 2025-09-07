import { compileFilter, simplifyFilter } from "../../filter/filter.ts";
import type { ChimeraFilterConfig } from "../../filter/types.ts";
import { buildComparator, simplifyOrderBy } from "../../order/order.ts";
import type { ChimeraOrderConfig } from "../../order/types.ts";
import { ChimeraCollectionQuery } from "../../query/ChimeraCollectionQuery/ChimeraCollectionQuery.ts";
import { ChimeraItemQuery } from "../../query/ChimeraItemQuery/ChimeraItemQuery.ts";
import {
	ChimeraDeleteManySym,
	ChimeraDeleteOneSym,
	ChimeraGetParamsSym,
	ChimeraSetManySym,
	ChimeraSetOneSym,
	ChimeraUpdateMixedSym,
} from "../../query/constants.ts";
import type { ChimeraQueryEntityCollectionFetcherParams, QueryEntityConfig } from "../../query/types.ts";
import type { EventArgs, EventNames } from "../../shared/ChimeraEventEmitter";
import { ChimeraEventEmitter } from "../../shared/ChimeraEventEmitter";
import { ChimeraWeakValueMap } from "../../shared/ChimeraWeakValueMap";
import { ChimeraInternalError } from "../../shared/errors.ts";
import { none, optionFromNullish, some } from "../../shared/shared.ts";
import type { ChimeraEntityId, ChimeraIdGetterFunc, DeepPartial, Option } from "../../shared/types.ts";
import type { ChimeraCollectionParams } from "../types.ts";

export type ChimeraEntityRepositoryEventMap<Item extends object, FilterConfig extends ChimeraFilterConfig> = {
	/** Each time item added */
	itemAdded: [{ instance: ChimeraEntityRepository<Item, FilterConfig>; item: Item }];

	/** Each time many items updated */
	updated: [{ instance: ChimeraEntityRepository<Item, FilterConfig>; items: Item[] }];
	/** Each time item updated */
	itemUpdated: [{ instance: ChimeraEntityRepository<Item, FilterConfig>; item: Item; oldItem: Option<Item> }];

	/** Each time item deleted */
	itemDeleted: [{ instance: ChimeraEntityRepository<Item, FilterConfig>; oldItem: Option<Item> }];
};

type SkipParams<Item extends object> = {
	item?: ChimeraItemQuery<Item>;
	collection?: ChimeraCollectionQuery<Item>;
};

export class ChimeraEntityRepository<
	Item extends object,
	FilterConfig extends ChimeraFilterConfig,
> extends ChimeraEventEmitter<ChimeraEntityRepositoryEventMap<Item, FilterConfig>> {
	readonly #entityConfig: QueryEntityConfig<Item>;
	readonly #filterConfig: FilterConfig;
	readonly #orderConfig: ChimeraOrderConfig;
	readonly #idGetter: ChimeraIdGetterFunc<Item>;

	readonly #itemsMap: ChimeraWeakValueMap<ChimeraEntityId, Item>;

	readonly #collectionQueryMap: ChimeraWeakValueMap<string, ChimeraCollectionQuery<Item>>;
	readonly #itemQueryMap: ChimeraWeakValueMap<ChimeraEntityId, ChimeraItemQuery<Item>>;

	#emit<T extends EventNames<ChimeraEntityRepositoryEventMap<Item, FilterConfig>>>(
		event: T,
		arg: EventArgs<ChimeraEntityRepositoryEventMap<Item, FilterConfig>, T>,
	) {
		queueMicrotask(() => super.emit(event, arg));
	}

	override emit(): never {
		throw new ChimeraInternalError("External events dispatching is not supported.");
	}

	#registerUpdate(item: Item, skipItem?: ChimeraItemQuery<Item>) {
		const id = this.#idGetter(item);
		const old = this.#itemsMap.get(id);
		this.#itemsMap.set(id, item);

		const itemQuery = this.#itemQueryMap.get(id);
		itemQuery && skipItem !== itemQuery && itemQuery[ChimeraSetOneSym](item);

		!old && this.#emit("itemAdded", { instance: this, item });
		this.#emit("itemUpdated", { instance: this, item, oldItem: optionFromNullish(old) });
	}
	#registerDelete(id: ChimeraEntityId, skipItem?: ChimeraItemQuery<Item>) {
		const item = this.#itemsMap.get(id);
		if (!item) return;
		this.#itemsMap.delete(id);

		const itemQuery = this.#itemQueryMap.get(id);
		itemQuery && skipItem !== itemQuery && itemQuery[ChimeraDeleteOneSym](id);

		this.#emit("itemDeleted", { instance: this, oldItem: optionFromNullish(item) });
	}

	#propagateUpdateOne(item: Item, { item: skipItem, collection: skipCollection }: SkipParams<Item> = {}) {
		this.#registerUpdate(item, skipItem);
		for (const c of this.#collectionQueryMap.values()) c !== skipCollection && c[ChimeraSetOneSym](item);
	}
	#propagateDeleteOne(id: ChimeraEntityId, { item: skipItem, collection: skipCollection }: SkipParams<Item> = {}) {
		this.#registerDelete(id, skipItem);
		for (const c of this.#collectionQueryMap.values()) c !== skipCollection && c[ChimeraDeleteOneSym](id);
	}

	#propagateUpdateMany(items: Iterable<Item>, { item: skipItem, collection: skipCollection }: SkipParams<Item> = {}) {
		for (const item of items) this.#registerUpdate(item, skipItem);
		this.#emit("updated", { instance: this, items: Array.from(items) });
		for (const c of this.#collectionQueryMap.values()) c !== skipCollection && c[ChimeraSetManySym](items);
	}
	#propagateDeleteMany(
		ids: Iterable<ChimeraEntityId>,
		{ item: skipItem, collection: skipCollection }: SkipParams<Item> = {},
	) {
		for (const id of ids) this.#registerDelete(id, skipItem);
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
		this.#itemQueryMap.set(query.id, query);
		query.on("selfUpdated", ({ instance, item }) => this.#itemUpdateHandler(instance, item));
		query.on("selfDeleted", ({ instance, id }) => this.#itemDeleteHandler(instance, id));
		return query;
	}

	#simplifyCollectionParams(
		params: ChimeraCollectionParams<FilterConfig, Item>,
	): ChimeraQueryEntityCollectionFetcherParams<Item, FilterConfig> {
		return {
			filter: simplifyFilter(params.filter),
			meta: params.meta,
			order: simplifyOrderBy(params.order),
		};
	}
	#getCollectionKey({ order, filter }: ChimeraQueryEntityCollectionFetcherParams<Item, FilterConfig>): string {
		return `ORDER<${order ? this.#orderConfig.getKey(order) : ""}>\nFILTER<${filter ? this.#filterConfig.getFilterKey(filter) : ""}>`;
	}

	#collectionUpdateHandler(query: ChimeraCollectionQuery<Item>, items: Item[]) {
		this.#propagateUpdateMany(items, { collection: query });
	}
	#collectionCreateHandler(query: ChimeraCollectionQuery<Item>, item: Item) {
		this.#propagateUpdateOne(item, { collection: query });
	}
	#collectionItemUpdated(query: ChimeraCollectionQuery<Item>, item: Item) {
		this.#propagateUpdateOne(item, { collection: query });
	}
	#collectionItemDeleted(query: ChimeraCollectionQuery<Item>, id: ChimeraEntityId) {
		this.#propagateDeleteOne(id, { collection: query });
	}
	#prepareCollectionQuery(query: ChimeraCollectionQuery<Item>): ChimeraCollectionQuery<Item> {
		this.#collectionQueryMap.set(this.#getCollectionKey(query[ChimeraGetParamsSym]), query);
		query.on("selfUpdated", ({ instance, items }) => this.#collectionUpdateHandler(instance, items));
		query.on("selfItemCreated", ({ instance, item }) => this.#collectionCreateHandler(instance, item));
		query.on("selfItemUpdated", ({ instance, item }) => this.#collectionItemUpdated(instance, item));
		query.on("selfItemDeleted", ({ instance, id }) => this.#collectionItemDeleted(instance, id));
		return query;
	}

	constructor(config: QueryEntityConfig<Item>, filterConfig: FilterConfig, orderConfig: ChimeraOrderConfig) {
		super();

		this.#entityConfig = config;
		this.#filterConfig = filterConfig;
		this.#orderConfig = orderConfig;
		this.#idGetter = config.idGetter;

		this.#itemsMap = new ChimeraWeakValueMap();
		this.#collectionQueryMap = new ChimeraWeakValueMap();
		this.#itemQueryMap = new ChimeraWeakValueMap();
	}

	[ChimeraSetOneSym](item: Item) {
		this.#propagateUpdateOne(item);
	}
	[ChimeraDeleteOneSym](id: ChimeraEntityId) {
		this.#propagateDeleteOne(id);
	}
	[ChimeraSetManySym](items: Iterable<Item>) {
		this.#propagateUpdateMany(items);
	}
	[ChimeraDeleteManySym](ids: Iterable<ChimeraEntityId>) {
		this.#propagateDeleteMany(ids);
	}
	[ChimeraUpdateMixedSym](toAdd: Iterable<Item>, toDelete: Iterable<ChimeraEntityId>) {
		this.#propagateUpdateMany(toAdd);
		this.#propagateDeleteMany(toDelete);
	}

	createItem(item: DeepPartial<Item>, meta?: any): ChimeraItemQuery<Item> {
		return this.#prepareItemQuery(new ChimeraItemQuery(this.#entityConfig, { id: "", meta }, none(), some(item)));
	}

	getItem(id: ChimeraEntityId, meta?: any): ChimeraItemQuery<Item> {
		const query = this.#itemQueryMap.get(id);
		if (query) return query;

		return this.#prepareItemQuery(
			new ChimeraItemQuery(this.#entityConfig, { id, meta }, optionFromNullish(this.#itemsMap.get(id)), none()),
		);
	}

	getCollection(params: ChimeraCollectionParams<FilterConfig, Item>): ChimeraCollectionQuery<Item> {
		const simplifiedParams = this.#simplifyCollectionParams(params);
		const key = this.#getCollectionKey(simplifiedParams);
		const query = this.#collectionQueryMap.get(key);
		if (query) return query;

		return this.#prepareCollectionQuery(
			new ChimeraCollectionQuery(
				this.#entityConfig,
				simplifiedParams as ChimeraQueryEntityCollectionFetcherParams<Item>,
				none(),
				buildComparator(this.#orderConfig.primitiveComparator, params.order),
				compileFilter(this.#filterConfig, params.filter),
				false,
			),
		);
	}
}
