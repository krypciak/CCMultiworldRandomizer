import * as ap from 'archipelago.js';
import type MwRandomizer from '../plugin';

import type * as _ from 'nax-ccuilib/src/headers/nax/input-field.d.ts'

declare global {
	namespace sc {
		interface GameModel {
			textClient: sc.APTextClientModel;
		}

		var AP_COLOR_MAPPING: Record<ap.ValidJSONColorType, string>;

		enum MENU_SUBMENU {
			AP_TEXT_CLIENT,
		}

		interface APTextClientModel extends ig.GameAddon, sc.Model {
			allMessages: ap.PrintJSONPacket[];
			messageTextBlocks: Record<number, sc.APMessageList.MessageEntry[]>;

			addMessage(this: this, message: ap.PrintJSONPacket): void;
			getMessageTextBlocks(this: this, width: number): sc.APMessageList.MessageEntry[];
			modelChanged(this: this, model: any, message: any, data: any): void;
		}

		interface APTextClientModelConstructor extends ImpactClass<sc.APTextClientModel> {
			new (): sc.APTextClientModel;
		}

		var APTextClientModel: APTextClientModelConstructor;

		interface APMessageList extends ig.GuiElementBase {
			allMessages: sc.APMessageList.MessageEntry[];
			visibleMessages: sc.APMessageList.MessageEntry[];
			firstShownIndex: number;
			viewportPos: number;
			margin: number;
			viewportHeight: number;

			getRenderWindowTop(this: this): number;
			getRenderWindowBottom(this: this): number;

			addMessage(this: this, message: ap.PrintJSONPacket): number;
			scroll(this: this, amount: number): void;

			recalculateRenderWindow(this: this, direction?: number, startIndex?: number): void;

			modelChanged(this: this, model: any, message: any, data: any): void;
		}

		interface APMessageListConstructor extends ImpactClass<sc.APMessageList> {
			new (width: number, height: number, margin: number): APMessageList;
		}

		var APMessageList: APMessageListConstructor;

		namespace APMessageList {
			interface MessageEntry {
				packet: ap.PrintJSONPacket;
				textBlock: ig.TextBlock;
				position: number;
				endPosition: number;
			}
		}

		interface APTextClientMenu extends sc.BaseMenu {
			boxGuiNinepatch: ig.NinePatch;
			buttongroup: sc.ButtonGroup;
			boxGui: ig.BoxGui;
			scrollBox: sc.ScrollPane;
			list: sc.APMessageList;

			scroll(this: this, amount: number): void;
			onBackButtonPress(): void;
			modelChanged(this: this, model: any, message: any, data: any): void;
		}

		interface APTextClientMenuConstructor extends ImpactClass<sc.APTextClientMenu> {
			new (): APTextClientMenu;
		}

		var APTextClientMenu: APTextClientMenuConstructor;
	}
}

