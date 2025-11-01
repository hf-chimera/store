import { getChimeraTypedHooks } from "../../../../packages/adapters/react";
import type { ChimeraStoreEntities } from "../../../../src";
import { ChimeraStore } from "../../../../src";
import type { Customer, Event, Order } from "../../server/types";
import { create, endpointEntityMap, getAll, getById, remove, subscribeToEvents, update } from "./api";

export type MyChimeraStore = typeof store;
export const store = new ChimeraStore<{
	customer: Customer;
	order: Order;
}>({
	query: {
		defaults: {
			idGetter: "id",
			async collectionFetcher(entity, { filter, order }) {
				return { data: await getAll(entity, filter, order) };
			},
			async itemCreator(entity, item) {
				return { data: await create(entity, item) };
			},
			async itemDeleter(entity, id) {
				await remove(entity, id);
				return { result: { id, success: true } };
			},
			async itemFetcher(entity, { id }) {
				return { data: await getById(entity, id) };
			},
			async itemUpdater(entity, item) {
				return { data: await update(entity, item.id, item) };
			},
		},
		entities: {
			customer: {},
			order: {},
		},
	},
});

window.store = store;

subscribeToEvents((event: Event) => {
	if (event.operation === "delete") {
		store.deleteOne(
			endpointEntityMap[event.entityType as keyof typeof endpointEntityMap] as ChimeraStoreEntities<MyChimeraStore>,
			event.id,
		);
	} else {
		store.updateOne(
			endpointEntityMap[event.entityType as keyof typeof endpointEntityMap] as ChimeraStoreEntities<MyChimeraStore>,
			event.entity,
		);
	}
});

export const { useChimeraStore, useChimeraRepository, useChimeraCollection, useChimeraItem } =
	getChimeraTypedHooks<MyChimeraStore>();
