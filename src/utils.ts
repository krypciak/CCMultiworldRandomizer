const fs = require("fs");

export async function readJsonFromFile(path: string) {
	if (path.startsWith('./assets/')) {
		return fetch(path.slice(1)).then(resp => resp.json());
	}
	if (path.startsWith('/assets/')) {
		return fetch(path).then(resp => resp.json());
	}
	if (path.startsWith('assets/')) {
		return fetch('/' + path).then(resp => resp.json());
	}

	return JSON.parse((await fs.promises.readFile(path)) as unknown as string);
}
