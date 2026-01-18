import {
	type AnyChimeraEntityStore,
	type ChimeraConjunctionDescriptor,
	type ChimeraConjunctionOperationDescriptor,
	type ChimeraConjunctionType,
	type ChimeraEntityStoreEntity,
	type ChimeraEntityStoreOperatorsMap,
	type ChimeraFilterDescriptor,
	type ChimeraOrderDescriptor,
	ChimeraOrderNulls,
	type ChimeraPropertyGetter,
	type Constructable,
	chimeraCreateConjunction,
	chimeraCreateNot,
	chimeraCreateOperator,
	chimeraCreateOrderBy,
	type KeysOfType,
} from "@hf-chimera/store";
import type { ChimeraQueryBuilder, QueryBuilderCreator } from "./types";

export class DefaultChimeraQueryBuilder<
	TStore extends AnyChimeraEntityStore,
	TEntity extends ChimeraEntityStoreEntity<TStore> = ChimeraEntityStoreEntity<TStore>,
	TOperatorsMap extends ChimeraEntityStoreOperatorsMap<TStore> = ChimeraEntityStoreOperatorsMap<TStore>,
> implements ChimeraQueryBuilder<TStore>
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

	group(conjunction: ChimeraConjunctionType, builder: QueryBuilderCreator<TStore, this>): this {
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
