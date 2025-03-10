import { defineConfig } from "tsup";

// biome-ignore lint/style/noDefaultExport: Required for tsup
export default defineConfig({
	format: ["cjs", "esm"],
	entry: ["./src/index.ts"],
	dts: true,
	shims: true,
	skipNodeModulesBundle: true,
	clean: true,
});
