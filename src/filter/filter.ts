import { compilePropertyGetter, simplifyPropertyGetter } from "../shared/shared.ts";
import type { ChimeraPropertyGetter, KeysOfType } from "../shared/types.ts";
import { ChimeraConjunctionSymbol, ChimeraOperatorSymbol } from "./constants.ts";
import { ChimeraFilterOperatorNotFoundError } from "./errors.ts";
import type {
	ChimeraConjunctionDescriptor,
	ChimeraConjunctionOperation,
	ChimeraConjunctionType,
	ChimeraFilterChecker,
	ChimeraFilterConfig,
	ChimeraFilterDescriptor,
	ChimeraFilterOperatorDescriptor,
	ChimeraKeyFromOperatorGetter,
	ChimeraOperatorMap,
	ChimeraSimplifiedFilter,
	ChimeraSimplifiedOperator,
	ConjunctionMap,
	SimplifiedConjunction,
} from "./types.ts";

const filterConjunctions = {
	and: (operations) => operations.every((op) => op()),
	not: (operations) => !operations.every((op) => op()),
	or: (operations) => operations.some((op) => op()),
} satisfies ConjunctionMap;

const compileOperator = <OperatorsMap extends ChimeraOperatorMap, Entity>(
	config: ChimeraFilterConfig<OperatorsMap>,
	{ op, value, test }: ChimeraFilterOperatorDescriptor<OperatorsMap, Entity>,
): ChimeraFilterChecker<Entity> => {
	const operatorFunc = config.operators[op];
	if (!operatorFunc) throw new ChimeraFilterOperatorNotFoundError(op);
	const getter = compilePropertyGetter(value);
	return (entity) => operatorFunc(getter(entity), test);
};

export const compileConjunction = <OperatorsMap extends ChimeraOperatorMap, Entity>(
	config: ChimeraFilterConfig<OperatorsMap>,
	{ kind, operations }: ChimeraConjunctionDescriptor<OperatorsMap, Entity>,
): ChimeraFilterChecker<Entity> => {
	const conjunction = filterConjunctions[kind];

	const compiledOperations = operations
		.map((operation) => {
			switch (operation.type) {
				case ChimeraOperatorSymbol:
					return compileOperator(config, operation);
				case ChimeraConjunctionSymbol:
					return compileConjunction(config, operation);
				default:
					// @ts-expect-error: `operation.type` should always be type `never` here
					throw new ChimeraInternalError(`Invalid filter operation ${operation.type}`);
			}
		})
		.filter(Boolean);

	return (entity) => conjunction(compiledOperations.map((op) => () => op(entity)));
};

export const simplifyOperator = <OperatorsMap extends ChimeraOperatorMap, Entity>({
	op,
	value,
	test,
                                                                                  }: ChimeraFilterOperatorDescriptor<OperatorsMap, Entity>): ChimeraSimplifiedOperator<OperatorsMap> => ({
	key: simplifyPropertyGetter(value),
	op,
	test,
	type: ChimeraOperatorSymbol,
});

const compareSimplifiedOperator = <OperatorsMap extends ChimeraOperatorMap>(
	a: ChimeraSimplifiedOperator<OperatorsMap>,
	b: ChimeraSimplifiedOperator<OperatorsMap>,
): number =>
	a.key.localeCompare(b.key) ||
	a.op.localeCompare(b.op) ||
	JSON.stringify(a.test).localeCompare(JSON.stringify(b.test));

const compareSimplifiedOperation = <OperatorsMap extends ChimeraOperatorMap>(
	a: ChimeraSimplifiedOperator<OperatorsMap> | SimplifiedConjunction<OperatorsMap>,
	b: ChimeraSimplifiedOperator<OperatorsMap> | SimplifiedConjunction<OperatorsMap>,
): number => {
	if (a.type !== b.type) return a.type === ChimeraOperatorSymbol ? -1 : 1;
	if (a.type === ChimeraOperatorSymbol && b.type === ChimeraOperatorSymbol) return compareSimplifiedOperator(a, b);
	if (a.type === ChimeraConjunctionSymbol && b.type === ChimeraConjunctionSymbol)
		return compareSimplifiedConjunction(a, b);
	return 0;
};

const compareSimplifiedConjunction = <OperatorsMap extends ChimeraOperatorMap>(
	a: SimplifiedConjunction<OperatorsMap>,
	b: SimplifiedConjunction<OperatorsMap>,
): number => {
	const kindCompare = a.kind.localeCompare(b.kind);
	if (kindCompare !== 0) return kindCompare;

	const aOps = a.operations;
	const bOps = b.operations;
	const minLength = Math.min(aOps.length, bOps.length);

	for (let i = 0; i < minLength; i++) {
		const aOp = aOps[i];
		const bOp = bOps[i];
		if (aOp && bOp) {
			const compare = compareSimplifiedOperation(aOp, bOp);
			if (compare !== 0) return compare;
		}
	}

	return aOps.length - bOps.length;
};

