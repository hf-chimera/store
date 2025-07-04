import { EventEmitter } from "eventemitter3";
import type { ChimeraFilterChecker } from "../filter/types.ts";
import type { ChimeraOrderByComparator } from "../order/types.ts";
import { ChimeraInternalError } from "../shared/errors.ts";
import { deepObjectFreeze, makeCancellablePromise, none, some } from "../shared/shared.ts";
import type {
	ChimeraCancellablePromise,
	ChimeraEntityId,
	ChimeraIdGetterFunc,
	DeepPartial,
	Option,
} from "../shared/types.ts";
import {
	ChimeraDeleteManySym,
	ChimeraDeleteOneSym,
	ChimeraGetParamsSym,
	ChimeraSetManySym,
	ChimeraSetOneSym,
	ChimeraUpdateMixedSym,
	IN_PROGRESS_STATES,
} from "./constants.ts";
import {
	ChimeraQueryAlreadyRunningError,
	ChimeraQueryDeletingError,
	type ChimeraQueryError,
	ChimeraQueryFetchingError,
	ChimeraQueryNotReadyError,
	ChimeraQueryTrustFetchedCollectionError,
	ChimeraQueryTrustIdMismatchError,
	ChimeraQueryUnsuccessfulDeletionError,
} from "./errors.ts";
import {
	type ChimeraQueryBatchedDeleteResponse,
	type ChimeraQueryCollectionFetcherResponse,
	type ChimeraQueryEntityCollectionFetcherParams,
	type ChimeraQueryFetchingStatable,
	ChimeraQueryFetchingState,
	type ChimeraQueryItemDeleteResponse,
	type ChimeraQueryItemFetcherResponse,
	type QueryEntityConfig,
} from "./types.ts";

export type ChimeraCollectionQueryEventMap<Item extends object> = {
	/** Once the query is initialized */
	initialized: [ChimeraCollectionQuery<Item>];

	/** Once the query data is ready (will be followed by 'update') */
	ready: [ChimeraCollectionQuery<Item>];

	/** Each time the query was updated */
	updated: [ChimeraCollectionQuery<Item>, Item[], Option<Item[]>];
	/** Each time the query was an initiator of update */
	selfUpdated: [ChimeraCollectionQuery<Item>, Item[], Option<Item[]>];

	/** Each time item created */
	selfItemCreated: [ChimeraCollectionQuery<Item>, Item];

	/** Each time item added */
	itemAdded: [ChimeraCollectionQuery<Item>, Item];

	/** Each time item updated */
	itemUpdated: [ChimeraCollectionQuery<Item>, Item, Item];
	/** Each time the query was an initiator of an item update */
	selfItemUpdated: [ChimeraCollectionQuery<Item>, Item];

	/** Each time item deleted */
	itemDeleted: [ChimeraCollectionQuery<Item>, Item];
	/** Each time the query was an initiator of item deletion */
	selfItemDeleted: [ChimeraCollectionQuery<Item>, ChimeraEntityId];

	/** Each time fetcher produces an error */
	error: [ChimeraCollectionQuery<Item>, unknown];
};

