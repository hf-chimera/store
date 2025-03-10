import { EventEmitter } from "eventemitter3";
import type { ChimeraEntityMap, ChimeraStoreConfig } from "./config.ts";

type ChimeraStoreEventMap = {
	"": []; // TODO: add events
};

export class ChimeraStore<
	EntityMap extends ChimeraEntityMap,
	Config extends ChimeraStoreConfig<EntityMap> = ChimeraStoreConfig<EntityMap>,
> extends EventEmitter<ChimeraStoreEventMap> {
	readonly #config: object;
	readonly #userConfig: Config;

	compileConfig() {
	}

	constructor(userConfig: Config) {
		super();
		this.#userConfig = userConfig;
		this.#config = {};

		console.info({userConfig: this.#userConfig, config: this.#config});
	}
}
