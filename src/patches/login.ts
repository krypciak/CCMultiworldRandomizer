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
				info: sc.MultiWorldModel.AnyConnectionInformation,
				mw: sc.MultiWorldModel.MultiworldVars
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

			this.textChild = new sc.TextGui("Logging in...", { maxWidth: 240 });
			this.content.addChildGui(this.textChild);

			this.msgBox = new sc.CenterBoxGui(this.content);
			this.msgBox.setAlign(ig.GUI_ALIGN.X_CENTER, ig.GUI_ALIGN.Y_CENTER);

			this.addChildGui(this.msgBox);

			this.callback = callback;

			this.doStateTransition("HIDDEN", true);
		},

		show() {
			ig.interact.addEntry(this.buttonInteract);
			this.doStateTransition("DEFAULT");
		},

		hide(success) {
			if (!success) {
				sc.multiworld.client.socket.disconnect();
			}
			ig.interact.removeEntry(this.buttonInteract);

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

		onLoginSuccess() {
			this.hide(true);
			this.callback();
		},
	});

	sc.TitleScreenButtonGui.inject({
		init() {
			this.parent();

			let continueButton: sc.ButtonGui = this.namedButtons["continue"];

			let oldCallback = continueButton.onButtonPress;

			continueButton.onButtonPress = () => {
				let listenerGui = new sc.MultiworldLoginListenerGui(oldCallback);
				ig.gui.addGuiElement(listenerGui);
				listenerGui.show();
				let slot: ig.SaveSlot = ig.storage.getSlot(ig.storage.lastUsedSlot);
				let mw = slot.data.vars.storage.mw;
				listenerGui.startLogin(mw?.connectionInfo, mw);
			};
		}
	});
}
