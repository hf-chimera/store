import { ChimeraError } from "../shared/errors.ts";

export class ChimeraOrderError extends ChimeraError {
}

export class ChimeraOrderTypeError extends ChimeraOrderError {
}

export class ChimeraOrderTypeComparisonError extends ChimeraOrderTypeError {
	constructor(a: unknown, b: unknown) {
		super(
			`Unsupported comparison "${a}"(${typeof a}[${a != null ? a.constructor.name : a}]) with "${b}"(${typeof b}[${b != null ? b.constructor.name : b}])`,
		);
	}
}
