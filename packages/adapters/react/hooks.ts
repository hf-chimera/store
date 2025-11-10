import { useEffect, useMemo, useRef, useState } from "react";
import type { ChimeraCollectionQuery } from "../../../src/query/ChimeraCollectionQuery";
import type { ChimeraItemQuery } from "../../../src/query/ChimeraItemQuery";
import type { ChimeraEntityId } from "../../../src/shared/types";
import type { ChimeraEntityRepository } from "../../../src/store/ChimeraEntityRepository";
import type {
	AnyChimeraStore,
	ChimeraStoreEntities,
	ChimeraStoreEntityType,
	ChimeraStoreOperatorMap,
} from "../../../src/store/ChimeraStore";
import { type AnyChimeraParams, normalizeParams } from "../shared/params";

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

export const createChimeraHooks = <T extends AnyChimeraStore>(
	store: T,
): {
	useChimeraStore: () => T;
	useChimeraRepository: <EntityName extends ChimeraStoreEntities<T>>(
		entityName: EntityName,
	) => ChimeraEntityRepository<ChimeraStoreEntityType<T, EntityName>, ChimeraStoreOperatorMap<T>>;
	useChimeraCollection: <EntityName extends ChimeraStoreEntities<T>, Meta = any>(
		entityName: EntityName,
		params: AnyChimeraParams<T, EntityName, Meta>,
		deps?: unknown[],
	) => ChimeraCollectionQuery<ChimeraStoreEntityType<T, EntityName>, ChimeraStoreOperatorMap<T>>;
	useChimeraItem: <EntityName extends ChimeraStoreEntities<T>, Meta = any>(
		entityName: EntityName,
		id: ChimeraEntityId,
		meta?: Meta,
	) => ChimeraItemQuery<ChimeraStoreEntityType<T, EntityName>>;
} => {
	const useChimeraRepository = <EntityName extends ChimeraStoreEntities<T>>(entityName: EntityName) =>
		// biome-ignore lint/correctness/useExhaustiveDependencies: this hook is generated for a specific store so it never changes
		useMemo(() => store.from(entityName), [entityName]);

	return {
		useChimeraStore: () => store,
		useChimeraRepository,
		useChimeraCollection: (entityName, params, deps?) => {
			const [, trigger] = useState(() => ({}));

			const repository = useChimeraRepository(entityName);

			const oldDeps = useRef(deps);
			if ((oldDeps.current && !deps) || (!oldDeps.current && deps)) {
				console.warn(
					"useChimeraCollection deps is not a reactive param!\n" +
						"Use deps if you want to control dependencies manually.\n" +
						"Omit it if you already have a stable reference to params",
				);
			}
			oldDeps.current = deps;

			const memeParams = useMemo(
				() => normalizeParams(params),
				// biome-ignore lint/correctness/useExhaustiveDependencies: Very unlikely it will be changed over time, anyway warning for this already added.
				deps ? deps : [params],
			);
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
		},
		useChimeraItem: (entityName, id, meta?) => {
			const [, trigger] = useState(() => ({}));

			const repository = useChimeraRepository(entityName);
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
		},
	};
};
