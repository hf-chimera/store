import type {
	AnyObject,
	ChimeraCancellablePromise,
	ChimeraEntityId,
	ChimeraIdGetterFunc,
	DeepPartial,
	Option,
} from "../shared/types.ts";
import {
	type ChimeraQueryEntityItemFetcherParams,
	type ChimeraQueryFetchingStatable,
	ChimeraQueryFetchingState,
	type ChimeraQueryItemDeleteResponse,
	type ChimeraQueryItemFetcherResponse,
	type QueryEntityConfig,
} from "./types.ts";

import { EventEmitter } from "eventemitter3";
import { ChimeraInternalError } from "../shared/errors.ts";
import { deepObjectAssign, makeCancellablePromise } from "../shared/shared.ts";
import { ChimeraDeleteOneSym, ChimeraSetOneSym, IN_PROGRESS_STATES } from "./constants.ts";
import {
	ChimeraQueryAlreadyRunningError,
	ChimeraQueryDeletedItemError,
	ChimeraQueryDeletingError,
	type ChimeraQueryError,
	ChimeraQueryFetchingError,
	ChimeraQueryIdMismatchError,
	ChimeraQueryNotCreatedError,
	ChimeraQueryNotReadyError,
	ChimeraQueryTrustIdMismatchError,
	ChimeraQueryUnsuccessfulDeletionError,
} from "./errors.ts";

export type ChimeraStoreItemEventMap<Item> = {
	/** Once the query is initialized */
	initialized: [ChimeraStoreItemQuery<Item>];

	/** Once the query data was created */
	created: [ChimeraStoreItemQuery<Item>];

	/** Once the query data is ready (will be followed by 'update') */
	ready: [ChimeraStoreItemQuery<Item>];

	/** Each time the query was updated */
	updated: [ChimeraStoreItemQuery<Item>, Option<Item>];

	/** Once the query data was deleted */
	deleted: [ChimeraStoreItemQuery<Item>];

	/** Each time fetcher produces an error */
	error: [ChimeraStoreItemQuery<Item>, unknown];
};

