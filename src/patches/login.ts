import MwRandomizer from "../plugin";

declare global {
	namespace sc {
		interface MultiworldLoginListenerGui extends ig.GuiElementBase, sc.MultiWorldModel.LoginListener {
			msgBox: sc.CenterBoxGui;
			content: ig.GuiElementBase;
			textChild: sc.TextGui; 
			callback: () => void;
		}

		interface MultiworldLoginListenerGuiConstructor extends ImpactClass<MultiworldLoginListenerGui> {
			new(callback: () => void): MultiworldLoginListenerGui;
		}

		var MultiworldLoginListenerGui: MultiworldLoginListenerGuiConstructor;
	}
}

export function patch(plugin: MwRandomizer) {
	sc.MultiworldLoginListenerGui = ig.GuiElementBase.extend({
		init(callback) {
			this.parent();

			this.onLoginSuccess = callback;

			this.content = new ig.GuiElementBase();
			this.content.setSize(240, 80);

			this.textChild = new sc.TextGui("Logging in...", { maxWidth: 240 });
			this.content.addChildGui(this.textChild);

			this.msgBox = new sc.CenterBoxGui(this.content);
		},

		onLoginProgress(message) {
			this.textChild.setText(message);
		},

		onLoginError(message) {
			this.textChild.setText(`\\c[2]${message}`);
		},

		onLoginSuccess() {
			this.doStateTransition("HIDDEN", false, true);
			this.callback();
		},
	});

	sc.TitleScreenButtonGui.inject({
		init() {
			this.parent();

			let continueButton: sc.ButtonGui = this.namedButtons["continue"];

			let oldCallback = continueButton.onButtonPress;

			continueButton.onButtonPress = () => {

			};
		}
	});
}
