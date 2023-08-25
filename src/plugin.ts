// don't trust ts-server, you can't replace this `require`
const fs = require("fs");

import * as ap from 'archipelago.js';
import {NetworkItem} from 'archipelago.js';
import {ItemData} from './item-data.model';
import {readJsonFromFile} from './utils';

declare const sc: any;
declare const ig: any;

export default class MwRandomizer {
	baseDirectory: string;
	randoData: ItemData | null = null;
	itemdb: any;
	numItems: number = 0;

	baseId: number = 300000;
	baseNormalItemId: number = 300100;

	client: ap.Client;

	declare lastIndexSeen: number;
	declare locationInfo: {[idx: number]: ap.NetworkItem};
	declare connectionInfo: ap.ConnectionInformation;
	declare localCheckedLocations: number[];

	defineVarProperty(name: string, igVar: string) {
		Object.defineProperty(this, name, {
			get() {
				return ig.vars.get(igVar);
			},
			set(newValue: any) {
				ig.vars.set(igVar, newValue);
			},
		});
	}

	constructor(mod: {baseDirectory: string}) {
		this.baseDirectory = mod.baseDirectory
		this.client = new ap.Client();
	}

	getElementConstantFromComboId(comboId: number): number | null {
		switch (comboId) {
			case this.baseId:
				return sc.PLAYER_CORE.ELEMENT_HEAT;
			case this.baseId + 1:
				return sc.PLAYER_CORE.ELEMENT_COLD;
			case this.baseId + 2:
				return sc.PLAYER_CORE.ELEMENT_SHOCK;
			case this.baseId + 3:
				return sc.PLAYER_CORE.ELEMENT_WAVE;
			default:
				return null;
		}
	}

	getItemDataFromComboId(comboId: number): [itemId: number, quantity: number] {
		if (this.numItems == 0) {
			throw "Can't fetch item data before item database is loaded";
		}

		comboId -= this.baseNormalItemId;
		return [comboId % this.numItems, (comboId / this.numItems + 1) | 0];
	}

	addMultiworldItem(comboId: number, index: number): void {
		if (index <= this.lastIndexSeen) {
			return;
		}

		if (comboId < this.baseNormalItemId) {
			if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
				sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
				sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
				sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
				sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
				sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
			}
			let elementConstant = this.getElementConstantFromComboId(comboId);
			if (elementConstant != null) {
				sc.model.player.setCore(elementConstant, true);
			}
		} else {
			let [itemId, quantity] = this.getItemDataFromComboId(comboId);
			sc.model.player.addItem(Number(itemId), quantity, false);
		}

