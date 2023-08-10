// don't trust ts-server, you can't replace this `require`
const fs = require("fs");

import * as ap from 'archipelago.js';
import {ItemData} from './item-data.model';

declare const sc: any;
declare const ig: any;

export default class MwRandomizer {
	baseDirectory: string;
	randoData: ItemData | null = null;
	itemdb: any;
	numItems: number = 0;
	lastIndexSeen: number = -1;

	baseId: number = 300000;
	baseNormalItemId: number = 300100;

	apClient: ap.Client | undefined = undefined;

	constructor(mod: {baseDirectory: string}) {
		console.log(arguments)
		this.baseDirectory = mod.baseDirectory
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
		return [comboId % this.numItems, (comboId / this.numItems) | 0 + 1];
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
					sc.model.player.setCore(sc.PLAYER_CORE[elementConstant], true);
				}
		} else {
			let [itemId, quantity] = this.getItemDataFromComboId(comboId);
			sc.model.player.addItem(Number(itemId), quantity, false);
		}

		this.lastIndexSeen = index;
	}

	async prestart() {
		const randoDataBuffer = await fs.promises.readFile(this.baseDirectory + "data/data.json");
		let randoData: ItemData = JSON.parse(randoDataBuffer as unknown as string);
		this.randoData = randoData;

		let maps = randoData.items;
		let quests = randoData.quests;

		const itemdbBuffer = await fs.promises.readFile("assets/data/item-database.json");
		let itemdb = JSON.parse(itemdbBuffer as unknown as string);
		this.itemdb = itemdb;
		this.numItems = itemdb.items.length;

		const client = new ap.Client();
		await client.connect({
			game: 'CrossCode',
			hostname: 'localhost',
			port: 38281,
			items_handling: ap.ITEMS_HANDLING_FLAGS.REMOTE_ALL,
			name: "CrossCodeTri",
		});

		window.client = client;

		const pkg = client.data.package.get('CrossCode');
		if (!pkg) {
			throw new Error('Cannot read package');
		}

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
					client.locations.check(check.mwid);

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
				
				client.locations.check(check.mwid);
			}
		});

		ig.EVENT_STEP.SEND_ITEM = ig.EventStepBase.extend({
			mwid: 0,
			init(settings) {
				this.mwid = settings.mwid;
			},
			start() {
				console.log(`sending check for location ${this.mwid}`)
				client.locations.check(this.mwid);
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
				client.locations.check(check.mwid);
			}
		});

		ig.Storage.inject({
			loadSlot(...args) {
				this.parent(...args);
				client.updateStatus(ap.CLIENT_STATUS.PLAYING);
			},
			onLevelLoaded(...args) {
				this.parent(...args);
				for (const [index, item] of client.items.received.entries()) {
					let comboId = item.item;
					plugin.addMultiworldItem(comboId, index);
				}
			}
		});
	}

	async main() {
		console.log("main");
		this.apClient?.updateStatus(ap.CLIENT_STATUS.READY);
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
