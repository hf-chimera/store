import type { ChimeraEntityMap } from "../shared/types.ts";
import { ChimeraQueryNotSpecifiedError } from "./errors.ts";
import type { ChimeraQueryConfig, ChimeraQueryDefaultsConfig } from "./types.ts";

export const chimeraDefaultQueryConfig = {
	defaults: {
		batchedCreator: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "batchedCreator");
		},
		batchedDeleter: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "batchedDeleter");
		},
		batchedUpdater: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "batchedUpdater");
		},

		collectionFetcher: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "collectionFetcher");
		},

		idGetter: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "idGetter");
		},

		itemCreator: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "itemCreator");
		},

		itemDeleter: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "itemDeleter");
		},
		itemFetcher: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "itemFetcher");
		},

		itemUpdater: (entity: string) => {
			throw new ChimeraQueryNotSpecifiedError(entity, "itemUpdater");
		},
		trustQuery: true,
		updateDebounceTimeout: 0,
	} as Required<ChimeraQueryDefaultsConfig<ChimeraEntityMap>>,
	entities: {},
} satisfies ChimeraQueryConfig<ChimeraEntityMap>;
