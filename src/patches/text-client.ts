import * as ap from 'archipelago.js';
import type MwRandomizer from '../plugin';

import type * as _ from 'nax-ccuilib/src/headers/nax/input-field.d.ts'

declare global {
	namespace sc {
		enum MENU_SUBMENU {
			AP_TEXT_CLIENT,
		}

		interface APTextClientMenu extends sc.BaseMenu {
			boxGuiNinepatch: ig.NinePatch;
			buttongroup: sc.ButtonGroup;
			boxGui: ig.BoxGui;
			scrollBox: sc.ScrollPane;
			onBackButtonPress(): void;
		}

		interface APTextClientMenuConstructor extends ImpactClass<APTextClientMenu> {
			new (): APTextClientMenu;
		}

		var APTextClientMenu: APTextClientMenuConstructor;
	}
}

export function patch(plugin: MwRandomizer) {
	sc.APTextClientMenu = sc.BaseMenu.extend({
		boxGuiNinepatch: new ig.NinePatch("media/gui/message.png", {
			width: 16,
			height: 16,
			top: 8,
			bottom: 8,
			left: 8,
			right: 8,
			offsets: {
				default: { x: 48, y: 0 }}
		}),
		init() {
			window.apmenu = this;
			this.parent();

			this.hook.zIndex = 9999999;
			this.hook.localAlpha = 0.0;
			this.hook.pauseGui = true;
			this.hook.size.x = ig.system.width;
			this.hook.size.y = ig.system.height;

			this.buttongroup = new sc.ButtonGroup();
			sc.menu.buttonInteract.pushButtonGroup(this.buttongroup);

			this.buttongroup.addPressCallback(() => {});

			sc.menu.pushBackCallback(this.onBackButtonPress.bind(this));

			this.boxGui = new ig.BoxGui(500, 260, false, this.boxGuiNinepatch);
			this.boxGui.hook.align.x = ig.GUI_ALIGN.X_CENTER;
			this.boxGui.hook.align.y = ig.GUI_ALIGN.Y_CENTER;

			this.addChildGui(this.boxGui);

			this.scrollBox = new sc.ScrollPane(sc.ScrollType.Y_ONLY);
			this.scrollBox.hook.size.x = 484;
			this.scrollBox.hook.size.y = 256;
			this.scrollBox.hook.align.x = ig.GUI_ALIGN.X_CENTER;
			this.scrollBox.hook.align.y = ig.GUI_ALIGN.Y_CENTER;
			this.scrollBox.showTopBar = false;
			this.scrollBox.showBottomBar = false;
			this.scrollBox.recalculateScrollBars();

			this.boxGui.addChildGui(this.scrollBox);
		},

		showMenu: function () {
			this.parent();
			ig.interact.setBlockDelay(0.1);
			// this.addObservers();
			this.doStateTransition("DEFAULT");
		},

		exitMenu: function () {
			this.parent();
			ig.interact.setBlockDelay(0.1);
			// this.removeObservers();
			this.doStateTransition("HIDDEN", false);

		},

		onBackButtonPress() {
			sc.menu.popBackCallback();
			sc.menu.popMenu();
		},
	});

	// @ts-expect-error
	sc.MENU_SUBMENU.AP_TEXT_CLIENT = 300001;
	sc.SUB_MENU_INFO[sc.MENU_SUBMENU.AP_TEXT_CLIENT] = {
		Clazz: sc.APTextClientMenu,
		name: "apTextClient",
	};
}
