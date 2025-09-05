import type { EventArgs, EventNames } from "../../shared/ChimeraEventEmitter";
import { ChimeraEventEmitter } from "../../shared/ChimeraEventEmitter";
import { ChimeraInternalError } from "../../shared/errors.ts";
import { deepObjectAssign, deepObjectFreeze, makeCancellablePromise, none, some } from "../../shared/shared.ts";
import type {
	AnyObject,
	ChimeraCancellablePromise,
	ChimeraEntityId,
	ChimeraIdGetterFunc,
	DeepPartial,
	Option,
} from "../../shared/types.ts";
import { ChimeraDeleteOneSym, ChimeraGetParamsSym, ChimeraSetOneSym, IN_PROGRESS_STATES } from "../constants.ts";
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
} from "../errors.ts";
import {
	type ChimeraQueryEntityItemFetcherParams,
	type ChimeraQueryFetchingStatable,
	ChimeraQueryFetchingState,
	type ChimeraQueryItemDeleteResponse,
	type ChimeraQueryItemFetcherResponse,
	type QueryEntityConfig,
} from "../types.ts";

export type ChimeraItemQueryEventMap<Item extends object> = {
	/** Once the query is initialized */
	initialized: [{ instance: ChimeraItemQuery<Item> }];

	/** Once the query data was created */
	created: [{ instance: ChimeraItemQuery<Item> }];

	/** Once the query data is ready (will be followed by 'update') */
	ready: [{ instance: ChimeraItemQuery<Item> }];

	/** Each time the query was updated */
	updated: [{ instance: ChimeraItemQuery<Item>; item: Item; oldItem: Option<Item> }];
	/** Each time the query was an initiator of update */
	selfUpdated: [{ instance: ChimeraItemQuery<Item>; item: Item; oldItem: Option<Item> }];

	/** Once the query data was deleted */
	deleted: [{ instance: ChimeraItemQuery<Item>; id: ChimeraEntityId }];
	/** Once the query was an initiator of deletion */
	selfDeleted: [{ instance: ChimeraItemQuery<Item>; id: ChimeraEntityId }];

	/** Each time the fetcher produces an error */
	error: [{ instance: ChimeraItemQuery<Item>; error: unknown }];
};

