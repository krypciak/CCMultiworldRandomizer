import MwRandomizer from "../plugin";

declare global {
	namespace sc {
		interface MultiworldLoginListenerGui extends ig.GuiElementBase, sc.MultiWorldModel.LoginListener {
			msgBox: sc.CenterBoxGui;
			content: ig.GuiElementBase;
			textChild: sc.TextGui; 

			buttonGroup: sc.ButtonGroup;
			buttonInteract: ig.ButtonInteractEntry;

			backButton: sc.ButtonGui;

			callback: () => void;

			show(this: this): void;
			hide(this: this, success: boolean): void;

			startLogin(
				this: this,
				info: Optional<sc.MultiWorldModel.AnyConnectionInformation>,
				mw: Optional<sc.MultiWorldModel.MultiworldVars>
			): void;

			onBackButtonPress(this: this): void;
		}

		interface MultiworldLoginListenerGuiConstructor extends ImpactClass<MultiworldLoginListenerGui> {
			new(callback: () => void): MultiworldLoginListenerGui;
		}

		var MultiworldLoginListenerGui: MultiworldLoginListenerGuiConstructor;
	}
}

export function patch(plugin: MwRandomizer) {
	sc.MultiworldLoginListenerGui = ig.GuiElementBase.extend({
		transitions: {
			DEFAULT: {
				state: { alpha: 1 },
				time: 0.2,
				timeFunction: KEY_SPLINES.EASE_OUT,
			},
			HIDDEN: {
				state: { alpha: 0 },
				time: 0.3,
				timeFunction: KEY_SPLINES.EASE_IN,
			},
		},

		init(callback) {
			this.parent();

			this.setSize(ig.system.width, ig.system.height);
			this.hook.zIndex = 99999999;
			this.hook.localAlpha = 0.8;
			this.hook.temporary = true;
			this.hook.pauseGui = true;

			this.buttonGroup = new sc.ButtonGroup();
			this.buttonInteract = new ig.ButtonInteractEntry();
			this.buttonInteract.pushButtonGroup(this.buttonGroup);

			this.content = new ig.GuiElementBase();
			this.content.setSize(240, 80);

			this.backButton = new sc.ButtonGui("\\i[back]Back", 100)
			this.backButton.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_BOTTOM);
			this.backButton.onButtonPress = this.onBackButtonPress.bind(this);
			this.backButton.submitSound = sc.BUTTON_SOUND.back;
			this.buttonGroup.addFocusGui(this.backButton, 0, 0);
			this.buttonInteract.addGlobalButton(this.backButton, sc.control.menuBack);
			this.content.addChildGui(this.backButton);

			this.textChild = new sc.TextGui("Logging in.", { maxWidth: 240 });
			this.content.addChildGui(this.textChild);

			this.msgBox = new sc.CenterBoxGui(this.content);
			this.msgBox.setAlign(ig.GUI_ALIGN.X_CENTER, ig.GUI_ALIGN.Y_CENTER);

			this.addChildGui(this.msgBox);

			this.callback = callback;

			this.doStateTransition("HIDDEN", true);
		},

		show() {
			ig.interact.addEntry(this.buttonInteract);
			ig.interact.setBlockDelay(0.2);
			this.doStateTransition("DEFAULT");
		},

		hide(success) {
			if (!success) {
				sc.multiworld.client.socket.disconnect();
			}
			ig.interact.removeEntry(this.buttonInteract);
			ig.interact.setBlockDelay(0.2);
			this.doStateTransition("HIDDEN", false, true);
		},

		startLogin(connectionInfo, mw) {
			sc.multiworld.login(connectionInfo, mw, this);
		},

		updateDrawables(renderer) {
			renderer.addColor("#000", 0, 0, this.hook.size.x, this.hook.size.y);
		},

		onBackButtonPress() {
			this.hide(false);
		},

		onLoginProgress(message) {
			this.textChild.setText(message);
		},

		onLoginError(message) {
			this.textChild.setText(`\\c[1]${message}`);
		},

		onLoginSuccess(message) {
			this.textChild.setText(`\\c[2]${message}`);
			this.hide(true);
			this.callback();
		},
	});

	sc.TitleScreenButtonGui.inject({
		init() {
			this.parent();

			let continueButton: sc.ButtonGui = this.namedButtons["continue"];

			let oldContinueCallback = continueButton.onButtonPress;

			continueButton.onButtonPress = () => {
				let slot: ig.SaveSlot = ig.storage.getSlot(ig.storage.lastUsedSlot);
				let mw = slot.data.vars.storage.mw;
				sc.multiworld.spawnLoginGui(mw?.connectionInfo, mw, oldContinueCallback);
			};

			let newGameButton: sc.ButtonGui = this.namedButtons["start"];

			let oldNewGameCallback = newGameButton.onButtonPress.bind(newGameButton);

			newGameButton.onButtonPress = () => {
				sc.menu.setDirectMode(true, sc.MENU_SUBMENU.AP_TEXT_CLIENT);
				sc.menu.exitCallback = () => {
					if (sc.multiworld.client.authenticated) {
						// unset New Game Plus to get the behavior I want from the callback.
						let oldNGP = this._newGamePlus;
						this._newGamePlus = false;
						oldNewGameCallback();
						this._newGamePlus = oldNGP;
					}
				};
				sc.model.enterMenu(true);
				if (!this._newGamePlus) {
					sc.Dialogs.showDialog(ig.lang.get("sc.gui.mw.warnings.no-new-game-plus"), sc.DIALOG_INFO_ICON.WARNING);
				}
			}
		},
	});

	sc.SaveList.inject({
		onSlotLoadPressed(button: sc.SaveSlotButton) {
			let callback = this.parent;
			let slot: ig.SaveSlot = ig.storage.getSlot(button.slot == -2 ? -1 : button.slot);
			let mw = slot.data.vars.storage.mw;
			sc.multiworld.spawnLoginGui(mw?.connectionInfo, mw, () => { callback(button); });
		}
	});

	sc.NewGameModeSelectDialog.inject({
		init(callback) {
			this.parent(callback);
			let oldCallback = this.buttongroup.pressCallbacks[0];

			this.buttongroup.pressCallbacks[0] = (button) => {
				this.hide();
				sc.menu.setDirectMode(true, sc.MENU_SUBMENU.AP_TEXT_CLIENT);
				sc.menu.exitCallback = () => {
					if (sc.multiworld.client.authenticated) {
						button.data = 0;
						oldCallback(button);
					}
				};
				sc.model.enterMenu(true);
			};
		}
	});

	sc.CrossCode.inject({
		start(startMode, transitionTime) {
			if (startMode == undefined || startMode == sc.START_MODE.STORY) {
				startMode = sc.START_MODE.NEW_GAME_PLUS;
			}
			this.parent(startMode, transitionTime);
		},
	});
}
