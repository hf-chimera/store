import { useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ChimeraCollectionQuery } from "../../src/query/ChimeraCollectionQuery";
import type { ChimeraItemQuery } from "../../src/query/ChimeraItemQuery";
import type { ChimeraEntityId } from "../../src/shared/types";
import type { ChimeraEntityRepository } from "../../src/store/ChimeraEntityRepository";
import type {
	AnyChimeraStore,
	ChimeraStoreEntities,
	ChimeraStoreEntityType,
	ChimeraStoreFilter,
} from "../../src/store/ChimeraStore";
import type { ChimeraCollectionParams } from "../../src/store/types";
import { ChimeraStoreContext } from "./context";

export function useChimeraStore<T extends AnyChimeraStore>(): T {
	const context = useContext(ChimeraStoreContext);
	if (!context) {
		throw new Error("useChimeraStore must be used within a ChimeraStoreProvider");
	}
	return context.store as T;
}

export function useChimeraRepository<T extends AnyChimeraStore, EntityName extends ChimeraStoreEntities<T>>(
	entityName: EntityName,
): ChimeraEntityRepository<ChimeraStoreEntityType<T, EntityName>, ChimeraStoreFilter<T>> {
	const store = useChimeraStore<T>();
	return store.from(entityName);
}

const CHIMERA_COLLECTION_UPDATE_EVENTS = [
	"ready",
	"updated",
	"selfUpdated",
	"selfItemCreated",
	"itemAdded",
	"itemUpdated",
	"selfItemUpdated",
	"itemDeleted",
	"selfItemDeleted",
	"error",
] as const;
export const useChimeraCollection = <T extends AnyChimeraStore, EntityName extends ChimeraStoreEntities<T>, Meta = any>(
	entityName: EntityName,
	params: ChimeraCollectionParams<ChimeraStoreFilter<T>, ChimeraStoreEntityType<T, EntityName>, Meta>,
	deps?: unknown[],
): ChimeraCollectionQuery<ChimeraStoreEntityType<T, EntityName>> => {
	const [, trigger] = useState(() => ({}));

	const repository = useChimeraRepository<T, EntityName>(entityName);

	const oldDeps = useRef(deps);
	if ((oldDeps.current && !deps) || (!oldDeps.current && deps)) {
		console.warn(
			"useChimeraCollection deps is not a reactive param. Use deps if you or omit it if you already have a stable reference to params",
		);
	}
	oldDeps.current = deps;

	// biome-ignore lint/correctness/useExhaustiveDependencies: Very unlikely it will be changed over time
	const memeParams = useMemo(() => params, deps ? deps : [params]);
	const collection = useMemo(() => repository.getCollection(memeParams), [repository, memeParams]);

	useEffect(() => {
		const handler = () => trigger({});
		for (const event of CHIMERA_COLLECTION_UPDATE_EVENTS) {
			collection.on(event, handler);
		}
		return () => {
			for (const event of CHIMERA_COLLECTION_UPDATE_EVENTS) {
				collection.off(event, handler);
			}
		};
	}, [collection]);

	return collection;
};

const CHIMERA_ITEM_UPDATE_EVENTS = [
	"initialized",
	"selfCreated",
	"ready",
	"updated",
	"selfUpdated",
	"deleted",
	"selfDeleted",
	"error",
] as const;
export const useChimeraItem = <T extends AnyChimeraStore, EntityName extends ChimeraStoreEntities<T>, Meta = any>(
	entityName: EntityName,
	id: ChimeraEntityId,
	meta?: Meta,
): ChimeraItemQuery<ChimeraStoreEntityType<T, EntityName>> => {
	const [, trigger] = useState(() => ({}));

	const repository = useChimeraRepository<T, EntityName>(entityName);
	const item = repository.getItem(id, meta);

	useEffect(() => {
		const handler = () => trigger({});
		for (const event of CHIMERA_ITEM_UPDATE_EVENTS) {
			item.on(event, handler);
		}
		return () => {
			for (const event of CHIMERA_ITEM_UPDATE_EVENTS) {
				item.off(event, handler);
			}
		};
	}, [item]);

	return item;
};

