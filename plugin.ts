import * as ap from 'archipelago.js';

declare const sc: any;
declare const ig: any;

export default class MwRandomizer {
    async prestart() {
        const client = new ap.Client();

        await client.connect({
            game: 'CrossCode',
            hostname: 'TODO',
            port: 38281,
            items_handling: ap.ITEMS_HANDLING_FLAGS.REMOTE_DIFFERENT_WORLDS,
            name: Math.random() + '',
        });

        const pkg = client.data.package.get('CrossCode');
        if (!pkg) {
            throw new Error('Cannot read package');
        }

        const maps: { [mapName: string]: {
            chests: { [mapId: string]: number },
            events: { [mapId: string]: {
                path: string,
                locationId: number,
            }[], },
            element: { [element: number]: number }
        } } = {};
        const quests: { [name: string]: number } = {};

        for (const [name, id] of Object.entries(pkg.location_name_to_id)) {
            const [type, ...args] = name.split(';');
            switch (type) {
                case 'chest': {
                    const [map, mapId] = args;
                    maps[map] = maps[map] || { chests: {}, events: {}, element: {} };
                    maps[map].chests[mapId] = id;
                    break;
                }
                case 'event': {
                    const [map, mapId, path] = args;
                    maps[map] = maps[map] || { chests: {}, events: {}, element: {} };
                    maps[map].events[mapId] = maps[map].events[mapId] || [];
                    maps[map].events[mapId].push({
                        locationId: id,
                        path: path,
                    });
                    break;
                }
                case 'quest': {
                    const [name] = args;
                    quests[name] = id;
                    break;
                }
                case 'element': {
                    const [map, element] = args;
                    maps[map] = maps[map] || { chests: {}, events: {}, element: {} };
                    maps[map].element[sc.PLAYER_CORE[element]] = id;
                    break;
                }
            }
        }

        const items: {[apItemId: number]: {
            id: string,
            amount: number;
        }} = {};
        for (const [name, id] of Object.entries(pkg.item_name_to_id)) {
            items[id] = {
                id: name.split(';')[0],
                amount: +name.split(';')[1],
            };
        }

        client.addListener('ReceivedItems', packet => {
            for (const item of packet.items) {
                const local = items[item.item]
                switch (local.id) {
                    case 'ELEMENT_HEAT':
                    case 'ELEMENT_COLD':
                    case 'ELEMENT_WAVE':
                    case 'ELEMENT_SHOCK':
                        if (!sc.model.player.getCore(sc.PLAYER_CORE.ELEMENT_CHANGE)) {
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_CHANGE, true);
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_HEAT, false);
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_COLD, false);
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_WAVE, false);
                            sc.model.player.setCore(sc.PLAYER_CORE.ELEMENT_SHOCK, false);
                        }
                        sc.model.player.setCore(sc.PLAYER_CORE[local.id], true);
                        break;
                    default:
                        sc.model.player.addItem(Number(local.id), local.amount, false);
                        break;
                }
            }
        });


        ig.ENTITY.Chest.inject({
            _reallyOpenUp() {
                const map = maps[ig.game.mapName];
                if (!map) {
                    console.warn('Chest not in logic');
                    return this.parent();
                }
                const check = map.chests[this.mapId];
                if (check === undefined) {
                    console.warn('Chest not in logic');
                    return this.parent();
                }

                const old = sc.ItemDropEntity.spawnDrops;
                try {
                    client.locations.check(check);

                    this.amount = 0;
                    return this.parent();
                } finally {
                    sc.ItemDropEntity.spawnDrops = old;
                }
            }
        });

        const elementCores = [sc.PLAYER_CORE.ELEMENT_HEAT, sc.PLAYER_CORE.ELEMENT_COLD, sc.PLAYER_CORE.ELEMENT_WAVE, sc.PLAYER_CORE.ELEMENT_SHOCK];
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