export class ChimeraItemQuery<Item extends object>
	extends ChimeraEventEmitter<ChimeraItemQueryEventMap<Item>>
	implements ChimeraQueryFetchingStatable
{
	#item: Option<Item>;
	#mutable: Item | null;
	#state: ChimeraQueryFetchingState;
	#promise: ChimeraCancellablePromise | null;
	#lastError: unknown;
	readonly #params: ChimeraQueryEntityItemFetcherParams<Item>;
	readonly #config: QueryEntityConfig<Item>;
	readonly #idGetter: ChimeraIdGetterFunc<Item>;

	#emit<T extends EventNames<ChimeraItemQueryEventMap<Item>>>(
		event: T,
		arg: EventArgs<ChimeraItemQueryEventMap<Item>, T>,
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
			this.#mutable
				? deepObjectAssign(this.#mutable as AnyObject, item as AnyObject)
				: (this.#mutable = structuredClone(item));
		} else this.#mutable = item;
	}

	#resetMutable() {
		this.#setMutable(
			this.#readyItem(`Trying to reset mutable ref for empty item (${this.#config.name}[${this.#params.id}])`),
		);
	}

	#setItem(item: Item) {
		!this.#item.some && this.#emit("ready", {instance: this});
		const oldItem = this.#item;
		this.#item = some(item);
		this.#resetMutable();
		this.#emit("updated", {instance: this, item, oldItem});
	}

	#setNewItem(item: Item) {
		deepObjectFreeze(item);
		const oldItem = this.#item;
		this.#setItem(item);
		this.#emit("selfUpdated", {instance: this, item, oldItem});
	}

	#deleteItem() {
		this.#state = ChimeraQueryFetchingState.Deleted;
		this.#emit("deleted", {id: this.#params.id, instance: this});
	}

	#setError(error: unknown, source: ChimeraQueryError): never {
		this.#state = this.#item.some ? ChimeraQueryFetchingState.ReErrored : ChimeraQueryFetchingState.Errored;
		this.#lastError = error;
		this.#emit("error", {error, instance: this});
		throw source;
	}

	#watchPromise(
		promise: Promise<ChimeraQueryItemFetcherResponse<Item>>,
		controller: AbortController,
	): ChimeraCancellablePromise<ChimeraQueryItemFetcherResponse<Item>> {
		return makeCancellablePromise(
			promise
				.then(({ data }) => {
					if (this.#config.trustQuery && !this.#config.devMode) {
						this.#setNewItem(data);
						this.#state = ChimeraQueryFetchingState.Fetched;
						return { data };
					}

					const localId = this.#params.id;
					const newId = this.#idGetter(data);

					if (localId === newId || this.#state === ChimeraQueryFetchingState.Creating) {
						this.#setNewItem(data);
						this.#state = ChimeraQueryFetchingState.Fetched;
					} else {
						this.#config.devMode &&
							this.#config.trustQuery &&
							console.warn(new ChimeraQueryTrustIdMismatchError(this.#config.name, localId, newId));

						if (!this.#config.trustQuery) {
							throw new ChimeraQueryTrustIdMismatchError(this.#config.name, localId, newId);
						}
						this.#setNewItem(data);
						this.#params.id = newId;
						this.#state = ChimeraQueryFetchingState.Fetched;
					}

					return { data };
				})
				.catch((error) => this.#setError(error, new ChimeraQueryFetchingError(this.#config.name, error))),
			controller,
		);
	}

	#updateItem(newItem: Item): Promise<ChimeraQueryItemFetcherResponse<Item>> {
		const newId = this.#idGetter(newItem);
		const oldId = this.#idGetter(
			this.#readyItem(`Trying to update not ready item (${this.#config.name}[${this.#params.id}])`),
		);
		if (newId !== oldId && !this.#config.trustQuery) {
			this.#resetMutable();
			throw new ChimeraQueryIdMismatchError(this.#config.name, oldId, newId);
		}

		this.#state = ChimeraQueryFetchingState.Updating;
		const { controller } = this.#prepareRequestParams();
		return this.#setPromise(
			this.#watchPromise(
				makeCancellablePromise(this.#config.itemUpdater(newItem, {signal: controller.signal}), controller),
				controller,
			),
		);
	}

	#requestDelete(): Promise<ChimeraQueryItemDeleteResponse> {
		this.#state = ChimeraQueryFetchingState.Deleting;
		const { controller } = this.#prepareRequestParams();

		return this.#setPromise(
			makeCancellablePromise(
				makeCancellablePromise(
					this.#config.itemDeleter(this.#params.id, { signal: controller.signal }),
					controller,
				).then(
					({ result }) => {
						const { id, success } = result;
						if (this.#config.trustQuery && !this.#config.devMode && success) {
							this.#deleteItem();
							return { result };
						}

						const localId = this.#params.id;

						if (localId !== id) {
							this.#config.devMode &&
								this.#config.trustQuery &&
								console.warn(new ChimeraQueryTrustIdMismatchError(this.#config.name, localId, id));

							if (!this.#config.trustQuery) throw new ChimeraQueryTrustIdMismatchError(this.#config.name, localId, id);
						}

						if (success) {
							this.#deleteItem();
							this.#emit("selfDeleted", {id, instance: this});
						} else {
							const error = new ChimeraQueryUnsuccessfulDeletionError(this.#config.name, this.#params.id);
							this.#state = ChimeraQueryFetchingState.ReErrored;
							this.#lastError = error;
							throw error;
						}

						return { result };
					},
					(error) => this.#setError(error, new ChimeraQueryDeletingError(this.#config.name, error)),
				),
			),
		);
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
		this.#item = none();
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
			const { controller } = this.#prepareRequestParams();
			this.#setPromise(
				this.#watchPromise(
					makeCancellablePromise(config.itemCreator(toCreate.value, { signal: controller.signal }), controller).then(
						({ data }) => {
							this.#params.id = this.#idGetter(data);
							this.#emit("created", {instance: this});
							return { data };
						},
					),
					controller,
				),
			);
		} else {
			this.#state = ChimeraQueryFetchingState.Fetching;
			const { controller } = this.#prepareRequestParams();
			this.#setPromise(
				this.#watchPromise(
					makeCancellablePromise(config.itemFetcher(params, { signal: controller.signal }), controller),
					controller,
				),
			);
		}

		this.#emit("initialized", {instance: this});
	}

	get [ChimeraGetParamsSym](): ChimeraQueryEntityItemFetcherParams<Item> {
		return this.#params;
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

	get id(): ChimeraEntityId {
		return this.#params.id;
	}

	/** Return an item if it is ready, throw error otherwise */
	get data(): Item {
		return this.#readyItem();
	}

	/** Get ref for an item that can be changed as a regular object. To send changes to updater, use <commit> method */
	get mutable(): Item {
		this.#readyItem();
		return this.#mutable as Item;
	}

	get promise(): Promise<unknown> | null {
		return this.#promise;
	}

	/**
	 * Wait for the current progress process to complete (both success or error)
	 */
	get progress(): Promise<void> {
		return new Promise((res) => {
			const resolve = () => queueMicrotask(() => res());
			this.#promise?.then(resolve, resolve);
			this.#promise?.cancelled(resolve);
		});
	}

	/**
	 *  Trigger refetch, return existing refetch promise if already running
	 *  @param force If true cancels any running process and starts a new one
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
		const { controller } = this.#prepareRequestParams();
		return this.#setPromise(
			this.#watchPromise(
				makeCancellablePromise(this.#config.itemFetcher(this.#params, {signal: controller.signal}), controller),
				controller,
			),
		);
	}

	/**
	 * Update item using updated copy, a running update process will be cancelled
	 * @param newItem new item to replace existing
	 * @param force if true cancels any running process including fetch and delete
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
	 * @param force if true cancels any running process including fetch and delete
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