export function getChimeraTypedHooks<T extends AnyChimeraStore>(
	withoutPrefix: true,
): {
	useStore: () => T;
	useRepository: <EntityName extends ChimeraStoreEntities<T>>(
		entityName: EntityName,
	) => ChimeraEntityRepository<ChimeraStoreEntityType<T, EntityName>, ChimeraStoreFilter<T>>;
	useCollection: <EntityName extends ChimeraStoreEntities<T>, Meta = any>(
		entityName: EntityName,
		params: ChimeraCollectionParams<ChimeraStoreFilter<T>, ChimeraStoreEntityType<T, EntityName>, Meta>,
		deps?: unknown[],
	) => ChimeraCollectionQuery<ChimeraStoreEntityType<T, EntityName>>;
	useItem: <EntityName extends ChimeraStoreEntities<T>, Meta = any>(
		entityName: EntityName,
		id: ChimeraEntityId,
		meta?: Meta,
	) => ChimeraItemQuery<ChimeraStoreEntityType<T, EntityName>>;
};
export function getChimeraTypedHooks<T extends AnyChimeraStore>(
	withoutPrefix?: false,
): {
	useChimeraStore: () => T;
	useChimeraRepository: <EntityName extends ChimeraStoreEntities<T>>(
		entityName: EntityName,
	) => ChimeraEntityRepository<ChimeraStoreEntityType<T, EntityName>, ChimeraStoreFilter<T>>;
	useChimeraCollection: <EntityName extends ChimeraStoreEntities<T>, Meta = any>(
		entityName: EntityName,
		params: ChimeraCollectionParams<ChimeraStoreFilter<T>, ChimeraStoreEntityType<T, EntityName>, Meta>,
		deps?: unknown[],
	) => ChimeraCollectionQuery<ChimeraStoreEntityType<T, EntityName>>;
	useChimeraItem: <EntityName extends ChimeraStoreEntities<T>, Meta = any>(
		entityName: EntityName,
		id: ChimeraEntityId,
		meta?: Meta,
	) => ChimeraItemQuery<ChimeraStoreEntityType<T, EntityName>>;
};
export function getChimeraTypedHooks<T extends AnyChimeraStore>(
	withoutPrefix?: boolean,
):
	| {
			useChimeraStore: () => T;
			useChimeraRepository: <EntityName extends ChimeraStoreEntities<T>>(
				entityName: EntityName,
			) => ChimeraEntityRepository<ChimeraStoreEntityType<T, EntityName>, ChimeraStoreFilter<T>>;
			useChimeraCollection: <EntityName extends ChimeraStoreEntities<T>, Meta = any>(
				entityName: EntityName,
				params: ChimeraCollectionParams<ChimeraStoreFilter<T>, ChimeraStoreEntityType<T, EntityName>, Meta>,
				deps?: unknown[],
			) => ChimeraCollectionQuery<ChimeraStoreEntityType<T, EntityName>>;
			useChimeraItem: <EntityName extends ChimeraStoreEntities<T>, Meta = any>(
				entityName: EntityName,
				id: ChimeraEntityId,
				meta?: Meta,
			) => ChimeraItemQuery<ChimeraStoreEntityType<T, EntityName>>;
	  }
	| {
			useStore: () => T;
			useRepository: <EntityName extends ChimeraStoreEntities<T>>(
				entityName: EntityName,
			) => ChimeraEntityRepository<ChimeraStoreEntityType<T, EntityName>, ChimeraStoreFilter<T>>;
			useCollection: <EntityName extends ChimeraStoreEntities<T>, Meta = any>(
				entityName: EntityName,
				params: ChimeraCollectionParams<ChimeraStoreFilter<T>, ChimeraStoreEntityType<T, EntityName>, Meta>,
				deps?: unknown[],
			) => ChimeraCollectionQuery<ChimeraStoreEntityType<T, EntityName>>;
			useItem: <EntityName extends ChimeraStoreEntities<T>, Meta = any>(
				entityName: EntityName,
				id: ChimeraEntityId,
				meta?: Meta,
			) => ChimeraItemQuery<ChimeraStoreEntityType<T, EntityName>>;
	  } {
	return (
		withoutPrefix
			? {
					useCollection: useChimeraCollection,
					useItem: useChimeraItem,
					useRepository: useChimeraRepository,
					useStore: useChimeraStore,
				}
			: {
					useChimeraCollection,
					useChimeraItem,
					useChimeraRepository,
					useChimeraStore,
				}
	) as ReturnType<typeof getChimeraTypedHooks<T>>;
}
