import { computed, customRef, isRef, type Ref, watch } from "vue";
import type {
	AnyChimeraStore,
	ChimeraCollectionQuery,
	ChimeraEntityId,
	ChimeraItemQuery,
	ChimeraStoreEntities,
	ChimeraStoreEntityType,
	ChimeraStoreOperatorMap,
} from "../../../src";
import type { ChimeraEntityRepository } from "../../../src/store/ChimeraEntityRepository";
import { type ChimeraQueryBuilder, DefaultChimeraQueryBuilder } from "../../qb";
import { type AnyChimeraParams, normalizeParams } from "../shared/params";

type MaybeRef<T> = T | Ref<T>;
type MaybeRefOrGetter<T> = MaybeRef<T> | (() => T);

const isFunction = (value: any): value is () => any => typeof value === "function";
const toValue = <T>(value: MaybeRefOrGetter<T>): T =>
	isFunction(value) ? value() : isRef(value) ? value.value : value;

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

export type ChimeraCollectionRef<T extends AnyChimeraStore, EntityName extends ChimeraStoreEntities<T>> = Ref<
	ChimeraCollectionQuery<ChimeraStoreEntityType<T, EntityName>, ChimeraStoreOperatorMap<T>>
>;

export type ChimeraItemRef<T extends AnyChimeraStore, EntityName extends ChimeraStoreEntities<T>> = Ref<
	ChimeraItemQuery<ChimeraStoreEntityType<T, EntityName>>
>;

type ChimeraComposables<TStore extends AnyChimeraStore, TQueryBuilder extends ChimeraQueryBuilder<TStore>> = {
	useChimeraStore: () => TStore;
	useChimeraRepository: <TEntityName extends ChimeraStoreEntities<TStore>>(
		entityName: MaybeRefOrGetter<TEntityName>,
	) => Ref<ChimeraEntityRepository<ChimeraStoreEntityType<TStore, TEntityName>, ChimeraStoreOperatorMap<TStore>>>;
	useChimeraCollection: <TEntityName extends ChimeraStoreEntities<TStore>, TMeta = any>(
		entityName: MaybeRefOrGetter<TEntityName>,
		params: MaybeRefOrGetter<
			AnyChimeraParams<TStore, TEntityName, TMeta, Extract<TQueryBuilder, ChimeraQueryBuilder<TStore, TEntityName>>>
		>,
	) => ChimeraCollectionRef<TStore, TEntityName>;
	useChimeraItem: <TEntityName extends ChimeraStoreEntities<TStore>, TMeta = any>(
		entityName: MaybeRefOrGetter<TEntityName>,
		id: MaybeRefOrGetter<ChimeraEntityId>,
		meta?: MaybeRefOrGetter<TMeta>,
	) => ChimeraItemRef<TStore, TEntityName>;
};

export function createChimeraComposables<TStore extends AnyChimeraStore>(
	store: TStore,
): ChimeraComposables<TStore, DefaultChimeraQueryBuilder<TStore>>;
export function createChimeraComposables<
	TStore extends AnyChimeraStore,
	TQueryBuilder extends ChimeraQueryBuilder<TStore>,
>(store: TStore, createQueryBuilder: () => TQueryBuilder): ChimeraComposables<TStore, TQueryBuilder>;
export function createChimeraComposables<
	TStore extends AnyChimeraStore,
	TQueryBuilder extends ChimeraQueryBuilder<TStore>,
>(store: TStore, createQueryBuilder?: () => TQueryBuilder): ChimeraComposables<TStore, TQueryBuilder> {
	createQueryBuilder ||= () => new DefaultChimeraQueryBuilder() as unknown as TQueryBuilder;

	const useChimeraRepository = <EntityName extends ChimeraStoreEntities<TStore>>(
		entityName: MaybeRefOrGetter<EntityName>,
	) => computed(() => store.from(toValue(entityName)));

	return {
		useChimeraStore: () => store,
		useChimeraRepository,
		useChimeraCollection: (entityName, params) => {
			const repository = useChimeraRepository(entityName);
			const normalizedParams = computed(() => normalizeParams(createQueryBuilder, toValue(params)));
			const collection = computed(() => repository.value.getCollection(normalizedParams.value));

			return customRef((track, trigger) => {
				watch(
					collection,
					(collection, _, onCleanup) => {
						const handler = () => trigger();
						CHIMERA_COLLECTION_UPDATE_EVENTS.forEach((event) => {
							collection.on(event, handler);
						});
						onCleanup(() =>
							CHIMERA_COLLECTION_UPDATE_EVENTS.forEach((event) => {
								collection.off(event, handler);
							}),
						);
					},
					{ immediate: true },
				);

				return {
					get() {
						track();
						return collection.value;
					},
					set() {
						console.warn("ChimeraCollectionRef is readonly");
					},
				};
			});
		},
		useChimeraItem: (entityName, id, meta) => {
			const repository = useChimeraRepository(entityName);
			const item = computed(() => repository.value.getItem(toValue(id), toValue(meta)));

			return customRef((track, trigger) => {
				watch(
					item,
					(item, _, onCleanup) => {
						const handler = () => trigger();
						CHIMERA_ITEM_UPDATE_EVENTS.forEach((event) => {
							item.on(event, handler);
						});
						onCleanup(() =>
							CHIMERA_ITEM_UPDATE_EVENTS.forEach((event) => {
								item.off(event, handler);
							}),
						);
					},
					{ immediate: true },
				);

				return {
					get() {
						track();
						return item.value;
					},
					set() {
						console.warn("ChimeraItemRef is readonly");
					},
				};
			});
		},
	};
}