		this.lastIndexSeen = index;
	}

	async storeAllLocationInfo() {
		let listener = (packet: ap.LocationInfoPacket) => {
			let locationInfoMap = {};
			packet.locations.forEach((item: any) => {
				let mwid: number = item.location;
				
				// cut down on save file space by not storing unimportant parts
				// item.location is redundant because you'll have the key whenever that's relevant
				// item.class is a string which is the same for every instance
				// together this saves several kilobytes of space in the save data
				delete item.location;
				delete item.class;
				// @ts-ignore
				locationInfoMap[mwid] = item;

				ig.vars.set("mw.locationInfo", locationInfoMap);
			});

			this.client.removeListener("LocationInfo", listener);
		};

		this.client.addListener('LocationInfo', listener);

		this.client.locations.scout(
			ap.CREATE_AS_HINT_MODE.NO_HINT,
			...this.client.locations.missing
		);
	}

	getLocationInfo(locations: number[], callback: (info: NetworkItem[]) => void) {
		let listener = (packet: ap.LocationInfoPacket) => {
			let matches = true;
			for (let i = 0; i < locations.length; i++) {
				if (packet.locations[i].location != locations[i]) {
					matches = false;
					break;
				}
			}

			if (!matches) {
				return;
			}

			this.client.removeListener("LocationInfo", listener);

			callback(packet.locations);
		};

		this.client.addListener('LocationInfo', listener);

		this.client.locations.scout(
			ap.CREATE_AS_HINT_MODE.NO_HINT,
			...locations
		);
	}

	notifyItemsSent(items: NetworkItem[]) {
		for (const item of items) {
			if (item.player == this.client.data.slot) {
				continue;
			}
			sc.Model.notifyObserver(sc.model.player, sc.PLAYER_MSG.MW_ITEM_SENT, item);
		}
	}

	async reallyCheckLocation(mwid: number) {
		this.client.locations.check(mwid);

		let loc = this.locationInfo[mwid];
		if (loc == undefined) {
			this.getLocationInfo([mwid], this.notifyItemsSent);
		} else {
			this.notifyItemsSent([loc]);

			// cut down on save file space by not storing what we have already
			delete this.locationInfo[loc.item];
		}

		if (this.localCheckedLocations.indexOf(mwid) >= 0) {
			return;
		}

		this.localCheckedLocations.push(mwid);
	}

	async login(info: ap.ConnectionInformation) {
		try {
			await this.client.connect(info);
		} catch (e) {
			sc.Dialogs.showErrorDialog(
				"Could not connect to Archipelago server. " +
					"You may still be able to play if you have logged in to this server before, " + 
					"but your progress will not be uploaded until " +
					"you connect to the server.",
				true
			);
			console.error("Could not connect to Archipelago server: ", e);
		}

		this.connectionInfo = info;

		this.client.updateStatus(ap.CLIENT_STATUS.PLAYING);

		if (this.locationInfo == null) {
			this.storeAllLocationInfo();
		}

		let checkedSet = new Set(this.client.locations.checked);

		for (const location of this.localCheckedLocations) {
			if (!checkedSet.has(location)) {
				this.reallyCheckLocation(location);
			}
		}

		this.onLevelLoaded();
	}

	onStoragePostLoad() {
		if (this.client.status == ap.CONNECTION_STATUS.CONNECTED) {
			this.client.disconnect();
		}

		if (!this.connectionInfo) {
			console.log("Reading connection info from file");
			// temporary -- import connection info from a JSON file
			// eventually this will be a ui in game
			readJsonFromFile("apConnection.json")
				.catch(e => {
					sc.Dialogs.showErrorDialog(
						"Could not read 'apConnection.json'. " +
							"If you want to play online, please create this file " + 
							"and fill it with connection details.",
						true
					);
					console.error("Could not read apConnection.json: ", e);
				})
				.then(file => {
					this.login({
						game: 'CrossCode',
						hostname: file.hostname,
						port: file.port,
						items_handling: ap.ITEMS_HANDLING_FLAGS.REMOTE_ALL,
						name: file.name,
					});
				});
		} else {
			console.log("Reading connection info from save file");
			this.login(this.connectionInfo);
		}
	}

	onLevelLoaded() {
		if (this.lastIndexSeen == null) {
			this.lastIndexSeen = -1;
		}

		if (!this.localCheckedLocations) {
			this.localCheckedLocations = [];
		}

		for (let i = this.lastIndexSeen + 1; i < this.client.items.received.length; i++) {
			let item = this.client.items.received[i];
			let comboId = item.item;
			this.addMultiworldItem(comboId, i);
		}
	}

	async prestart() {
		this.defineVarProperty("lastIndexSeen", "mw.lastIndexSeen");
		this.defineVarProperty("locationInfo", "mw.locationInfo");
		this.defineVarProperty("connectionInfo", "mw.connectionInfo");
		this.defineVarProperty("localCheckedLocations", "mw.checkedLocations");

		let randoData: ItemData = await readJsonFromFile(this.baseDirectory + "data/data.json")
		this.randoData = randoData;

		let maps = randoData.items;
		let quests = randoData.quests;

		let itemdb = await readJsonFromFile("assets/data/item-database.json");
		this.itemdb = itemdb;

		this.numItems = itemdb.items.length;

		let client = this.client;

		// @ts-ignore
		window.apclient = client;

		client.addListener('ReceivedItems', packet => {
			let index = packet.index;
			for (const [offset, item] of packet.items.entries()) {
				let comboId = item.item;
				this.addMultiworldItem(comboId, index + offset);
			}
		});

		// For those times JS decides to override `this`
		// Used several times in the injection code
		let plugin = this;

		ig.ENTITY.Chest.inject({
			_reallyOpenUp() {
				const map = maps[ig.game.mapName];
				
				if (!map) {
					console.warn('Chest not in logic');
					return this.parent();
				}
				const check = map.chests[this.mapId];
				if (check === undefined || check.mwid === undefined) {
					console.warn('Chest not in logic');
					return this.parent();
				}

				const old = sc.ItemDropEntity.spawnDrops;
				try {
					plugin.reallyCheckLocation(check.mwid);

					this.amount = 0;
					return this.parent();
				} finally {
					sc.ItemDropEntity.spawnDrops = old;
				}
			}
		});

		ig.EVENT_STEP.SET_PLAYER_CORE.inject({
			start() {
				const map = maps[ig.game.mapName];
				if (!map || !map.elements) {
					return this.parent();
				}

				const check = map.elements[this.core];
				if (check === undefined) {
					return this.parent();
				}
				
				plugin.reallyCheckLocation(check.mwid);
			}
		});

		ig.EVENT_STEP.SEND_ITEM = ig.EventStepBase.extend({
			mwid: 0,
			init(settings) {
				this.mwid = settings.mwid;
			},
			start() {
				plugin.reallyCheckLocation(this.mwid);
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
							&& mapOverrides.events[entity.settings.mapId]
						) {
								for (const check of mapOverrides.events[entity.settings.mapId]) {
									const path = check.path.slice(1).split(/\./g);
									if (check.mwid == null) {
										continue;
									}
									set(entity, 'SEND_ITEM', [...path, 'type']);
									set(entity, check.mwid, [...path, 'mwid']);
								}
							}
					}
				}

				return this.parent(map, ...args);
			}
		});

		sc.QuestModel.inject({
			_collectRewards(quest) {
				const check = quests[quest.id];
				if (check === undefined) {
					return this.parent(quest);
				}
				if (check.mwid === undefined) {
					return this.parent(arguments);
				}
				plugin.reallyCheckLocation(check.mwid);
			}
		});

		ig.Storage.inject({
			onLevelLoaded(...args) {
				this.parent(...args);
				plugin.onLevelLoaded();
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
			textGui: null,
			init: function (mwid: number, player: number) {
				this.parent();
				this.id = mwid == void 0 ? -1 : mwid;
				this.player = player;
				this.timer = 5;

				let playerObj = client.players.get(player);
				let destGameName = playerObj?.game;
				let itemName = "Unknown";
				if (destGameName != undefined) {
					let gameInfo = client.data.package.get(destGameName)
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

		sc.PLAYER_MSG["MW_ITEM_SENT"] = 300001;

		sc.MultiWorldHudBox = sc.RightHudBoxGui.extend({
			delayedStack: [],
			size: 0,

			init: function() {
				this.parent("ARCHIPELAGO");
				this.size = sc.options.get("item-hud-size");
				sc.Model.addObserver(sc.model.player, this);
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
				if (model == sc.model.player) {
					if (
						msg == sc.PLAYER_MSG.MW_ITEM_SENT &&
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

		sc.CrossCode.inject({
			init(...args) {
				this.parent(...args);
				sc.multiWorldHud = new sc.MultiWorldHudBox();
				sc.gui.rightHudPanel.addHudBox(sc.multiWorldHud);
			},

			gotoTitle(...args) {
				if (client.status == ap.CONNECTION_STATUS.CONNECTED) {
					client.disconnect();
				}
				this.parent(...args);
			},
		});
	}

	async main() {
		ig.storage.register(this);
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
