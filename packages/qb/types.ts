import type {
	AnyChimeraEntityStore,
	ChimeraEntityStoreEntity,
	ChimeraEntityStoreOperatorsMap,
	ChimeraFilterDescriptor,
	ChimeraOrderDescriptor,
	Nullish,
} from "@hf-chimera/store";

export interface ChimeraQueryBuilder<TStore extends AnyChimeraEntityStore> {
	isChimeraQueryBuilder: true;
	// Create a new instance of the same type
	create(): this;
	// Build ChimeraQuery params
	build(): {
		filter: ChimeraFilterDescriptor<ChimeraEntityStoreOperatorsMap<TStore>, ChimeraEntityStoreEntity<TStore>> | null;
		order: ChimeraOrderDescriptor<ChimeraEntityStoreEntity<TStore>>[] | null;
	};
}

export type QueryBuilderCreator<
	TStore extends AnyChimeraEntityStore,
	TQueryBuilder extends ChimeraQueryBuilder<TStore> = ChimeraQueryBuilder<TStore>,
> = (q: TQueryBuilder) => Nullish<ChimeraQueryBuilder<TStore>>;
