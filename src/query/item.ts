import { EventEmitter } from "eventemitter3";
import { type AnyObject, deepObjectAssign, type IdGetterFunc, type MutationRequester } from "../internal/utils.ts";

type ChimeraStoreItemEventMap<Item> = {
	created: [ChimeraStoreItem<Item>];
	updated: [ChimeraStoreItem<Item>];
};

export class ChimeraStoreItem<Item> extends EventEmitter<ChimeraStoreItemEventMap<Item>> {
	#item: Item;
	#mutable: Item;
	readonly #devMode: boolean;
	readonly #trustQuery: boolean;
	readonly #idGetter: IdGetterFunc<Item>;
	readonly #mutator: MutationRequester<Item>;

	#setItem(item: Item) {
		const clone = structuredClone(item);
		if (item != null && typeof item === "object") deepObjectAssign(this.#mutable as AnyObject, clone as AnyObject);
		else this.#mutable = clone;
		this.#item = item;
	}

	#resetMutable() {
		deepObjectAssign(this.#mutable as AnyObject, structuredClone(this.#item) as AnyObject);
	}

	#updateItem(newItem: Item) {
		if (this.#idGetter(newItem) !== this.#idGetter(this.#item)) {
			this.#resetMutable();
			throw new Error("Id of provided item not matches with id of the stored one.");
		}

		this.#mutator(newItem, (queryItem) => {
			if ((!this.#trustQuery || this.#devMode) && this.#idGetter(queryItem) !== this.#idGetter(newItem)) {
				console.warn("Initial item id not matches with received item id.");
				if (!this.#trustQuery) {
					this.#resetMutable();
					return;
				}
			}
			this.#setItem(queryItem);
		});
	}

	#dispatchChange() {
		this.emit("updated", this);
	}

	constructor(
		item: Item,
		idGetter: IdGetterFunc<Item>,
		mutator: MutationRequester<Item>,
		trustQuery: boolean,
		devMode: boolean,
	) {
		super();

		this.#idGetter = idGetter;
		this.#mutator = mutator;
		this.#devMode = devMode;
		this.#trustQuery = trustQuery;
		this.#item = item;
		this.#mutable = structuredClone(item);

		Promise.resolve().then(() => this.emit("created", this));
	}

	get data(): Item {
		return this.#item;
	}

	get mutable(): Item {
		return this.#mutable;
	}

	update(newItem: Item) {
		this.#updateItem(newItem);
		this.#dispatchChange();
	}

	mutate(mutator: (item: Item) => Item) {
		const item = structuredClone(this.#item);
		this.#updateItem(mutator(item) ?? item);
		this.#dispatchChange();
	}

	commit() {
		this.#updateItem(this.#mutable);
		this.#dispatchChange();
	}
}
