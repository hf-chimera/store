import type { ChimeraDebugConfig } from "../debug";
import type { ChimeraFilterChecker, ChimeraOperatorMap } from "../filter/types.ts";
import type { ChimeraOrderByComparator } from "../order/types.ts";
import type { EventArgs, EventNames } from "../shared/ChimeraEventEmitter";
import { ChimeraEventEmitter } from "../shared/ChimeraEventEmitter";
import { ChimeraInternalError } from "../shared/errors.ts";
import { deepObjectClone, deepObjectFreeze, makeCancellablePromise } from "../shared/shared.ts";
import type { ChimeraCancellablePromise, ChimeraEntityId, DeepPartial } from "../shared/types.ts";
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
	type ChimeraIdGetterFunction,
	type ChimeraQueryBatchedDeleteResponse,
	type ChimeraQueryCollectionFetcherResponse,
	type ChimeraQueryEntityCollectionFetcherParams,
	type ChimeraQueryFetchingStatable,
	ChimeraQueryFetchingState,
	type ChimeraQueryItemDeleteResponse,
	type ChimeraQueryItemFetcherResponse,
	type QueryEntityConfig,
} from "./types.ts";

export type ChimeraCollectionQueryEventMap<
	TEntityName extends string,
	TItem extends object,
	TOperatorsMap extends ChimeraOperatorMap,
> = {
	/** Once the query is initialized */
	initialized: { instance: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap> };

	/** Once the query data is ready (will be followed by 'update') */
	ready: { instance: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap> };

	/** Each time the query was updated */
	updated: {
		instance: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>;
		items: TItem[];
		oldItems: TItem[] | null;
	};
	/** Each time the query was an initiator of update */
	selfUpdated: {
		instance: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>;
		items: TItem[];
		oldItems: TItem[] | null;
	};

	/** Each time item created */
	selfItemCreated: { instance: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>; item: TItem };

	/** Each time item added */
	itemAdded: { instance: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>; item: TItem };

	/** Each time item updated */
	itemUpdated: { instance: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>; oldItem: TItem; newItem: TItem };
	/** Each time the query was an initiator of an item update */
	selfItemUpdated: { instance: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>; item: TItem };

	/** Each time item deleted */
	itemDeleted: { instance: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>; item: TItem };
	/** Each time the query was an initiator of item deletion */
	selfItemDeleted: { instance: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>; id: ChimeraEntityId };

	/** Each time the fetcher produces an error */
	error: { instance: ChimeraCollectionQuery<TEntityName, TItem, TOperatorsMap>; error: unknown };
};

