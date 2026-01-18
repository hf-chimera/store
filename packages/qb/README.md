# ChimeraQueryBuilder

A type-safe query builder for constructing filters and ordering rules for Chimera Store collections. `ChimeraQueryBuilder` provides a fluent API for building complex queries with support for filtering, ordering, and nested grouping.

## Features

- **Type-Safe**: Full TypeScript support with automatic type inference
- **Fluent API**: Chainable methods for building queries
- **Complex Filtering**: Support for operators, negations, and grouped conditions
- **Ordering**: Flexible sorting with null handling options
- **Nested Groups**: Create complex logical groupings with AND/OR/NOT

## Installation

```bash
# Install both the core store and query builder
npm install @hf-chimera/store @hf-chimera/query-builder

# Or with yarn
yarn add @hf-chimera/store @hf-chimera/query-builder

# Or with pnpm
pnpm add @hf-chimera/store @hf-chimera/query-builder
```

## Setting Up Your Store

Before using `ChimeraQueryBuilder`, you need to create entity stores. Here's a complete example:

```typescript
import { createChimeraEntityStore } from "@hf-chimera/store";

// Define your entity types
type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string;
  createdAt: Date;
};

type Order = {
  id: number;
  customerId: number;
  productName: string;
  quantity: number;
  totalAmount: number;
  status: "pending" | "completed" | "cancelled";
  createdAt: Date;
};

// Create entity stores
export const customerStore = createChimeraEntityStore<"customer", Customer>({
  name: "customer",
  idGetter: "id",
  async collectionFetcher(params, requestParams) {
    const response = await fetch(`/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filter: params.filter, order: params.order }),
      signal: requestParams.signal,
    });
    return { data: await response.json() };
  },
  async itemCreator(item, requestParams) {
    const response = await fetch(`/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
      signal: requestParams.signal,
    });
    return { data: await response.json() };
  },
  async itemUpdater(item, requestParams) {
    const response = await fetch(`/api/customers/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
      signal: requestParams.signal,
    });
    return { data: await response.json() };
  },
  async itemDeleter(id, requestParams) {
    await fetch(`/api/customers/${id}`, {
      method: "DELETE",
      signal: requestParams.signal,
    });
    return { result: { id, success: true } };
  },
  async itemFetcher(params, requestParams) {
    const response = await fetch(`/api/customers/${params.id}`, {
      signal: requestParams.signal,
    });
    return { data: await response.json() };
  },
});

export const orderStore = createChimeraEntityStore<"order", Order>({
  name: "order",
  idGetter: "id",
  // ... similar CRUD operations
});
```

## Basic Usage

```typescript
import { ChimeraQueryBuilder } from "@hf-chimera/query-builder";
import { customerStore } from "./store";

// Create a query builder instance
const query = new ChimeraQueryBuilder<typeof customerStore, Customer, any>();

// Build a simple query
query
  .where("name", "eq", "John")
  .where("age", "gte", 18)
  .orderBy("createdAt", true); // true = descending

// Build the query descriptor
const descriptor = query.build();
// Returns: { filter: {...}, order: [...] }

// Use with entity store
const customers = customerStore.getCollection(descriptor);
```

## API Reference

### `orderBy(key, desc?, nulls?)`

Adds an ordering rule to the query.

**Parameters:**

- `key`: `ChimeraPropertyGetter<Entity> | (keyof Entity & string)` - The property to order by (can be a property name string or a property getter function)
- `desc`: `boolean` (default: `false`) - Whether to sort in descending order
- `nulls`: `ChimeraOrderNulls` (default: `ChimeraOrderNulls.Last`) - How to handle null values (`Last` or `First`)

**Returns:** `this` - Returns the builder instance for chaining

**Example:**

```typescript
query
  .orderBy("name") // Ascending
  .orderBy("age", true) // Descending
  .orderBy("createdAt", false, ChimeraOrderNulls.First); // Nulls first
```

### `where(value, op, test)`

Adds a filter condition to the query. Multiple `where` calls are combined with AND logic by default.

**Parameters:**

- `value`: `ChimeraPropertyGetter<Entity> | (KeysOfType<Entity, T> & string)` - The property to filter on (property name or getter function)
- `op`: `Op extends keyof OperatorsMap & string` - The operator to use (e.g., `'eq'`, `'gte'`, `'in'`, etc.)
- `test`: `Parameters<OperatorsMap[Op]>[1]` - The value to compare against (type depends on the operator)

**Returns:** `this` - Returns the builder instance for chaining

**Example:**

```typescript
query
  .where("status", "eq", "active")
  .where("age", "gte", 18)
  .where("tags", "in", ["javascript", "typescript"]);
```

### `whereNot(value, op, test)`

Adds a negated filter condition (NOT condition) to the query.

**Parameters:**

- `value`: Same as `where()`
- `op`: Same as `where()`
- `test`: Same as `where()`

**Returns:** `this` - Returns the builder instance for chaining

**Example:**

```typescript
query.where("status", "eq", "active").whereNot("deleted", "eq", true); // NOT deleted = true
```

### `group(conjunction, builder)`

Creates a grouped condition with a specified logical conjunction. Useful for creating complex logical expressions with AND, OR, or NOT groups.

**Parameters:**

- `conjunction`: `ChimeraConjunctionType` - The logical operator: `'and'`, `'or'`, or `'not'`
- `builder`: `QueryBuilderCreator<Store, Entity, OperatorsMap>` - A callback function that receives a new builder instance for building the nested query

**Returns:** `this` - Returns the builder instance for chaining

**Example:**

```typescript
// Create an OR group: (status = 'active' OR status = 'pending')
query.group("or", (q) => {
  q.where("status", "eq", "active").where("status", "eq", "pending");
});

