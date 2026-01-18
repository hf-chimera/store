import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	dts: true,
	sourcemap: true,
	entry: {
		index: "./index.ts",
	},
	format: ["cjs", "esm"],
	shims: true,
	skipNodeModulesBundle: true,
	external: ["@hf-chimera/store"],
});
