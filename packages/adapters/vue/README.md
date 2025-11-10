# ChimeraStore Vue Integration

This package provides Vue 3 composables for seamless integration with ChimeraStore, enabling fully reactive data queries in Vue applications.

## Features

- **Vue Composables**: Use `useChimeraCollection` and `useChimeraItem` with the Composition API
- **TypeScript Support**: Strong typing for entities, queries, and repositories
- **Automatic Reactivity**: Components update automatically on data, status, and error changes
- **Query Builder Support**: Fluent query builder function for strong types and readability

## Installation

```bash
# Install the main package
npm install @hf-chimera/store

# Install Vue (if not already installed)
npm install vue
```

## Usage

### For Vue Applications

Import from the Vue-specific entry point:

```ts
import { createChimeraComposables } from '@hf-chimera/store/vue';
// In your app, call createChimeraComposables(store) and export the returned composables
```

### For Non-Vue Usage

Import and use the core store directly:

```ts
import { ChimeraStore } from '@hf-chimera/store';
```

## Quick Start

### 1. Prepare composables for the store

Use `createChimeraComposables` to create Vue composables bound to your store instance.

```ts
import { ChimeraStore } from '@hf-chimera/store';
import { createChimeraComposables } from '@hf-chimera/store/vue';
import type { MyEntityMap } from './types';

// Create your store instance
const store = new ChimeraStore<MyEntityMap>({
  query: {
    defaults: {
      idGetter: 'id',
      async collectionFetcher(entity, { filter, order }) {
        return { data: await fetchCollection(entity, filter, order) };
      },
      async itemFetcher(entity, { id }) {
        return { data: await fetchItem(entity, id) };
      },
      // ... other fetchers
    },
    entities: {
      customer: {},
      order: {},
    },
  },
});

export const {
  useChimeraStore,
  useChimeraRepository,
  useChimeraCollection,
  useChimeraItem,
} = createChimeraComposables(store);
```

### 2. Use Collection Queries in a component

`useChimeraCollection` returns a Vue `Ref` to a `ChimeraCollectionQuery`. In `<template>`, refs are auto-unwrapped. In `<script setup>`, access via `.value`.

```vue
<script setup lang="ts">
import { useChimeraCollection } from '@/store/chimera';

const customers = useChimeraCollection('customer', {
  filter: { status: 'active' },
  order: [{ field: 'name', direction: 'asc' }],
});

function addCustomer() {
  customers.value.create({ name: 'New Customer' });
}
</script>

<template>
  <div>
    <div v-if="!customers.ready">Loading...</div>
    <div v-else-if="customers.lastError">Error: {{ String(customers.lastError) }}</div>
    <template v-else>
      <div v-for="c in customers" :key="c.id">
        {{ c.name }}
        <button @click="customers.delete(c.id)">Delete</button>
      </div>
      <button @click="addCustomer">Add Customer</button>
    </template>
  </div>
</template>
```

### 3. Use Item Queries in a component

```vue
<script setup lang="ts">
import { useChimeraItem } from '@/store/chimera';

interface Props { customerId: string }
const props = defineProps<Props>();

const customer = useChimeraItem('customer', () => props.customerId);

function updateName() {
  if (!customer.value.data) return;
  customer.value.mutable.name = 'Updated Name';
  customer.value.commit();
}
</script>

<template>
  <div>
    <div v-if="!customer.ready">Loading...</div>
    <div v-else-if="customer.lastError">Error: {{ String(customer.lastError) }}</div>
    <div v-else-if="!customer.data">Customer not found</div>
    <div v-else>
      <h3>{{ customer.data.name }}</h3>
      <button @click="updateName">Update Name</button>
    </div>
  </div>
</template>
```

### 4. Using the Query Builder

You can pass a builder function instead of a params object. The composable will call it to build the query.

```ts
import { useChimeraCollection } from '@/store/chimera';

const activeUsers = useChimeraCollection('customer', (q) => {
  q.where('email', 'contains', '@example.com')
   .orderBy('createdAt', true);
});
```

Complex example with groups:

```ts
const featuredOrders = useChimeraCollection('order', (q) => {
  q.where('status', 'eq', 'completed')
   // Must be either high value OR from VIP customer
   .group('or', (group) => {
     group.where('totalAmount', 'gte', 1000)
          .where('customerId', 'in', [1, 2, 3]);
   })
   // But not cancelled
   .whereNot('status', 'eq', 'cancelled')
   .orderBy('totalAmount', true);
});
```

For more information on the query builder, see the [ChimeraQueryBuilder documentation](../../qb/README.md).

## API Reference

### Composables

#### `useChimeraStore<Store>()`

Access the ChimeraStore instance directly.

```ts
const store = useChimeraStore<MyChimeraStore>();
const customerRepo = store.from('customer');
```

#### `useChimeraRepository<EntityName>(entityName)`

Access a specific entity repository.

```ts
const customerRepo = useChimeraRepository<'customer'>('customer');
```

#### `useChimeraCollection<EntityName, Meta>(entityName, params)`

Composable for collection queries with automatic reactivity.

Parameters:

- `entityName: EntityName` — Entity name
- `params: ChimeraCollectionParams | QueryBuilderCreator | Ref | Getter` — Query params or builder; can be a value, a `ref`, or a function getter

Returns: `Ref<ChimeraCollectionQuery<Item, OperatorsMap>>` — see [ChimeraCollectionQuery](../../../README.md#chimeracollectionquery)

#### `useChimeraItem<EntityName, Meta>(entityName, id, meta?)`

Composable for single item queries with automatic reactivity.

Parameters:

- `entityName: EntityName` — Entity name
- `id: ChimeraEntityId | Ref | Getter` — Item ID (can be reactive)
- `meta?: Meta | Ref | Getter` — Optional metadata (can be reactive)

Returns: `Ref<ChimeraItemQuery<Item>>` — see [ChimeraItemQuery](../../../README.md#chimeraitemquery)

## Vue-specific Notes

- All composables return Vue `Ref`s. In `<template>`, refs are automatically unwrapped; in `<script>`, access via `.value`.
- Subscribes internally to store events and triggers updates on:
  - Collections: `ready`, `updated`, `selfUpdated`, `selfItemCreated`, `itemAdded`, `itemUpdated`, `selfItemUpdated`, `itemDeleted`, `selfItemDeleted`, `error`.
  - Items: `initialized`, `selfCreated`, `ready`, `updated`, `selfUpdated`, `deleted`, `selfDeleted`, `error`.
- You can pass reactive inputs (refs or getters) to `entityName`, `params`, `id`, and `meta`. The composables will react to changes automatically.

## Tips

1. **Type Safety**: Consider exposing a typed facade (e.g., `getChimeraTypedComposables`) in your project for strict types.
2. **Error Handling**: Always check `ready` and `lastError` before rendering critical UI.
3. **Optimistic Updates**: Use the `mutable` object on item queries and call `commit()`.
4. **Batch Operations**: Prefer collection-level operations when possible.
5. **Query Builder**: Prefer the builder function for complex filtering and ordering with strong types.

## Migration from Vanilla ChimeraStore

If you're using ChimeraStore without Vue, you can gradually adopt the Vue composables:

1. Keep your existing `ChimeraStore` instance.
2. Create composables with `createChimeraComposables(store)` and replace direct store calls in components.
3. The Vue integration works with existing stores without changes.
