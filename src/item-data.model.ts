export interface WorldData {
	items: RawItems;
	quests: RawQuests;
}

export type RawItems = { [mapName: string]: RawMapItems };

export interface RawMapItems {
	chests?: RawChests;
	cutscenes?: RawEvents;
	elements?: RawElements;
}

export type RawChests = { [mapId: string]: RawChest };

export interface RawChest {
	mwids: number[];
}

export type RawEvents = { [mapId: string]: RawEvent[] };

export interface RawEvent {
	mwids: number[];
	path: string;
}

export type RawElements = { [mapId: string]: RawElement };

export interface RawElement {
	mwids: number[];
}

export type RawQuests = { [questName: string]: RawQuest };

export interface RawQuest {
	mwids: number[];
}