export function patch(plugin: MwRandomizer) {
	sc.AP_COLOR_MAPPING = {
		bold: "white",
		underline: "white",
		black: "white",
		red: "red",
		green: "green",
		yellow: "yellow",
		blue: "blue",
		magenta: "fuchsia",
		cyan: "teal",
		white: "white",
		black_bg: "white",
		red_bg: "red",
		green_bg: "green",
		yellow_bg: "yellow",
		blue_bg: "blue",
		purple_bg: "fuchsia",
		cyan_bg: "teal",
		white_bg: "white",
	};

	sc.APTextClientModel = ig.GameAddon.extend({
		init() {
			this.allMessages = [];
			this.messageTextBlocks = {};
			sc.Model.addObserver(sc.multiworld, this);
		},

		getMessageTextBlocks(width) {
			let result = this.messageTextBlocks[width];
			if (result != undefined) {
				return result;
			} else {
				return this.messageTextBlocks[width] = [];
			}
		},

		addMessage(message) {
			this.allMessages.push(message);
		},

		modelChanged(model, message, data) {
			if (model == sc.multiworld && message == sc.MULTIWORLD_MSG.PRINT_JSON) {
				console.log(data);
				this.addMessage(data);
			}
		},
	});

	sc.APMessageList = ig.GuiElementBase.extend({
		init(width: number, height: number, margin: number) {
			this.parent();
			this.firstShownIndex = 0;
			this.viewportPos = 0;
			this.margin = margin;
			this.viewportHeight = height;

			this.allMessages = sc.model.textClient.getMessageTextBlocks(width);
			let contentHeight = 0;
			if (this.allMessages.length > 0) {
				let message = this.allMessages[this.allMessages.length - 1];
				contentHeight = message.endPosition + message.textBlock.linePadding;
			}
			this.setSize(width, contentHeight);
			this.visibleMessages = [];

			this.recalculateRenderWindow();
		},

		getRenderWindowTop() {
			return this.viewportPos - this.margin;
		},

		getRenderWindowBottom() {
			return this.viewportPos + this.viewportHeight + this.margin;
		},

		addMessage(message) {
			let formattedText = "";
			for (const el of message.data) {
				switch (el.type) {
					case undefined:
					case "text":
						formattedText += el.text;
						break;
					case "player_id": {
						let playerName = sc.multiworld.client.players.get(Number(el.text))?.name;
						if (playerName == undefined) {
							playerName = "\\C[dark-red]Unknown\\c[0]";
						}
						formattedText += `\\C[pink]${playerName}\\c[0]`;
						break;
					}
					case "player_name":
						formattedText += `\\C[pink]${el.text}\\c[0]`;
						break;
					case "item_id": {
						let itemInfo = plugin.getItemInfo({
							item: Number(el.text),
							flags: el.flags,
							player: el.player,
						});

						formattedText += `\\c[3]${plugin.getGuiString(itemInfo)}\\c[0]`;
						break;
					}
					case "item_name": {
						let game = sc.multiworld.client.data.games[el.player];
						let itemId = sc.multiworld.client.data.package.get(game)?.item_name_to_id[el.text];
						if (itemId == undefined) {
							itemId = 0;
						}
						let itemInfo = plugin.getItemInfo({
							item: itemId,
							flags: el.flags,
							player: el.player,
						});

						formattedText += `\\c[3]${plugin.getGuiString(itemInfo)}\\c[0]`;
						break;
					}
					case "location_id": {
						let game = sc.multiworld.client.data.games[el.player];
						let locationName = sc.multiworld.client.data.package.get(game)?.location_id_to_name[Number(el.text)];
						if (locationName == undefined) {
							locationName = "\\C[dark-red]Unknown\\c[0]";
						}
						formattedText += `\\C[olive]${locationName}\\c[0]`;
						break;
					}
					case "location_name":
						formattedText += `\\C[olive]${el.text}\\c[0]`;
						break;
					case "entrance_name":
						formattedText += el.text;
						break;
					case "color": {
						formattedText += `\\C[${sc.AP_COLOR_MAPPING[el.color]}]${el.text}\\c[0]`;
						break;
					}
				}
			}

			let textBlock = new ig.TextBlock(
				sc.fontsystem.font,
				formattedText,
				{ 
					maxWidth: this.hook.size.x - 8,
					linePadding: -2,
				}
			);
			let msgSize = textBlock.size.y + textBlock.linePadding;

			textBlock.prerender();

			let previous = this.allMessages[this.allMessages.length - 1];
			if (previous == undefined) {
				let entry = {
					packet: message,
					textBlock,
					position: 0,
					endPosition: msgSize,
				};

				this.allMessages.push(entry);

				// 0 = entry.position
				if (0 < this.getRenderWindowBottom()) {
					this.visibleMessages.push(entry);
				}

				return msgSize;
			}

			let position = previous.position + previous.textBlock.size.y + previous.textBlock.linePadding;
			let endPosition = position + msgSize;

			let entry = { packet: message, textBlock, position, endPosition };

			this.allMessages.push(entry);

			if (position < this.getRenderWindowBottom()) {
				this.visibleMessages.push(entry);
			}

			this.hook.size.y += msgSize;

			// return the amount to scroll.
			return msgSize;
		},

		scroll(amount) {
			if (this.hook.size.y <= this.viewportHeight) {
				return;
			}
			let prevPos = this.viewportPos;
			this.viewportPos = (this.viewportPos + amount).limit(0, this.hook.size.y - this.viewportHeight);
			if (this.viewportPos == prevPos) {
				return;
			}

			this.recalculateRenderWindow(Math.sign(amount));
		},

		recalculateRenderWindow(direction, startIndex) {
			if (direction == undefined) {
				direction = 1;
			}

			let newFirstIndex;
			if (direction >= 0) {
				// unshift from the front the ones that are no longer visible
				newFirstIndex = startIndex != undefined ? startIndex : 0;
				for (; newFirstIndex < this.allMessages.length; newFirstIndex++) {
					if (this.allMessages[newFirstIndex].endPosition > this.getRenderWindowTop()) {
						break;
					}
				}
			} else {
				// shift to the front the ones that are now visible
				newFirstIndex = startIndex != undefined ? startIndex : this.allMessages.length - 1;
				for (; newFirstIndex >= 1; newFirstIndex--) {
					if (this.allMessages[newFirstIndex].endPosition < this.getRenderWindowTop()) {
						break;
					}
				}
			}

			// push to back the ones that should now be visible
			let newEndIndex = newFirstIndex;
			for (; newEndIndex < this.allMessages.length; newEndIndex++) {
				if (this.allMessages[newEndIndex].position > this.getRenderWindowBottom()) {
					break;
				}
			}

			this.visibleMessages = this.allMessages.slice(newFirstIndex, newEndIndex + 1);
			this.firstShownIndex = newFirstIndex;
		},

		updateDrawables(renderer: ig.GuiRenderer) {
			for (const message of this.visibleMessages) {
				renderer.addText(message.textBlock, 2, message.position);
			}
		},
	});

	sc.APTextClientMenu = sc.BaseMenu.extend({
		boxGuiNinepatch: new ig.NinePatch("media/gui/menu.png", {
			// this is the same as the tasks list gui from the quest details view
			// i think it works really well here
			width: 4,
			height: 8,
			left: 6,
			top: 8,
			right: 6,
			bottom: 8,
			offsets: {
				default: { x: 472, y: 80 },
				solved: { x: 488, y: 80 },
				elite: { x: 504, y: 80 },
			},
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

			this.boxGui = new ig.BoxGui(400, 260, false, this.boxGuiNinepatch);
			this.boxGui.hook.align.x = ig.GUI_ALIGN.X_CENTER;
			this.boxGui.hook.align.y = ig.GUI_ALIGN.Y_CENTER;
			this.boxGui.hook.pos.x = -70;

			this.addChildGui(this.boxGui);

			this.scrollBox = new sc.ScrollPane(sc.ScrollType.Y_ONLY);
			this.scrollBox.setSize(398, 260);
			this.scrollBox.hook.align.x = ig.GUI_ALIGN.X_CENTER;
			this.scrollBox.hook.align.y = ig.GUI_ALIGN.Y_CENTER;
			this.scrollBox.showTopBar = false;
			this.scrollBox.showBottomBar = false;

			this.list = new sc.APMessageList(398, 258, 40);
			this.scrollBox.setContent(this.list);

			this.boxGui.addChildGui(this.scrollBox);

			sc.Model.addObserver(sc.multiworld, this);
		},

		showMenu() {
			this.parent();
			this.addObservers();
			for (let i = this.list.allMessages.length; i < sc.model.textClient.allMessages.length; i++) {
				this.list.addMessage(sc.model.textClient.allMessages[i]);
			}
			ig.interact.setBlockDelay(0.1);
			// this.addObservers();
			this.doStateTransition("DEFAULT");
		},

		exitMenu() {
			this.parent();
			this.removeObservers();
			ig.interact.setBlockDelay(0.1);
			// this.removeObservers();
			this.doStateTransition("HIDDEN", false);
		},

		scroll(amount) {
			this.scrollBox.scrollY(amount);
			this.list.scroll(amount);
		},

		update() {
			if (sc.control.menuScrollUp()) {
				this.scroll(-20);
			}
			if (sc.control.menuScrollDown()) {
				this.scroll(20);
			}
		},

		onBackButtonPress() {
			sc.menu.popBackCallback();
			sc.menu.popMenu();
		},

		modelChanged(model, message, data) {
			if (model == sc.multiworld && message == sc.MULTIWORLD_MSG.PRINT_JSON) {
				this.list.addMessage(data);
				this.scrollBox.recalculateScrollBars();
			}
		},
	});

	// @ts-expect-error
	sc.MENU_SUBMENU.AP_TEXT_CLIENT = 300001;
	sc.SUB_MENU_INFO[sc.MENU_SUBMENU.AP_TEXT_CLIENT] = {
		Clazz: sc.APTextClientMenu,
		name: "apTextClient",
	};

	ig.addGameAddon(() => {
		return (sc.model.textClient = new sc.APTextClientModel());
	});
}
