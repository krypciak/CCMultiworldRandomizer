import type MwRandomizer from "../plugin";
import "ultimate-crosscode-typedefs";

declare global {
	namespace sc {
		interface NewGameModeSelectDialog {
			apGfx: ig.Image;
			apGui: sc.NewGameModeDialogButton;
			oldCallback: this["callback"];
		}
	}
}

export function patch(plugin: MwRandomizer) {
	sc.NewGamePlusModel.inject({
		options: { "rhombus-start": true },
		onReset() {
			this.options = { "rhombus-start": true },
			this.active = false;
		}
	});

	sc.NewGamePlusMenu.inject({
		init() {
			this.parent();
			this.button.setActive(sc.newgame.hasAnyOptions());
		},
	});

	sc.NewGameToggleSet.inject({
		updateActiveState(
			totalPoints: number,
			newGameCost: number,
			remainingCredits: number,
		) {
			this.parent(totalPoints, newGameCost, remainingCredits);

			for (const button of this.buttons) {
				if (button.data.id == "rhombus-start") {
					button.setActive(false);
				}
			}
		}
	});
}
