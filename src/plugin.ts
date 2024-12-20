import * as ap from 'archipelago.js';
import {WorldData, ItemInfo} from './item-data.model';
import {readJsonFromFile} from './utils';
import {applyPatches} from "./patches/index";

import type * as _ from 'nax-module-cache/src/headers/nax/moduleCache.d.ts'

declare global {
	namespace sc {
		var randoData: WorldData;
		var multiWorldHud: sc.MultiWorldHudBox;
	}
}

export default class MwRandomizer {
	baseDirectory: string;
	randoData!: WorldData;
	itemdb: any;

	constructor(mod: {baseDirectory: string}) {
		this.baseDirectory = mod.baseDirectory;
	}

	getColoredStatus(status: string) {
		switch (status.toLowerCase()) {
			case sc.MULTIWORLD_CONNECTION_STATUS.CONNECTED.toLowerCase():
				return `\\c[2]${status}\\c[0]`;
			case sc.MULTIWORLD_CONNECTION_STATUS.DISCONNECTED.toLowerCase():
				return `\\c[1]${status}\\c[0]`;
			case sc.MULTIWORLD_CONNECTION_STATUS.CONNECTING.toLowerCase():
				return `\\c[3]${status}\\c[0]`;
		}
	}

	getGuiString(item: {icon: string; label: string}): string {
		return `\\i[${item.icon}]${item.label}`;
	}

	async prestart() {
		window.moduleCache.registerModPrefix("mw-rando", this.baseDirectory.substring(7));
		ig.lib = this.baseDirectory.substring(7);

		let randoData: WorldData = await readJsonFromFile(this.baseDirectory + "data/out/data.json");
		this.randoData = randoData;
		sc.randoData = randoData;

		let itemdb = await readJsonFromFile("assets/data/item-database.json");
		this.itemdb = itemdb;

		// For those times JS decides to override `this`
		// Used several times in the injection code
		let plugin = this;

		applyPatches(this);

		sc.PartyModel.inject({
			addPartyMember(name: string, ...args) {
				this.parent(name, ...args);
				sc.party.getPartyMemberModel(name).setSpLevel(sc.model.player.spLevel);
			},
		});

		let mwIcons = new ig.Font(plugin.baseDirectory.substring(7) + "assets/media/font/icons-multiworld.png", 16, ig.MultiFont.ICON_START);

		let index = sc.fontsystem.font.iconSets.length;
		sc.fontsystem.font.pushIconSet(mwIcons);
		sc.fontsystem.font.setMapping({
			"mw-item": [index, 0],
			"ap-logo": [index, 2],
			"ap-item-unknown": [index, 2],
			"ap-item-trap": [index, 3],
			"ap-item-filler": [index, 4],
			"ap-item-useful": [index, 5],
			"ap-item-prog": [index, 6],
			"ap-locked": [index, 7],
		});

		sc.CrossCode.inject({
			init() {
				this.parent();
				sc.multiWorldHud = new sc.MultiWorldHudBox();
				sc.gui.rightHudPanel.addHudBox(sc.multiWorldHud);

				ig.input.bind(ig.KEY.PAGE_DOWN, "pgdn");
				ig.input.bind(ig.KEY.PAGE_UP, "pgup");
				ig.input.bind(ig.KEY.HOME, "home");
				ig.input.bind(ig.KEY.END, "end");
			},
		});
	}
}
