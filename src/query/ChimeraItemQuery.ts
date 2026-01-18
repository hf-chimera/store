import type { ChimeraDebugConfig } from "../debug";
import type { ChimeraOperatorMap } from "../filter";
import type { EventArgs, EventNames } from "../shared/ChimeraEventEmitter";
import { ChimeraEventEmitter } from "../shared/ChimeraEventEmitter";
import { ChimeraInternalError } from "../shared/errors.ts";
import { deepObjectAssign, deepObjectClone, deepObjectFreeze, makeCancellablePromise } from "../shared/shared.ts";
import type { AnyObject, ChimeraCancellablePromise, ChimeraEntityId, DeepPartial } from "../shared/types.ts";
import { ChimeraDeleteOneSym, ChimeraGetParamsSym, ChimeraSetOneSym, IN_PROGRESS_STATES } from "./constants.ts";
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
import {
	type ChimeraIdGetterFunction,
	type ChimeraQueryEntityItemFetcherParams,
	type ChimeraQueryFetchingStatable,
	ChimeraQueryFetchingState,
	type ChimeraQueryItemDeleteResponse,
	type ChimeraQueryItemFetcherResponse,
	type QueryEntityConfig,
} from "./types.ts";

export type ChimeraItemQueryEventMap<TEntityName extends string, TItem extends object> = {
	/** Once the query is initialized */
	initialized: [{ instance: ChimeraItemQuery<TEntityName, TItem> }];

	/** Once the query data was created */
	selfCreated: [{ instance: ChimeraItemQuery<TEntityName, TItem>; item: TItem }];

	/** Once the query data is ready (will be followed by 'update') */
	ready: [{ instance: ChimeraItemQuery<TEntityName, TItem> }];

	/** Each time the query was updated */
	updated: [{ instance: ChimeraItemQuery<TEntityName, TItem>; item: TItem; oldItem: TItem | null }];
	/** Each time the query was an initiator of update */
	selfUpdated: [{ instance: ChimeraItemQuery<TEntityName, TItem>; item: TItem; oldItem: TItem | null }];

	/** Once the query data was deleted */
	deleted: [{ instance: ChimeraItemQuery<TEntityName, TItem>; id: ChimeraEntityId }];
	/** Once the query was an initiator of deletion */
	selfDeleted: [{ instance: ChimeraItemQuery<TEntityName, TItem>; id: ChimeraEntityId }];

	/** Each time the fetcher produces an error */
	error: [{ instance: ChimeraItemQuery<TEntityName, TItem>; error: unknown }];
};

