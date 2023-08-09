import * as esbuild from 'esbuild';
import {polyfillNode} from 'esbuild-plugin-polyfill-node';

esbuild.build({
	"target": "es2018",
	"format": "esm",
	"platform": "node",
	"bundle": true,
	"sourcemap": "inline",
	"outfile": "plugin.js",
	"plugins": [ polyfillNode({
		"polyfills": {
			"crypto": true,
			"fs": false,
			"events": false,
		}
	}) ],
	"entryPoints": ["src/plugin.ts"],
});
