# ChimeraEntityStore React Integration

This package provides React hooks for seamless integration with ChimeraEntityStore, enabling reactive data management in React applications.

## Features

- **React Hooks**: Custom hooks for managing ChimeraEntityStore queries
- **TypeScript Support**: Full type safety with TypeScript
- **Automatic State Management**: Automatic re-rendering when data changes

## Installation

```bash
# Install both the core store and React adapter
npm install @hf-chimera/store @hf-chimera/react

# React is a peer dependency
npm install react

# Or install all at once
npm install @hf-chimera/store @hf-chimera/react react
```

## Usage

### For React Applications

Import from the React-specific entry point:

```tsx
import { createChimeraHooks } from "@hf-chimera/store/react";
// In your app, call createChimeraHooks(store) and export the returned hooks
```

### For Non-React Applications

Import from the main package:

```ts
import { createChimeraEntityStore } from "@hf-chimera/store";
import { createChimeraStoreHooks } from "@hf-chimera/react";
```

## Quick Start

### 1. Prepare hooks for the store

Use the `createChimeraStoreHooks` function to create hooks for your entity store:

```ts
import { createChimeraStoreHooks } from "@hf-chimera/react";
import { createChimeraEntityStore } from "@hf-chimera/store";

// Define your entity type
type Customer = {
  id: number;
  name: string;
  email: string;
};

// Create your entity store instance
const customerStore = createChimeraEntityStore<"customer", Customer>({
  name: "customer",
  idGetter: "id",
  async collectionFetcher(params, requestParams) {
    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filter: params.filter, order: params.order }),
      signal: requestParams.signal,
    });
    return { data: await response.json() };
  },
  async itemFetcher(params, requestParams) {
    const response = await fetch(`/api/customers/${params.id}`, {
      signal: requestParams.signal,
    });
    return { data: await response.json() };
  },
  // ... other CRUD operations
});

// Create hooks bound to your customer store
// This generates: useChimeraCustomerStore, useChimeraCustomerCollection, useChimeraCustomerItem
export const {
  useChimeraCustomerStore,
  useChimeraCustomerCollection,
  useChimeraCustomerItem,
} = createChimeraStoreHooks(customerStore);
```

### 2. Use Collection Queries

```tsx
import { useChimeraCustomerCollection } from "./store";

function CustomerList() {
  const customers = useChimeraCustomerCollection({
    filter: { status: "active" },
    order: [{ field: "name", direction: "asc" }],
  });

  if (!customers.ready) return <div>Loading...</div>;
  if (customers.lastError)
    return <div>Error: {String(customers.lastError)}</div>;

  return (
    <div>
      {customers.map((customer) => (
        <div key={customer.id}>
          {customer.name}
          <button onClick={() => customers.delete(customer.id)}>Delete</button>
        </div>
      ))}
      <button onClick={() => customers.create({ name: "New Customer" })}>
        Add Customer
      </button>
    </div>
  );
}
```

### 3. Use Item Queries

```tsx
import { useChimeraCustomerItem } from "./store";

function CustomerDetail({ customerId }: { customerId: string }) {
  const customer = useChimeraCustomerItem(customerId);

  if (!customer.ready) return <div>Loading...</div>;
  if (customer.lastError) return <div>Error: {String(customer.lastError)}</div>;
  if (!customer.data) return <div>Customer not found</div>;

  const handleUpdate = () => {
    customer.mutable.name = "Updated Name";
    customer.commit();
  };

  return (
    <div>
      <h3>{customer.data.name}</h3>
      <button onClick={handleUpdate}>Update Name</button>
    </div>
  );
}
```

### 4. Using with Query Builder

You can use the `ChimeraQueryBuilder` with React hooks by passing a builder function instead of the query descriptor. This provides a more fluent and type-safe API:

```tsx
import { useChimeraCollection, useChimeraItem } from "./store";

function ActiveUsers() {
  // Pass a builder function - the hook will call it and build the query
  const activeUsers = useChimeraCollection("customer", (q) => {
    q.where("email", "contains", "@example.com").orderBy("createdAt", true);
  });

  if (!activeUsers.ready) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {activeUsers.map((user) => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

**Complex Query with Groups:**

```tsx
import { useChimeraCollection } from "./store";

function FeaturedOrders() {
  const orders = useChimeraCollection("order", (q) => {
    q.where("status", "eq", "completed")
      // Must be either high value OR from VIP customer
      .group("or", (group) => {
        group
          .where("totalAmount", "gte", 1000)
          .where("customerId", "in", [1, 2, 3]); // VIP customers
      })
      // But not cancelled
      .whereNot("status", "eq", "cancelled")
      .orderBy("totalAmount", true);
  });

  return (
    <div>
      {orders.map((order) => (
        <div key={order.id}>{order.productName}</div>
      ))}
    </div>
  );
}
```

For more information on using the query builder, see the [ChimeraQueryBuilder documentation](../../qb/README.md).

## API Reference

### Hooks

#### `useChimeraCustomerCollection<Meta>(params, deps?)`

Hook for collection queries with automatic state management.

**Parameters:**

- `entityName: EntityName` - Name of the entity
- `params: ChimeraCollectionParams | QueryBuilderCreator` - Query parameters or query builder function
- `deps?: unknown[]` - Optional dependency array for memoization

**Returns:** `ChimeraCollectionQuery<Item, OperatorsMap>`, see [ChimeraCollectionQuery documentation](../../../README.md#chimeracollectionquery)

#### `useChimeraItem<Store, EntityName, Meta>(entityName, id, meta?)`

Hook for individual item queries with automatic state management.

**Parameters:**

- `entityName: EntityName` - Name of the entity
- `id: ChimeraEntityId` - Item ID
- `meta?: Meta` - Optional metadata

**Returns:** `ChimeraItemQuery<Item>`, see [ChimeraCollectionQuery documentation](../../../README.md#chimeraitemquery)

## Tips

1. **Type Safety**: Use `getChimeraTypedHooks` for full type safety
2. **Error Handling**: Always check `ready` and `lastError` properties
3. **Optimistic Updates**: Use the `mutable` property for optimistic updates on item queries
4. **Batch Operations**: Use batch operations for multiple items when possible
5. **Query Builder**: Use the query builder function syntax for better type safety and readability
