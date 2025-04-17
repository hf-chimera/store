import { ChimeraQueryFetchingState } from "./types.ts";

export const ChimeraSetOneSym = Symbol("ChimeraSetOneSym");
export const ChimeraSetManySym = Symbol("ChimeraSetManySym");
export const ChimeraDeleteOneSym = Symbol("ChimeraDeleteOneSym");
export const ChimeraDeleteManySym = Symbol("ChimeraDeleteManySym");
export const ChimeraUpdateMixedSym = Symbol("ChimeraUpdateMixedSym");

export const IN_PROGRESS_STATES = [
	ChimeraQueryFetchingState.Scheduled,
	ChimeraQueryFetchingState.Creating,
	ChimeraQueryFetchingState.Fetching,
	ChimeraQueryFetchingState.Refetching,
	ChimeraQueryFetchingState.Updating,
	ChimeraQueryFetchingState.Deleting,
];
