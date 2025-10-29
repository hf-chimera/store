import type { ChimeraSimplifiedOrderDescriptor } from "../../../../src";
import { ChimeraConjunctionSymbol, ChimeraOperatorSymbol } from "../../../../src/filter/constants";
import type { chimeraDefaultFilterOperators } from "../../../../src/filter/defaults";
import type { ChimeraSimplifiedFilter, ChimeraSimplifiedOperator } from "../../../../src/filter/types";
import type { FieldFilter, Filter } from "../../server/types";

// Configuration
const API_BASE = "http://localhost:3000";
const EVENT_BASE = "http://localhost:3001";

const entityEndpointMap = {
	order: "orders",
	customer: "customers",
} as const;

export const endpointEntityMap = {
	orders: "order",
	customers: "customer",
} as const;

type OperatorMap = typeof chimeraDefaultFilterOperators;

/**
 * Transform Chimera filter to unified filter format
 */
export function transformChimeraFilterToUnified(
	node: ChimeraSimplifiedFilter<OperatorMap> | ChimeraSimplifiedOperator<OperatorMap>,
): Filter {
	if (!node || typeof node !== "object") {
		throw new Error("Invalid Chimera filter node");
	}

	// Operator node
	if ("type" in node && node.type === ChimeraOperatorSymbol) {
		return {
			field: node.key,
			op: node.op as FieldFilter["op"],
			value: node.test,
		};
	}

	// Conjunction node
	if ("type" in node && node.type === ChimeraConjunctionSymbol) {
		const transformed = node.operations.map(transformChimeraFilterToUnified);

		switch (node.kind) {
			case "and":
				return { and: transformed };
			case "or":
				return { or: transformed };
			case "not":
				if (transformed.length !== 1) {
					throw new Error("NOT conjunction must have exactly one operation");
				}
				return { not: transformed[0] as Filter };
		}
	}

	throw new Error("Unknown Chimera filter node type");
}

/**
 * Helper to make HTTP requests using fetch
 */
async function makeRequest(url: string, method: string, data?: any): Promise<any> {
	const options: RequestInit = {
		method,
		headers: {
			"Content-Type": "application/json",
		},
	};

	if (data) {
		options.body = JSON.stringify(data);
	}

	const res = await fetch(url, options);

	if (res.status === 204) return null;
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`HTTP ${res.status}: ${text}`);
	}

	const text = await res.text();
	return text ? JSON.parse(text) : null;
}

/**
 * CRUD Functions
 */
export async function getAll(
	entity: string,
	filter: ChimeraSimplifiedFilter<OperatorMap> | null,
	order: ChimeraSimplifiedOrderDescriptor[] | null,
): Promise<any[]> {
	const query: string[] = [];
	if (filter) query.push(`filter=${encodeURIComponent(JSON.stringify(transformChimeraFilterToUnified(filter)))}`);
	if (order) query.push(`order=${encodeURIComponent(JSON.stringify(order))}`);

	const url = `${API_BASE}/${entityEndpointMap[entity as keyof typeof entityEndpointMap]}${query.length ? `?${query.join("&")}` : ""}`;
	return makeRequest(url, "GET");
}

export async function getById(entity: string, id: number | string): Promise<any> {
	return makeRequest(`${API_BASE}/${entityEndpointMap[entity as keyof typeof entityEndpointMap]}/${id}`, "GET");
}

export async function create(entity: string, data: any): Promise<any> {
	return makeRequest(`${API_BASE}/${entityEndpointMap[entity as keyof typeof entityEndpointMap]}`, "POST", data);
}

export async function update(entity: string, id: number | string, data: any): Promise<any> {
	return makeRequest(`${API_BASE}/${entityEndpointMap[entity as keyof typeof entityEndpointMap]}/${id}`, "PUT", data);
}

export async function remove(entity: string, id: number | string): Promise<void> {
	return makeRequest(`${API_BASE}/${entityEndpointMap[entity as keyof typeof entityEndpointMap]}/${id}`, "DELETE");
}

/**
 * Event Stream Subscription (Server-Sent Events)
 */
export function subscribeToEvents(onEvent: (event: any) => void): () => void {
	const eventSource = new EventSource(`${EVENT_BASE}/events/stream`);

	eventSource.onmessage = (event) => {
		try {
			const data = JSON.parse(event.data);
			onEvent(data);
		} catch (e) {
			console.error("Failed to parse event:", e);
		}
	};

	eventSource.onerror = (err) => {
		console.error("Event stream error:", err);
	};

	// Return unsubscribe function
	return () => {
		eventSource.close();
	};
}
