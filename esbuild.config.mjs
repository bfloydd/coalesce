import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import fs from "fs";
import path from "path";

const prod = (process.argv[2] === "production");
const distDir = prod ? "dist" : ".";

console.log('Starting build process', {
	mode: prod ? 'production' : 'development',
	distDir
});

if (prod && !fs.existsSync(distDir)) {
	console.log(`Creating distribution directory: ${distDir}`);
	fs.mkdirSync(distDir, { recursive: true });
}

console.log('Configuring esbuild...');
const context = await esbuild.context({
	entryPoints: ["main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtins],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: path.join(distDir, "main.js"),
	minify: prod,
});

if (prod) {
	console.log('Building for production...');
	try {
		await context.rebuild();
		console.log('Production build completed successfully');

		// Minify CSS in production mode
		if (fs.existsSync("styles.css")) {
			console.log("Processing CSS...");
			const css = fs.readFileSync("styles.css", "utf8");
			console.log("CSS file read, starting minification...");

			try {
				// Use esbuild's CSS minification
				const result = await esbuild.transform(css, {
					loader: "css",
					minify: true
				});

				// Write to dist directory
				const cssOutPath = path.join(distDir, "styles.css");
				fs.writeFileSync(cssOutPath, result.code);
				console.log('CSS processing completed', {
					originalSize: css.length,
					minifiedSize: result.code.length,
					outputPath: cssOutPath
				});
			} catch (error) {
				console.error('Failed to process CSS:', error);
				process.exit(1);
			}
		} else {
			console.log("No styles.css found, skipping CSS processing");
		}

		// Copy manifest.json to dist directory
		if (fs.existsSync("manifest.json")) {
			console.log("Processing manifest.json...");
			try {
				const manifestOutPath = path.join(distDir, "manifest.json");
				fs.copyFileSync("manifest.json", manifestOutPath);
				console.log('Manifest processing completed', {
					outputPath: manifestOutPath
				});
			} catch (error) {
				console.error('Failed to process manifest.json:', error);
				process.exit(1);
			}
		} else {
			console.log("No manifest.json found, skipping manifest processing");
		}

		console.log('Production build process completed successfully');
	} catch (error) {
		console.error('Production build failed:', error);
		process.exit(1);
	}
	process.exit(0);
} else {
	console.log('Starting development watch mode...');
	try {
		await context.watch();
		console.log('Watch mode started successfully');
	} catch (error) {
		console.error('Failed to start watch mode:', error);
		process.exit(1);
	}
}
