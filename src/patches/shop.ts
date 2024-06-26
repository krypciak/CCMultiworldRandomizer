import * as ap from "archipelago.js";
import type MwRandomizer from "../plugin";
import type { RawQuest } from "../item-data.model";
import { getElementIconString } from "../utils";

export function patch(plugin: MwRandomizer) {
	sc.ShopListMenu.inject({
		scrapBuyList(shopItems) {
			this.parent(shopItems);
			const shopID = sc.menu.shopID;
			if (!shopID) {
				return;
			}

			const shopData = sc.randoData.shops[shopID];
			for (const entry of this.list.getChildren()) {
				const gui = (entry as unknown as ig.GuiHook).gui;

				const itemId: number = gui.data.id;
				const mwid: number = shopData[itemId];
				const button: sc.ButtonGui = gui.button;

				button.removeChildGui(button.textChild);
				const item: ap.NetworkItem = sc.multiworld.locationInfo[mwid];
				const itemInfo = plugin.getItemInfo(item);

				button.textChild = new sc.ItemMarqueeGui(itemInfo.icon, itemInfo.label, button.hook.size.x - 10);
				button.textChild.hook.pos.x = 5;
				button.addChildGui(button.textChild);
			}
		},
	})
}
