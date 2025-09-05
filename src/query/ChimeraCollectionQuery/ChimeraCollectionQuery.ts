import type { ChimeraFilterChecker } from "../../filter/types.ts";
import type { ChimeraOrderByComparator } from "../../order/types.ts";
import type { EventArgs, EventNames } from "../../shared/ChimeraEventEmitter";
import { ChimeraEventEmitter } from "../../shared/ChimeraEventEmitter";
import { ChimeraInternalError } from "../../shared/errors.ts";
import { deepObjectFreeze, makeCancellablePromise, none, some } from "../../shared/shared.ts";
import type {
	ChimeraCancellablePromise,
	ChimeraEntityId,
	ChimeraIdGetterFunc,
	DeepPartial,
	Option,
} from "../../shared/types.ts";
import {
	ChimeraDeleteManySym,
	ChimeraDeleteOneSym,
	ChimeraGetParamsSym,
	ChimeraSetManySym,
	ChimeraSetOneSym,
	ChimeraUpdateMixedSym,
	IN_PROGRESS_STATES,
} from "../constants.ts";
import {
	ChimeraQueryAlreadyRunningError,
	ChimeraQueryDeletingError,
	type ChimeraQueryError,
	ChimeraQueryFetchingError,
	ChimeraQueryNotReadyError,
	ChimeraQueryTrustFetchedCollectionError,
	ChimeraQueryTrustIdMismatchError,
	ChimeraQueryUnsuccessfulDeletionError,
} from "../errors.ts";
import {
	type ChimeraQueryBatchedDeleteResponse,
	type ChimeraQueryCollectionFetcherResponse,
	type ChimeraQueryEntityCollectionFetcherParams,
	type ChimeraQueryFetchingStatable,
	ChimeraQueryFetchingState,
	type ChimeraQueryItemDeleteResponse,
	type ChimeraQueryItemFetcherResponse,
	type QueryEntityConfig,
} from "../types.ts";

export type ChimeraCollectionQueryEventMap<Item extends object> = {
	/** Once the query is initialized */
	initialized: { instance: ChimeraCollectionQuery<Item> };

	/** Once the query data is ready (will be followed by 'update') */
	ready: { instance: ChimeraCollectionQuery<Item> };

	/** Each time the query was updated */
	updated: { instance: ChimeraCollectionQuery<Item>; items: Item[]; oldItems: Option<Item[]> };
	/** Each time the query was an initiator of update */
	selfUpdated: { instance: ChimeraCollectionQuery<Item>; items: Item[]; oldItems: Option<Item[]> };

	/** Each time item created */
	selfItemCreated: { instance: ChimeraCollectionQuery<Item>; item: Item };

	/** Each time item added */
	itemAdded: { instance: ChimeraCollectionQuery<Item>; item: Item };

	/** Each time item updated */
	itemUpdated: { instance: ChimeraCollectionQuery<Item>; oldItem: Item; newItem: Item };
	/** Each time the query was an initiator of an item update */
	selfItemUpdated: { instance: ChimeraCollectionQuery<Item>; item: Item };

	/** Each time item deleted */
	itemDeleted: { instance: ChimeraCollectionQuery<Item>; item: Item };
	/** Each time the query was an initiator of item deletion */
	selfItemDeleted: { instance: ChimeraCollectionQuery<Item>; id: ChimeraEntityId };

	/** Each time the fetcher produces an error */
	error: { instance: ChimeraCollectionQuery<Item>; error: unknown };
};

