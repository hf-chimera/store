---
"@hf-chimera/store": patch
---

Implement library with adapters

This patch release introduces the complete implementation of the
`@hf-chimera/store` library with a flexible adapter system:

- **React Adapter** (`packages/adapters/react`): Hooks and context for
  integrating the store with React applications
- **Query Builder** (`packages/qb`): Fluent API for constructing complex queries
- **CRUD Example**: Full-stack example application demonstrating store usage
  with customers and orders
- **Core Improvements**: Bug fixes in ordering logic (using the first non-equal
  result) and enhanced type safety
- **Testing Infrastructure**: Added Vitest UI and comprehensive test coverage
