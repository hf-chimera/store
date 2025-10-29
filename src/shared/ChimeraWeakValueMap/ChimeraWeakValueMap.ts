import type { EventArgs, EventNames } from "../ChimeraEventEmitter";
import { ChimeraEventEmitter } from "../ChimeraEventEmitter";
import { ChimeraInternalError } from "../errors.ts";

export type ChimeraWeakValueMapEventMap<K, V extends object> = {
	/** An item was added to the map */
	set: { key: K; value: V; instance: ChimeraWeakValueMap<K, V> };

	/** An item was removed from the map */
	delete: { key: K; value: V; instance: ChimeraWeakValueMap<K, V> };

	/** Weak reference was automatically collected */
	finalize: { key: K; instance: ChimeraWeakValueMap<K, V> };

	/** All items were removed from the map */
	clear: { instance: ChimeraWeakValueMap<K, V> };
};

export class ChimeraWeakValueMap<K, V extends object> extends ChimeraEventEmitter<ChimeraWeakValueMapEventMap<K, V>> {
	readonly #map: Map<K, WeakRef<V>>;
	readonly #registry: FinalizationRegistry<K>;
	#cleanupScheduled = false;

	#emit<T extends EventNames<ChimeraWeakValueMapEventMap<K, V>>>(
		event: T,
		arg: EventArgs<ChimeraWeakValueMapEventMap<K, V>, T>,
	) {
		queueMicrotask(() => super.emit(event, arg));
	}

	override emit(): never {
		throw new ChimeraInternalError("External events dispatching is not supported.");
	}

	#scheduleCleanup() {
		if (this.#cleanupScheduled) return;
		this.#cleanupScheduled = true;

		const scheduler =
			typeof requestIdleCallback !== "undefined" ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 0);

		scheduler(() => {
			this.#cleanup();
			this.#cleanupScheduled = false;
		});
	}

	#cleanup() {
		for (const [key, weakRef] of this.#map.entries()) {
			if (weakRef.deref() === undefined) {
				this.#map.delete(key);
				this.#emit("finalize", { instance: this, key });
			}
		}
	}

	constructor(values?: readonly (readonly [K, V])[] | null) {
		super();

		this.#registry = new FinalizationRegistry<K>((key) => {
			const weakRef = this.#map.get(key);
			if (weakRef && weakRef.deref() === undefined) {
				this.#map.delete(key);
				this.#emit("finalize", { instance: this, key });
			}
		});

		this.#map = new Map(
			values
				? values.map(([k, v]): [K, WeakRef<V>] => {
						this.#registry.register(v, k, v);
						return [k, new WeakRef(v)];
					})
				: null,
		);
	}

	set(key: K, value: V): this {
		const existingRef = this.#map.get(key);
		if (existingRef) {
			const existingValue = existingRef.deref();
			if (existingValue) {
				this.#registry.unregister(existingValue);
			}
		}

		this.#registry.register(value, key, value);
		this.#map.set(key, new WeakRef(value));
		this.#emit("set", { instance: this, key, value });
		return this;
	}

	delete(key: K): boolean {
		if (!this.#map.has(key)) return false;
		const weakRef = this.#map.get(key);
		const value = weakRef?.deref();

		if (value === undefined) {
			this.#map.delete(key);
			this.#emit("finalize", { instance: this, key });
			return true;
		}

		this.#map.delete(key);
		this.#registry.unregister(value);
		this.#emit("delete", { instance: this, key, value });
		return true;
	}

	has(key: K): boolean {
		const weakRef = this.#map.get(key);
		const value = weakRef?.deref();

		if (value === undefined && weakRef) {
			this.#map.delete(key);
			this.#emit("finalize", { instance: this, key });
			this.#scheduleCleanup();
		}

		return value !== undefined;
	}

	forEach(callbackFn: (value: V, key: K, map: ChimeraWeakValueMap<K, V>) => void, thisArg?: any): void {
		this.#map.forEach((weakRef, k) => {
			const value = weakRef.deref();
			if (value !== undefined) {
				callbackFn.call(thisArg, value, k, this);
			} else {
				this.#map.delete(k);
				this.#emit("finalize", { instance: this, key: k });
			}
		});

		if (this.#map.size > 0) {
			this.#scheduleCleanup();
		}
	}

	get(key: K): V | undefined {
		const weakRef = this.#map.get(key);
		const value = weakRef?.deref();

		if (value === undefined && weakRef) {
			this.#map.delete(key);
			this.#emit("finalize", { instance: this, key });
			this.#scheduleCleanup();
		}

		return value;
	}

	get size(): number {
		this.#cleanup();
		return this.#map.size;
	}

	*entries(): IterableIterator<[K, V]> {
		for (const [k, weakRef] of this.#map.entries()) {
			const value = weakRef.deref();
			if (value !== undefined) {
				yield [k, value];
			} else {
				this.#map.delete(k);
				this.#emit("finalize", { instance: this, key: k });
			}
		}

		if (this.#map.size > 0) {
			this.#scheduleCleanup();
		}
	}

	*keys(): IterableIterator<K> {
		for (const [k, weakRef] of this.#map.entries()) {
			if (weakRef.deref() !== undefined) {
				yield k;
			} else {
				this.#map.delete(k);
				this.#emit("finalize", { instance: this, key: k });
			}
		}

		if (this.#map.size > 0) {
			this.#scheduleCleanup();
		}
	}

	*values(): IterableIterator<V> {
		for (const weakRef of this.#map.values()) {
			const value = weakRef.deref();
			if (value !== undefined) {
				yield value;
			}
		}

		this.#cleanup();
	}

	*[Symbol.iterator](): IterableIterator<[K, V]> {
		yield* this.entries();
	}

	clear(): void {
		for (const weakRef of this.#map.values()) {
			const value = weakRef.deref();
			if (value !== undefined) {
				this.#registry.unregister(value);
			}
		}

		this.#map.clear();
		this.#emit("clear", { instance: this });
	}

	cleanup(): void {
		this.#cleanup();
	}

	get rawSize(): number {
		return this.#map.size;
	}
}
