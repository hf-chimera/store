import {
	type ChimeraDefaultFetcher,
	type ChimeraDefaultMutator
} from "../src/config";
import { ChimeraStore } from "../src";
import { type TestEntityMap, TestEntityName } from "./stubs/types";

const store = new ChimeraStore<TestEntityMap>({
	defaults: {
		idGetter: "id",
		fetcher: (() => {
		}) as unknown as ChimeraDefaultFetcher<TestEntityMap>,
		mutator: (() => {
		}) as unknown as ChimeraDefaultMutator<TestEntityMap>,
	},
	entities: {
		[TestEntityName.Post]: {},
		[TestEntityName.Comment]: {},
		[TestEntityName.Album]: {},
		[TestEntityName.Photo]: {},
		[TestEntityName.Todo]: {},
		[TestEntityName.User]: {},
	},
});

store;
