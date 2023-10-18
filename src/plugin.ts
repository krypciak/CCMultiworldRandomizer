// don't trust ts-server, you can't replace this `require`
const fs = require("fs");

import * as ap from 'archipelago.js';
import {WorldData, RawElement} from './item-data.model';
import {readJsonFromFile} from './utils';
import "./types/multiworld-model";

export default class MwRandomizer {
	baseDirectory: string;
	randoData: WorldData | null = null;
	itemdb: any;

	constructor(mod: {baseDirectory: string}) {
		this.baseDirectory = mod.baseDirectory
	}

	getColoredStatus(status: string) {
		switch (status.toLowerCase()) {
			case ap.CONNECTION_STATUS.CONNECTED.toLowerCase():
				return `\\c[2]${status}\\c[0]`;
			case ap.CONNECTION_STATUS.DISCONNECTED.toLowerCase():
				return `\\c[1]${status}\\c[0]`;
			case ap.CONNECTION_STATUS.WAITING_FOR_AUTH.toLowerCase():
			case ap.CONNECTION_STATUS.CONNECTING.toLowerCase():
				return `\\c[3]${status}\\c[0]`;
		}
	}

	async prestart() {
		let randoData: WorldData = await readJsonFromFile(this.baseDirectory + "data/data.json")
		this.randoData = randoData;

		let maps = randoData.items;
		let quests = randoData.quests;

		let itemdb = await readJsonFromFile("assets/data/item-database.json");
		this.itemdb = itemdb;

		// @ts-ignore
		window.apclient = client;

		// For those times JS decides to override `this`
		// Used several times in the injection code
		let plugin = this;

		ig.addGameAddon(() => {
			return (sc.multiworld = new sc.MultiWorldModel());
		});

		ig.ENTITY.Chest.inject({
			_reallyOpenUp() {
				const map = maps[ig.game.mapName];
				
				if (!map) {
					console.warn('Chest not in logic');
					return this.parent();
				}

				const check = map.chests?.[this.mapId];

				const old = sc.ItemDropEntity.spawnDrops;
				try {
					if (check) {
						sc.multiworld.reallyCheckLocations(check.mwids);
					}

					this.amount = 0;
					return this.parent();
				} finally {
					sc.ItemDropEntity.spawnDrops = old;
				}
			}
		});

		ig.EVENT_STEP.SET_PLAYER_CORE.inject({
			start() {
				if (
					this.core != sc.PLAYER_CORE.ELEMENT_HEAT &&
					this.core != sc.PLAYER_CORE.ELEMENT_COLD &&
					this.core != sc.PLAYER_CORE.ELEMENT_SHOCK &&
					this.core != sc.PLAYER_CORE.ELEMENT_WAVE
				) {
					return this.parent();
				}

				// do not disable elements
				if (!this.value) {
					return;
				}

				const map = maps[ig.game.mapName];
				if (!map || !map.elements) {
					return this.parent();
				}

				const check = Object.values(map.elements)[0] as RawElement;
				sc.multiworld.reallyCheckLocations(check.mwids);
			}
		});

		ig.EVENT_STEP.SEND_ITEM = ig.EventStepBase.extend({
			mwids: [],
			init(settings) {
				this.mwids = settings.mwids;
			},
			start() {
				sc.multiworld.reallyCheckLocations(this.mwids);
			}
		});

		ig.Game.inject({
			loadLevel(map, ...args) {
				const mapOverrides = maps[map.name.replace(/[\\\/]/g, '.')];
				if (mapOverrides) {
					for (const entity of map.entities) {
						if (
							entity
							&& entity.settings
							&& entity.settings.mapId
							&& mapOverrides.cutscenes
							&& mapOverrides.cutscenes[entity.settings.mapId]
						) {
								for (const check of mapOverrides.cutscenes[entity.settings.mapId]) {
									const path = check.path.slice(1).split(/\./g);

									set(entity, 'SEND_ITEM', [...path, 'type']);
									set(entity, check.mwids, [...path, 'mwids']);
								}
							}
					}
				}

				return this.parent(map, ...args);
			}
		});

		sc.QuestModel.inject({
			_collectRewards(quest: sc.Quest) {
				const check = quests[quest.id];
				if (check) {
					sc.multiworld.reallyCheckLocations(check.mwids);
				} else {
					return this.parent(quest);
				}
			}
		});

		sc.QuestDialog.inject({
			setQuestRewards(quest: sc.Quest, hideRewards: boolean, finished: boolean) {
				this.parent(quest, hideRewards, finished);
				let mwQuest = randoData.quests[quest.id]
				if (
					mwQuest === undefined ||
					mwQuest.mwids === undefined
				) {
					return;
				}

				this.setSize(this.hook.size.x, this.hook.size.y + 6);

				let worldGuis: sc.TextGui[] = [];

				// const reward = sc.multiworld.client.locations.scout(ap.CREATE_AS_HINT_MODE.NO_HINT, randoData.quests[quest.id].mwid);
				for (let i = 0; i < this.itemsGui.hook.children.length; i++) {
					const hook = this.itemsGui.hook.children[i];
					const gui = hook.gui;
					if (hideRewards) {
						gui.setText("\\i[ap-logo]?????????????");
					} else {
						gui.setText(`\\i[ap-logo]Unknown`);
					}

					hook.pos.y += 3 * i;
					let worldGui = new sc.TextGui("Archipelago", { "font": sc.fontsystem.tinyFont });
					worldGui.setPos(15, gui.hook.size.y - 2);
					gui.addChildGui(worldGui);
					worldGuis.push(worldGui);
				}

				sc.multiworld.getLocationInfo(mwQuest.mwids, (info) => {
					for (let i = 0; i < info.length; i++) {
						const hook = this.itemsGui.hook.children[i];
						const gui = hook.gui;

						let gameName = sc.multiworld.client.data.players[info[i].player].game;
						let gameInfo = sc.multiworld.client.data.package.get(gameName);
						gui.setText(`\\i[ap-logo]${gameInfo?.item_id_to_name[info[i].item]}`);
						let player = sc.multiworld.client.players.get(info[i].player);
						let playerName = player?.alias ?? player?.name;
						if (playerName) {
							worldGuis[i].setText(`\\i[ap-logo]${playerName}`);
						}
					}
				});
			}
		});

		sc.QuestDetailsView.inject({
			_setQuest(quest: sc.Quest) {
				this.parent(quest);
				let mwQuest = randoData.quests[quest.id]
				if (mwQuest === undefined) {
					return;
				}

				let worldGuis: sc.TextGui[] = [];

				// const reward = sc.multiworld.client.locations.scout(ap.CREATE_AS_HINT_MODE.NO_HINT, randoData.quests[quest.id].mwid);
				for (let i = 0; i < this.itemsGui.hook.children.length; i++) {
					const hook = this.itemsGui.hook.children[i];
					const gui = hook.gui;
					if (quest.hideRewards) {
						gui.setText("\\i[ap-logo]?????????????");
					} else {
						gui.setText(`\\i[ap-logo]Unknown`);
					}

					hook.pos.y += 3 * i;
					let worldGui = new sc.TextGui("Archipelago", { "font": sc.fontsystem.tinyFont });
					worldGui.setPos(15, gui.hook.size.y - 2);
					gui.addChildGui(worldGui);
					worldGuis.push(worldGui);
				}

				sc.multiworld.getLocationInfo(mwQuest.mwids, (info) => {
					for (let i = 0; i < info.length; i++) {
						const hook = this.itemsGui.hook.children[i];
						const gui = hook.gui;

						let gameName = sc.multiworld.client.data.players[info[i].player].game;
						let gameInfo = sc.multiworld.client.data.package.get(gameName);
						gui.setText(`\\i[ap-logo]${gameInfo?.item_id_to_name[info[i].item]}`);
						let player = sc.multiworld.client.players.get(info[i].player);
						let playerName = player?.alias ?? player?.name;
						if (playerName) {
							worldGuis[i].setText(`\\i[ap-logo]${playerName}`);
						}
					}
				});
			}
		});

		let mwIcons = new ig.Font(
			plugin.baseDirectory.substring(7) + "assets/icons.png",
			16,
			ig.MultiFont.ICON_START,
		);

		let index = sc.fontsystem.font.iconSets.length;
		sc.fontsystem.font.pushIconSet(mwIcons);
		sc.fontsystem.font.setMapping({
			"mw-item": [index, 0],
			"ap-logo": [index, 1],
		});

		// And for my next trick I will rip off ItemContent and ItemHudGui from the base game
		// pls don't sue
		sc.MultiWorldItemContent = ig.GuiElementBase.extend({
			timer: 0,
			id: -1,
			player: -1,
			textGui: null,
			init: function (mwid: number, player: number) {
				this.parent();
				this.id = mwid == void 0 ? -1 : mwid;
				this.player = player;
				this.timer = 5;

				let playerObj = sc.multiworld.client.players.get(player);
				let destGameName = playerObj?.game;
				let itemName = "Unknown";
				if (destGameName != undefined) {
					let gameInfo = sc.multiworld.client.data.package.get(destGameName)
					if (gameInfo != undefined) {
						itemName = gameInfo.item_id_to_name[mwid];
					}
				}

				let playerName = playerObj?.name ?? "Archipelago";

				let text = `\\i[ap-logo] Sent \\c[3]${itemName}\\c[0] to \\c[3]${playerName}\\c[0]`;
				let isNormalSize = sc.options.get("item-hud-size") == sc.ITEM_HUD_SIZE.NORMAL;

				this.textGui = new sc.TextGui(text, {
					speed: ig.TextBlock.SPEED.IMMEDIATE,
					font: isNormalSize ? sc.fontsystem.font : sc.fontsystem.smallFont,
				});
				this.textGui.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_CENTER);
				this.addChildGui(this.textGui);

				this.setSize(
					this.textGui.hook.size.x + 4,
					isNormalSize ? 18 : 8
				);

				this.hook.pivot.x = this.hook.size.x;
				this.hook.pivot.y = 0;
			},

			updateOption: function (isNormalSize: boolean) {
				if (isNormalSize) {
					if (this.textGui.font == sc.fontsystem.font) return;
					this.textGui.setFont(sc.fontsystem.font);
				} else {
					if (this.textGui.font == sc.fontsystem.smallFont) return;
					this.textGui.setFont(sc.fontsystem.smallFont);
				}

				this.setSize(
					this.textGui.hook.size.x + 4,
					isNormalSize ? 18 : 8
				);
			},

			updateTimer: function () {
				if (this.timer > 0) this.timer = this.timer - ig.system.tick;
			},
		});

