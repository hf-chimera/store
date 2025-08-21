export class ChimeraError extends Error {
}

export class ChimeraInternalError extends ChimeraError {
	constructor(message: string, options?: ErrorOptions) {
		super(
			`${message}\nIf you have this bug, feel free to create an issue in https://github.com/hf-chimera/store/issues`,
			options,
		);
	}
}
