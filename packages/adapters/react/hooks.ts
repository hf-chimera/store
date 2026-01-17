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
import { type ChimeraQueryBuilder, DefaultChimeraQueryBuilder } from "../../qb";
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

type ChimeraHooks<TStore extends AnyChimeraStore, TQueryBuilder extends ChimeraQueryBuilder<TStore>> = {
	useChimeraStore: () => TStore;
	useChimeraRepository: <TEntityName extends ChimeraStoreEntities<TStore>>(
		entityName: TEntityName,
	) => ChimeraEntityRepository<ChimeraStoreEntityType<TStore, TEntityName>, ChimeraStoreOperatorMap<TStore>>;
	useChimeraCollection: <TEntityName extends ChimeraStoreEntities<TStore>, Meta = any>(
		entityName: TEntityName,
		params: AnyChimeraParams<
			TStore,
			TEntityName,
			Meta,
			Extract<TQueryBuilder, ChimeraQueryBuilder<TStore, TEntityName>>
		>,
		deps?: unknown[],
	) => ChimeraCollectionQuery<ChimeraStoreEntityType<TStore, TEntityName>, ChimeraStoreOperatorMap<TStore>>;
	useChimeraItem: <TEntityName extends ChimeraStoreEntities<TStore>, Meta = any>(
		entityName: TEntityName,
		id: ChimeraEntityId,
		meta?: Meta,
	) => ChimeraItemQuery<ChimeraStoreEntityType<TStore, TEntityName>>;
};

export function createChimeraHooks<TStore extends AnyChimeraStore>(
	store: TStore,
): ChimeraHooks<TStore, DefaultChimeraQueryBuilder<TStore>>;
export function createChimeraHooks<TStore extends AnyChimeraStore, TQueryBuilder extends ChimeraQueryBuilder<TStore>>(
	store: TStore,
	createQueryBuilder: () => TQueryBuilder,
): ChimeraHooks<TStore, TQueryBuilder>;
export function createChimeraHooks<TStore extends AnyChimeraStore, TQueryBuilder extends ChimeraQueryBuilder<TStore>>(
	store: TStore,
	createQueryBuilder?: () => TQueryBuilder,
): ChimeraHooks<TStore, TQueryBuilder> {
	createQueryBuilder ||= () => new DefaultChimeraQueryBuilder() as unknown as TQueryBuilder;

	const useChimeraRepository = <EntityName extends ChimeraStoreEntities<TStore>>(entityName: EntityName) =>
		// biome-ignore lint/correctness/useExhaustiveDependencies: this hook is generated for a specific store so it never changes
		useMemo(() => store.from(entityName), [entityName]);

	return {
		useChimeraStore: () => store,
		useChimeraRepository,
		useChimeraCollection: <TEntityName extends ChimeraStoreEntities<TStore>, Meta = any>(
			entityName: TEntityName,
			params: AnyChimeraParams<
				TStore,
				TEntityName,
				Meta,
				Extract<TQueryBuilder, ChimeraQueryBuilder<TStore, TEntityName>>
			>,
			deps?: unknown[],
		) => {
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
				() => normalizeParams(createQueryBuilder, params),
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
}
