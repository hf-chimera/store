import http from "node:http";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { IncomingMessage, ServerResponse } from "http";
import type { ApiOrder, Event, Filter, WhereClause } from "./types";

interface EntityConfig {
	table: string;
	fields: string[];
}

// Database setup
let db: DatabaseSync;
const events: Event[] = [];
const connections = new Map<string, number>();

// Clear already read events
setInterval(() => {
	const min = Math.min(...connections.values());
	const firstElem = events.findIndex((e) => e.timestamp > min);
	if (firstElem === -1) return;
	events.splice(0, firstElem);
}, 1000);

// Entity configurations
const entities: Record<string, EntityConfig> = {
	customers: {
		table: "customers",
		fields: ["name", "email", "phone"],
	},
	orders: {
		table: "orders",
		fields: ["customerId", "productName", "quantity", "totalAmount", "status"],
	},
};

function buildWhereClause(filter?: Filter | null): WhereClause | null {
	if (!filter) return null;

	const values: (null | number | bigint | string)[] = [];

	const parseNode = (node: Filter): string => {
		if (node.and) return `(${node.and.map(parseNode).join(" AND ")})`;
		if (node.or) return `(${node.or.map(parseNode).join(" OR ")})`;
		if (node.not) return `(NOT ${parseNode(node.not)})`;

		const { field, op, value } = node;
		const col = `"${field}"`;

		switch (op) {
			case "eq":
				values.push(value);
				return `${col} = ?`;
			case "neq":
				values.push(value);
				return `${col} != ?`;
			case "gt":
				values.push(value);
				return `${col} > ?`;
			case "gte":
				values.push(value);
				return `${col} >= ?`;
			case "lt":
				values.push(value);
				return `${col} < ?`;
			case "lte":
				values.push(value);
				return `${col} <= ?`;
			case "contains":
				values.push(`%${value}%`);
				return `${col} LIKE ?`;
			case "startsWith":
				values.push(`${value}%`);
				return `${col} LIKE ?`;
			case "endsWith":
				values.push(`%${value}`);
				return `${col} LIKE ?`;
			case "in":
				values.push(value);
				return `${col} IN (${value.map(() => "?").join(",")})`;
			case "notIn":
				values.push(value);
				return `${col} NOT IN (${value.map(() => "?").join(",")})`;
			default:
				throw new Error(`Unsupported operator: ${op}`);
		}
	};

	const clause = parseNode(filter);
	return { clause, values: values.flat() };
}

function buildOrderClause(order?: ApiOrder | null): string {
	if (!order || !Array.isArray(order) || order.length === 0) return "";

	return order
		.map(({ field, desc, nulls }) => {
			let clause = `"${field}" ${desc ? "DESC" : "ASC"}`;
			if (nulls === "first") clause += " NULLS FIRST";
			if (nulls === "last") clause += " NULLS LAST";
			return clause;
		})
		.join(", ");
}

function initDb() {
	db = new DatabaseSync(path.join(import.meta.dirname, "./database.sqlite"));
	db.exec(`
      CREATE TABLE IF NOT EXISTS customers
      (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          name      TEXT        NOT NULL,
          email     TEXT UNIQUE NOT NULL,
          phone     TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS orders
      (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          customerId  INTEGER NOT NULL,
          productName TEXT    NOT NULL,
          quantity    INTEGER NOT NULL,
          totalAmount REAL    NOT NULL,
          status      TEXT     DEFAULT 'pending',
          createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP
      );
	`);
}

// Event publisher
function publishEvent(event: Event) {
	events.push(event);
	console.info(
		`[EVENT] ${event.entityType} ${event.operation}:`,
		event.operation === "delete" ? event.id : event.entity,
	);
}

// Helper to parse JSON body
async function parseBody(req: http.IncomingMessage): Promise<any> {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk: string) => (body += chunk));
		req.on("end", () => {
			try {
				resolve(body ? JSON.parse(body) : {});
			} catch (e) {
				reject(e);
			}
		});
	});
}

// Helper to send JSON response
function sendJSON(res: http.ServerResponse, data: any, status = 200) {
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
	});
	res.end(JSON.stringify(data));
}

const operations = {
	getAll: ({ filter, order }: { filter?: Filter | null; order?: ApiOrder | null }, config: EntityConfig) => {
		const whereClause = buildWhereClause(filter ?? null);
		const orderClause = buildOrderClause(order ?? null);
		return db
			.prepare(
				`SELECT *FROM ${config.table} ${whereClause ? `WHERE ${whereClause.clause}` : ""} ${orderClause ? `ORDER BY ${orderClause}` : ""}`,
			)
			.all(...(whereClause?.values || []));
	},

	getById: (id: string, config: EntityConfig) => {
		return db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(id);
	},

	create: (data: any, config: EntityConfig) => {
		const result = db
			.prepare(
				`INSERT INTO ${config.table} (${config.fields.join(", ")}) VALUES (${config.fields.map(() => "?").join(", ")})`,
			)
			.run(...config.fields.map((f) => data[f]));
		const entity = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(result.lastInsertRowid);
		publishEvent({ entityType: config.table, operation: "create", entity, timestamp: Date.now() });
		return entity;
	},

	update: (id: string, data: any, config: EntityConfig) => {
		db.prepare(`UPDATE ${config.table} SET ${config.fields.map((f) => `${f} = ?`).join(", ")} WHERE id = ?`).run(
			...config.fields.map((f) => data[f]),
			id,
		);
		const entity = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(id);
		publishEvent({ entityType: config.table, operation: "update", entity, timestamp: Date.now() });
		return entity;
	},

	delete: (id: string, config: EntityConfig) => {
		db.prepare(`DELETE FROM ${config.table} WHERE id = ?`).run(id);
		publishEvent({ entityType: config.table, operation: "delete", timestamp: Date.now(), id: +id });
	},
};

