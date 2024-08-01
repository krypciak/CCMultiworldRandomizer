import * as ap from "archipelago.js";
import type MwRandomizer from "../plugin";

declare global {
	namespace sc {
		interface ShopMenu {
			shopList: sc.ShopListMenu;

			onQuantitySubmit(this: this, button: sc.ShopItemButton, quantity: number): void;
		}

		interface ShopListMenu {
			menuGfx: ig.Image;
			shopData: Record<number, number> | undefined;
		}

		interface ShopItemButton {
			apItem: ap.NetworkItem | undefined;
			itemId: number | undefined;
		}
	}
}

export function patch(plugin: MwRandomizer) {
	sc.ShopMenu.inject({
		onQuantitySubmit(button: sc.ShopItemButton, quantity: number) {
			if (button.apItem == undefined) {
				return this.parent(button, quantity);
			}

			if (quantity == 0) {
				return this.parent(button, quantity);
			}

			button.setCountNumber(1);
			sc.menu.updateCart(button.itemId!, 1, button.price);
			this.onQuantityBack(button);
			this.cart.setCheckout(true);
			this.shopList.updateListEntries();
		},

		buyItems() {
			this.parent();

			if (this.shopList.shopData == undefined) {
				return false;
			}

			for (const entry of sc.menu.shopCart) {
				let mwid = this.shopList.shopData[entry.id as number];
				if (mwid == undefined || sc.multiworld.locationInfo[mwid] == undefined) {
					continue;
				}

				sc.model.player.removeItem(entry.id, entry.amount, true);
				sc.multiworld.reallyCheckLocation(mwid);
			}
			return false;
		},
	});

	sc.ShopListMenu.inject({
		menuGfx: new ig.Image("media/gui/menu.png"),
		scrapBuyList(shopItems) {
			this.parent(shopItems);
			const shopID = sc.menu.shopID;
			if (shopID == undefined || sc.randoData.shops == undefined) {
				return;
			}

			this.shopData = sc.multiworld.options.shopSendMode == "itemType" ?
				sc.randoData.shops.locations.global :
				sc.randoData.shops.locations.perShop[shopID];

			if (sc.multiworld.options.questDialogHints && sc.multiworld.options.shopDialogHints) {
				const toHint = Object.values(this.shopData).filter(mwid =>
					sc.multiworld.locationInfo[mwid] != undefined &&
					sc.multiworld.locationInfo[mwid].flags & ap.ITEM_FLAGS.PROGRESSION
				);

				if (toHint.length > 0) {
					// @ts-ignore
					sc.multiworld.client.locations.scout(ap.CREATE_AS_HINT_MODE.HINT_ONLY_NEW, ...toHint);
				}
			}

			let accum = 0;
			for (const entry of this.list.getChildren()) {
				const gui = entry.gui as unknown as sc.ShopItemButton;
				gui.hook.pos.y += accum;

				const itemId: number = gui.data.id;
				const mwid: number = this.shopData[itemId];
				const button: sc.ButtonGui = gui.button;

				const item = sc.multiworld.locationInfo[mwid];
				if (item == undefined) {
					continue;
				}

				button.removeChildGui(button.textChild);

				const itemInfo = plugin.getItemInfo(item);

				gui.apItem = item;
				gui.itemId = itemId;

				const marqueeGui = new sc.ItemMarqueeGui(
					itemInfo.icon,
					itemInfo.label,
					button.hook.size.x - 10,
					{ autoScroll: false, holdOnReset: false }
				);

				if (itemInfo.level > 0) {
					marqueeGui.iconGui.setDrawCallback((width: number, height: number) => {
						sc.MenuHelper.drawLevel(
							itemInfo.level,
							width,
							height,
							this.menuGfx,
							itemInfo.isScalable
						);
					});
				}

				button.textChild = marqueeGui;
				button.text = itemInfo.label;
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

			this.updateListEntries();
		},

		updateListEntries(resetCounters: boolean | undefined | null) {
			this.parent(resetCounters);

			const shopID = sc.menu.shopID!;

			if (this.shopData == undefined) {
				return;
			}

			for (const entry of this.list.getChildren()) {
				const gui = entry.gui as unknown as sc.ShopItemButton;

				if (gui.apItem) { 
					const owned = sc.multiworld.localCheckedLocations.includes(this.shopData[gui.itemId!]);
					gui.data = sc.multiworld.getShopLabelsFromItemData(gui.apItem!);
					gui.owned.setNumber(
						owned ? 1 : 0,
						true
					);

					if (owned) {
						gui.setActive(false);
						continue;
					}
				}

				if (gui.active && gui.itemId != undefined) {
					let unlockItem: number | null = null;
					if (sc.multiworld.options.shopReceiveMode == "itemType") {
						unlockItem = sc.randoData.shops.unlocks.byId[gui.itemId];
					} else if (sc.multiworld.options.shopReceiveMode == "shop") {
						unlockItem = sc.randoData.shops.unlocks.byShop[shopID];
					} else if (sc.multiworld.options.shopReceiveMode == "slot") {
						unlockItem = sc.randoData.shops.unlocks.byShopAndId[shopID][gui.itemId];
					}

					if (unlockItem != null) {
						gui.setActive(sc.multiworld.receivedItemMap[unlockItem] != undefined);
					}
				}
			}
		}
	});

	sc.ShopItemButton.inject({
		focusGained() {
			this.parent();
			this.button.textChild.labelGui?.activate();
		},

		focusLost() {
			this.parent();
			this.button.textChild.labelGui?.deactivate();
			this.button.textChild.labelGui?.reset();
		}
	});
}