export class ChimeraCollectionQuery<Item extends object>
	extends ChimeraEventEmitter<ChimeraCollectionQueryEventMap<Item>>
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

	#emit<T extends EventNames<ChimeraCollectionQueryEventMap<Item>>>(
		event: T,
		arg: EventArgs<ChimeraCollectionQueryEventMap<Item>, T>,
	) {
		queueMicrotask(() => super.emit(event, arg));
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
		this.#emit("itemAdded", {instance: this, item});
	}

	#setItems(items: Item[]) {
		!this.#items.some && this.#emit("ready", {instance: this});
		const old = this.#items;
		this.#items = some(items);
		this.#emit("updated", {instance: this, items, oldItems: old});
	}

	#setNewItems(items: Item[]) {
		items.forEach((i) => deepObjectFreeze(i));
		this.#emit("selfUpdated", {instance: this, items, oldItems: this.#items});
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
		this.#emit("itemDeleted", {instance: this, item: old as Item});
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
		this.#emit("itemUpdated", {instance: this, newItem: newItem, oldItem: old as Item});
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

	#setError(error: unknown, source: ChimeraQueryError): never {
		this.#state = this.#items.some ? ChimeraQueryFetchingState.ReErrored : ChimeraQueryFetchingState.Errored;
		this.#lastError = error;
		this.#emit("error", {error, instance: this});
		throw source;
	}

	#watchPromise(
		promise: ChimeraCancellablePromise<ChimeraQueryCollectionFetcherResponse<Item>>,
		controller: AbortController,
	): ChimeraCancellablePromise<ChimeraQueryCollectionFetcherResponse<Item>> {
		return makeCancellablePromise(
			promise
				.then((response) => {
					this.#setNewItems(this.#validate(response.data));
					this.#state = ChimeraQueryFetchingState.Fetched;
					return response;
				})
				.catch((error) => this.#setError(error, new ChimeraQueryFetchingError(this.#config.name, error))),
			controller,
		);
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
					controller,
				),
			);
		}

		this.#emit("initialized", {instance: this});
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

	/**
	 * Wait for the current progress process to complete (both success or error)
	 */
	get progress(): Promise<void> {
		return new Promise((res) => {
			const resolve = () => queueMicrotask(() => res());
			if (this.#promise) {
				this.#promise.then(resolve, resolve);
				this.#promise.cancelled(resolve);
			} else resolve();
		});
	}

	/**
	 * Wait for the current progress process to complete, throw an error if it fails
	 */
	get result(): Promise<void> {
		return new Promise((res, rej) => {
			const resolve = () => queueMicrotask(() => res());
			if (this.#promise) {
				this.#promise.then(resolve, rej);
				this.#promise.cancelled(() => rej("cancelled"));
			} else resolve();
		});
	}

	/** Return an item if it is ready, throw error otherwise */
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
		return this.#setPromise(
			this.#watchPromise(
				makeCancellablePromise(this.#config.collectionFetcher(this.#params, {signal: controller.signal}), controller),
				controller,
			),
		);
	}

	/**
	 * Update item using updated copy
	 * @param newItem new item to update
	 */
	update(newItem: Item): Promise<ChimeraQueryItemFetcherResponse<Item>> {
		const { controller } = this.#prepareRequestParams();
		return this.#config.itemUpdater(newItem, {signal: controller.signal}).then((response) => {
			const { data } = response;
			this.#items.some && this.#setNewOne(data);
			this.#emit("selfItemUpdated", {instance: this, item: data});
			return response;
		});
	}

	/**
	 * Update item using updated copy
	 * @param newItems array of items to update
	 */
	batchedUpdate(newItems: Iterable<Item>): Promise<ChimeraQueryCollectionFetcherResponse<Item>> {
		const { controller } = this.#prepareRequestParams();
		return this.#config.batchedUpdater(Array.from(newItems), {signal: controller.signal}).then((response) => {
			const ready = this.#items.some;
			response.data.forEach((item) => {
				ready && this.#setNewOne(item);
				this.#emit("selfItemUpdated", {instance: this, item});
			});
			return response;
		});
	}

	/**
	 * Delete item using its [id]
	 * @param id id of item to delete
	 */
	delete(id: ChimeraEntityId): Promise<ChimeraQueryItemDeleteResponse> {
		const { controller } = this.#prepareRequestParams();
		return this.#config.itemDeleter(id, {signal: controller.signal}).then(
			(response) => {
				const {
					result: { id: newId, success },
				} = response;
				if (!this.#items.some) {
					success && this.#emit("selfItemDeleted", {id: newId, instance: this});
					return response;
				}

				if (this.#config.trustQuery && !this.#config.devMode && success) {
					this.#deleteById(newId);
					this.#emit("selfItemDeleted", {id: newId, instance: this});
					return response;
				}

				if (id !== newId) {
					this.#config.devMode &&
						this.#config.trustQuery &&
						console.warn(new ChimeraQueryTrustIdMismatchError(this.#config.name, id, newId));

					if (!this.#config.trustQuery) {
						success && this.#emit("selfItemDeleted", {id: newId, instance: this});
						throw new ChimeraQueryTrustIdMismatchError(this.#config.name, id, newId);
					}
				}

				if (success) {
					this.#deleteById(newId);
					this.#emit("selfItemDeleted", {id: newId, instance: this});
					return response;
				}
				const error = new ChimeraQueryUnsuccessfulDeletionError(this.#config.name, id);
				this.#state = ChimeraQueryFetchingState.ReErrored;
				this.#lastError = error;
				throw error;
			},
			(error) => this.#setError(error, new ChimeraQueryDeletingError(this.#config.name, error)),
		);
	}

	/**
	 * Delete a list of items by their [id]s
	 * @param ids array of items to delete
	 */
	batchedDelete(ids: Iterable<ChimeraEntityId>): Promise<ChimeraQueryBatchedDeleteResponse> {
		const { controller } = this.#prepareRequestParams();
		return this.#config.batchedDeleter(Array.from(ids), {signal: controller.signal}).then(
			(response) => {
				this.#items.some &&
					response.result.forEach(({ id: newId, success }) => {
						if (success) {
							this.#deleteById(newId);
							this.#emit("selfItemDeleted", {id: newId, instance: this});
						} else {
							const error = new ChimeraQueryUnsuccessfulDeletionError(this.#config.name, newId);
							this.#state = ChimeraQueryFetchingState.ReErrored;
							this.#lastError = error;
							throw error;
						}
					});
				return response;
			},
			(error) => this.#setError(error, new ChimeraQueryDeletingError(this.#config.name, error)),
		);
	}

	/**
	 * Create new item using partial data
	 * @param item partial item data to create new item
	 */
	create(item: DeepPartial<Item>): Promise<ChimeraQueryItemFetcherResponse<Item>> {
		const { controller } = this.#prepareRequestParams();
		return this.#config.itemCreator(item, {signal: controller.signal}).then(
			(response) => {
				const { data } = response;
				this.#items.some && this.#setNewOne(data);
				this.#emit("selfItemCreated", {instance: this, item: data});
				return response;
			},
			(error) => this.#setError(error, new ChimeraQueryFetchingError(this.#config.name, error)),
		);
	}

	/**
	 * Create multiple items using partial data
	 * @param items array of partial item data to create new items
	 */
	batchedCreate(items: Iterable<DeepPartial<Item>>): Promise<ChimeraQueryCollectionFetcherResponse<Item>> {
		const { controller } = this.#prepareRequestParams();
		return this.#config.batchedCreator(Array.from(items), {signal: controller.signal}).then(
			(response) => {
				this.#items.some &&
					response.data.forEach((item) => {
						this.#setNewOne(item);
						this.#emit("selfItemCreated", {instance: this, item});
					});
				return response;
			},
			(error) => this.#setError(error, new ChimeraQueryFetchingError(this.#config.name, error)),
		);
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

	entries(): ArrayIterator<[number, Item]> {
		return this.#readyItems().entries();
	}

	values(): ArrayIterator<Item> {
		return this.#readyItems().values();
	}

	keys(): ArrayIterator<number> {
		return this.#readyItems().keys();
	}

	every<S extends Item>(
		predicate: (value: Item, index: number, query: this) => value is S,
	): this is ChimeraCollectionQuery<S>;
	every(predicate: (value: Item, index: number, query: this) => unknown): boolean;
	every(predicate: (value: Item, index: number, query: this) => unknown): boolean {
		return this.#readyItems().every((item, idx) => predicate(item, idx, this));
	}

	some(predicate: (value: Item, index: number, query: this) => unknown): boolean {
		return this.#readyItems().some((item, idx) => predicate(item, idx, this));
	}

	filter<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): S[];
	filter(predicate: (value: Item, index: number, query: this) => boolean): Item[];
	filter<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): S[] {
		return this.#readyItems().filter((item, idx) => predicate(item, idx, this));
	}

	find<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): S | undefined;
	find(predicate: (value: Item, index: number, query: this) => unknown): Item | undefined;
	find<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): S | undefined {
		return this.#readyItems().find((item, idx) => predicate(item, idx, this));
	}

	findIndex<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): number;
	findIndex(predicate: (value: Item, index: number, query: this) => boolean): number;
	findIndex<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): number {
		return this.#readyItems().findIndex((item, idx) => predicate(item, idx, this));
	}

	findLast<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): S | undefined;
	findLast(predicate: (value: Item, index: number, query: this) => boolean): Item | undefined;
	findLast<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): S | undefined {
		return this.#readyItems().findLast((item, idx) => predicate(item, idx, this));
	}

	findLastIndex<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): number;
	findLastIndex(predicate: (value: Item, index: number, query: this) => boolean): number;
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