export class ChimeraCollectionQuery<
		TEntityName extends string,
		TItem extends object,
		TOperatorsMap extends ChimeraOperatorMap,
	>
	extends ChimeraEventEmitter<ChimeraCollectionQueryEventMap<TEntityName, TItem, TOperatorsMap>>
	implements ChimeraQueryFetchingStatable
{
	#state: ChimeraQueryFetchingState;
	#promise: ChimeraCancellablePromise | null;
	#lastError: unknown;
	#items: TItem[] | null;
	readonly #entityConfig: QueryEntityConfig<TEntityName, TItem, TOperatorsMap>;
	readonly #debugConfig: ChimeraDebugConfig;
	readonly #idGetter: ChimeraIdGetterFunction<TEntityName, TItem>;
	readonly #params: ChimeraQueryEntityCollectionFetcherParams<TItem, TOperatorsMap>;
	readonly #order: ChimeraOrderByComparator<TItem>;
	readonly #filter: ChimeraFilterChecker<TItem>;

	#emit<T extends EventNames<ChimeraCollectionQueryEventMap<TEntityName, TItem, TOperatorsMap>>>(
		event: T,
		arg: EventArgs<ChimeraCollectionQueryEventMap<TEntityName, TItem, TOperatorsMap>, T>,
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

	#readyItems(internalMessage?: string): TItem[] {
		if (this.#items) return this.#items;
		throw internalMessage
			? new ChimeraInternalError(internalMessage)
			: new ChimeraQueryNotReadyError(this.#entityConfig.name);
	}

	#addItem(item: TItem) {
		const items = this.#readyItems("Trying to update not ready collection");
		const foundIndex = items.findIndex((el) => this.#order(el, item) > 0);
		items.splice(foundIndex !== -1 ? foundIndex : items.length, 0, item);
		this.#emit("itemAdded", { instance: this, item });
	}

	#setItems(items: TItem[]) {
		!this.#items && this.#emit("ready", { instance: this });
		const oldItems = this.#items;
		this.#items = items;
		this.#emit("updated", { instance: this, items, oldItems });
	}

	#setNewItems(items: TItem[]) {
		items.forEach((i) => void deepObjectFreeze(i));
		this.#emit("selfUpdated", { instance: this, items, oldItems: this.#items });
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
		this.#emit("itemDeleted", { instance: this, item: old as TItem });
	}

	#deleteItem(item: TItem) {
		this.#deleteAtIndex(this.#readyItems("Trying to update not ready collection").indexOf(item));
	}

	#deleteById(id: ChimeraEntityId) {
		const name = this.#entityConfig.name;
		this.#deleteAtIndex(
			this.#readyItems("Trying to update not ready collection").findIndex((item) => this.#idGetter(item, name) === id),
		);
	}

	#replaceItem(oldItem: TItem, newItem: TItem) {
		const items = this.#readyItems("Trying to update not ready collection");
		const index = items.indexOf(oldItem);
		const old = items[index];
		items[index] = newItem;
		this.#emit("itemUpdated", { instance: this, newItem: newItem, oldItem: old as TItem });
	}

	#getById(id: ChimeraEntityId) {
		const name = this.#entityConfig.name;
		return this.#readyItems("Trying to update not ready collection").find((item) => this.#idGetter(item, name) === id);
	}

	#setOne(item: TItem) {
		const existingItem = this.#getById(this.#idGetter(item, this.#entityConfig.name));
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

	#setNewOne(item: TItem) {
		deepObjectFreeze(item);
		this.#setOne(item);
	}

	#apply(input: TItem[]): TItem[] {
		return input.filter((item: TItem) => this.#filter(item)).sort((a, b) => this.#order(a, b));
	}

	#validate(input: TItem[]): TItem[] {
		if (this.#entityConfig.trustQuery && !this.#debugConfig.devMode) return input;

		const prepared = this.#apply(input);
		if (!this.#entityConfig.trustQuery) return prepared;

		if (this.#debugConfig.devMode) {
			for (let i = 0; i < input.length; i++) {
				if (input[i] !== prepared[i]) {
					console.warn(new ChimeraQueryTrustFetchedCollectionError(this.#entityConfig.name, input, prepared));
					break;
				}
			}
		}

		return input;
	}

	#setError(error: unknown, source: ChimeraQueryError): never {
		this.#state = this.#items ? ChimeraQueryFetchingState.ReErrored : ChimeraQueryFetchingState.Errored;
		this.#lastError = error;
		this.#emit("error", { error, instance: this });
		throw source;
	}

	#watchPromise(
		promise: ChimeraCancellablePromise<ChimeraQueryCollectionFetcherResponse<TItem>>,
		controller: AbortController,
	): ChimeraCancellablePromise<ChimeraQueryCollectionFetcherResponse<TItem>> {
		return makeCancellablePromise(
			promise
				.then((response) => {
					this.#setNewItems(this.#validate(response.data));
					this.#state = ChimeraQueryFetchingState.Fetched;
					return response;
				})
				.catch((error) => this.#setError(error, new ChimeraQueryFetchingError(this.#entityConfig.name, error))),
			controller,
		);
	}

	constructor(
		config: QueryEntityConfig<TEntityName, TItem, TOperatorsMap>,
		debugConfig: ChimeraDebugConfig,
		params: ChimeraQueryEntityCollectionFetcherParams<TItem, any>,
		existingItems: Iterable<TItem> | null,
		order: ChimeraOrderByComparator<TItem>,
		filter: ChimeraFilterChecker<TItem>,
		alreadyValid: boolean,
	) {
		super();

		this.#entityConfig = config;
		this.#debugConfig = debugConfig;
		this.#params = params;
		this.#promise = null;
		this.#items = null;
		this.#state = ChimeraQueryFetchingState.Initialized;
		this.#idGetter = config.idGetter;
		this.#filter = filter;
		this.#order = order;

		if (existingItems) {
			const input = Array.from(existingItems);
			this.#setItems(alreadyValid ? this.#validate(input) : this.#apply(input));
			this.#state = ChimeraQueryFetchingState.Prefetched;
		} else {
			this.#state = ChimeraQueryFetchingState.Fetching;
			const { controller } = this.#prepareRequestParams();
			this.#setPromise(
				this.#watchPromise(
					makeCancellablePromise(
						config.collectionFetcher(params, { signal: controller.signal }, this.#entityConfig.name),
						controller,
					),
					controller,
				),
			);
		}

		this.#emit("initialized", { instance: this });
	}

	get name() {
		return this.#entityConfig.name;
	}

	get [ChimeraGetParamsSym](): ChimeraQueryEntityCollectionFetcherParams<TItem, TOperatorsMap> {
		return this.#params;
	}

	[ChimeraSetOneSym](item: TItem) {
		this.#items && this.#setOne(item);
	}

	[ChimeraDeleteOneSym](id: ChimeraEntityId) {
		this.#items && this.#deleteById(id);
	}

	[ChimeraSetManySym](items: Iterable<TItem>) {
		if (this.#items) for (const item of items) this.#setOne(item);
	}

	[ChimeraDeleteManySym](ids: Iterable<ChimeraEntityId>) {
		if (this.#items) for (const id of ids) this.#deleteById(id);
	}

	[ChimeraUpdateMixedSym](toAdd: Iterable<TItem>, toDelete: Iterable<ChimeraEntityId>) {
		if (this.#items) {
			for (const id of toDelete) this.#deleteById(id);
			for (const item of toAdd) this.#setOne(item);
		}
	}

	get state(): ChimeraQueryFetchingState {
		return this.#state;
	}

	get inProgress(): boolean {
		return IN_PROGRESS_STATES.includes(this.#state);
	}

	get ready(): boolean {
		return this.#items !== null;
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
				this.#promise.cancelled(() => this.progress.then(resolve, resolve));
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
				this.#promise.cancelled(() => (this.#promise ? this.result.then(res, rej) : rej("cancelled")));
			} else resolve();
		});
	}

	/** Return an item if it is ready, throw error otherwise */
	getById(id: ChimeraEntityId): TItem | undefined {
		const name = this.#entityConfig.name;
		return this.#readyItems().find((item) => this.#idGetter(item, name) === id);
	}

	/** Return mutable ref to item by idx if it is ready, throw error otherwise */
	mutableAt(idx: number): TItem | undefined {
		return deepObjectClone(this.#readyItems().at(idx));
	}

	/** Return mutable ref to item by [id] if it is ready, throw error otherwise */
	mutableGetById(id: ChimeraEntityId): TItem | undefined {
		const name = this.#entityConfig.name;
		return deepObjectClone(this.#readyItems().find((item) => this.#idGetter(item, name) === id));
	}

	/**
	 *  Trigger refetch, return existing refetch promise if already running
	 *  @param force If true cancels any running process and starts a new one
	 *  @throws {ChimeraQueryAlreadyRunningError} If deleting or updating already in progress
	 */
	refetch(force = false): Promise<ChimeraQueryCollectionFetcherResponse<TItem>> {
		if (
			!force &&
			this.#promise &&
			[ChimeraQueryFetchingState.Fetching, ChimeraQueryFetchingState.Refetching].includes(this.#state)
		)
			return this.#promise as Promise<ChimeraQueryCollectionFetcherResponse<TItem>>;

		if (!force && [ChimeraQueryFetchingState.Updating, ChimeraQueryFetchingState.Deleting].includes(this.#state))
			throw new ChimeraQueryAlreadyRunningError(this.#entityConfig.name, this.#state);

		this.#state = ChimeraQueryFetchingState.Refetching;
		const { controller } = this.#prepareRequestParams();
		return this.#setPromise(
			this.#watchPromise(
				makeCancellablePromise(
					this.#entityConfig.collectionFetcher(this.#params, { signal: controller.signal }, this.#entityConfig.name),
					controller,
				),
				controller,
			),
		);
	}

	/**
	 * Update item using updated copy
	 * @param newItem new item to update
	 */
	update(newItem: TItem): Promise<ChimeraQueryItemFetcherResponse<TItem>> {
		const { controller } = this.#prepareRequestParams();
		return this.#entityConfig
			.itemUpdater(newItem, { signal: controller.signal }, this.#entityConfig.name)
			.then((response) => {
				const { data } = response;
				this.#items && this.#setNewOne(data);
				this.#emit("selfItemUpdated", { instance: this, item: data });
				return response;
			});
	}

	/**
	 * Update item using updated copy
	 * @param newItems array of items to update
	 */
	batchedUpdate(newItems: Iterable<TItem>): Promise<ChimeraQueryCollectionFetcherResponse<TItem>> {
		const { controller } = this.#prepareRequestParams();
		return this.#entityConfig
			.batchedUpdater(Array.from(newItems), { signal: controller.signal }, this.#entityConfig.name)
			.then((response) => {
				const ready = this.ready;
				response.data.forEach((item) => {
					ready && this.#setNewOne(item);
					this.#emit("selfItemUpdated", { instance: this, item });
				});
				return response;
			});
	}

	/**
	 * Delete item using its [id]
	 * @param id id of item to delete
	 */
	delete(id: ChimeraEntityId): Promise<ChimeraQueryItemDeleteResponse> {
		const name = this.#entityConfig.name;
		const { controller } = this.#prepareRequestParams();
		return this.#entityConfig.itemDeleter(id, { signal: controller.signal }, name).then(
			(response) => {
				const {
					result: { id: newId, success },
				} = response;
				if (!this.#items) {
					success && this.#emit("selfItemDeleted", { id: newId, instance: this });
					return response;
				}

				if (this.#entityConfig.trustQuery && !this.#debugConfig.devMode && success) {
					this.#deleteById(newId);
					this.#emit("selfItemDeleted", { id: newId, instance: this });
					return response;
				}

				if (id !== newId) {
					this.#debugConfig.devMode &&
						this.#entityConfig.trustQuery &&
						console.warn(new ChimeraQueryTrustIdMismatchError(this.#entityConfig.name, id, newId));

					if (!this.#entityConfig.trustQuery) {
						success && this.#emit("selfItemDeleted", { id: newId, instance: this });
						throw new ChimeraQueryTrustIdMismatchError(this.#entityConfig.name, id, newId);
					}
				}

				if (success) {
					this.#deleteById(newId);
					this.#emit("selfItemDeleted", { id: newId, instance: this });
					return response;
				}
				const error = new ChimeraQueryUnsuccessfulDeletionError(this.#entityConfig.name, id);
				this.#state = ChimeraQueryFetchingState.ReErrored;
				this.#lastError = error;
				throw error;
			},
			(error) => this.#setError(error, new ChimeraQueryDeletingError(name, error)),
		);
	}

	/**
	 * Delete a list of items by their [id]s
	 * @param ids array of items to delete
	 */
	batchedDelete(ids: Iterable<ChimeraEntityId>): Promise<ChimeraQueryBatchedDeleteResponse> {
		const name = this.#entityConfig.name;
		const { controller } = this.#prepareRequestParams();
		return this.#entityConfig.batchedDeleter(Array.from(ids), { signal: controller.signal }, name).then(
			(response) => {
				this.#items &&
					response.result.forEach(({ id: newId, success }) => {
						if (success) {
							this.#deleteById(newId);
							this.#emit("selfItemDeleted", { id: newId, instance: this });
						} else {
							const error = new ChimeraQueryUnsuccessfulDeletionError(this.#entityConfig.name, newId);
							this.#state = ChimeraQueryFetchingState.ReErrored;
							this.#lastError = error;
							throw error;
						}
					});
				return response;
			},
			(error) => this.#setError(error, new ChimeraQueryDeletingError(name, error)),
		);
	}

	/**
	 * Create new item using partial data
	 * @param item partial item data to create new item
	 */
	create(item: DeepPartial<TItem>): Promise<ChimeraQueryItemFetcherResponse<TItem>> {
		const name = this.#entityConfig.name;
		const { controller } = this.#prepareRequestParams();
		return this.#entityConfig.itemCreator(item, { signal: controller.signal }, name).then(
			(response) => {
				const { data } = response;
				this.#items && this.#setNewOne(data);
				this.#emit("selfItemCreated", { instance: this, item: data });
				return response;
			},
			(error) => this.#setError(error, new ChimeraQueryFetchingError(name, error)),
		);
	}

	/**
	 * Create multiple items using partial data
	 * @param items array of partial item data to create new items
	 */
	batchedCreate(items: Iterable<DeepPartial<TItem>>): Promise<ChimeraQueryCollectionFetcherResponse<TItem>> {
		const name = this.#entityConfig.name;
		const { controller } = this.#prepareRequestParams();
		return this.#entityConfig.batchedCreator(Array.from(items), { signal: controller.signal }, name).then(
			(response) => {
				this.#items &&
					response.data.forEach((item) => {
						this.#setNewOne(item);
						this.#emit("selfItemCreated", { instance: this, item });
					});
				return response;
			},
			(error) => this.#setError(error, new ChimeraQueryFetchingError(name, error)),
		);
	}

	/**
	 * Standard Array API without mutations
	 */

	get length(): number {
		return this.#readyItems().length;
	}

	[Symbol.iterator](): Iterator<TItem> {
		return this.#readyItems()[Symbol.iterator]();
	}

	at(idx: number): TItem | undefined {
		return this.#readyItems().at(idx);
	}

	entries(): ArrayIterator<[number, TItem]> {
		return this.#readyItems().entries();
	}

	values(): ArrayIterator<TItem> {
		return this.#readyItems().values();
	}

	keys(): ArrayIterator<number> {
		return this.#readyItems().keys();
	}

	every<S extends TItem>(
		predicate: (value: TItem, index: number, query: this) => value is S,
	): this is ChimeraCollectionQuery<TEntityName, S, TOperatorsMap>;
	every(predicate: (value: TItem, index: number, query: this) => unknown): boolean;
	every(predicate: (value: TItem, index: number, query: this) => unknown): boolean {
		return this.#readyItems().every((item, idx) => predicate(item, idx, this));
	}

	some(predicate: (value: TItem, index: number, query: this) => unknown): boolean {
		return this.#readyItems().some((item, idx) => predicate(item, idx, this));
	}

	filter<S extends TItem>(predicate: (value: TItem, index: number, query: this) => value is S): S[];
	filter(predicate: (value: TItem, index: number, query: this) => boolean): TItem[];
	filter<S extends TItem>(predicate: (value: TItem, index: number, query: this) => value is S): S[] {
		return this.#readyItems().filter((item, idx) => predicate(item, idx, this));
	}

	find<S extends TItem>(predicate: (value: TItem, index: number, query: this) => value is S): S | undefined;
	find(predicate: (value: TItem, index: number, query: this) => unknown): TItem | undefined;
	find<S extends TItem>(predicate: (value: TItem, index: number, query: this) => value is S): S | undefined {
		return this.#readyItems().find((item, idx) => predicate(item, idx, this));
	}

	findIndex<S extends TItem>(predicate: (value: TItem, index: number, query: this) => value is S): number;
	findIndex(predicate: (value: TItem, index: number, query: this) => boolean): number;
	findIndex<S extends TItem>(predicate: (value: TItem, index: number, query: this) => value is S): number {
		return this.#readyItems().findIndex((item, idx) => predicate(item, idx, this));
	}

	findLast<S extends TItem>(predicate: (value: TItem, index: number, query: this) => value is S): S | undefined;
	findLast(predicate: (value: TItem, index: number, query: this) => boolean): TItem | undefined;
	findLast<S extends TItem>(predicate: (value: TItem, index: number, query: this) => value is S): S | undefined {
		return this.#readyItems().findLast((item, idx) => predicate(item, idx, this));
	}

	findLastIndex<S extends TItem>(predicate: (value: TItem, index: number, query: this) => value is S): number;
	findLastIndex(predicate: (value: TItem, index: number, query: this) => boolean): number;
	findLastIndex<S extends TItem>(predicate: (value: TItem, index: number, query: this) => value is S): number {
		return this.#readyItems().findLastIndex((item, idx) => predicate(item, idx, this));
	}

	forEach(cb: (value: TItem, index: number, query: this) => void) {
		this.#readyItems().forEach((item, idx) => void cb(item, idx, this));
	}

	includes(item: TItem): boolean {
		return this.#readyItems().includes(item);
	}

	indexOf(item: TItem): number {
		return this.#readyItems().indexOf(item);
	}

	map<U>(cb: (value: TItem, index: number, query: this) => U) {
		return this.#readyItems().map((item, idx) => cb(item, idx, this));
	}

	reduce<U>(cb: (previousValue: U, currentValue: TItem, currentIndex: number, query: this) => U, initialValue?: U) {
		return this.#readyItems().reduce((prev, cur, idx) => cb(prev as U, cur, idx, this), initialValue);
	}

	reduceRight<U>(
		cb: (previousValue: U, currentValue: TItem, currentIndex: number, query: this) => U,
		initialValue?: U,
	) {
		return this.#readyItems().reduceRight((prev, cur, idx) => cb(prev as U, cur, idx, this), initialValue);
	}

	slice(start?: number, end?: number): TItem[] {
		return this.#readyItems().slice(start, end);
	}

	toSorted(compareFn?: (a: TItem, b: TItem) => number): TItem[] {
		return this.#readyItems().toSorted(compareFn);
	}

	toSpliced(start: number, deleteCount: number, ...items: TItem[]): TItem[] {
		return this.#readyItems().toSpliced(start, deleteCount, ...items);
	}

	toJSON() {
		return Array.from(this.#readyItems());
	}

	override toString(): string {
		return this.#readyItems().toString();
	}
}

export type AnyChimeraCollectionQuery = ChimeraCollectionQuery<any, any, any>;
type ExtractedChimeraCollectionQuery<TCollectionQuery extends AnyChimeraCollectionQuery> =
	TCollectionQuery extends ChimeraCollectionQuery<infer TEntityName, infer TItem, infer TOperatorsMap>
		? { entityName: TEntityName; item: TItem; operatorsMap: TOperatorsMap }
		: never;
export type ChimeraCollectionQueryName<TCollectionQuery extends AnyChimeraCollectionQuery> =
	ExtractedChimeraCollectionQuery<TCollectionQuery>["entityName"];
export type ChimeraCollectionQueryEntity<TCollectionQuery extends AnyChimeraCollectionQuery> =
	ExtractedChimeraCollectionQuery<TCollectionQuery>["item"];
export type ChimeraCollectionQueryOperatorsMap<TCollectionQuery extends AnyChimeraCollectionQuery> =
	ExtractedChimeraCollectionQuery<TCollectionQuery>["operatorsMap"];
