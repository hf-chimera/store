import { ChimeraError } from "../shared/errors.ts";

export class ChimeraFilterError extends ChimeraError {
}

export class ChimeraFilterOperatorError extends ChimeraFilterError {
	constructor(operator: string, message: string) {
		super(`Operator "${operator}" ${message}`);
	}
}

export class ChimeraFilterOperatorNotFoundError extends ChimeraFilterOperatorError {
	constructor(operator: string) {
		super(operator, "not found");
	}
}

export class ChimeraFilterConjunctionError extends ChimeraFilterError {
	constructor(conjunction: string, message: string) {
		super(`Conjunction "${conjunction}" ${message}`);
	}
}

export class ChimeraFilterConjunctionNotFoundError extends ChimeraFilterOperatorError {
	constructor(conjunction: string) {
		super(conjunction, "not found");
	}
}