export const simplifyConjunction = <OperatorsMap extends ChimeraOperatorMap, Entity>({
	kind,
	operations,
                                                                                     }: ChimeraConjunctionDescriptor<OperatorsMap, Entity>): SimplifiedConjunction<OperatorsMap> => {
	return {
		kind,
		operations: operations
			.map((op) => {
				switch (op.type) {
					case ChimeraOperatorSymbol:
						return simplifyOperator(op);
					case ChimeraConjunctionSymbol:
						return simplifyConjunction(op);
					default:
						// @ts-expect-error: `op.type` should always be type `never` here
						throw new ChimeraInternalError(`Invalid filter operation ${op.type}`);
				}
			})
			.filter(Boolean)
			.sort((a, b) => compareSimplifiedOperation(a, b)),
		type: ChimeraConjunctionSymbol,
	};
};

export const chimeraCreateOperator = <
	Entity,
	OperatorsMap extends ChimeraOperatorMap,
	Op extends keyof OperatorsMap & string,
>(
	op: Op,
	value:
		| ChimeraPropertyGetter<Entity, Parameters<OperatorsMap[Op]>[0]>
		| (KeysOfType<Entity, Parameters<OperatorsMap[Op]>[0]> & string),
	test: Parameters<OperatorsMap[Op]>[1],
): ChimeraFilterOperatorDescriptor<OperatorsMap, Entity, Op> => ({
	op,
	test,
	type: ChimeraOperatorSymbol,
	value: (typeof value === "string"
		? {
				get: value,
				key: value,
			}
		: value) as ChimeraPropertyGetter<Entity, Parameters<OperatorsMap[Op]>[0]>,
});

export const chimeraCreateConjunction = <
	Entity,
	OperatorsMap extends ChimeraOperatorMap,
	Conj extends Exclude<ChimeraConjunctionType, 'not'> = Exclude<ChimeraConjunctionType, 'not'>,
>(
	kind: Conj,
	operations: ChimeraConjunctionOperation<OperatorsMap, Entity>[],
): ChimeraConjunctionDescriptor<OperatorsMap, Entity, Conj> => ({
	kind,
	operations,
	type: ChimeraConjunctionSymbol,
});

export const chimeraCreateNot = <Entity, OperatorsMap extends ChimeraOperatorMap>(
	operation: ChimeraConjunctionOperation<OperatorsMap, Entity>,
): ChimeraConjunctionDescriptor<OperatorsMap, Entity, 'not'> => ({
	kind: "not",
	operations: [operation],
	type: ChimeraConjunctionSymbol,
});

export const compileFilter = <Entity, OperatorsMap extends ChimeraOperatorMap>(
	config: ChimeraFilterConfig<OperatorsMap>,
	descriptor?: ChimeraFilterDescriptor<OperatorsMap, Entity> | null,
): ChimeraFilterChecker<Entity> => (descriptor ? compileConjunction(config, descriptor) : () => true);

export const simplifyFilter = <Entity, OperatorsMap extends ChimeraOperatorMap>(
	descriptor?: ChimeraFilterDescriptor<OperatorsMap, Entity> | null,
): ChimeraSimplifiedFilter<OperatorsMap> => (descriptor ? simplifyConjunction(descriptor) : null);

const isOperationSubset = <OperatorsMap extends ChimeraOperatorMap>(
	candidateOp: ChimeraSimplifiedOperator<OperatorsMap> | SimplifiedConjunction<OperatorsMap>,
	targetOp: ChimeraSimplifiedOperator<OperatorsMap> | SimplifiedConjunction<OperatorsMap>,
	getOperatorKey: ChimeraKeyFromOperatorGetter,
): boolean => {
	if (candidateOp.type !== targetOp.type) return false;

	if (candidateOp.type === ChimeraOperatorSymbol && targetOp.type === ChimeraOperatorSymbol) {
		// For operators: must have the same key, op, and stringified value
		return (
			candidateOp.key === targetOp.key &&
			candidateOp.op === targetOp.op &&
			getOperatorKey(candidateOp) === getOperatorKey(targetOp)
		);
	}

	if (candidateOp.type === ChimeraConjunctionSymbol && targetOp.type === ChimeraConjunctionSymbol) {
		// For conjunctions: recursively check subset relationship
		return isConjunctionSubset(candidateOp, targetOp, getOperatorKey);
	}

	return false;
};

const isConjunctionSubset = <OperatorsMap extends ChimeraOperatorMap>(
	candidate: SimplifiedConjunction<OperatorsMap>,
	target: SimplifiedConjunction<OperatorsMap>,
	getOperatorKey: ChimeraKeyFromOperatorGetter,
): boolean => {
	if (candidate.kind !== target.kind) return false;

	switch (candidate.kind) {
		case "and":
		case "not":
			return candidate.operations.every((candidateOp) =>
				target.operations.some((targetOp) => isOperationSubset(candidateOp, targetOp, getOperatorKey)),
			);
		case "or":
			return target.operations.every((targetOp) =>
				candidate.operations.some((candidateOp) => isOperationSubset(candidateOp, targetOp, getOperatorKey)),
			);
	}
};

export const isFilterSubset = <OperatorsMap extends ChimeraOperatorMap>(
	candidate: ChimeraSimplifiedFilter<OperatorsMap>,
	target: ChimeraSimplifiedFilter<OperatorsMap>,
	getOperatorKey: ChimeraKeyFromOperatorGetter,
): boolean => {
	// If a candidate is null, it's always a subset (matches everything)
	if (candidate === null) return true;
	// If the target is null but a candidate is not, a candidate is never a subset
	if (target === null) return false;

	return isConjunctionSubset(candidate, target, getOperatorKey);
};
