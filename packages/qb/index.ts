import type {
	AnyChimeraStore,
	ChimeraConjunctionDescriptor,
	ChimeraConjunctionOperationDescriptor,
	ChimeraConjunctionType,
	ChimeraFilterDescriptor,
	ChimeraOrderDescriptor,
	ChimeraPropertyGetter,
	ChimeraStoreEntities,
	ChimeraStoreOperatorMap,
} from "../../src";
import {
	ChimeraOrderNulls,
	chimeraCreateConjunction,
	chimeraCreateNot,
	chimeraCreateOperator,
	chimeraCreateOrderBy,
} from "../../src";
import type { Constructable, KeysOfType } from "../../src/shared/types";

export interface ChimeraQueryBuilder<
	TStore extends AnyChimeraStore,
	TEntity extends ChimeraStoreEntities<TStore> = ChimeraStoreEntities<TStore>,
	TOperatorsMap extends ChimeraStoreOperatorMap<TStore> = ChimeraStoreOperatorMap<TStore>,
> {
	isChimeraQueryBuilder: true;
	// Create a new instance of the same type
	create(): this;
	// Build ChimeraQuery params
	build(): {
		filter: ChimeraFilterDescriptor<TOperatorsMap, TEntity> | null;
		order: ChimeraOrderDescriptor<TEntity>[] | null;
	};
}

export type QueryBuilderCreator<
	TStore extends AnyChimeraStore,
	TEntity extends ChimeraStoreEntities<TStore>,
	TOperatorsMap extends ChimeraStoreOperatorMap<TStore> = ChimeraStoreOperatorMap<TStore>,
	TQueryBuilder extends ChimeraQueryBuilder<TStore, TEntity, TOperatorsMap> = ChimeraQueryBuilder<
		TStore,
		TEntity,
		TOperatorsMap
	>,
> = (q: TQueryBuilder) => unknown;

export class DefaultChimeraQueryBuilder<
	TStore extends AnyChimeraStore,
	TEntity extends ChimeraStoreEntities<TStore> = ChimeraStoreEntities<TStore>,
	TOperatorsMap extends ChimeraStoreOperatorMap<TStore> = ChimeraStoreOperatorMap<TStore>,
> implements ChimeraQueryBuilder<TStore, TEntity, TOperatorsMap>
{
	private orderRules: ChimeraOrderDescriptor<TEntity>[] = [];

	isChimeraQueryBuilder: true = true;

	create(): this {
		return new (this.constructor as Constructable)();
	}

	orderBy(
		key: ChimeraPropertyGetter<TEntity> | (keyof TEntity & string),
		desc = false,
		nulls: ChimeraOrderNulls = ChimeraOrderNulls.Last,
	): this {
		this.orderRules.push(chimeraCreateOrderBy<TEntity>(key, desc, nulls));
		return this;
	}

	private filters: ChimeraConjunctionOperationDescriptor<TOperatorsMap, TEntity>[] = [];
	private rootConjunction: Exclude<ChimeraConjunctionType, "not"> = "and";

	private conjunction(type: Exclude<ChimeraConjunctionType, "not">) {
		this.rootConjunction = type;
	}

	private buildFilter(): ChimeraConjunctionDescriptor<TOperatorsMap, TEntity> | null {
		return this.filters.length
			? chimeraCreateConjunction<TEntity, TOperatorsMap>(this.rootConjunction, this.filters)
			: null;
	}

	where<Op extends keyof TOperatorsMap & string>(
		value:
			| ChimeraPropertyGetter<TEntity, Parameters<TOperatorsMap[Op]>[0]>
			| (KeysOfType<TEntity, Parameters<TOperatorsMap[Op]>[0]> & string),
		op: Op,
		test: Parameters<TOperatorsMap[Op]>[1],
	): this {
		this.filters.push(chimeraCreateOperator<TEntity, TOperatorsMap, Op>(op, value, test));
		return this;
	}

	group(conjunction: ChimeraConjunctionType, builder: QueryBuilderCreator<TStore, TEntity, TOperatorsMap, this>): this {
		const isNot = conjunction === "not";
		const nestedBuilder = this.create();

		!isNot && nestedBuilder.conjunction(conjunction);

		builder(nestedBuilder);

		const nestedQuery = nestedBuilder.buildFilter();
		nestedQuery && this.filters.push(isNot ? chimeraCreateNot<TEntity, TOperatorsMap>(nestedQuery) : nestedQuery);

		return this;
	}

	whereNot<Op extends keyof TOperatorsMap & string>(
		value:
			| ChimeraPropertyGetter<TEntity, Parameters<TOperatorsMap[Op]>[0]>
			| (KeysOfType<TEntity, Parameters<TOperatorsMap[Op]>[0]> & string),
		op: Op,
		test: Parameters<TOperatorsMap[Op]>[1],
	): this {
		this.filters.push(
			chimeraCreateNot<TEntity, TOperatorsMap>(chimeraCreateOperator<TEntity, TOperatorsMap, Op>(op, value, test)),
		);
		return this;
	}

	build(): {
		filter: ChimeraFilterDescriptor<TOperatorsMap, TEntity> | null;
		order: ChimeraOrderDescriptor<TEntity>[] | null;
	} {
		return {
			filter: this.buildFilter(),
			order: this.orderRules.length ? this.orderRules : null,
		};
	}
}
