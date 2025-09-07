import { ChimeraInternalError } from "../shared/errors.ts";
import { compilePropertyGetter, simplifyPropertyGetter } from "../shared/shared.ts";
import type { ChimeraPropertyGetter, KeysOfType } from "../shared/types.ts";
import { ChimeraConjunctionSymbol, ChimeraOperatorSymbol } from "./constants.ts";
import { ChimeraFilterConjunctionNotFoundError, ChimeraFilterOperatorNotFoundError } from "./errors.ts";
import type {
	ChimeraConjunctionDescriptor,
	ChimeraConjunctionMap,
	ChimeraConjunctionOperation,
	ChimeraConjunctionType,
	ChimeraFilterChecker,
	ChimeraFilterConfig,
	ChimeraFilterDescriptor,
	ChimeraFilterOperatorDescriptor,
	ChimeraKeyFromOperatorGetter,
	ChimeraSimplifiedFilter,
	ChimeraSimplifiedOperator,
	SimplifiedConjunction,
} from "./types.ts";

const chimeraFilterConjunctions = {
	and: (operations) => operations.every((op) => op()),
	or: (operations) => operations.some((op) => op()),
} satisfies ChimeraConjunctionMap;

const compileOperator = <Config extends ChimeraFilterConfig, Entity>(
	config: Config,
	{ op, value, test }: ChimeraFilterOperatorDescriptor<Config, Entity>,
): ChimeraFilterChecker<Entity> => {
	const operatorFunc = config.operators[op];
	if (!operatorFunc) throw new ChimeraFilterOperatorNotFoundError(op);
	const getter = compilePropertyGetter(value);
	return (entity) => operatorFunc(getter(entity), test);
};

export const compileConjunction = <Config extends ChimeraFilterConfig, Entity>(
	config: Config,
	{ kind, operations }: ChimeraConjunctionDescriptor<Config, Entity>,
): ChimeraFilterChecker<Entity> => {
	const conjunction = chimeraFilterConjunctions[kind];
	if (!conjunction) throw new ChimeraFilterConjunctionNotFoundError(kind);

	const compiledOperations = operations.map((operation) => {
		switch (operation.type) {
			case ChimeraOperatorSymbol:
				return compileOperator(config, operation);
			case ChimeraConjunctionSymbol:
				return compileConjunction(config, operation);
			default:
				// @ts-expect-error: `operation.type` should always be type `never` here
				throw new ChimeraInternalError(`Invalid filter operation ${operation.type}`);
		}
	});

	return (entity) => conjunction(compiledOperations.map((op) => () => op(entity)));
};

export const simplifyOperator = <Config extends ChimeraFilterConfig, Entity>({
	op,
	value,
	test,
                                                                             }: ChimeraFilterOperatorDescriptor<Config, Entity>): ChimeraSimplifiedOperator<Config> => ({
	key: simplifyPropertyGetter(value),
	op,
	test,
	type: ChimeraOperatorSymbol,
});

const compareSimplifiedOperator = <Config extends ChimeraFilterConfig>(
	a: ChimeraSimplifiedOperator<Config>,
	b: ChimeraSimplifiedOperator<Config>,
): number =>
	a.key.localeCompare(b.key) ||
	a.op.localeCompare(b.op) ||
	JSON.stringify(a.test).localeCompare(JSON.stringify(b.test));

const compareSimplifiedOperation = <Config extends ChimeraFilterConfig>(
	a: ChimeraSimplifiedOperator<Config> | SimplifiedConjunction<Config>,
	b: ChimeraSimplifiedOperator<Config> | SimplifiedConjunction<Config>,
): number => {
	if (a.type !== b.type) return a.type === ChimeraOperatorSymbol ? -1 : 1;
	if (a.type === ChimeraOperatorSymbol && b.type === ChimeraOperatorSymbol) return compareSimplifiedOperator(a, b);
	if (a.type === ChimeraConjunctionSymbol && b.type === ChimeraConjunctionSymbol)
		return compareSimplifiedConjunction(a, b);
	return 0;
};

