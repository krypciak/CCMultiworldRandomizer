import MwRandomizer from "../plugin"; 

declare global {
	namespace sc {
		interface MultiworldChestMarker extends ig.GuiElementBase {
		}

		interface MapAreaContainer {
		}
	}
}

export function patch(plugin: MwRandomizer) {
	sc.MapAreaContainer.inject({
		createLandmarks
	});
}
