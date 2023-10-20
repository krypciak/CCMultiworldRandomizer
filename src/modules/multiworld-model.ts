import { defineVarProperty } from "../utils";
import * as ap from "archipelago.js";
import {ig, sc} from "ultimate-crosscode-typedefs";

ig.module("mw-rando.multiworld-model")
	.requires("impact.feature.storage.storage")
	.defines(() => {
		sc.MULTIWORLD_MSG = {
			CONNECTION_STATUS_CHANGED: 0,
			ITEM_SENT: 1,
			OPTIONS_PRESENT: 2,
		};

		sc.MultiWorldModel = ig.GameAddon.extend({
			observers: [],
			client: null,
			previousConnectionStatus: ap.CONNECTION_STATUS.DISCONNECTED,

			baseId: 3235824000,
			baseNormalItemId: 3235824100,
			numItems: 0,

			init() {
				this.client = new ap.Client();
				ig.storage.register(this);
				this.numItems = sc.inventory.items.length;

				defineVarProperty(this, "connectionInfo", "mw.connectionInfo");
				defineVarProperty(this, "lastIndexSeen", "mw.lastIndexSeen");
				defineVarProperty(this, "locationInfo", "mw.locationInfo");
				defineVarProperty(this, "localCheckedLocations", "mw.checkedLocations");
				defineVarProperty(this, "mode", "mw.mode");
				defineVarProperty(this, "options", "mw.options");

				window.setInterval(this.updateConnectionStatus.bind(this), 300);
			},

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
			},

			getItemDataFromComboId(comboId: number): [itemId: number, quantity: number] {
				if (this.numItems == 0) {
					throw "Can't fetch item data before item database is loaded";
				}

				comboId -= this.baseNormalItemId;
				return [comboId % this.numItems, (comboId / this.numItems + 1) | 0];
			},

			onStoragePostLoad() {
				if (this.connectionInfo) {
					console.log("Reading connection info from save file");
					this.login(this.connectionInfo);
				} else {
					sc.Dialogs.showInfoDialog(
						"This save file has no Archpelago connection associated with it. " +
							"To play online, open the pause menu and enter the details.",
						true,
					);
				}
			},

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
			},

			notifyItemsSent(items: ap.NetworkItem[]) {
				for (const item of items) {
					if (item.player == this.client.data.slot) {
						continue;
					}
					sc.Model.notifyObserver(this, sc.MULTIWORLD_MSG.ITEM_SENT, item);
				}
			},

			updateConnectionStatus() {
				if (this.previousConnectionStatus == this.client.status) {
					return;
				}

				this.previousConnectionStatus = this.client.status;

				sc.Model.notifyObserver(this, sc.MULTIWORLD_MSG.CONNECTION_STATUS_CHANGED, this.client.status);
			},

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
			},

			getLocationInfo(locations: number[], callback: (info: ap.NetworkItem[]) => void) {
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
			},

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
			},

			async reallyCheckLocation(mwid: number) {
				this.client.locations.check(mwid);

				let loc = this.locationInfo[mwid];
				if (loc == undefined) {
					this.getLocationInfo([mwid], sc.multiworld.notifyItemsSent.bind(sc.multiworld));
				} else {
					sc.multiworld.notifyItemsSent([loc]);

					// cut down on save file space by not storing what we have already
					delete this.locationInfo[loc.item];
				}

				if (this.localCheckedLocations.indexOf(mwid) >= 0) {
					return;
				}

				this.localCheckedLocations.push(mwid);
			},

			async reallyCheckLocations(mwids: number[]) {
				for (const mwid of mwids) {
					this.reallyCheckLocation(mwid);
				}
			},

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

					return;
				}

				this.client.addListener('ReceivedItems', (packet: ap.ReceivedItemsPacket) => {
					let index = packet.index;
					for (const [offset, item] of packet.items.entries()) {
						let comboId = item.item;
						this.addMultiworldItem(comboId, index + offset);
					}
				});

				this.connectionInfo = info;

				this.mode = this.client.data.slotData.mode;
				this.options = this.client.data.slotData.options;

				const obfuscationLevel: string = this.options.hiddenQuestObfuscationLevel;

				this.questSettings = {
					hidePlayer: obfuscationLevel == "hide_text" || obfuscationLevel == "hide_all",
					hideIcon: obfuscationLevel == "hide_all"
				};

				sc.Model.notifyObserver(sc.multiworld, sc.MULTIWORLD_MSG.OPTIONS_PRESENT);

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

				sc.multiworld.onLevelLoaded();
			},
		});

		ig.addGameAddon(() => {
			return (sc.multiworld = new sc.MultiWorldModel());
		});
	});