export class ChimeraStoreItemQuery<Item>
	extends EventEmitter<ChimeraStoreItemEventMap<Item>>
	implements ChimeraQueryFetchingStatable {
	#item: Option<Item>;
	#mutable: Item | null;
	#state: ChimeraQueryFetchingState;
	#promise: ChimeraCancellablePromise | null;
	#lastError: unknown;
	readonly #config: QueryEntityConfig<Item>;
	readonly #idGetter: ChimeraIdGetterFunc<Item>;
	readonly #params: ChimeraQueryEntityItemFetcherParams<Item>;

	#emit<T extends EventEmitter.EventNames<ChimeraStoreItemEventMap<Item>>>(
		event: T,
		...args: EventEmitter.EventArgs<ChimeraStoreItemEventMap<Item>, T>
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

	#setPromise<P extends ChimeraCancellablePromise>(promise: P): P {
		this.#promise?.cancel();
		this.#promise = promise;
		return promise;
	}

	#readyItem(internalMessage?: string): Item {
		if (this.#item.some) return this.#item.value;
		throw internalMessage
			? new ChimeraInternalError(internalMessage)
			: new ChimeraQueryNotReadyError(this.#config.name);
	}

	#mutableItem(internalMessage?: string): Item {
		if (this.#state === ChimeraQueryFetchingState.Deleted) {
			throw internalMessage
				? new ChimeraInternalError(internalMessage)
				: new ChimeraQueryDeletedItemError(this.#config.name, this.#params.id);
		}
		return this.#readyItem(internalMessage);
	}

	#setMutable(item: Item) {
		if (typeof item === "object" && item != null) {
			deepObjectAssign(this.#mutable as AnyObject, item as AnyObject);
		} else this.#mutable = item;
	}

	#resetMutable() {
		this.#setMutable(
			this.#readyItem(`Trying to reset mutable ref for empty item (${this.#config.name}[${this.#params.id}])`),
		);
	}

	#setItem(item: Item) {
		!this.#item.some && this.#emit("ready", this);
		const old = this.#item;
		this.#item = {some: true, value: item};
		this.#resetMutable();
		this.#emit("updated", this, old);
	}

	#deleteItem() {
		this.#state = ChimeraQueryFetchingState.Deleted;
		this.#emit("deleted", this);
	}

	#setError(error: unknown, source: ChimeraQueryError) {
		this.#state = this.#item.some ? ChimeraQueryFetchingState.ReErrored : ChimeraQueryFetchingState.Errored;
		this.#lastError = error;
		this.#emit("error", this, error);
		throw source;
	}

	#watchPromise(
		promise: ChimeraCancellablePromise<ChimeraQueryItemFetcherResponse<Item>>,
	): ChimeraCancellablePromise<ChimeraQueryItemFetcherResponse<Item>> {
		promise
			.then(({data}) => {
				if (this.#config.trustQuery && !this.#config.devMode) {
					this.#setItem(data);
					this.#state = ChimeraQueryFetchingState.Fetched;
					return;
				}

				const localId = this.#params.id;
				const newId = this.#idGetter(data);

				if (localId === newId) {
					this.#setItem(data);
					this.#state = ChimeraQueryFetchingState.Fetched;
				} else {
					this.#config.devMode &&
					this.#config.trustQuery &&
					console.warn(new ChimeraQueryTrustIdMismatchError(this.#config.name, localId, newId));

					if (!this.#config.trustQuery) throw new ChimeraQueryTrustIdMismatchError(this.#config.name, localId, newId);
				}
			})
			.catch((error) => this.#setError(error, new ChimeraQueryFetchingError(this.#config.name, error)));
		return promise;
	}

	#updateItem(newItem: Item): Promise<ChimeraQueryItemFetcherResponse<Item>> {
		const newId = this.#idGetter(newItem);
		const oldId = this.#idGetter(
			this.#readyItem(`Trying to update not ready item (${this.#config.name}[${this.#params.id}])`),
		);
		if (newId !== oldId) {
			this.#resetMutable();
			throw new ChimeraQueryIdMismatchError(this.#config.name, oldId, newId);
		}

		this.#state = ChimeraQueryFetchingState.Updating;
		const {controller} = this.#prepareRequestParams();
		const promise = this.#config.itemUpdater(newItem, {signal: controller.signal});
		this.#setPromise(this.#watchPromise(makeCancellablePromise(promise, controller)));
		return promise;
	}

	#requestDelete(): Promise<ChimeraQueryItemDeleteResponse> {
		this.#state = ChimeraQueryFetchingState.Deleting;
		const {controller} = this.#prepareRequestParams();

		const promise = this.#config.itemDeleter(this.#params.id, {signal: controller.signal});

		const cancellablePromise = makeCancellablePromise(promise, controller);
		this.#setPromise(cancellablePromise);
		cancellablePromise.then(
			({result: {id, success}}) => {
				if (this.#config.trustQuery && !this.#config.devMode && success) return this.#deleteItem();

				const localId = this.#params.id;

				if (localId !== id) {
					this.#config.devMode &&
					this.#config.trustQuery &&
					console.warn(new ChimeraQueryTrustIdMismatchError(this.#config.name, localId, id));

					if (!this.#config.trustQuery) throw new ChimeraQueryTrustIdMismatchError(this.#config.name, localId, id);
				}

				if (success) this.#deleteItem();
				else {
					const error = new ChimeraQueryUnsuccessfulDeletionError(this.#config.name, this.#params.id);
					this.#state = ChimeraQueryFetchingState.ReErrored;
					this.#lastError = error;
					throw error;
				}
			},
			(error) => this.#setError(error, new ChimeraQueryDeletingError(this.#config.name, error)),
		);

		return promise;
	}

	constructor(
		config: QueryEntityConfig<Item>,
		params: ChimeraQueryEntityItemFetcherParams<Item>,
		maybeItem: Option<Item>,
		toCreate: Option<DeepPartial<Item>>,
	) {
		super();

		this.#config = config;
		this.#idGetter = config.idGetter;
		this.#params = params;
		this.#promise = null;
		this.#item = {some: false};
		this.#mutable = null;
		this.#state = ChimeraQueryFetchingState.Initialized;

		if (maybeItem.some) {
			const item = maybeItem.value;

			this.#setItem(item);

			if (config.devMode && this.#idGetter(item) !== params.id) {
				this.#state = ChimeraQueryFetchingState.Errored;
				throw new ChimeraInternalError(
					`Invalid item query [id] (changed from "${params.id}" to "${this.#idGetter(item)}")`,
				);
			}

			this.#state = ChimeraQueryFetchingState.Prefetched;
		} else if (toCreate.some) {
			this.#state = ChimeraQueryFetchingState.Creating;
			const {controller} = this.#prepareRequestParams();
			this.#setPromise(
				this.#watchPromise(
					makeCancellablePromise(config.itemCreator(toCreate.value, {signal: controller.signal}), controller),
				),
			).then(() => this.#emit("created", this));
		} else {
			this.#state = ChimeraQueryFetchingState.Fetching;
			const {controller} = this.#prepareRequestParams();
			this.#setPromise(
				this.#watchPromise(
					makeCancellablePromise(config.itemFetcher(params, {signal: controller.signal}), controller),
				),
			);
		}

		this.#emit("initialized", this);
	}

	[ChimeraSetOneSym](item: Item) {
		this.#setItem(item);
		!this.inProgress && (this.#state = ChimeraQueryFetchingState.Actualized);
	}

	[ChimeraDeleteOneSym](id: ChimeraEntityId) {
		if (id === this.#params.id) {
			this.#promise?.cancel();
			this.#promise = null;
			this.#deleteItem();
		}
	}

	get state(): ChimeraQueryFetchingState {
		return this.#state;
	}

	get inProgress(): boolean {
		return IN_PROGRESS_STATES.includes(this.#state);
	}

	get ready(): boolean {
		return this.#item.some;
	}

	get lastError(): unknown {
		return this.#lastError;
	}

	/** Return item if it is ready, throw error otherwise */
	get data(): Item {
		return this.#readyItem();
	}

	/** Get ref for item, that can be changed as a regular object. To send changes to updater use <commit> method */
	get mutable(): Item {
		this.#readyItem();
		return this.#mutable as Item;
	}

	/**
	 *  Trigger refetch, return existing refetch promise if already running
	 *  @param {boolean} force If true cancels any running process and starts a new one
	 *  @throws {ChimeraQueryAlreadyRunningError} If deleting or updating already in progress
	 */
	refetch(force = false): Promise<ChimeraQueryItemFetcherResponse<Item>> {
		if (
			!force &&
			this.#promise &&
			[ChimeraQueryFetchingState.Fetching, ChimeraQueryFetchingState.Refetching].includes(this.#state)
		)
			return this.#promise as Promise<ChimeraQueryItemFetcherResponse<Item>>;

		if (this.#state === ChimeraQueryFetchingState.Creating) throw new ChimeraQueryNotCreatedError(this.#config.name);

		if (!force && [ChimeraQueryFetchingState.Updating, ChimeraQueryFetchingState.Deleting].includes(this.#state))
			throw new ChimeraQueryAlreadyRunningError(this.#config.name, this.#state);

		this.#state = ChimeraQueryFetchingState.Refetching;
		const {controller} = this.#prepareRequestParams();
		const promise = this.#config.itemFetcher(this.#params, {signal: controller.signal});
		return this.#setPromise(this.#watchPromise(makeCancellablePromise(promise, controller)));
	}

	/**
	 * Update item using updated copy, a running update process will be cancelled
	 * @param newItem new item to replace existing
	 * @param {boolean} force if true cancels any running process including fetch and delete
	 * @throws {ChimeraQueryAlreadyRunningError} If deleting or updating already in progress
	 */
	update(newItem: Item, force = false): Promise<ChimeraQueryItemFetcherResponse<Item>> {
		if (this.#state === ChimeraQueryFetchingState.Creating) throw new ChimeraQueryNotCreatedError(this.#config.name);

		if (
			!force &&
			[
				ChimeraQueryFetchingState.Fetching,
				ChimeraQueryFetchingState.Refetching,
				ChimeraQueryFetchingState.Deleting,
			].includes(this.#state)
		)
			throw new ChimeraQueryAlreadyRunningError(this.#config.name, this.#state);

		this.#mutableItem();
		return this.#updateItem(newItem);
	}

	/**
	 * Update item using function with draft item as argument
	 * that can be used to patch item in place or return a patched value,
	 * a running update process will be cancelled
	 * @param mutator mutator function
	 * @param {boolean} force if true cancels any running process including fetch and delete
	 * @throws {ChimeraQueryAlreadyRunningError} If deleting or updating already in progress
	 */
	mutate(mutator: (draft: Item) => Item, force = false): Promise<ChimeraQueryItemFetcherResponse<Item>> {
		if (this.#state === ChimeraQueryFetchingState.Creating) throw new ChimeraQueryNotCreatedError(this.#config.name);

		if (
			!force &&
			[
				ChimeraQueryFetchingState.Fetching,
				ChimeraQueryFetchingState.Refetching,
				ChimeraQueryFetchingState.Deleting,
			].includes(this.#state)
		)
			throw new ChimeraQueryAlreadyRunningError(this.#config.name, this.#state);

		const item = structuredClone(this.#mutableItem());
		return this.#updateItem(mutator(item) ?? item);
	}

	/**
	 * Commit updated value from mutable ref, a running update process will be canceled
	 * @param force if true cancels any running process including fetch and delete
	 * @throws {ChimeraQueryAlreadyRunningError} If deleting or updating already in progress
	 */
	commit(force = false): Promise<ChimeraQueryItemFetcherResponse<Item>> {
		if (this.#state === ChimeraQueryFetchingState.Creating) throw new ChimeraQueryNotCreatedError(this.#config.name);

		if (
			!force &&
			[
				ChimeraQueryFetchingState.Fetching,
				ChimeraQueryFetchingState.Refetching,
				ChimeraQueryFetchingState.Deleting,
			].includes(this.#state)
		)
			throw new ChimeraQueryAlreadyRunningError(this.#config.name, this.#state);

		this.#mutableItem();
		return this.#updateItem(this.#mutable as Item);
	}

	/**
	 * Request to delete the value.
	 * Local copy will still be available if it was present.
	 * A running delete process will be canceled
	 * @param force if true cancels any running process including fetch and update
	 * @throws {ChimeraQueryAlreadyRunningError} If deleting or updating already in progress
	 */
	delete(force = false): Promise<ChimeraQueryItemDeleteResponse> {
		if (this.#state === ChimeraQueryFetchingState.Creating) throw new ChimeraQueryNotCreatedError(this.#config.name);

		if (
			!force &&
			[
				ChimeraQueryFetchingState.Fetching,
				ChimeraQueryFetchingState.Refetching,
				ChimeraQueryFetchingState.Updating,
			].includes(this.#state)
		)
			throw new ChimeraQueryAlreadyRunningError(this.#config.name, this.#state);

		return this.#requestDelete();
	}

	toJSON() {
		return this.#readyItem();
	}

	override toString(): string {
		return `${this.#readyItem()}`;
	}
}
