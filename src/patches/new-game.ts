import * as ap from 'archipelago.js';
import type MwRandomizer from "../plugin";
import "../types/multiworld-model.d";
import "ultimate-crosscode-typedefs";

export function patch(plugin: MwRandomizer) {
	sc.NewGameModeSelectDialog.inject({
		init(...args) {
			this.parent(...args);

			this.content.hook.size.x += 110;
			this.msgBox.hook.size.x += 110;
			this.msgBox.centerBox.hook.size.x += 110;
			this.apGui = new sc.NewGameModeDialogButton(
				"Archipelago",
				2
			);

			this.apGui.hook.pos.y = 27;
			this.apGui.hook.align.x = ig.GUI_ALIGN.X_CENTER;
			this.content.addChildGui(this.apGui);

			this.buttongroup.removeFocusGui(1, 0);
			this.buttongroup.addFocusGui(this.apGui, 1, 0);
			this.buttongroup.addFocusGui(this.plus, 2, 0);

			this.buttongroup.addSelectionCallback(function (gui) {
				if (gui.data == 2) {
					this.info.doStateTransition("DEFAULT", true);
					this.info.setText("Connect to a multiworld and play with friends!");
				}
			}.bind(this));

			this.oldCallback = this.callback
			this.callback = function (gui) {
				this.oldCallback(gui);
				if (gui.data == 2) {
					sc.menu.setDirectMode(true, sc.MENU_SUBMENU.AP_CONNECTION);
					sc.menu.exitCallback = function () {
						if (sc.multiworld.connectionInfo) {
							const titleScreenButtons = ig.gui.guiHooks.filter(
								x=>x.gui.buttons?.changelogGui
							)[0].gui.buttons;

							titleScreenButtons.changelogGui.clearLogs();
							ig.bgm.clear("MEDIUM_OUT");
							// c && c.stop();
							// c = null;
							ig.interact.removeEntry(titleScreenButtons.buttonInteract);
							ig.game.start(sc.START_MODE.NEW_GAME_PLUS, 1);
						} else sc.newgame.onReset();
					}.bind(this);
					sc.model.enterMenu(true);
				}
			}
		}
	});
}
