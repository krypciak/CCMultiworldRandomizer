declare namespace ig {
	namespace EVENT_STEP {
		interface SEND_ITEM extends ig.EventStepBase {
			mwids: number[];
		}

		interface SendItemConstructor extends ImpactClass<SEND_ITEM> {
			new(settings: { mwids: number[] }): SEND_ITEM;
		}

		var SEND_ITEM: SendItemConstructor;
	}
}

declare namespace sc {
	enum MULTIWORLD_MSG {
		CONNECTION_STATUS_CHANGED,
		ITEM_SENT,
		OPTIONS_PRESENT,
	};

	interface MultiWorldModel extends ig.GameAddon, sc.Model, ig.Storage.Listener {
		client: ap.Client;
		previousConnectionStatus: ap.ConnectionStatus;

		baseId: number;
		baseNormalItemId: number;
		numItems: number;

		connectionInfo: ap.ConnectionInformation;
		lastIndexSeen: number;
        locationInfo: {[idx: number]: ap.NetworkItem};
        connectionInfo: ap.ConnectionInformation;
        localCheckedLocations: number[];
        mode: string;
        options: any;

		enterData(this: this, randoData: ItemData): void;
		getElementConstantFromComboId(this: this, comboId: number): number | null;
		getItemDataFromComboId(this: this, comboId: number): [itemId: number, quantity: number];

		notifyItemsSent(this: this, items: ap.NetworkItem[]): void;
		onLevelLoaded(this: this): void;
		updateConnectionStatus(this: this): void;
		addMultiworldItem(this: this, comboId: number, index: number): void;
		getLocationInfo(this: this, locations: number[], callback: (info: ap.NetworkItem[]) => void);
		async storeAllLocationInfo(this: this): void;
		async reallyCheckLocation(this: this, mwid: number): void;
		async reallyCheckLocations(this: this, mwids: number[]): void;
		async login(this: this, connectionInfo: ap.ConnectionInformation): void;
	}

	interface MultiWorldModelConstructor extends ImpactClass<MultiWorldModel> {
		new(): MultiWorldModel;
	}

	var MultiWorldModel: sc.MultiWorldModelConstructor;

	var multiworld: sc.MultiWorldModel;
}
