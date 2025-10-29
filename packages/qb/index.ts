import type {
	AnyChimeraStore,
	ChimeraConjunctionDescriptor,
	ChimeraConjunctionOperation,
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
import type { KeysOfType } from "../../src/shared/types";

export type QueryBuilderCreator<
	Store extends AnyChimeraStore,
	Entity extends ChimeraStoreEntities<Store>,
	OperatorsMap extends ChimeraStoreOperatorMap<Store> = ChimeraStoreOperatorMap<Store>,
> = (q: ChimeraQueryBuilder<Store, Entity, OperatorsMap>) => any;

export class ChimeraQueryBuilder<
	Store extends AnyChimeraStore,
	Entity extends ChimeraStoreEntities<Store>,
	OperatorsMap extends ChimeraStoreOperatorMap<Store> = ChimeraStoreOperatorMap<Store>,
> {
	private orderRules: ChimeraOrderDescriptor<Entity>[] = [];

	orderBy(
		key: ChimeraPropertyGetter<Entity> | (keyof Entity & string),
		desc = false,
		nulls: ChimeraOrderNulls = ChimeraOrderNulls.Last,
	): this {
		this.orderRules.push(chimeraCreateOrderBy<Entity>(key, desc, nulls));
		return this;
	}

	private filters: ChimeraConjunctionOperation<OperatorsMap, Entity>[] = [];
	private rootConjunction: Exclude<ChimeraConjunctionType, "not"> = "and";

	private conjunction(type: Exclude<ChimeraConjunctionType, "not">) {
		this.rootConjunction = type;
	}

	private buildFilter(): ChimeraConjunctionDescriptor<OperatorsMap, Entity> | null {
		return this.filters.length
			? chimeraCreateConjunction<Entity, OperatorsMap>(this.rootConjunction, this.filters)
			: null;
	}

	where<Op extends keyof OperatorsMap & string>(
		value:
			| ChimeraPropertyGetter<Entity, Parameters<OperatorsMap[Op]>[0]>
			| (KeysOfType<Entity, Parameters<OperatorsMap[Op]>[0]> & string),
		op: Op,
		test: Parameters<OperatorsMap[Op]>[1],
	): this {
		this.filters.push(chimeraCreateOperator<Entity, OperatorsMap, Op>(op, value, test));
		return this;
	}

	group(conjunction: ChimeraConjunctionType, builder: QueryBuilderCreator<Store, Entity, OperatorsMap>): this {
		const isNot = conjunction === "not";
		const nestedBuilder = new ChimeraQueryBuilder<Store, Entity, OperatorsMap>();

		!isNot && nestedBuilder.conjunction(conjunction);

		builder(nestedBuilder);

		const nestedQuery = nestedBuilder.buildFilter();
		nestedQuery && this.filters.push(isNot ? chimeraCreateNot<Entity, OperatorsMap>(nestedQuery) : nestedQuery);

		return this;
	}

	whereNot<Op extends keyof OperatorsMap & string>(
		value:
			| ChimeraPropertyGetter<Entity, Parameters<OperatorsMap[Op]>[0]>
			| (KeysOfType<Entity, Parameters<OperatorsMap[Op]>[0]> & string),
		op: Op,
		test: Parameters<OperatorsMap[Op]>[1],
	): this {
		this.filters.push(
			chimeraCreateNot<Entity, OperatorsMap>(chimeraCreateOperator<Entity, OperatorsMap, Op>(op, value, test)),
		);
		return this;
	}

	build(): {
		filter: ChimeraFilterDescriptor<OperatorsMap, Entity> | null;
		order: ChimeraOrderDescriptor<Entity>[] | null;
	} {
		return {
			filter: this.buildFilter(),
			order: this.orderRules.length ? this.orderRules : null,
		};
	}
}
