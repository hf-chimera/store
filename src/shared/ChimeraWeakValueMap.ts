import { EventEmitter } from "eventemitter3";
import { ChimeraInternalError } from "./errors.ts";

export type ChimeraWeakValueMapEventMap<K, V extends object> = {
	/** An item was added to the map */
	set: [ChimeraWeakValueMap<K, V>, K, V];

	/** An item was removed from the map */
	delete: [ChimeraWeakValueMap<K, V>, K, V];

	/** Weak reference was automatically collected */
	finalize: [ChimeraWeakValueMap<K, V>, K];

	/** All items were removed from the map */
	clear: [ChimeraWeakValueMap<K, V>];
};

export class ChimeraWeakValueMap<K, V extends object> extends EventEmitter<ChimeraWeakValueMapEventMap<K, V>> {
	readonly #map: Map<K, WeakRef<V>>;
	readonly #registry: FinalizationRegistry<K>;

	#emit<T extends EventEmitter.EventNames<ChimeraWeakValueMapEventMap<K, V>>>(
		event: T,
		...args: EventEmitter.EventArgs<ChimeraWeakValueMapEventMap<K, V>, T>
	) {
		queueMicrotask(() => super.emit(event, ...args));
	}

	override emit(): never {
		throw new ChimeraInternalError("External events dispatching is not supported.");
	}

	constructor(values?: readonly (readonly [K, V])[] | null) {
		super();

		this.#registry = new FinalizationRegistry<K>((key) => this.#map.delete(key) && this.#emit("finalize", this, key));
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
		this.#registry.register(value, key, value);
		this.#map.set(key, new WeakRef(value));
		this.#emit("set", this, key, value);
		return this;
	}

	delete(key: K): boolean {
		if (!this.#map.has(key)) return false;
		const value = this.#map.get(key)?.deref();
		if (value === undefined) return false;
		this.#map.delete(key);
		this.#registry.unregister(value);
		this.#emit("delete", this, key, value);
		return true;
	}

	has(key: K): boolean {
		return this.#map.get(key)?.deref() !== undefined;
	}

	forEach(callbackFn: (value: V, key: K, map: ChimeraWeakValueMap<K, V>) => void, thisArg?: any): void {
		this.#map.forEach((v, k) => {
			const value = v.deref();
			value !== undefined && callbackFn(value, k, this);
		}, thisArg);
	}

	get(key: K): V | undefined {
		return this.#map.get(key)?.deref();
	}

	get size(): number {
		return this.#map.size;
	}

	*entries(): IterableIterator<[K, V]> {
		let entry: IteratorResult<[K, WeakRef<V>]>;
		const iterator = this.#map.entries();
		while (!(entry = iterator.next()).done) {
			const { 0: k, 1: v } = entry.value;
			const value = v.deref();
			if (value !== undefined) yield [k, value];
		}
	}

	*keys(): IterableIterator<K> {
		let entry: IteratorResult<[K, WeakRef<V>]>;
		const iterator = this.#map.entries();
		while (!(entry = iterator.next()).done) {
			const { 0: k, 1: v } = entry.value;
			if (v.deref() !== undefined) yield k;
		}
	}

	*values(): IterableIterator<V> {
		let entry: IteratorResult<[K, WeakRef<V>]>;
		const iterator = this.#map.entries();
		while (!(entry = iterator.next()).done) {
			const value = entry.value[1].deref();
			if (value !== undefined) yield value;
		}
	}

	*[Symbol.iterator](): IterableIterator<[K, V]> {
		yield* this.entries();
	}

	clear(): void {
		this.#map.forEach((v) => {
			const value = v.deref();
			value !== undefined && this.#registry.unregister(value);
		});
		this.#map.clear();
		this.#emit("clear", this);
	}
}
