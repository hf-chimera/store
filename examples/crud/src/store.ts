import { createDefaultQueryBuilder, type DefaultChimeraQueryBuilder } from '@hf-chimera/query-builder';
import { createChimeraStoreHooks } from "@hf-chimera/react";
import {
	type AnyChimeraEntityStore,
	type ChimeraEntityId,
	type ChimeraQueryEntityConfig,
	createChimeraEntityStore,
} from "@hf-chimera/store";
import type { Customer, Event, Order } from "../../server/types";
import { create, getAll, getById, type OperatorMap, remove, subscribeToEvents, update } from "./api";

type GenericEntity = { id: ChimeraEntityId } & Record<string, any>;

type GenericFetchers<TEntity extends GenericEntity = GenericEntity> = Omit<
	ChimeraQueryEntityConfig<string, TEntity, OperatorMap>,
	"name"
>;

const genericParams = {
	idGetter: "id",
	async collectionFetcher({ filter, order }, _, entity) {
		return { data: await getAll(entity, filter, order) };
	},
	async itemCreator(item, _, entity) {
		return { data: await create(entity, item) };
	},
	async itemDeleter(id, _, entity) {
		await remove(entity, id);
		return { result: { id, success: true } };
	},
	async itemFetcher({ id }, _, entity) {
		return { data: await getById(entity, id) };
	},
	async itemUpdater(item, _, entity) {
		return { data: await update(entity, item.id, item) };
	},
} as const satisfies GenericFetchers;

const customerStore = createChimeraEntityStore<Customer, "customer">({
	name: "customer",
	...(genericParams as unknown as GenericFetchers<Customer>),
});

const orderStore = createChimeraEntityStore<Order, "order">({
	name: "order",
	...(genericParams as unknown as GenericFetchers<Order>),
});

const eventMap = {
	orders: orderStore,
	customers: customerStore,
} as Record<string, AnyChimeraEntityStore>;

subscribeToEvents((event: Event) => {
	const store = eventMap[event.entityType];
	if (!store) return;

	if (event.operation === "delete") {
		store.deleteOne(event.id);
	} else {
		store.updateOne(event.entity);
	}
});

export const { useChimeraCustomerStore, useChimeraCustomerCollection, useChimeraCustomerItem } =
	createChimeraStoreHooks(customerStore, createDefaultQueryBuilder as () => DefaultChimeraQueryBuilder<typeof customerStore>);

export const { useChimeraOrderStore, useChimeraOrderCollection, useChimeraOrderItem } = createChimeraStoreHooks(
	orderStore,
	createDefaultQueryBuilder as () => DefaultChimeraQueryBuilder<typeof orderStore>,
);
