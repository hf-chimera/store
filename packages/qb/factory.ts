import type { AnyChimeraEntityStore } from "@hf-chimera/store";
import { DefaultChimeraQueryBuilder } from "./DefaultChimeraQueryBuilder";

export function createDefaultQueryBuilder<TStore extends AnyChimeraEntityStore>(): DefaultChimeraQueryBuilder<TStore> {
	return new DefaultChimeraQueryBuilder<TStore>();
}