		sc.MultiWorldHudBox = sc.RightHudBoxGui.extend({
			contentEntries: [],
			delayedStack: [],
			size: 0,

			init: function() {
				this.parent("Archipelago");
				this.size = sc.options.get("item-hud-size");
				sc.Model.addObserver(sc.multiworld, this);
				sc.Model.addObserver(sc.model, this);
				sc.Model.addObserver(sc.options, this);
			},

			addEntry: function (mwid: number, player: number) {
				let entry = new sc.MultiWorldItemContent(mwid, player);
				if (this.contentEntries.length >= 5) {
					this.delayedStack.push(entry);
				} else {
					this.pushContent(entry, true);
				}
				this.hidden && this.show();
			},

			update: function () {
				if (!sc.model.isPaused() && !sc.model.isMenu() && !this.hidden) {
					for (let i = this.contentEntries.length, gui = null; i--; ) {
						gui = this.contentEntries[i].subGui;
						gui.updateTimer();

						if (gui.timer <= 0) {
							gui = this.removeContent(i);
							if (i == 0 && this.contentEntries.length == 0)
								gui.hook.pivot.y = gui.hook.size.y / 2;
							else {
								gui.hook.pivot.y = 0;
								gui.hook.anim.timeFunction = KEY_SPLINES.EASE_OUT;
							}
							this._popDelayed();
						}
					}

					!this.hidden && this.contentEntries.length == 0 && this.hide();
				}
			},

			_popDelayed: function () {
				if (this.delayedStack.length != 0) {
					var b = this.delayedStack.splice(0, 1)[0];
					this.pushContent(b, true);
				}
			},

			_updateSizes: function (isNormalSize: boolean) {
				for (var i = this.contentEntries.length, gui = null; i--; ) {
					gui = this.contentEntries[i];
					gui.subGui.updateOption(isNormalSize);
					gui.setContent(gui.subGui);
				}
				this.rearrangeContent();
			},

			modelChanged: function (model: any, msg: number, data: any) {
				if (model == sc.multiworld) {
					if (
						msg == sc.MULTIWORLD_MSG.ITEM_SENT &&
						sc.options.get("show-items")
					) {
						this.addEntry(data.item, data.player);
					}
				} else if (model == sc.model) {
					if (model.isReset()) {
						this.clearContent();
						this.delayedStack.length = 0;
						this.hide();
					} else if (
						model.isCutscene() ||
						model.isHUDBlocked() ||
						sc.quests.hasQuestSolvedDialogs()
					) {
							this.hide()
					} else if (
						!model.isCutscene() &&
						!model.isHUDBlocked() &&
						this.contentEntries.length > 0 &&
						!sc.quests.hasQuestSolvedDialogs()
					) {
						this.show();
					}
				} else if (model == sc.options && msg == sc.OPTIONS_EVENT.OPTION_CHANGED) {
					model = sc.options.get("item-hud-size");
					if (model != this.size) {
						this._updateSizes(model == sc.ITEM_HUD_SIZE.NORMAL);
						this.size = model;
					}
				}
			},
		});

