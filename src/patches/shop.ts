import * as ap from "archipelago.js";
import type MwRandomizer from "../plugin";

export function patch(plugin: MwRandomizer) {
	sc.ShopListMenu.inject({
		scrapBuyList(shopItems) {
			this.parent(shopItems);
			const shopID = sc.menu.shopID;
			if (!shopID) {
				return;
			}

			const shopData = sc.randoData.shops[shopID];

			let accum = 0;
			for (const entry of this.list.getChildren()) {
				const gui = (entry as unknown as ig.GuiHook).gui;
				gui.hook.pos.y += accum;

				const itemId: number = gui.data.id;
				const mwid: number = shopData[itemId];
				const button: sc.ButtonGui = gui.button;

				button.removeChildGui(button.textChild);
				const item: ap.NetworkItem = sc.multiworld.locationInfo[mwid];
				const itemInfo = plugin.getItemInfo(item);

				const marqueeGui = new sc.ItemMarqueeGui(
					itemInfo.icon,
					itemInfo.label,
					button.hook.size.x - 10,
					{ autoScroll: false, holdOnReset: false }
				);

				button.textChild =  marqueeGui;
				button.textChild.hook.pos.x = 5;
				button.hook.align.y = ig.GUI_ALIGN.Y_CENTER;
				button.addChildGui(button.textChild);

				const worldGui = new sc.TextGui(itemInfo.player, { "font": sc.fontsystem.tinyFont });
				worldGui.hook.pos.x = 22;
				worldGui.hook.pos.y = button.hook.size.y;
				accum += worldGui.hook.size.y;
				button.addChildGui(worldGui);
			}

			this.list.list.contentPane.hook.size.y += accum;
			this.list.list.recalculateScrollBars();
		},
	});

	sc.ShopItemButton.inject({
		focusGained() {
			this.button.textChild.labelGui?.activate();
		},

		focusLost() {
			this.button.textChild.labelGui?.deactivate();
			this.button.textChild.labelGui?.reset();
		}
	});
}
