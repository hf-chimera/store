import { EventEmitter } from "eventemitter3";
import type { ChimeraEntityMap } from "../shared/types.ts";
import type { ChimeraStoreConfig } from "./types.ts";

type ChimeraStoreEventMap = {
	"": []; // TODO: add events
};

export class ChimeraStore<
	EntityMap extends ChimeraEntityMap,
	Config extends ChimeraStoreConfig<EntityMap> = ChimeraStoreConfig<EntityMap>,
> extends EventEmitter<ChimeraStoreEventMap> {
	readonly #config: object;
	readonly #userConfig: Config;

	constructor(userConfig: Config) {
		super();
		this.#userConfig = userConfig;
		this.#config = {};

		console.info({userConfig: this.#userConfig, config: this.#config});
	}
}
