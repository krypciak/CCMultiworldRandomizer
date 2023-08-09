import * as ap from 'archipelago.js';
const fs = require("fs");
import {ItemData} from './item-data.model';

declare const sc: any;
declare const ig: any;

export default class MwRandomizer {
	baseDirectory: string;
	randoData: ItemData | null = null;
	itemDB: any;
	numItems: number = 0;

	baseId: number = 300000;
	baseNormalItemId: number = 300100;

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

	async prestart() {
		const randoDataBuffer = await fs.promises.readFile(this.baseDirectory + "data/data.json");
		let randoData: ItemData = JSON.parse(randoDataBuffer as unknown as string);
		this.randoData = randoData;

		const itemDBBuffer = await fs.promises.readFile(this.baseDirectory + "data/data.json");
		let itemDB: ItemData = JSON.parse(itemDBBuffer as unknown as string);
		this.itemDB = itemDB;

		const client = new ap.Client();
		// await client.connect({
		// 	game: 'CrossCode',
		// 	hostname: 'localhost',
		// 	port: 38281,
		// 	items_handling: ap.ITEMS_HANDLING_FLAGS.REMOTE_DIFFERENT_WORLDS,
		// 	name: "CrossCodeTri",
		// });

		const pkg = client.data.package.get('CrossCode');
		if (!pkg) {
			throw new Error('Cannot read package');
		}

		client.addListener('ReceivedItems', packet => {
			for (const item of packet.items) {
				let comboId = item.item;

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
			}
		});

		ig.ENTITY.Chest.inject({
			_reallyOpenUp() {
				const map = randoData.items[ig.game.mapName];
				
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
			init(settings) {
				this.bypass = !!settings.bypass;
				this.alsoGiveElementChange = !!settings.alsoGiveElementChange;
				return this.parent(settings);
			},

			start() {
				if (this.alsoGiveElementChange) {
					if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
						sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
					}
				}

				if (this.bypass || !elementCores.includes(this.core) || !this.value) {
					return this.parent();
				}

				const map = maps[ig.game.mapName];
				if (!map) {
					return this.parent();
				}

				const check = map.element[this.core];
				if (check === undefined) {
					return this.parent();
				}
				
				client.locations.check(check);
			}
		});

		ig.EVENT_STEP.SEND_ITEM = ig.EventStepBase.extend({
			locationId: 0,
			init(settings) {
				this.locationId = settings.locationId;
			},
			start() {
				client.locations.check(this.locationId);
			}
		});

		ig.Game.inject({
			loadLevel(map, ...args) {
				const mapOverrides = maps[map.name.replace(/[\\\/]/g, '.')];
				if (mapOverrides) {
					for (const entity of map.entities) {
						if (entity
							&& entity.settings
							&& entity.settings.mapId
							&& mapOverrides[entity.settings.mapId]
							&& mapOverrides[entity.settings.mapId].events
							&& mapOverrides[entity.settings.mapId].events[0]
							&& mapOverrides[entity.settings.mapId].events[0].type === 'event') {
								for (const check of mapOverrides.events[entity.settings.mapId]) {
									const path = check.path.slice(1).split(/\./g);
									set(entity, 'SEND_ITEM', [...path, 'type']);
									set(entity, check.locationId, [...path, 'locationId']);
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
				client.locations.check(check);
			}
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
