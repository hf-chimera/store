import type { chimeraDefaultFilterOperators } from "../filter/defaults";
import type { ChimeraQueryEntityConfig } from "./types.ts";

const throwNotImplemented = (method: string) =>
	function () {
		throw new Error(`${method} not implemented for entity "${arguments[arguments.length - 1]}"`);
	};

export const chimeraDefaultQueryEntityConfig = {
	trustQuery: true,
	updateDebounceTimeout: 0,
	collectionFetcher: throwNotImplemented("collectionFetcher"),
	itemFetcher: throwNotImplemented("itemFetcher"),
	itemUpdater: throwNotImplemented("itemUpdater"),
	batchedUpdater: throwNotImplemented("batchedUpdater"),
	itemDeleter: throwNotImplemented("itemDeleter"),
	batchedDeleter: throwNotImplemented("batchedDeleter"),
	itemCreator: throwNotImplemented("itemCreator"),
	batchedCreator: throwNotImplemented("batchedCreator"),
} satisfies Omit<
	Required<ChimeraQueryEntityConfig<string, object, typeof chimeraDefaultFilterOperators>>,
	"idGetter" | "name"
>;