export class ChimeraItemQuery<TEntityName extends string, TItem extends object>
	extends ChimeraEventEmitter<ChimeraItemQueryEventMap<TEntityName, TItem>>
	implements ChimeraQueryFetchingStatable
{
	#item: TItem | null;
	#mutable: TItem | null;
	#state: ChimeraQueryFetchingState;
	#promise: ChimeraCancellablePromise | null;
	#lastError: unknown;
	readonly #params: ChimeraQueryEntityItemFetcherParams<TItem>;
	readonly #entityConfig: QueryEntityConfig<TEntityName, TItem, ChimeraOperatorMap>;
	readonly #debugConfig: ChimeraDebugConfig;
	readonly #idGetter: ChimeraIdGetterFunction<TEntityName, TItem>;

	#emit<T extends EventNames<ChimeraItemQueryEventMap<TEntityName, TItem>>>(
		event: T,
		arg: EventArgs<ChimeraItemQueryEventMap<TEntityName, TItem>, T>,
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

	#readyItem(internalMessage?: string): TItem {
		if (this.#item) return this.#item;
		throw internalMessage
			? new ChimeraInternalError(internalMessage)
			: new ChimeraQueryNotReadyError(this.#entityConfig.name);
	}

	#mutableItem(internalMessage?: string): TItem {
		if (this.#state === ChimeraQueryFetchingState.Deleted) {
			throw internalMessage
				? new ChimeraInternalError(internalMessage)
				: new ChimeraQueryDeletedItemError(this.#entityConfig.name, this.#params.id);
		}
		return this.#readyItem(internalMessage);
	}

	#setMutable(item: TItem) {
		if (item != null) {
			if (this.#mutable) {
				deepObjectAssign(this.#mutable as AnyObject, item as AnyObject);
			} else {
				this.#mutable = deepObjectClone(item);
			}
		} else this.#mutable = item;
	}

	#resetMutable() {
		this.#setMutable(
			this.#readyItem(`Trying to reset mutable ref for empty item (${this.#entityConfig.name}[${this.#params.id}])`),
		);
	}

	#setItem(item: TItem) {
		!this.#item && this.#emit("ready", { instance: this });
		const oldItem = this.#item;
		this.#item = item;
		this.#resetMutable();
		this.#emit("updated", { instance: this, item, oldItem });
	}

	#setNewItem(item: TItem) {
		deepObjectFreeze(item);
		const oldItem = this.#item;
		this.#setItem(item);
		this.#emit("selfUpdated", { instance: this, item, oldItem });
	}

	#deleteItem() {
		this.#state = ChimeraQueryFetchingState.Deleted;
		this.#emit("deleted", { id: this.#params.id, instance: this });
	}

	#setError(error: unknown, source: ChimeraQueryError): never {
		this.#state = this.#item ? ChimeraQueryFetchingState.ReErrored : ChimeraQueryFetchingState.Errored;
		this.#lastError = error;
		this.#emit("error", { error, instance: this });
		throw source;
	}

	#watchPromise(
		promise: Promise<ChimeraQueryItemFetcherResponse<TItem>>,
		controller: AbortController,
	): ChimeraCancellablePromise<ChimeraQueryItemFetcherResponse<TItem>> {
		const name = this.#entityConfig.name;

		return makeCancellablePromise(
			promise
				.then(({ data }) => {
					if (this.#entityConfig.trustQuery && !this.#debugConfig.devMode) {
						this.#setNewItem(data);
						this.#state = ChimeraQueryFetchingState.Fetched;
						return { data };
					}

					const localId = this.#params.id;
					const newId = this.#idGetter(data, name);

					if (localId === newId || this.#state === ChimeraQueryFetchingState.Creating) {
						this.#setNewItem(data);
						if (this.#state === ChimeraQueryFetchingState.Creating) {
							this.#emit("selfCreated", { instance: this, item: data });
						}
						this.#state = ChimeraQueryFetchingState.Fetched;
					} else {
						this.#debugConfig.devMode &&
							this.#entityConfig.trustQuery &&
							console.warn(new ChimeraQueryTrustIdMismatchError(this.#entityConfig.name, localId, newId));

						if (!this.#entityConfig.trustQuery) {
							throw new ChimeraQueryTrustIdMismatchError(this.#entityConfig.name, localId, newId);
						}
						this.#setNewItem(data);
						this.#params.id = newId;
						this.#state = ChimeraQueryFetchingState.Fetched;
					}

					return { data };
				})
				.catch((error) => this.#setError(error, new ChimeraQueryFetchingError(this.#entityConfig.name, error))),
			controller,
		);
	}

	#updateItem(newItem: TItem): Promise<ChimeraQueryItemFetcherResponse<TItem>> {
		const name = this.#entityConfig.name;

		const newId = this.#idGetter(newItem, name);
		const oldId = this.#idGetter(
			this.#readyItem(`Trying to update not ready item (${this.#entityConfig.name}[${this.#params.id}])`),
			name,
		);
		if (newId !== oldId && !this.#entityConfig.trustQuery) {
			this.#resetMutable();
			throw new ChimeraQueryIdMismatchError(this.#entityConfig.name, oldId, newId);
		}

		this.#state = ChimeraQueryFetchingState.Updating;
		const { controller } = this.#prepareRequestParams();
		return this.#setPromise(
			this.#watchPromise(
				makeCancellablePromise(
					this.#entityConfig.itemUpdater(newItem, { signal: controller.signal }, name),
					controller,
				),
				controller,
			),
		);
	}

	#requestDelete(): Promise<ChimeraQueryItemDeleteResponse> {
		this.#state = ChimeraQueryFetchingState.Deleting;
		const { controller } = this.#prepareRequestParams();

		const name = this.#entityConfig.name;

		return this.#setPromise(
			makeCancellablePromise(
				makeCancellablePromise(
					this.#entityConfig.itemDeleter(this.#params.id, { signal: controller.signal }, name),
					controller,
				).then(
					({ result }) => {
						const { id, success } = result;
						if (this.#entityConfig.trustQuery && !this.#debugConfig.devMode && success) {
							this.#deleteItem();
							return { result };
						}

						const localId = this.#params.id;

						if (localId !== id) {
							this.#debugConfig.devMode &&
								this.#entityConfig.trustQuery &&
								console.warn(new ChimeraQueryTrustIdMismatchError(this.#entityConfig.name, localId, id));

							if (!this.#entityConfig.trustQuery)
								throw new ChimeraQueryTrustIdMismatchError(this.#entityConfig.name, localId, id);
						}

						if (success) {
							this.#deleteItem();
							this.#emit("selfDeleted", { id, instance: this });
						} else {
							const error = new ChimeraQueryUnsuccessfulDeletionError(this.#entityConfig.name, this.#params.id);
							this.#state = ChimeraQueryFetchingState.ReErrored;
							this.#lastError = error;
							throw error;
						}

						return { result };
					},
					(error) => this.#setError(error, new ChimeraQueryDeletingError(this.#entityConfig.name, error)),
				),
			),
		);
	}

	constructor(
		config: QueryEntityConfig<TEntityName, TItem, ChimeraOperatorMap>,
		debugConfig: ChimeraDebugConfig,
		params: ChimeraQueryEntityItemFetcherParams<TItem>,
		existingItem: TItem | null,
		toCreateItem: DeepPartial<TItem> | null,
	) {
		super();

		this.#entityConfig = config;
		this.#debugConfig = debugConfig;
		this.#idGetter = config.idGetter;
		this.#params = params;
		this.#promise = null;
		this.#item = null;
		this.#mutable = null;
		this.#state = ChimeraQueryFetchingState.Initialized;

		const name = config.name;

		if (existingItem) {
			const item = existingItem;

			this.#setItem(item);

			if (debugConfig.devMode && this.#idGetter(item, name) !== params.id) {
				this.#state = ChimeraQueryFetchingState.Errored;
				throw new ChimeraInternalError(
					`Invalid item query [id] (changed from "${params.id}" to "${this.#idGetter(item, name)}")`,
				);
			}

			this.#state = ChimeraQueryFetchingState.Prefetched;
		} else if (toCreateItem) {
			this.#state = ChimeraQueryFetchingState.Creating;
			const { controller } = this.#prepareRequestParams();
			this.#setPromise(
				this.#watchPromise(
					makeCancellablePromise(
						config.itemCreator(toCreateItem, { signal: controller.signal }, name),
						controller,
					).then(({ data }) => {
						this.#params.id = this.#idGetter(data, name);
						return { data };
					}),
					controller,
				),
			);
		} else {
			this.#state = ChimeraQueryFetchingState.Fetching;
			const { controller } = this.#prepareRequestParams();
			this.#setPromise(
				this.#watchPromise(
					makeCancellablePromise(config.itemFetcher(params, { signal: controller.signal }, name), controller),
					controller,
				),
			);
		}

		this.#emit("initialized", { instance: this });
	}

	get name(): TEntityName {
		return this.#entityConfig.name;
	}

	get [ChimeraGetParamsSym](): ChimeraQueryEntityItemFetcherParams<TItem> {
		return this.#params;
	}

	[ChimeraSetOneSym](item: TItem) {
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
		return this.#item !== null;
	}

	get lastError(): unknown {
		return this.#lastError;
	}

	get id(): ChimeraEntityId {
		return this.#params.id;
	}

	/** Return an item if it is ready, throw error otherwise */
	get data(): TItem {
		return this.#readyItem();
	}

	/** Get ref for an item that can be changed as a regular object. To send changes to updater, use <commit> method */
	get mutable(): TItem {
		this.#readyItem();
		return this.#mutable as TItem;
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

	/**
	 *  Trigger refetch, return existing refetch promise if already running
	 *  @param force If true cancels any running process and starts a new one
	 *  @throws {ChimeraQueryAlreadyRunningError} If deleting or updating already in progress
	 */
	refetch(force = false): Promise<ChimeraQueryItemFetcherResponse<TItem>> {
		if (
			!force &&
			this.#promise &&
			[ChimeraQueryFetchingState.Fetching, ChimeraQueryFetchingState.Refetching].includes(this.#state)
		)
			return this.#promise as Promise<ChimeraQueryItemFetcherResponse<TItem>>;

		if (this.#state === ChimeraQueryFetchingState.Creating)
			throw new ChimeraQueryNotCreatedError(this.#entityConfig.name);

		if (!force && [ChimeraQueryFetchingState.Updating, ChimeraQueryFetchingState.Deleting].includes(this.#state))
			throw new ChimeraQueryAlreadyRunningError(this.#entityConfig.name, this.#state);

		this.#state = ChimeraQueryFetchingState.Refetching;
		const { controller } = this.#prepareRequestParams();
		return this.#setPromise(
			this.#watchPromise(
				makeCancellablePromise(
					this.#entityConfig.itemFetcher(this.#params, { signal: controller.signal }, this.#entityConfig.name),
					controller,
				),
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
	update(newItem: TItem, force = false): Promise<ChimeraQueryItemFetcherResponse<TItem>> {
		if (this.#state === ChimeraQueryFetchingState.Creating)
			throw new ChimeraQueryNotCreatedError(this.#entityConfig.name);

		if (
			!force &&
			[
				ChimeraQueryFetchingState.Fetching,
				ChimeraQueryFetchingState.Refetching,
				ChimeraQueryFetchingState.Deleting,
			].includes(this.#state)
		)
			throw new ChimeraQueryAlreadyRunningError(this.#entityConfig.name, this.#state);

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
	mutate(mutator: (draft: TItem) => TItem, force = false): Promise<ChimeraQueryItemFetcherResponse<TItem>> {
		if (this.#state === ChimeraQueryFetchingState.Creating)
			throw new ChimeraQueryNotCreatedError(this.#entityConfig.name);

		if (
			!force &&
			[
				ChimeraQueryFetchingState.Fetching,
				ChimeraQueryFetchingState.Refetching,
				ChimeraQueryFetchingState.Deleting,
			].includes(this.#state)
		)
			throw new ChimeraQueryAlreadyRunningError(this.#entityConfig.name, this.#state);

		const item = deepObjectClone(this.#mutableItem());
		return this.#updateItem(mutator(item) ?? item);
	}

	/**
	 * Commit updated value from mutable ref, a running update process will be canceled
	 * @param force if true cancels any running process including fetch and delete
	 * @throws {ChimeraQueryAlreadyRunningError} If deleting or updating already in progress
	 */
	commit(force = false): Promise<ChimeraQueryItemFetcherResponse<TItem>> {
		if (this.#state === ChimeraQueryFetchingState.Creating)
			throw new ChimeraQueryNotCreatedError(this.#entityConfig.name);

		if (
			!force &&
			[
				ChimeraQueryFetchingState.Fetching,
				ChimeraQueryFetchingState.Refetching,
				ChimeraQueryFetchingState.Deleting,
			].includes(this.#state)
		)
			throw new ChimeraQueryAlreadyRunningError(this.#entityConfig.name, this.#state);

		this.#mutableItem();
		return this.#updateItem(this.#mutable as TItem);
	}

	/**
	 * Request to delete the value.
	 * Local copy will still be available if it was present.
	 * A running delete process will be canceled
	 * @param force if true cancels any running process including fetch and update
	 * @throws {ChimeraQueryAlreadyRunningError} If deleting or updating already in progress
	 */
	delete(force = false): Promise<ChimeraQueryItemDeleteResponse> {
		if (this.#state === ChimeraQueryFetchingState.Creating)
			throw new ChimeraQueryNotCreatedError(this.#entityConfig.name);

		if (
			!force &&
			[
				ChimeraQueryFetchingState.Fetching,
				ChimeraQueryFetchingState.Refetching,
				ChimeraQueryFetchingState.Updating,
			].includes(this.#state)
		)
			throw new ChimeraQueryAlreadyRunningError(this.#entityConfig.name, this.#state);

		return this.#requestDelete();
	}

	toJSON() {
		return this.#readyItem();
	}

	override toString(): string {
		return `${this.#readyItem()}`;
	}
}

export type AnyChimeraItemQuery = ChimeraItemQuery<any, any>;
type ExtractedChimeraItemQuery<TItemQuery> =
	TItemQuery extends ChimeraItemQuery<infer TEntityName, infer TItem>
		? { entityName: TEntityName; item: TItem }
		: never;
export type ChimeraItemQueryName = ExtractedChimeraItemQuery<AnyChimeraItemQuery>["entityName"];
export type ChimeraItemQueryEntity = ExtractedChimeraItemQuery<AnyChimeraItemQuery>["item"];