// Create a NOT group: NOT (age < 18 OR deleted = true)
query.group("not", (q) => {
  q.group("or", (nested) => {
    nested.where("age", "lt", 18).where("deleted", "eq", true);
  });
});
```

### `build()`

Builds and returns the final query descriptor object.

**Returns:**

```typescript
{
  filter: ChimeraFilterDescriptor<OperatorsMap, Entity> | null;
  order: (ChimeraOrderDescriptor < Entity > []) | null;
}
```

- `filter`: The filter descriptor, or `null` if no filters were added
- `order`: An array of order descriptors, or `null` if no ordering was specified

**Example:**

```typescript
const { filter, order } = query.build();

// Use with store
const collection = store.from("customer").getCollection({ filter, order });
```

## Examples

_Note: The following examples use generic type parameters like `Store`, `User`, and `OperatorsMap`. See [Setting Up Your Store](#setting-up-your-store) section above for a complete store setup example._

### Simple Filtering

```typescript
const query = new ChimeraQueryBuilder<Store, User, OperatorsMap>();

query
  .where("email", "eq", "user@example.com")
  .where("active", "eq", true)
  .orderBy("createdAt", true);

const { filter, order } = query.build();
```

### Complex Logical Groups

```typescript
const query = new ChimeraQueryBuilder<Store, Post, OperatorsMap>();

query
  // Main AND condition
  .where("published", "eq", true)
  .where("createdAt", "gte", new Date("2024-01-01"))

  // OR group: (authorId = '123' OR authorId = '456')
  .group("or", (q) => {
    q.where("authorId", "eq", "123").where("authorId", "eq", "456");
  })

  // NOT group: NOT (tags contains 'draft')
  .group("not", (q) => {
    q.where("tags", "contains", "draft");
  })

  .orderBy("createdAt", true)
  .orderBy("title"); // Secondary sort

const { filter, order } = query.build();
```

### Multiple Order Rules

```typescript
const query = new ChimeraQueryBuilder<Store, Product, OperatorsMap>();

query
  .where("inStock", "eq", true)
  .orderBy("category") // Primary sort: category ascending
  .orderBy("price", false) // Secondary sort: price ascending
  .orderBy("rating", true) // Tertiary sort: rating descending
  .orderBy("name"); // Final sort: name ascending

const { filter, order } = query.build();
```

### Combining whereNot and Groups

```typescript
const query = new ChimeraQueryBuilder<Store, Article, OperatorsMap>();

query
  .where("published", "eq", true)
  .whereNot("archived", "eq", true)

  // Either in featured category OR has high views
  .group("or", (q) => {
    q.where("category", "eq", "featured").where("views", "gte", 1000);
  })

  // But NOT in any of these tags
  .group("not", (q) => {
    q.where("tags", "in", ["spam", "deprecated"]);
  })

  .orderBy("publishedAt", true);

const { filter, order } = query.build();
```

### Empty Query

```typescript
const query = new ChimeraQueryBuilder<Store, Entity, OperatorsMap>();

// Build without any filters or ordering
const { filter, order } = query.build();
// filter: null
// order: null
```

### Chaining Pattern

All methods return `this`, allowing you to chain operations:

```typescript
const query = new ChimeraQueryBuilder<Store, User, OperatorsMap>()
  .where("active", "eq", true)
  .where("role", "in", ["admin", "moderator"])
  .group("or", (q) => {
    q.where("age", "gte", 18).where("verified", "eq", true);
  })
  .orderBy("lastActive", true)
  .orderBy("name");

const descriptor = query.build();
```

## Type Safety

The `ChimeraQueryBuilder` is fully type-safe. It ensures:

- Property names must exist on the entity type
- Operator names must exist in the `OperatorsMap`
- Test values match the expected types for each operator
- Property getters are correctly typed

```typescript
type User = {
  id: string;
  name: string;
  age: number;
  email: string;
};

type OperatorsMap = {
  eq: (value: any) => boolean;
  gte: (value: number) => boolean;
  in: (value: any[]) => boolean;
};

const query = new ChimeraQueryBuilder<Store, User, OperatorsMap>();

// ✅ Valid
query.where("name", "eq", "John");
query.where("age", "gte", 18);
query.where("id", "in", ["1", "2", "3"]);

// ❌ TypeScript errors
query.where("invalidProperty", "eq", "value"); // Property doesn't exist
query.where("age", "invalidOp", 18); // Operator doesn't exist
query.where("age", "eq", "not a number"); // Wrong type for operator
```

## Integration

### With Repository

```typescript
const query = new ChimeraQueryBuilder<typeof store, User, OperatorsMap>()
  .where("active", "eq", true)
  .orderBy("createdAt", true);

// Use with entity store
const users = userStore.getCollection(query.build());
```

## Notes

- Multiple `where()` calls are combined with **AND** logic by default
- Use `group('or', ...)` to create OR conditions
- Use `group('not', ...)` or `whereNot()` for negations
- Order rules are applied in the sequence they're added (first = primary sort)
- An empty query builder will return `{ filter: null, order: null }`
