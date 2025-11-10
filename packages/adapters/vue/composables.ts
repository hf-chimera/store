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

export const createChimeraComposables = <T extends AnyChimeraStore>(
	store: T,
): {
	useChimeraStore: () => T;
	useChimeraRepository: <EntityName extends ChimeraStoreEntities<T>>(
		entityName: MaybeRefOrGetter<EntityName>,
	) => Ref<ChimeraEntityRepository<ChimeraStoreEntityType<T, EntityName>, ChimeraStoreOperatorMap<T>>>;
	useChimeraCollection: <EntityName extends ChimeraStoreEntities<T>, Meta = any>(
		entityName: MaybeRefOrGetter<EntityName>,
		params: MaybeRefOrGetter<AnyChimeraParams<T, EntityName, Meta>>,
	) => ChimeraCollectionRef<T, EntityName>;
	useChimeraItem: <EntityName extends ChimeraStoreEntities<T>, Meta = any>(
		entityName: MaybeRefOrGetter<EntityName>,
		id: MaybeRefOrGetter<ChimeraEntityId>,
		meta?: MaybeRefOrGetter<Meta>,
	) => ChimeraItemRef<T, EntityName>;
} => {
	const useChimeraRepository = <EntityName extends ChimeraStoreEntities<T>>(entityName: MaybeRefOrGetter<EntityName>) =>
		computed(() => store.from(toValue(entityName)));

	return {
		useChimeraStore: () => store,
		useChimeraRepository,
		useChimeraCollection: (entityName, params) => {
			const repository = useChimeraRepository(entityName);
			const normalizedParams = computed(() => normalizeParams(toValue(params)));
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
};
