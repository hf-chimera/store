import type {
	AnyChimeraCollectionQuery,
	AnyChimeraEntityStore,
	AnyChimeraItemQuery,
	ChimeraEventEmitterEventNames,
} from "@hf-chimera/store";

export const CHIMERA_ENTITY_STORE_UPDATE_EVENTS = [
	"initialized",
	"updated",
	"itemAdded",
	"itemUpdated",
	"deleted",
	"itemDeleted",
] as const satisfies ChimeraEventEmitterEventNames<AnyChimeraEntityStore>[];

export const CHIMERA_COLLECTION_UPDATE_EVENTS = [
	"ready",
	"updated",
	"selfUpdated",
	"selfItemCreated",
	"itemAdded",
	"itemUpdated",
	"selfItemUpdated",
	"itemDeleted",
	"selfItemDeleted",
	"error",
] as const satisfies ChimeraEventEmitterEventNames<AnyChimeraCollectionQuery>[];

export const CHIMERA_ITEM_UPDATE_EVENTS = [
	"initialized",
	"selfCreated",
	"ready",
	"updated",
	"selfUpdated",
	"deleted",
	"selfDeleted",
	"error",
] as const satisfies ChimeraEventEmitterEventNames<AnyChimeraItemQuery>[];
