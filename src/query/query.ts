import { EventEmitter } from "eventemitter3";
import type { ChimeraFilterChecker } from "../filter.ts";
import type { EntityId, IdGetterFunc, MutationRequester } from "../internal/utils.ts";
import type { ChimeraOrderByComparator } from "../order.ts";
import {
	ChimeraDeleteManySym,
	ChimeraDeleteOneSym,
	ChimeraSetManySym,
	ChimeraSetOneSym,
	ChimeraUpdateMixedSym,
} from "../internal/symbols.ts";

type ChimeraStoreQueryEventMap<Item> = {
	created: [ChimeraStoreQuery<Item>];
	updated: [ChimeraStoreQuery<Item>];
};

export class ChimeraStoreQuery<Item> extends EventEmitter<ChimeraStoreQueryEventMap<Item>> {
	readonly #items: Item[];
	readonly #devMode: boolean;
	readonly #trustQuery: boolean;
	readonly #idGetter: IdGetterFunc<Item>;
	readonly #order: ChimeraOrderByComparator<Item>;
	readonly #filter: ChimeraFilterChecker<Item>;
	readonly #mutator: MutationRequester<Item>;

	#addItem(item: Item) {
		const foundIndex = this.#items.findIndex((el) => this.#order(el, item) > 0);
		this.#items.splice(foundIndex !== -1 ? foundIndex : this.#items.length, 0, item);
	}

	#deleteAtIndex(index: number) {
		if (index === -1) return;
		this.#items.splice(index, 1);
	}

	#deleteItem(item: Item) {
		this.#deleteAtIndex(this.#items.indexOf(item));
	}

	#deleteById(id: EntityId) {
		this.#deleteAtIndex(this.#items.findIndex((item) => this.#idGetter(item) === id));
	}

	#replaceItem(oldItem: Item, newItem: Item) {
		this.#items[this.#items.indexOf(oldItem)] = newItem;
	}

	#setOne(item: Item) {
		const existingItem = this.getById(this.#idGetter(item));
		const nowMatches = this.#filter(item);

		if (!(nowMatches || existingItem)) return;

		if (existingItem) {
			if (this.#order(existingItem, item) === 0) {
				this.#replaceItem(existingItem, item);
				return;
			}

			this.#deleteItem(existingItem);
		}

		if (nowMatches) {
			this.#addItem(item);
		}
	}

	#dispatchChange() {
		this.emit("updated", this);
	}

	constructor(
		data: Iterable<Item>,
		idGetter: IdGetterFunc<Item>,
		order: ChimeraOrderByComparator<Item>,
		filter: ChimeraFilterChecker<Item>,
		mutator: MutationRequester<Item>,
		alreadyValid: boolean,
		trustQuery: boolean,
		devMode: boolean,
	) {
		super();

		this.#idGetter = idGetter;
		this.#filter = filter;
		this.#order = order;
		this.#mutator = mutator;
		this.#devMode = devMode;
		this.#trustQuery = trustQuery;

		if (alreadyValid && this.#trustQuery) {
			if (this.#devMode) {
				const input = Array.from(data);
				const output = input.filter(this.#filter).sort(this.#order);
				for (let i = 0; i < input.length; i++) {
					if (input[i] !== output[i]) {
						console.error(
							`
DO NOT IGNORE THIS ERROR OR YOUR PROD WILL BREAK!
Looks like your query provider returned not properly sorted or ordered collection.
By default Chimera tend to trust external query provider to avoid extra data processing.
If it is not your case, set field "trustQuery" to "false" in config defaults or for specific entity.
This error visible only if "devMode" is "true". 
If you'll ignore it, your production may fail, because Chimera won't check the data correctness.
					`.trim(),
						);
						break;
					}
				}
				this.#items = output;
			} else {
				this.#items = Array.from(data);
			}
		} else {
			this.#items = Array.from(data).filter(filter).sort(order);
		}

		// Dispatching event on the next tick because it is not possible to catch it before creation
		Promise.resolve().then(() => this.emit("created", this));
	}

	[ChimeraSetOneSym](item: Item) {
		this.#setOne(item);
		this.#dispatchChange();
	}

	[ChimeraDeleteOneSym](id: EntityId) {
		this.#deleteById(id);
		this.#dispatchChange();
	}

	[ChimeraSetManySym](items: Iterable<Item>) {
		for (const item of items) this.#setOne(item);
		this.#dispatchChange();
	}

	[ChimeraDeleteManySym](ids: Iterable<EntityId>) {
		for (const id of ids) this.#deleteById(id);
		this.#dispatchChange();
	}

	[ChimeraUpdateMixedSym](toAdd: Iterable<Item>, toDelete: Iterable<EntityId>) {
		for (const id of toDelete) this.#deleteById(id);
		for (const item of toAdd) this.#setOne(item);
		this.#dispatchChange();
	}

	getById(id: EntityId): Item | undefined {
		return this.#items.find((item) => this.#idGetter(item) === id);
	}

	update(newItem: Item) {
		this.#mutator(newItem, (queryItem) => {
			if ((!this.#trustQuery || this.#devMode) && this.#idGetter(queryItem) !== this.#idGetter(newItem)) {
				console.warn("Initial item id not matches with received item id.");
			}
			this.#setOne(queryItem);
			this.#dispatchChange();
		});
	}

	/**
	 * Standard Array API without mutations
	 */

	get length(): number {
		return this.#items.length;
	}

	[Symbol.iterator](): Iterator<Item> {
		return this.#items[Symbol.iterator]();
	}

	at(idx: number): Item | undefined {
		return this.#items.at(idx);
	}

	entries(): Iterator<[number, Item]> {
		return this.#items.entries();
	}

	values(): Iterator<Item> {
		return this.#items.values();
	}

	keys(): Iterator<number> {
		return this.#items.keys();
	}

	every<S extends Item>(
		predicate: (value: Item, index: number, query: this) => value is S,
	): this is ChimeraStoreQuery<S> {
		return this.#items.every((item, idx) => predicate(item, idx, this));
	}

	some(predicate: (value: Item, index: number, query: this) => unknown): boolean {
		return this.#items.some((item, idx) => predicate(item, idx, this));
	}

	filter<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): S[] {
		return this.#items.filter((item, idx) => predicate(item, idx, this));
	}

	find<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): S | undefined {
		return this.#items.find((item, idx) => predicate(item, idx, this));
	}

	findIndex<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): number {
		return this.#items.findIndex((item, idx) => predicate(item, idx, this));
	}

	findLast<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): S | undefined {
		return this.#items.findLast((item, idx) => predicate(item, idx, this));
	}

	findLastIndex<S extends Item>(predicate: (value: Item, index: number, query: this) => value is S): number {
		return this.#items.findLastIndex((item, idx) => predicate(item, idx, this));
	}

	forEach(cb: (value: Item, index: number, query: this) => void) {
		this.#items.forEach((item, idx) => cb(item, idx, this));
	}

	includes(item: Item): boolean {
		return this.#items.includes(item);
	}

	indexOf(item: Item): number {
		return this.#items.indexOf(item);
	}

	map<U>(cb: (value: Item, index: number, query: this) => U) {
		return this.#items.map((item, idx) => cb(item, idx, this));
	}

	reduce<U>(cb: (previousValue: U, currentValue: Item, currentIndex: number, query: this) => U, initialValue?: U) {
		return this.#items.reduce((prev, cur, idx) => cb(prev as U, cur, idx, this), initialValue);
	}

	reduceRight<U>(cb: (previousValue: U, currentValue: Item, currentIndex: number, query: this) => U, initialValue?: U) {
		return this.#items.reduceRight((prev, cur, idx) => cb(prev as U, cur, idx, this), initialValue);
	}

	slice(start?: number, end?: number): Item[] {
		return this.#items.slice(start, end);
	}

	toSorted(compareFn?: (a: Item, b: Item) => number): Item[] {
		return this.#items.toSorted(compareFn);
	}

	toSpliced(start: number, deleteCount: number, ...items: Item[]): Item[] {
		return this.#items.toSpliced(start, deleteCount, ...items);
	}

	toJSON() {
		return Array.from(this.#items);
	}

	override toString(): string {
		return this.#items.toString();
	}
}
