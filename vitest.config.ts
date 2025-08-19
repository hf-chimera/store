import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			exclude: ["node_modules/", "dist/", "src/tests/", "**/*.test.ts", "**/*.d.ts", "**/*.config.*"],
			provider: "v8",
			reporter: ["text", "json", "html"],
		},
		environment: "node",
		globals: true,
		setupFiles: ["./src/tests/setup.ts"],
	},
});
