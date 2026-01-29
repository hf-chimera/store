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
import { useEffect, useMemo, useRef, useState } from "react";

type ChimeraHooks<
	TStore extends AnyChimeraEntityStore,
	TQueryBuilder extends ChimeraQueryBuilder<TStore>,
	TEntityName extends ChimeraEntityStoreName<TStore> = ChimeraEntityStoreName<TStore>,
> = {
	[K in TEntityName as `useChimera${Capitalize<K>}Store`]: () => TStore;
} & {
	[K in TEntityName as `useChimera${Capitalize<K>}Collection`]: <Meta = any>(
		params: AnyChimeraParams<TStore, Meta, TQueryBuilder>,
		deps?: unknown[],
	) => ChimeraCollectionQuery<TEntityName, ChimeraEntityStoreEntity<TStore>, ChimeraEntityStoreOperatorsMap<TStore>>;
} & {
	[K in TEntityName as `useChimera${Capitalize<K>}Item`]: <Meta = any>(
		id: ChimeraEntityId,
		meta?: Meta,
	) => ChimeraItemQuery<TEntityName, ChimeraEntityStoreEntity<TStore>>;
};

const capitalize = <T extends string>(s: T): Capitalize<T> =>
	s !== "" ? (((s[0] as string).toUpperCase() + s.slice(1)) as Capitalize<T>) : ("" as Capitalize<T>);

const useSubscribedValue = <TEventEmitter extends AnyChimeraEventEmitter>(
	value: TEventEmitter,
	events: ChimeraEventEmitterEventNames<TEventEmitter>[],
): TEventEmitter => {
	const trigger = useState(() => ({}))[1];
	useEffect(() => {
		const handler = () => trigger({});
		events.forEach((event) => {
			value.on(event, handler);
		});
		return () => {
			events.forEach((event) => {
				value.off(event, handler);
			});
		};
	}, [value, events, trigger]);
	return value;
};

export function createChimeraStoreHooks<TStore extends AnyChimeraEntityStore>(
	store: TStore,
): ChimeraHooks<TStore, never>;
export function createChimeraStoreHooks<
	TStore extends AnyChimeraEntityStore,
	TQueryBuilder extends ChimeraQueryBuilder<TStore>,
>(store: TStore, createQueryBuilder: () => TQueryBuilder): ChimeraHooks<TStore, TQueryBuilder>;
export function createChimeraStoreHooks<
	TStore extends AnyChimeraEntityStore,
	TQueryBuilder extends ChimeraQueryBuilder<TStore>,
>(store: TStore, createQueryBuilder?: () => TQueryBuilder): ChimeraHooks<TStore, TQueryBuilder> {
	return {
		[`useChimera${capitalize(store.name)}Store`]: () => useSubscribedValue(store, CHIMERA_ENTITY_STORE_UPDATE_EVENTS),
		[`useChimera${capitalize(store.name)}Collection`]: <TMeta = any>(
			params: AnyChimeraParams<TStore, TMeta, TQueryBuilder>,
			deps?: unknown[],
		) => {
			const oldDeps = useRef(deps);
			if ((oldDeps.current && !deps) || (!oldDeps.current && deps)) {
				console.warn(
					`useChimera${capitalize(store.name)}Collection deps is not a reactive param!\n` +
						"Use deps if you want to control dependencies manually.\n" +
						"Omit it if you already have a stable reference to params",
				);
			}
			oldDeps.current = deps;

			const stableParams = useMemo(
				() => normalizeParams(createQueryBuilder, params as TQueryBuilder),
				// biome-ignore lint/correctness/useExhaustiveDependencies: Very unlikely it will be changed over time, anyway warning for this already added.
				deps ? deps : [params],
			);

			return useSubscribedValue(
				useMemo(() => store.getCollection(stableParams), [store, stableParams]),
				CHIMERA_COLLECTION_UPDATE_EVENTS,
			);
		},
		[`useChimera${capitalize(store.name)}Item`]: <Meta = any>(id: ChimeraEntityId, meta?: Meta) =>
			useSubscribedValue(
				useMemo(() => store.getItem(id, meta), [store, id, meta]),
				CHIMERA_ITEM_UPDATE_EVENTS,
			),
	} as ChimeraHooks<TStore, TQueryBuilder>;
}
