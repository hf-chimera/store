import {
	type AnyChimeraParams,
	CHIMERA_COLLECTION_UPDATE_EVENTS,
	CHIMERA_ENTITY_STORE_UPDATE_EVENTS,
	CHIMERA_ITEM_UPDATE_EVENTS,
	type ChimeraQueryBuilder,
	normalizeParams,
} from "@hf-chimera/adapters-shared";
import type {
	AnyChimeraEntityStore,
	AnyChimeraEventEmitter,
	ChimeraCollectionQuery,
	ChimeraEntityId,
	ChimeraEntityStoreEntity,
	ChimeraEntityStoreName,
	ChimeraEntityStoreOperatorsMap,
	ChimeraEventEmitterEventNames,
	ChimeraItemQuery,
} from "@hf-chimera/store";
import { computed, customRef, isRef, type Ref, watch } from "vue";

type MaybeRef<T> = T | Ref<T>;
type MaybeRefOrGetter<T> = MaybeRef<T> | (() => T);

type ChimeraComposables<
	TStore extends AnyChimeraEntityStore,
	TQueryBuilder extends ChimeraQueryBuilder<TStore>,
	TEntityName extends ChimeraEntityStoreName<TStore> = ChimeraEntityStoreName<TStore>,
> = {
	[K in TEntityName as `useChimera${Capitalize<K>}Store`]: () => Ref<TStore>;
} & {
	[K in TEntityName as `useChimera${Capitalize<K>}Collection`]: <TMeta = any>(
		params: MaybeRefOrGetter<AnyChimeraParams<TStore, TMeta, TQueryBuilder>>,
	) => Ref<
		ChimeraCollectionQuery<
			ChimeraEntityStoreName<TStore>,
			ChimeraEntityStoreEntity<TStore>,
			ChimeraEntityStoreOperatorsMap<TStore>
		>
	>;
} & {
	[K in TEntityName as `useChimera${Capitalize<K>}Item`]: <TMeta = any>(
		id: MaybeRefOrGetter<ChimeraEntityId>,
		meta?: MaybeRefOrGetter<TMeta>,
	) => Ref<ChimeraItemQuery<ChimeraEntityStoreName<TStore>, ChimeraEntityStoreEntity<TStore>>>;
};

const isFunction = (value: any): value is () => any => typeof value === "function";
const toValue = <T>(value: MaybeRefOrGetter<T>): T =>
	isFunction(value) ? value() : isRef(value) ? value.value : value;
const capitalize = <T extends string>(s: T): Capitalize<T> =>
	s !== "" ? (((s[0] as string).toUpperCase() + s.slice(1)) as Capitalize<T>) : ("" as Capitalize<T>);

const createEmitterRef = <TEventEmitter extends AnyChimeraEventEmitter>(
	value: MaybeRefOrGetter<TEventEmitter>,
	events: ChimeraEventEmitterEventNames<TEventEmitter>[],
	name: string,
) =>
	customRef((track, trigger) => {
		watch(
			value,
			(value, _, onCleanup) => {
				const actualValue = toValue(value);

				const handler = () => trigger();
				events.forEach((event) => {
					actualValue.on(event, handler);
				});
				onCleanup(() =>
					events.forEach((event) => {
						actualValue.off(event, handler);
					}),
				);
			},
			{ immediate: true },
		);

		return {
			get() {
				track();
				return toValue(value);
			},
			set() {
				console.warn(`${name} ref is readonly`);
			},
		};
	});

export function createChimeraStoreComposables<TStore extends AnyChimeraEntityStore>(
	store: TStore,
): ChimeraComposables<TStore, never>;
export function createChimeraStoreComposables<
	TStore extends AnyChimeraEntityStore,
	TQueryBuilder extends ChimeraQueryBuilder<TStore>,
>(store: TStore, createQueryBuilder: () => TQueryBuilder): ChimeraComposables<TStore, TQueryBuilder>;
export function createChimeraStoreComposables<
	TStore extends AnyChimeraEntityStore,
	TQueryBuilder extends ChimeraQueryBuilder<TStore>,
>(store: TStore, createQueryBuilder?: () => TQueryBuilder): ChimeraComposables<TStore, TQueryBuilder> {
	return {
		[`useChimera${capitalize(store.name)}Store`]: () =>
			createEmitterRef(store, CHIMERA_ENTITY_STORE_UPDATE_EVENTS, "ChimeraEntityStore"),
		[`useChimera${capitalize(store.name)}Collection`]: <TMeta = any>(
			params: MaybeRefOrGetter<AnyChimeraParams<TStore, TMeta, TQueryBuilder>>,
		): Ref<
			ChimeraCollectionQuery<
				ChimeraEntityStoreName<TStore>,
				ChimeraEntityStoreEntity<TStore>,
				ChimeraEntityStoreOperatorsMap<TStore>
			>
		> => {
			const normalizedParams = computed(() => normalizeParams(createQueryBuilder, toValue(params as TQueryBuilder)));
			return createEmitterRef(
				computed(() => store.getCollection(normalizedParams.value)),
				CHIMERA_COLLECTION_UPDATE_EVENTS,
				"ChimeraCollectionQuery",
			);
		},
		[`useChimera${capitalize(store.name)}Item`]: <TMeta = any>(
			id: MaybeRefOrGetter<ChimeraEntityId>,
			meta?: MaybeRefOrGetter<TMeta>,
		): Ref<ChimeraItemQuery<ChimeraEntityStoreName<TStore>, ChimeraEntityStoreEntity<TStore>>> =>
			createEmitterRef(
				computed(() => store.getItem(toValue(id), toValue(meta))),
				CHIMERA_ITEM_UPDATE_EVENTS,
				"ChimeraItemQuery",
			),
	} as ChimeraComposables<TStore, TQueryBuilder>;
}
