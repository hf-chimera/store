import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	dts: true,
	entry: {
		main: "./src/index.ts",
		react: "./adapters/react/index.ts",
	},
	format: ["cjs", "esm"],
	shims: true,
	skipNodeModulesBundle: true,
});