export class ChimeraCollectionQuery<Item extends object>
	extends EventEmitter<ChimeraCollectionQueryEventMap<Item>>
	implements ChimeraQueryFetchingStatable
{
	#state: ChimeraQueryFetchingState;
	#promise: ChimeraCancellablePromise | null;
	#lastError: unknown;
	#items: Option<Item[]>;
	readonly #config: QueryEntityConfig<Item>;
	readonly #idGetter: ChimeraIdGetterFunc<Item>;
	readonly #params: ChimeraQueryEntityCollectionFetcherParams<Item>;
	readonly #order: ChimeraOrderByComparator<Item>;
	readonly #filter: ChimeraFilterChecker<Item>;

	#emit<T extends EventEmitter.EventNames<ChimeraCollectionQueryEventMap<Item>>>(
		event: T,
		...args: EventEmitter.EventArgs<ChimeraCollectionQueryEventMap<Item>, T>
	) {
		queueMicrotask(() => super.emit(event, ...args));
	}

	override emit(): never {
		throw new ChimeraInternalError("External events dispatching is not supported.");
	}

	#prepareRequestParams() {
		return {
			controller: new AbortController(),
		};
	}

	#readyItems(internalMessage?: string): Item[] {
		if (this.#items.some) return this.#items.value;
		throw internalMessage
			? new ChimeraInternalError(internalMessage)
			: new ChimeraQueryNotReadyError(this.#config.name);
	}

	#addItem(item: Item) {
		const items = this.#readyItems("Trying to update not ready collection");
		const foundIndex = items.findIndex((el) => this.#order(el, item) > 0);
		items.splice(foundIndex !== -1 ? foundIndex : items.length, 0, item);
		this.#emit("itemAdded", this, item);
	}

	#setItems(items: Item[]) {
		!this.#items.some && this.#emit("ready", this);
		const old = this.#items;
		this.#items = some(items);
		this.#emit("updated", this, items, old);
	}

	#setNewItems(items: Item[]) {
		items.forEach((i) => deepObjectFreeze(i));
		this.#emit("selfUpdated", this, items, this.#items);
		this.#setItems(items);
	}

	#setPromise<P extends ChimeraCancellablePromise>(promise: P): P {
		this.#promise?.cancel();
		this.#promise = promise;
		return promise;
	}

	#deleteAtIndex(index: number) {
		if (index === -1) return;
		const { 0: old } = this.#readyItems("Trying to update not ready collection").splice(index, 1);
		this.#emit("itemDeleted", this, old as Item);
	}

	#deleteItem(item: Item) {
		this.#deleteAtIndex(this.#readyItems("Trying to update not ready collection").indexOf(item));
	}

	#deleteById(id: ChimeraEntityId) {
		this.#deleteAtIndex(
			this.#readyItems("Trying to update not ready collection").findIndex((item) => this.#idGetter(item) === id),
		);
	}

	#replaceItem(oldItem: Item, newItem: Item) {
		const items = this.#readyItems("Trying to update not ready collection");
		const index = items.indexOf(oldItem);
		const old = items[index];
		items[index] = newItem;
		this.#emit("itemUpdated", this, old as Item, newItem);
	}

	#getById(id: ChimeraEntityId) {
		return this.#readyItems("Trying to update not ready collection").find((item) => this.#idGetter(item) === id);
	}

	#setOne(item: Item) {
		const existingItem = this.#getById(this.#idGetter(item));
		const nowMatches = this.#filter(item);

		if (!(nowMatches || existingItem)) return;

		if (existingItem) {
			if (this.#order(existingItem, item) === 0) {
				this.#replaceItem(existingItem, item);
				return;
			}

			this.#deleteItem(existingItem);
		}

		nowMatches && this.#addItem(item);
	}

	#setNewOne(item: Item) {
		deepObjectFreeze(item);
		this.#setOne(item);
	}

	#apply(input: Item[]): Item[] {
		return input.filter((item: Item) => this.#filter(item)).sort((a, b) => this.#order(a, b));
	}

	#validate(input: Item[]): Item[] {
		if (this.#config.trustQuery && !this.#config.devMode) return input;

		const prepared = this.#apply(input);
		if (!this.#config.trustQuery) return prepared;

		if (this.#config.devMode) {
			for (let i = 0; i < input.length; i++) {
				if (input[i] !== prepared[i]) {
					console.warn(new ChimeraQueryTrustFetchedCollectionError(this.#config.name, input, prepared));
					break;
				}
			}
		}

		return input;
	}

	#setError(error: unknown, source: ChimeraQueryError) {
		this.#state = this.#items.some ? ChimeraQueryFetchingState.ReErrored : ChimeraQueryFetchingState.Errored;
		this.#lastError = error;
		this.#emit("error", this, error);
		throw source;
	}

	#watchPromise(
		promise: ChimeraCancellablePromise<ChimeraQueryCollectionFetcherResponse<Item>>,
	): ChimeraCancellablePromise<ChimeraQueryCollectionFetcherResponse<Item>> {
		promise
			.then(({ data }) => {
				this.#setNewItems(this.#validate(data));
				this.#state = ChimeraQueryFetchingState.Fetched;
			})
			.catch((error) => this.#setError(error, new ChimeraQueryFetchingError(this.#config.name, error)));
		return promise;
	}

	constructor(
		config: QueryEntityConfig<Item>,
		params: ChimeraQueryEntityCollectionFetcherParams<Item>,
		maybeItems: Option<Iterable<Item>>,
		order: ChimeraOrderByComparator<Item>,
		filter: ChimeraFilterChecker<Item>,
		alreadyValid: boolean,
	) {
		super();

		this.#config = config;
		this.#params = params;
		this.#promise = null;
		this.#items = none();
		this.#state = ChimeraQueryFetchingState.Initialized;
		this.#idGetter = config.idGetter;
		this.#filter = filter;
		this.#order = order;

		if (maybeItems.some) {
			const input = Array.from(maybeItems.value);
			this.#setItems(alreadyValid ? this.#validate(input) : this.#apply(input));
			this.#state = ChimeraQueryFetchingState.Prefetched;
		} else {
			this.#state = ChimeraQueryFetchingState.Fetching;
			const { controller } = this.#prepareRequestParams();
			this.#setPromise(
				this.#watchPromise(
					makeCancellablePromise(config.collectionFetcher(params, { signal: controller.signal }), controller),
				),
			);
		}

		this.#emit("initialized", this);
	}

	get [ChimeraGetParamsSym](): ChimeraQueryEntityCollectionFetcherParams<Item> {
		return this.#params;
	}

	[ChimeraSetOneSym](item: Item) {
		this.#setOne(item);
	}

	[ChimeraDeleteOneSym](id: ChimeraEntityId) {
		this.#deleteById(id);
	}

	[ChimeraSetManySym](items: Iterable<Item>) {
		for (const item of items) this.#setOne(item);
	}

	[ChimeraDeleteManySym](ids: Iterable<ChimeraEntityId>) {
		for (const id of ids) this.#deleteById(id);
	}

	[ChimeraUpdateMixedSym](toAdd: Iterable<Item>, toDelete: Iterable<ChimeraEntityId>) {
		for (const id of toDelete) this.#deleteById(id);
		for (const item of toAdd) this.#setOne(item);
	}

	get state(): ChimeraQueryFetchingState {
		return this.#state;
	}

	get inProgress(): boolean {
		return IN_PROGRESS_STATES.includes(this.#state);
	}

	get ready(): boolean {
		return this.#items.some;
	}

	get lastError(): unknown {
		return this.#lastError;
	}

	/** Return item if it is ready, throw error otherwise */
	getById(id: ChimeraEntityId): Item | undefined {
		return this.#readyItems().find((item) => this.#idGetter(item) === id);
	}

	/** Return mutable ref to item by idx if it is ready, throw error otherwise */
	mutableAt(idx: number): Item | undefined {
		return structuredClone(this.#readyItems().at(idx));
	}

	/** Return mutable ref to item by [id] if it is ready, throw error otherwise */
	mutableGetById(id: ChimeraEntityId): Item | undefined {
		return structuredClone(this.#readyItems().find((item) => this.#idGetter(item) === id));
	}

	/**
	 *  Trigger refetch, return existing refetch promise if already running
	 *  @param force If true cancels any running process and starts a new one
	 *  @throws {ChimeraQueryAlreadyRunningError} If deleting or updating already in progress
	 */
	refetch(force = false): Promise<ChimeraQueryCollectionFetcherResponse<Item>> {
		if (
			!force &&
			this.#promise &&
			[ChimeraQueryFetchingState.Fetching, ChimeraQueryFetchingState.Refetching].includes(this.#state)
		)
			return this.#promise as Promise<ChimeraQueryCollectionFetcherResponse<Item>>;

		if (!force && [ChimeraQueryFetchingState.Updating, ChimeraQueryFetchingState.Deleting].includes(this.#state))
			throw new ChimeraQueryAlreadyRunningError(this.#config.name, this.#state);

		this.#state = ChimeraQueryFetchingState.Refetching;
		const { controller } = this.#prepareRequestParams();
		const promise = this.#config.collectionFetcher(this.#params, { signal: controller.signal });
		this.#setPromise(this.#watchPromise(makeCancellablePromise(promise, controller)));
		return promise;
	}

	/**
	 * Update item using updated copy
	 * @param newItem new item to update
	 */
	update(newItem: Item): Promise<ChimeraQueryItemFetcherResponse<Item>> {
		const { controller } = this.#prepareRequestParams();
		const promise = this.#config.itemUpdater(newItem, { signal: controller.signal });
		promise.then(({ data }) => {
			this.#items.some && this.#setNewOne(data);
			this.#emit("selfItemUpdated", this, data);
		});
		return promise;
	}

	/**
	 * Update item using updated copy
	 * @param newItems array of items to update
	 */
	batchedUpdate(newItems: Iterable<Item>): Promise<ChimeraQueryCollectionFetcherResponse<Item>> {
		const { controller } = this.#prepareRequestParams();
		const promise = this.#config.batchedUpdater(Array.from(newItems), { signal: controller.signal });
		promise.then(({ data }) => {
			const ready = this.#items.some;
			data.forEach((item) => {
				ready && this.#setNewOne(item);
				this.#emit("selfItemUpdated", this, item);
			});
		});
		return promise;
	}

	/**
	 * Delete item using its [id]
	 * @param id id of item to delete
	 */
	delete(id: ChimeraEntityId): Promise<ChimeraQueryItemDeleteResponse> {
		const { controller } = this.#prepareRequestParams();
		const promise = this.#config.itemDeleter(id, { signal: controller.signal });
		promise.then(
			// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: have no idea how to fix it yet
			({ result: { id: newId, success } }) => {
				if (!this.#items.some) {
					success && this.#emit("selfItemDeleted", this, newId);
					return;
				}

				if (this.#config.trustQuery && !this.#config.devMode && success) {
					this.#deleteById(newId);
					this.#emit("selfItemDeleted", this, newId);
					return;
				}

				if (id !== newId) {
					this.#config.devMode &&
						this.#config.trustQuery &&
						console.warn(new ChimeraQueryTrustIdMismatchError(this.#config.name, id, newId));

					if (!this.#config.trustQuery) {
						success && this.#emit("selfItemDeleted", this, newId);
						throw new ChimeraQueryTrustIdMismatchError(this.#config.name, id, newId);
					}
				}

				if (success) {
					this.#deleteById(newId);
					this.#emit("selfItemDeleted", this, newId);
				} else {
					const error = new ChimeraQueryUnsuccessfulDeletionError(this.#config.name, id);
					this.#state = ChimeraQueryFetchingState.ReErrored;
					this.#lastError = error;
					throw error;
				}
			},
			(error) => this.#setError(error, new ChimeraQueryDeletingError(this.#config.name, error)),
		);
		return promise;
	}

	/**
	 * Delete a list of items by their [id]s
	 * @param ids array of items to delete
	 */
	batchedDelete(ids: Iterable<ChimeraEntityId>): Promise<ChimeraQueryBatchedDeleteResponse> {
		const { controller } = this.#prepareRequestParams();
		const idsArr = Array.from(ids);
		const promise = this.#config.batchedDeleter(idsArr, { signal: controller.signal });
		promise.then(
			({ result }) => {
				this.#items.some &&
					result.forEach(({ id: newId, success }) => {
						if (success) {
							this.#deleteById(newId);
							this.#emit("selfItemDeleted", this, newId);
						} else {
							const error = new ChimeraQueryUnsuccessfulDeletionError(this.#config.name, newId);
							this.#state = ChimeraQueryFetchingState.ReErrored;
							this.#lastError = error;
							throw error;
						}
					});
			},
			(error) => this.#setError(error, new ChimeraQueryDeletingError(this.#config.name, error)),
		);
		return promise;
	}

	/**
	 * Create new item using partial data
	 * @param item partial item data to create new item
	 */
	create(item: DeepPartial<Item>): Promise<ChimeraQueryItemFetcherResponse<Item>> {
		const { controller } = this.#prepareRequestParams();
		const promise = this.#config.itemCreator(item, { signal: controller.signal });
		promise.then(
			({ data }) => {
				this.#items.some && this.#setNewOne(data);
				this.#emit("selfItemCreated", this, data);
			},
			(error) => this.#setError(error, new ChimeraQueryFetchingError(this.#config.name, error)),
		);
		return promise;
	}

	/**
	 * Create multiple items using partial data
	 * @param items array of partial item data to create new items
	 */
	batchedCreate(items: Iterable<DeepPartial<Item>>): Promise<ChimeraQueryCollectionFetcherResponse<Item>> {
		const { controller } = this.#prepareRequestParams();
		const promise = this.#config.batchedCreator(Array.from(items), { signal: controller.signal });
		promise.then(
			({ data }) => {
				this.#items.some &&
					data.forEach((item) => {
						this.#setNewOne(item);
						this.#emit("selfItemCreated", this, item);
					});
			},
			(error) => this.#setError(error, new ChimeraQueryFetchingError(this.#config.name, error)),
		);
		return promise;
	}

	/**
	 * Standard Array API without mutations
	 */

	get length(): number {
		return this.#readyItems().length;
	}

	[Symbol.iterator](): Iterator<Item> {
		return this.#readyItems()[Symbol.iterator]();
	}

	at(idx: number): Item | undefined {
		return this.#readyItems().at(idx);
	}

	entries(): Iterator<[number, Item]> {
		return this.#readyItems().entries();
	}

	values(): Iterator<Item> {
		return this.#readyItems().values();
	}

	keys(): Iterator<number> {
		return this.#readyItems().keys();
	}

	every<S extends Item>(
		predicate: (value: Item, index: number, query: this) => value is S,
	): this is ChimeraCollectionQuery<S> {
		return this.#readyItems().every((item, idx) => predicate(item, idx, this));
	}

	some(predicate: (value: Item, index: number, query: this) => unknown): boolean {
		return this.#readyItems().some((item, idx) => predicate(item, idx, this));
	}

	filter<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): S[] {
		return this.#readyItems().filter((item, idx) => predicate(item, idx, this));
	}

	find<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): S | undefined {
		return this.#readyItems().find((item, idx) => predicate(item, idx, this));
	}

	findIndex<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): number {
		return this.#readyItems().findIndex((item, idx) => predicate(item, idx, this));
	}

	findLast<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): S | undefined {
		return this.#readyItems().findLast((item, idx) => predicate(item, idx, this));
	}

	findLastIndex<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): number {
		return this.#readyItems().findLastIndex((item, idx) => predicate(item, idx, this));
	}

	forEach(cb: (value: Item, index: number, query: this) => void) {
		this.#readyItems().forEach((item, idx) => cb(item, idx, this));
	}

	includes(item: Item): boolean {
		return this.#readyItems().includes(item);
	}

	indexOf(item: Item): number {
		return this.#readyItems().indexOf(item);
	}

	map<U>(cb: (value: Item, index: number, query: this) => U) {
		return this.#readyItems().map((item, idx) => cb(item, idx, this));
	}

	reduce<U>(cb: (previousValue: U, currentValue: Item, currentIndex: number, query: this) => U, initialValue?: U) {
		return this.#readyItems().reduce((prev, cur, idx) => cb(prev as U, cur, idx, this), initialValue);
	}

	reduceRight<U>(cb: (previousValue: U, currentValue: Item, currentIndex: number, query: this) => U, initialValue?: U) {
		return this.#readyItems().reduceRight((prev, cur, idx) => cb(prev as U, cur, idx, this), initialValue);
	}

	slice(start?: number, end?: number): Item[] {
		return this.#readyItems().slice(start, end);
	}

	toSorted(compareFn?: (a: Item, b: Item) => number): Item[] {
		return this.#readyItems().toSorted(compareFn);
	}

	toSpliced(start: number, deleteCount: number, ...items: Item[]): Item[] {
		return this.#readyItems().toSpliced(start, deleteCount, ...items);
	}

	toJSON() {
		return Array.from(this.#readyItems());
	}

	override toString(): string {
		return this.#readyItems().toString();
	}
}
