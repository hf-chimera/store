export type FilterOperator =
	| "contains"
	| "endsWith"
	| "eq"
	| "gt"
	| "gte"
	| "in"
	| "lt"
	| "lte"
	| "neq"
	| "notIn"
	| "startsWith";

export interface FieldFilter {
	field: string;
	op: FilterOperator;
	value: any;
	and?: never;
	or?: never;
	not?: never;
}

export interface AndFilter {
	and: Filter[];
	or?: never;
	not?: never;
}

export interface OrFilter {
	or: Filter[];
	and?: never;
	not?: never;
}

export interface NotFilter {
	not: Filter;
	and?: never;
	or?: never;
}

export type Filter = FieldFilter | AndFilter | OrFilter | NotFilter;

export interface OrderRule {
	field: string;
	desc?: boolean;
	nulls?: "first" | "last";
}

export type ApiOrder = OrderRule[];

export interface WhereClause {
	clause: string;
	values: (null | number | bigint | string)[];
}

export interface Customer {
	id: number;
	name: string;
	email: string;
	phone: string;
	createdAt?: string;
}

export interface Order {
	id: number;
	customerId: number;
	productName: string;
	quantity: number;
	totalAmount: number;
	status: string;
	createdAt?: string;
}

export type Event = {
	entityType: string;
	timestamp: number;
} & (
	| {
			operation: "create" | "update";
			entity?: any;
	  }
	| {
			operation: "delete";
			id: number;
	  }
);
