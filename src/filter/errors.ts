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
