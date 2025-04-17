import type { ChimeraEntityMap } from "../shared/types.ts";
import { ChimeraQueryNotSpecifiedError } from "./errors.ts";
import type { ChimeraQueryConfig } from "./types.ts";

export const chimeraDefaultQueryConfig = {
	defaults: {
		trustQuery: true,
		updateDebounceTimeout: 0,

		idGetter: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "idGetter");
		},

		collectionFetcher: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "collectionFetcher");
		},
		itemFetcher: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "itemFetcher");
		},

		itemUpdater: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "itemUpdater");
		},
		batchedUpdater: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "batchedUpdater");
		},

		itemDeleter: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "itemDeleter");
		},
		batchedDeleter: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "batchedDeleter");
		},

		itemCreator: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "itemCreator");
		},
		batchedCreator: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "batchedCreator");
		},
	},
	entities: {},
} satisfies ChimeraQueryConfig<ChimeraEntityMap>;
