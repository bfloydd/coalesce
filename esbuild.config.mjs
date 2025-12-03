import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import fs from "fs";
import path from "path";

const mode = process.argv[2];
const prod = (mode === "production");
const qa = (mode === "qa");
const distDir = prod ? "dist" : ".";

console.log('Starting build process', {
	mode: prod ? 'production' : (qa ? 'qa' : 'development'),
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
		// Build CSS bundle from modular sources into a single styles.css
		const cssSources = [
			"styles/base/variables.css",
			"styles/base/reset.css",
			"styles/components/backlinks.css",
			"styles/components/header.css",
			"styles/components/blocks.css",
			"styles/components/settings.css",
			"styles/themes/default.css",
			"styles/themes/compact.css",
			"styles/themes/modern.css",
			"styles/themes/naked.css"
		];

		let combinedCss = '';

		// Read all existing CSS sources in a defined order
		for (const cssPath of cssSources) {
			if (fs.existsSync(cssPath)) {
				const contents = fs.readFileSync(cssPath, "utf8");
				if (contents.trim().length > 0) {
					combinedCss += `/* Source: ${cssPath} */\n` + contents + "\n\n";
				}
			}
		}

		if (combinedCss.length === 0) {
			console.log("No CSS sources found, skipping CSS processing");
		} else {
			console.log("Processing CSS bundle from modular sources...");
			console.log("CSS bundle assembled, starting minification...");

			try {
				// Use esbuild's CSS minification on the combined bundle
				const result = await esbuild.transform(combinedCss, {
					loader: "css",
					minify: true
				});

				// Write to dist directory as a single styles.css
				const cssOutPath = path.join(distDir, "styles.css");
				fs.writeFileSync(cssOutPath, result.code);
				console.log('CSS processing completed', {
					originalSize: combinedCss.length,
					minifiedSize: result.code.length,
					outputPath: cssOutPath
				});
			} catch (error) {
				console.error('Failed to process CSS:', error);
				process.exit(1);
			}
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
} else if (qa) {
	console.log('Building for qa (one-time build to current directory)...');
	try {
		await context.rebuild();
		console.log('QA build completed successfully');

		// Build CSS bundle (non-minified, like dev mode)
		const cssSources = [
			"styles/base/variables.css",
			"styles/base/reset.css",
			"styles/components/backlinks.css",
			"styles/components/header.css",
			"styles/components/blocks.css",
			"styles/components/settings.css",
			"styles/themes/default.css",
			"styles/themes/compact.css",
			"styles/themes/modern.css",
			"styles/themes/naked.css"
		];

		let combinedCss = "";

		for (const cssPath of cssSources) {
			if (fs.existsSync(cssPath)) {
				const contents = fs.readFileSync(cssPath, "utf8");
				if (contents.trim().length > 0) {
					combinedCss += `/* Source: ${cssPath} */\n` + contents + "\n\n";
				}
			}
		}

		if (combinedCss.length > 0) {
			console.log("Processing CSS bundle (qa)...");
			const result = await esbuild.transform(combinedCss, {
				loader: "css",
				minify: false
			});
			const cssOutPath = path.join(distDir, "styles.css");
			fs.writeFileSync(cssOutPath, result.code);
			console.log('CSS bundle (qa) written', {
				originalSize: combinedCss.length,
				minifiedSize: result.code.length,
				outputPath: cssOutPath
			});
		} else {
			console.log("No CSS sources found, skipping CSS processing (qa)");
		}

		console.log('QA build process completed successfully');
	} catch (error) {
		console.error('QA build failed:', error);
		process.exit(1);
	}
	process.exit(0);
} else {
	console.log('Starting development watch mode...');
	try {
		// Build CSS bundle once for development so modular files are compiled into styles.css
		const cssSources = [
			"styles/base/variables.css",
			"styles/base/reset.css",
			"styles/components/backlinks.css",
			"styles/components/header.css",
			"styles/components/blocks.css",
			"styles/components/settings.css",
			"styles/themes/default.css",
			"styles/themes/compact.css",
			"styles/themes/modern.css",
			"styles/themes/naked.css"
		];

		let combinedCss = "";

		for (const cssPath of cssSources) {
			if (fs.existsSync(cssPath)) {
				const contents = fs.readFileSync(cssPath, "utf8");
				if (contents.trim().length > 0) {
					combinedCss += `/* Source: ${cssPath} */\n` + contents + "\n\n";
				}
			}
		}

		if (combinedCss.length > 0) {
			console.log("Processing CSS bundle (development)...");
			const result = await esbuild.transform(combinedCss, {
				loader: "css",
				minify: false
			});
			const cssOutPath = path.join(distDir, "styles.css");
			fs.writeFileSync(cssOutPath, result.code);
			console.log('CSS bundle (development) written', {
				originalSize: combinedCss.length,
				minifiedSize: result.code.length,
				outputPath: cssOutPath
			});
		} else {
			console.log("No CSS sources found, skipping CSS processing (development)");
		}

		await context.watch();
		console.log('Watch mode started successfully');
	} catch (error) {
		console.error('Failed to start watch mode:', error);
		process.exit(1);
	}
}
