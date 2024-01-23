import type MwRandomizer from "../plugin";
import "../types/multiworld-model.d";

export function patch(plugin: MwRandomizer) {
	let quests = plugin.randoData?.quests;
	sc.QuestModel.inject({
		_collectRewards(quest: sc.Quest) {
			const check = quests?.[quest.id];
			if (
				check == undefined ||
				check.mwids == undefined ||
				check.mwids.length == 0 ||
				sc.multiworld.locationInfo[check.mwids[0]] === undefined
			) {
				return this.parent(quest);
			}

			sc.multiworld.reallyCheckLocations(check.mwids);
		},
	});

	sc.QuestDialogWrapper.inject({
		init(
			quest: sc.Quest,
			callback: CallableFunction,
			finished: bool,
			characterName: string,
			mapName: string,
		) {
			this.parent(quest, callback, finished, characterName, mapName);
			this.questBox.hook.pos.y = -13;

			if (this.overlay) {
				this.questBox.removeChildGui(this.overlay);
				this.overlay = new ig.BoxGui(281, 246, false, this.questBox.ninepatch);
				this.overlay.hook.transitions = {
					DEFAULT: { state: {}, time: 0.2, timeFunction: KEY_SPLINES.LINEAR },
					HIDDEN: {
						state: { alpha: 0 },
						time: 0.2,
						timeFunction: KEY_SPLINES.LINEAR,
					},
				};
				this.overlay.doStateTransition("HIDDEN", true);
				this.questBox.addChildGui(this.overlay);
			}

			sc.Model.addObserver(sc.multiworld, this.questBox);
		},

		_close(a) {
			this.parent(a);

			sc.Model.removeObserver(sc.multiworld, this.questBox);
		},
	});

	sc.QuestDialog.inject({
		init(quest: sc.Quest, finished: boolean) {
			this.parent(quest, finished);

			this.finished = finished;

			this.hook.align.x = ig.GUI_ALIGN.Y_TOP;
			this.hook.size.y = 246;
		},

		setQuestRewards(quest: sc.Quest, hideRewards: boolean, finished: boolean) {
			this.parent(quest, hideRewards, finished);
			let mwQuest = plugin.randoData?.quests[quest.id];
			this.mwQuest = mwQuest;
			if (
				mwQuest === undefined ||
				mwQuest.mwids === undefined ||
				mwQuest.mwids.length === 0 ||
				sc.multiworld.locationInfo[mwQuest.mwids[0]] === undefined
			) {
				return;
			}

			this.removeChildGui(this.itemsGui);

			this.scrollBox = new sc.ScrollPane(sc.ScrollType.Y_ONLY);
			this.scrollBox.setSize(146, finished ? 65 : 88);
			this.scrollBox.showTopBar = false;
			this.scrollBox.showBottomBar = false;
			this.scrollBox.setPos(124, finished ? 180 : 157);

			this.newItemsGui = new ig.GuiElementBase();

			this.scrollBox.setContent(this.newItemsGui);

			this.addChildGui(this.scrollBox);
			
			plugin.makeApItemsGui(quest, !hideRewards, mwQuest, this.newItemsGui, this.gfx, 144);
			this.scrollBox.recalculateScrollBars();
		},

		modelChanged(model: sc.Model, msg: number, data: any) {
			if (
				model == sc.multiworld &&
				msg == sc.MULTIWORLD_MSG.CONNECTION_STATUS_CHANGED &&
				this.mwQuest &&
				sc.multiworld.locationInfo[this.mwQuest.mwids[0]] === undefined
			) {
				plugin.makeApItemsGui(this.quest, this.finished, this.mwQuest, this.newItemsGui, this.gfx, 144);
			}
		},

		update() {
			if (!ig.interact.isBlocked()) {
				if (sc.control.menuScrollUp()) {
					this.scrollBox.scrollY(-20, false, 0.05);
				} else if (sc.control.menuScrollDown()) {
					this.scrollBox.scrollY(20, false, 0.05);
				}
			}
		}
	});

	sc.QuestDetailsView.inject({
		_setQuest(quest: sc.Quest) {
			this.parent(quest);
			let mwQuest = plugin.randoData.quests[quest.id]
			if (
				mwQuest === undefined ||
				sc.multiworld.locationInfo[mwQuest.mwids[0]] === undefined
			) {
				return;
			}
			
			plugin.makeApItemsGui(quest, false, mwQuest, this.itemsGui, this.gfx, 145);
		}
	});

	// Move the quest decline button to the right of the quest accept button.
	// This is needed so that we can increase the height of the quest dialog.
	sc.QuestStartDialogButtonBox.inject({
		init(
			buttonGroup: sc.ButtonGroup,
			finished: boolean,
			mandatory: boolean,
			parentQuest: boolean,
		) {
			this.parent(buttonGroup, finished, mandatory, parentQuest);
			this.setSize(
				(finished || mandatory) ? 142 : 281,
				25
			);
			this.declineButton.setPos(142, 3);

			buttonGroup.removeFocusGui(0, 1);
			buttonGroup.addFocusGui(this.declineButton, 1, 0);
		}
	});
}