// Generic route handler for CRUD operations
async function handleCrudRoute(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	entityName: string,
	config: EntityConfig,
) {
	const fullUrl = new URL(req.url, "http://localhost"); // base required for Node URL
	const method = req.method || "";

	const listPattern = new RegExp(`^/${entityName}$`);
	const itemPattern = new RegExp(`^/${entityName}/(\\d+)$`);

	try {
		// List all
		if (listPattern.test(fullUrl.pathname) && method === "GET") {
			const filterParam = fullUrl.searchParams.get("filter");
			const orderParam = fullUrl.searchParams.get("order");

			let filter: Filter | null = null;
			if (filterParam) {
				try {
					filter = JSON.parse(decodeURIComponent(filterParam));
				} catch (err) {
					console.warn("Invalid filter param:", err);
					filter = null;
				}
			}

			let order: ApiOrder | null = null;
			if (orderParam) {
				try {
					order = JSON.parse(decodeURIComponent(orderParam));
				} catch (err) {
					console.warn("Invalid order param:", err);
					order = null;
				}
			}

			const items = operations.getAll({ filter, order }, config);
			sendJSON(res, items);
			return true;
		}

		// Create
		if (listPattern.test(fullUrl.pathname) && method === "POST") {
			const body = await parseBody(req);
			const item = operations.create(body, config);
			sendJSON(res, item, 201);
			return true;
		}

		const id = fullUrl.pathname.match(itemPattern)?.[1];
		if (!id) return false;

		// Get by ID
		if (itemPattern.test(fullUrl.pathname) && method === "GET") {
			const item = operations.getById(id, config);
			item ? sendJSON(res, item) : sendJSON(res, { error: "Not found" }, 404);
			return true;
		}

		// Update
		if (itemPattern.test(fullUrl.pathname) && method === "PUT") {
			const body = await parseBody(req);
			const item = operations.update(id, body, config);
			sendJSON(res, item);
			return true;
		}

		// Delete
		if (itemPattern.test(fullUrl.pathname) && method === "DELETE") {
			operations.delete(id, config);
			res.writeHead(204);
			res.end();
			return true;
		}

		return false; // Route handled
	} catch (err) {
		console.error(err);
		sendJSON(res, { error: "Internal server error" }, 500);
		return true;
	}
}

// Main API Server
const apiServer = http.createServer(
	async (
		req: InstanceType<IncomingMessage>,
		res: InstanceType<ServerResponse<InstanceType<IncomingMessage>>> & { req: InstanceType<IncomingMessage> },
	) => {
		// Handle CORS preflight
		if (req.method === "OPTIONS") {
			res.writeHead(204, {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
				"Access-Control-Max-Age": "86400", // cache preflight for 24h
			});
			res.end();
			return;
		}

		// Try to handle the route with each entity
		for (const [entityName, config] of Object.entries(entities)) {
			if (await handleCrudRoute(req, res, entityName, config)) return;
		}

		// No route matched
		sendJSON(res, { error: "Not found" }, 404);
	},
);

// Event Processing Server
const eventServer = http.createServer(
	(
		req: InstanceType<IncomingMessage>,
		res: InstanceType<ServerResponse<InstanceType<IncomingMessage>>> & { req: InstanceType<IncomingMessage> },
	) => {
		// Handle CORS preflight
		if (req.method === "OPTIONS") {
			res.writeHead(204, {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET,OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
				"Access-Control-Max-Age": "86400",
			});
			res.end();
			return;
		}

		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": "*",
		});

		const id = Math.random().toString(36).slice(2);
		connections.set(id, Date.now());
		const interval = setInterval(() => {
			if (events.length > 0) {
				const lastEventTime = connections.get(id) ?? 0;
				for (const event of events)
					if (lastEventTime < event.timestamp) res.write(`data: ${JSON.stringify(event)}\n\n`);
			}
		}, 100);

		req.on("close", () => clearInterval(interval));
	},
);

// Start servers
function start() {
	initDb();

	apiServer.listen(3000, () => {
		console.info("🚀 Main API running on http://localhost:3000");
		console.info("   Available entities:");
		Object.keys(entities).forEach((entity) => {
			console.info(`   GET/POST    /${entity}`);
			console.info(`   GET/PUT/DEL /${entity}/:id`);
		});
	});

	eventServer.listen(3001, () => {
		console.info("📡 Event Service running on http://localhost:3001");
		console.info("   GET /events - View all events");
		console.info("   GET /events/stream - SSE stream");
	});
}

start();
