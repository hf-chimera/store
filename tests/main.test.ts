import { ChimeraStore } from "../src";
import { type TestEntityMap, TestEntityName } from "./stubs/types";

const store = new ChimeraStore<TestEntityMap>({
	query: {
		defaults: {
			idGetter: "id",
		},
		entities: {
			[TestEntityName.Post]: {},
			[TestEntityName.Comment]: {},
			[TestEntityName.Album]: {},
			[TestEntityName.Photo]: {},
			[TestEntityName.Todo]: {},
			[TestEntityName.User]: {},
		},
	}
});

store;