const compareSimplifiedConjunction = <Config extends ChimeraFilterConfig>(
	a: SimplifiedConjunction<Config>,
	b: SimplifiedConjunction<Config>,
): number => {
	const kindCompare = a.kind.localeCompare((b as SimplifiedConjunction).kind);
	if (kindCompare !== 0) return kindCompare;

	const aOps = a.operations;
	const bOps = (b as SimplifiedConjunction).operations;
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

export const simplifyConjunction = <Config extends ChimeraFilterConfig, Entity>({
	kind,
	operations,
                                                                                }: ChimeraConjunctionDescriptor<Config, Entity>): SimplifiedConjunction<Config> => {
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
			.sort((a, b) => compareSimplifiedOperation(a, b)),
		type: ChimeraConjunctionSymbol,
	};
};

export const chimeraCreateOperator = <
	Entity,
	Config extends ChimeraFilterConfig,
	Op extends keyof Config["operators"] & string,
>(
	op: Op,
	value:
		| ChimeraPropertyGetter<Entity, Parameters<Config["operators"][Op]>[0]>
		| (KeysOfType<Entity, Parameters<Config["operators"][Op]>[0]> & string),
	test: Parameters<Config["operators"][Op]>[1],
): ChimeraFilterOperatorDescriptor<Config, Entity, Op> => ({
	op,
	test,
	type: ChimeraOperatorSymbol,
	value: (typeof value === "string"
		? {
				get: value,
				key: value,
			}
		: value) as ChimeraPropertyGetter<Entity, Parameters<Config["operators"][Op]>[0]>,
});

export const chimeraCreateConjunction = <
	Entity,
	Config extends ChimeraFilterConfig,
	Conj extends ChimeraConjunctionType = ChimeraConjunctionType,
>(
	kind: Conj,
	operations: ChimeraConjunctionOperation<Config, Entity>[],
): ChimeraConjunctionDescriptor<Config, Entity, Conj> => ({
	kind,
	operations,
	type: ChimeraConjunctionSymbol,
});

export const compileFilter = <Entity, Config extends ChimeraFilterConfig = ChimeraFilterConfig>(
	config: Config,
	descriptor?: ChimeraFilterDescriptor<Config, Entity>,
): ChimeraFilterChecker<Entity> => (descriptor ? compileConjunction(config, descriptor) : () => true);

export const simplifyFilter = <Entity, Config extends ChimeraFilterConfig = ChimeraFilterConfig>(
	descriptor?: ChimeraFilterDescriptor<Config, Entity> | null,
): ChimeraSimplifiedFilter<Config> => (descriptor ? simplifyConjunction(descriptor) : null);

const isOperationSubset = <Config extends ChimeraFilterConfig>(
	candidateOp: ChimeraSimplifiedOperator<Config> | SimplifiedConjunction<Config>,
	targetOp: ChimeraSimplifiedOperator<Config> | SimplifiedConjunction<Config>,
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

const isConjunctionSubset = <Config extends ChimeraFilterConfig>(
	candidate: SimplifiedConjunction<Config>,
	target: SimplifiedConjunction<Config>,
	getOperatorKey: ChimeraKeyFromOperatorGetter,
): boolean => {
	if (candidate.kind !== target.kind) return false;

	if (candidate.kind === "and") {
		// Each candidate operation must be a part of the target operations
		return candidate.operations.every((candidateOp) =>
			target.operations.some((targetOp) => isOperationSubset(candidateOp, targetOp, getOperatorKey)),
		);
	}

	if (candidate.kind === "or") {
		// Each target operation must be a part of the candidate operations
		return target.operations.every((targetOp) =>
			candidate.operations.some((candidateOp) => isOperationSubset(candidateOp, targetOp, getOperatorKey)),
		);
	}

	return false;
};

export const isFilterSubset = <Config extends ChimeraFilterConfig>(
	candidate: ChimeraSimplifiedFilter<Config>,
	target: ChimeraSimplifiedFilter<Config>,
	getOperatorKey: ChimeraKeyFromOperatorGetter,
): boolean => {
	// If a candidate is null, it's always a subset (matches everything)
	if (candidate === null) return true;
	// If the target is null but a candidate is not, a candidate is never a subset
	if (target === null) return false;

	return isConjunctionSubset(candidate, target, getOperatorKey);
};