		sc.APConnectionStatusGui = sc.TextGui.extend({
			init: function () {
				this.parent("", {font: sc.fontsystem.tinyFont});
				this.updateText();

				sc.Model.addObserver(sc.multiworld, this);
			},

			updateText: function () {
				this.setText(`AP: ${plugin.getColoredStatus(sc.multiworld.client.status.toUpperCase())}`);
			},

			modelChanged(model: any, msg: number, data: any) {
				if (model == sc.multiworld && msg == sc.MULTIWORLD_MSG.CONNECTION_STATUS_CHANGED) {
					this.updateText();
				}
			},
		});

		sc.PauseScreenGui.inject({
			init(...args) {
				this.parent(...args);

				this.apConnectionStatusGui = new sc.APConnectionStatusGui();

				this.apConnectionStatusGui.setAlign(this.versionGui.hook.align.x, this.versionGui.hook.align.y);
				this.apConnectionStatusGui.setPos(0, this.versionGui.hook.size.y * 2);

				this.versionGui.addChildGui(this.apConnectionStatusGui);

				this.apSettingsButton = new sc.ButtonGui("\\i[ap-logo] Archipelago Settings");
				this.apSettingsButton.setPos(3, 3);
				this.buttonGroup.addFocusGui(this.apSettingsButton);
				this.apSettingsButton.onButtonPress = function () {
					sc.menu.setDirectMode(true, sc.MENU_SUBMENU.AP_CONNECTION);
					sc.model.enterMenu(true);
				}.bind(this);

				this.addChildGui(this.apSettingsButton);
			},
		});

