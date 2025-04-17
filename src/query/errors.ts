import { ChimeraError } from "../shared/errors.ts";
import type { ChimeraEntityId } from "../shared/types.ts";
import type { ChimeraQueryFetchingState } from "./types.ts";

export class ChimeraQueryError extends ChimeraError {
	readonly entityName: string;

	constructor(entityName: string, message: string) {
		super(message);
		this.entityName = entityName;
	}
}

export class ChimeraQueryIdMismatchError extends ChimeraQueryError {
	readonly old: ChimeraEntityId;
	readonly new: ChimeraEntityId;

	constructor(entityName: string, oldId: ChimeraEntityId, newId: ChimeraEntityId) {
		super(
			entityName,
			`
Can't update "${entityName}" item if the change updates it's [id] (changed from "${oldId}" to "${newId}").
If such an update should not be an error, update <idGetter> field in "${entityName}" entity config to make Chimera get the [id] value properly.
		`.trim(),
		);
		this.old = oldId;
		this.new = newId;
	}
}

export class ChimeraQueryNotSpecifiedError extends ChimeraQueryError {
	readonly methodName: string;

	constructor(entityName: string, methodName: string) {
		super(entityName, `<${methodName}> for entity "${entityName}" was not specified`);
		this.methodName = methodName;
	}
}

export class ChimeraQueryTrustError extends ChimeraQueryError {
	constructor(entityName: string, description: string) {
		super(
			entityName,
			`
DO NOT IGNORE THIS ERROR OR YOUR PROD MAY BREAK!

Looks like your "${entityName}" query provider ${description}

By default Chimera tend to trust external query provider to avoid extra data processing.
If it is not your case, set field "trustQuery" to "false" in config defaults or for specific entity.
This error visible only if "devMode" is "true".
If you'll ignore it, your production may fail, because Chimera won't check the data correctness.
`.trim(),
		);
	}
}

export class ChimeraQueryTrustIdMismatchError extends ChimeraQueryTrustError {
	readonly old: ChimeraEntityId;
	readonly new: ChimeraEntityId;

	constructor(entityName: string, oldId: ChimeraEntityId, newId: ChimeraEntityId) {
		super(
			entityName,
			`
returned an item with [id] that not matches with the [id] of item that was updated (changed from "${oldId}" to "${newId}"). 
If it is not an error, update <idGetter> field in "${entityName}" entity config to make Chimera get the [id] value properly.
`.trim(),
		);
		this.old = oldId;
		this.new = newId;
	}
}

export class ChimeraQueryTrustFetchedCollectionError extends ChimeraQueryTrustError {
	readonly old: unknown[];
	readonly new: unknown[];

	constructor(entityName: string, input: unknown[], output: unknown[]) {
		super(entityName, "returned not properly sorted or ordered collection.");
		this.old = input;
		this.new = output;
	}
}

export class ChimeraQueryFetchingError extends ChimeraQueryError {
	constructor(entityName: string, cause: unknown) {
		super(entityName, `Something went wrong: ${cause}.`);
		this.cause = cause;
	}
}

export class ChimeraQueryDeletingError extends ChimeraQueryError {
	constructor(entityName: string, cause: unknown) {
		super(entityName, `Something went wrong: ${cause}.`);
		this.cause = cause;
	}
}

export class ChimeraQueryNotReadyError extends ChimeraQueryError {
	constructor(entityName: string) {
		super(entityName, "Unable to get unready value.");
	}
}

export class ChimeraQueryDeletedItemError extends ChimeraQueryError {
	constructor(entityName: string, id: ChimeraEntityId) {
		super(entityName, `Unable to updated deleted item with [id] "${id}."`);
	}
}

export class ChimeraQueryUnsuccessfulDeletionError extends ChimeraQueryError {
	constructor(entityName: string, id: ChimeraEntityId) {
		super(entityName, `Item with [id] "${id}" was not deleted.`);
	}
}

export class ChimeraQueryAlreadyRunningError extends ChimeraQueryError {
	constructor(entityName: string, status: ChimeraQueryFetchingState) {
		super(entityName, `Unable to operate query. Other process already running ${status}.`);
	}
}

export class ChimeraQueryNotCreatedError extends ChimeraQueryError {
	constructor(entityName: string) {
		super(entityName, "Unable to operate not created item.");
	}
}
