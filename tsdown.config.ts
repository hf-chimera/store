import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	dts: true,
	sourcemap: true,
	entry: {
		index: "./src/index.ts",
		defaults: "./src/defaults.ts",
		qb: "./packages/qb/index.ts",
		"adapters/react": "./packages/adapters/react/index.ts",
		"adapters/vue": "./packages/adapters/vue/index.ts",
	},
	format: ["cjs", "esm"],
	shims: true,
	skipNodeModulesBundle: true,
});