		sc.APConnectionBox = sc.BaseMenu.extend({
			gfx: new ig.Image("media/gui/menu.png"),

			fields: [
				{
					key: "hostname",
					label: "Hostname",
				},
				{
					key: "port",
					label: "Port",
				},
				{
					key: "name",
					label: "Slot Name",
				}
			],

			textGuis: [],
			inputGuis: [],

			textColumnWidth: 0,
			hSpacer: 5,
			vSpacer: 3,

			msgBox: null,
			msgBoxBox: null,
			inputList: null,
			content: null,
			connect: null,
			disconnect: null,
			buttonHolder: null,

			buttongroup: null,
			back: null,
			keepOpen: false,

			init: function () {
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

				this.inputList = new ig.GuiElementBase();

				for (let i = 0; i < this.fields.length; i++) {
					let textGui = new sc.TextGui(this.fields[i].label);
					this.textColumnWidth = Math.max(this.textColumnWidth, textGui.hook.size.x);
					textGui.hook.pos.y = (textGui.hook.size.y + this.vSpacer) * i;
					this.inputList.addChildGui(textGui);
					this.textGuis.push(textGui);

					let inputGui = new nax.ccuilib.InputField(200, textGui.hook.size.y);
					this.buttongroup.addFocusGui(inputGui, 0, i);
					inputGui.hook.pos.y = (textGui.hook.size.y + this.vSpacer) * i;
					
					if (sc.multiworld.connectionInfo) {
						//@ts-ignore
						let prefill = "" + sc.multiworld.connectionInfo[this.fields[i].key];
						inputGui.value = prefill.split("");
						inputGui.textChild.setText(prefill);
						inputGui.cursorPos = prefill.length;
						inputGui.cursor.hook.pos.x = inputGui.calculateCursorPos();
					}

					this.inputList.addChildGui(inputGui);
					this.inputGuis.push(inputGui);
				}
 
				for (const gui of this.inputGuis) {
					gui.hook.pos.x = this.textColumnWidth + this.hSpacer;
				}

				this.inputList.setSize(
					this.textColumnWidth + this.hSpacer + 200, 
					this.textGuis[0].hook.size.y * this.textGuis.length + this.vSpacer * (this.textGuis.length - 1)
				);

				this.content = new ig.GuiElementBase();

				this.msgBox = new sc.BlackWhiteBox(this.inputList.hook.size.x, this.inputList.hook.size.y);
				this.msgBox.setSize(this.inputList.hook.size.x + 22, this.inputList.hook.size.y + 10);
				this.msgBox.addChildGui(this.inputList);

				this.inputList.setAlign(ig.GUI_ALIGN.X_CENTER, ig.GUI_ALIGN.Y_CENTER);

				this.apConnectionStatusGui = new sc.APConnectionStatusGui();
				this.apConnectionStatusGui.setPos(7, 0);

				this.msgBoxBox = new ig.GuiElementBase();
				this.msgBoxBox.setSize(
					this.msgBox.hook.size.x,
					this.msgBox.hook.size.y + this.apConnectionStatusGui.hook.size.y
				);

				this.msgBox.setPos(0, this.apConnectionStatusGui.hook.size.y);

				this.msgBoxBox.addChildGui(this.apConnectionStatusGui);
				this.msgBoxBox.addChildGui(this.msgBox);
				this.msgBoxBox.setAlign(ig.GUI_ALIGN.X_CENTER, ig.GUI_ALIGN.Y_TOP);

				this.connect = new sc.ButtonGui("Connect", sc.BUTTON_MENU_WIDTH);
				this.connect.onButtonPress = this.connectFromInput.bind(this);
				this.buttongroup.addFocusGui(this.connect, 0, this.fields.length);

				this.disconnect = new sc.ButtonGui("Disconnect", sc.BUTTON_MENU_WIDTH);
				this.disconnect.onButtonPress = () => { sc.multiworld.client.disconnect() };
				this.disconnect.setPos(sc.BUTTON_MENU_WIDTH + this.hSpacer);
				this.buttongroup.addFocusGui(this.disconnect, 1, this.fields.length);

				this.buttonHolder = new ig.GuiElementBase();

				this.buttonHolder.addChildGui(this.connect);
				this.buttonHolder.addChildGui(this.disconnect);
				this.buttonHolder.setSize(sc.BUTTON_MENU_WIDTH * 2 + this.hSpacer, sc.BUTTON_TYPE.DEFAULT.height);
				this.buttonHolder.setAlign(ig.GUI_ALIGN.X_CENTER, ig.GUI_ALIGN.Y_BOTTOM);

				this.content.addChildGui(this.msgBoxBox);
				this.content.addChildGui(this.buttonHolder);
				this.content.setAlign(ig.GUI_ALIGN.X_CENTER, ig.GUI_ALIGN.Y_CENTER);

				this.content.setSize(
					Math.max(
						this.msgBoxBox.hook.size.x,
						this.buttonHolder.hook.size.x
					),
					this.msgBoxBox.hook.size.y + this.buttonHolder.hook.size.y + this.vSpacer,
				);
				this.addChildGui(this.content);

				this.doStateTransition("HIDDEN", true);
			},

			getOptions() {
				let result = {};
				for (let i = 0; i < this.fields.length; i++) {
					result[this.fields[i].key] = this.inputGuis[i].value.join("");
				}

				return result;
			},

			connectFromInput() {
				let options = this.getOptions();
				if (isNaN(options.port)) {
					sc.Dialogs.showErrorDialog(
						"Port is not a number",
						true,
					);
					return;
				}
				let portNumber = Number(options.port);

				if (portNumber > 65535 || portNumber < 1) {
					sc.Dialogs.showErrorDialog(
						"Port must be between 1 and 65535",
						true
					);
					return;
				}

				sc.multiworld.login({
					game: 'CrossCode',
					hostname: options.hostname,
					port: portNumber,
					items_handling: ap.ITEMS_HANDLING_FLAGS.REMOTE_ALL,
					name: options.name,
				});
			},

			showMenu: function () {
				this.parent();
				ig.interact.setBlockDelay(0.1);
				this.addObservers();
				this.msgBox.doStateTransition("DEFAULT");
				this.doStateTransition("DEFAULT");
			},

			hideMenu: function () {
				this.parent();
				ig.interact.setBlockDelay(0.1);
				this.removeObservers();
				this.msgBox.doStateTransition("HIDDEN");
				this.doStateTransition("HIDDEN", false);
			},

			onBackButtonPress: function () {
				sc.menu.popBackCallback();
				sc.menu.popMenu();
			},

			addObservers: function () {
				sc.Model.addObserver(sc.model, this);
			},

			removeObservers: function () {
				sc.Model.removeObserver(sc.model, this);
			},

			modelChanged: function(model: any, msg: number, data: any) {
				if (model == sc.multiworld && msg == sc.MULTIWORLD_MSG.CONNECTION_STATUS_CHANGED) {
				}
			},

			onDetach: function () {},
		});

		sc.MENU_SUBMENU.AP_CONNECTION = 300000;
		sc.SUB_MENU_INFO[sc.MENU_SUBMENU.AP_CONNECTION] = {
			Clazz: sc.APConnectionBox,
			name: "apConnection",
		};

		sc.CrossCode.inject({
			init(...args) {
				this.parent(...args);
				sc.multiWorldHud = new sc.MultiWorldHudBox();
				sc.gui.rightHudPanel.addHudBox(sc.multiWorldHud);
			},

			gotoTitle(...args) {
				if (sc.multiworld.client.status == ap.CONNECTION_STATUS.CONNECTED) {
					sc.multiworld.client.disconnect();
					// sc.multiworld.updateConnectionStatus();
				}
				this.parent(...args);
			},
		});
	}
}

function set(root, value, path, offset = 0) {
	if (path.length <= offset) {
		return;
	}
	while (offset < path.length - 1) {
		root = root[path[offset]];
		offset++;
	}

	if (path.length - 1 === offset) {
		root[path[offset]] = value;
	}
}
