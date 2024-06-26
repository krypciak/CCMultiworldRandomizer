import * as ap from "archipelago.js";
import type MwRandomizer from "../plugin";
import type { ItemInfo, RawQuest } from "../item-data.model";
import { getElementIconString } from "../utils";

declare global {
	namespace sc {
		namespace TextMarqueeGui {
			interface Settings extends sc.TextGui.Settings {
				autoScroll?: boolean;
				scrollSpeed?: number;
				holdTime?: number;
			}
		}

		interface TextMarqueeGui extends ig.GuiElementBase {
			textGui: sc.TextGui;
			autoScroll: boolean;
			scrollSpeed: number;
			holdTime: number;
			currentPosition: number;
			direction: number;
			timer: number;

			setText(this: this, text: string): void;
		}

		interface TextMarqueeGuiConstructor extends ImpactClass<TextMarqueeGui> {
			new(text: string, width: number, settings: sc.TextMarqueeGui.Settings | undefined): TextMarqueeGui;
		}

		var TextMarqueeGui: sc.TextMarqueeGuiConstructor;

		interface ItemMarqueeGui extends ig.GuiElementBase {
			iconGui: sc.TextGui;
			labelGui: sc.TextMarqueeGui;

			setText(this: this, text: string): void;
		}

		interface ItemMarqueeGuiConstructor extends ImpactClass<ItemMarqueeGui> {
			new(icon: string, label: string, width: number): ItemMarqueeGui;
		}

		var ItemMarqueeGui: sc.ItemMarqueeGuiConstructor;

		interface MultiWorldItemMarqueeGui extends sc.ItemMarqueeGui {
			worldGui: sc.TextGui;
			itemInfo: ItemInfo;

			setText(this: this, text: string): void;
		}

		interface MultiWorldItemMarqueeGuiConstructor extends ImpactClass<MultiWorldItemMarqueeGui> {
			new(data: ItemInfo, width: number): MultiWorldItemMarqueeGui;
		}

		var MultiWorldItemMarqueeGui: sc.MultiWorldItemMarqueeGuiConstructor;
	}
}

export function patch(plugin: MwRandomizer) {
	const DEFAULT_SCROLL_SPEED = 30;
	const DEFAULT_HOLD_TIME = 1;

	sc.TextMarqueeGui = ig.GuiElementBase.extend({
		init(text: string, width: number, settings: sc.TextMarqueeGui.Settings | undefined) {
			this.parent();

			this.textGui = new sc.TextGui(text, settings);

			this.addChildGui(this.textGui);

			this.setSize(width, this.textGui.hook.size.y);
			this.hook.clip = true;

			this.autoScroll = settings?.autoScroll || false;
			this.scrollSpeed = settings?.scrollSpeed || DEFAULT_SCROLL_SPEED;
			this.holdTime = settings?.holdTime || DEFAULT_HOLD_TIME;

			this.currentPosition = 0;
			this.direction = 0;
			this.timer = this.holdTime;
		},

		setText(text) {
		    this.textGui.setText(text);
		},

		update() {
			this.parent();

			if (this.textGui.hook.size.x < this.hook.size.x) {
				this.textGui.hook.pos.x = 0;
				return;
			}

			const prevPos = this.textGui.hook.pos.x;
			if (this.direction == 0) {
				if (this.timer > 0) {
					this.timer -= ig.system.actualTick;
					return;
				} else {
					this.direction = prevPos < 0 ? 1 : -1;
				}
			}

			let nextPos = prevPos + Math.sign(this.direction) * this.scrollSpeed * ig.system.actualTick;

			if (this.direction < 0 && nextPos < this.hook.size.x - this.textGui.hook.size.x) {
				nextPos = this.hook.size.x - this.textGui.hook.size.x;
				this.direction = 0;
				this.timer = this.holdTime;
			} else if (this.direction > 0 && nextPos > 0) {
				nextPos = 0;
				this.direction = 0;
				this.timer = this.holdTime;
			}

			this.textGui.hook.pos.x = nextPos;
		},
	});

	sc.ItemMarqueeGui = ig.GuiElementBase.extend({
		init(icon: string, label: string, width: number) {
			this.parent();

			this.iconGui = new sc.TextGui(`\\i[${icon}]`);
			this.addChildGui(this.iconGui);

			this.labelGui = new sc.TextMarqueeGui(label, width - 15, { autoScroll: false });
			this.labelGui.hook.pos.x = 15;
			this.addChildGui(this.labelGui);

			this.hook.size.x = width;
			this.hook.size.y = this.iconGui.hook.size.y;
		},

		setText(text) {
		    this.labelGui.setText(text);
		},
	});

	sc.MultiWorldItemMarqueeGui = sc.ItemMarqueeGui.extend({
		init(itemInfo: ItemInfo, width: number) {
			this.parent(itemInfo.icon, itemInfo.label, width);

			this.itemInfo = itemInfo;

			this.worldGui = new sc.TextGui(itemInfo.player, { "font": sc.fontsystem.tinyFont });
			this.worldGui.setPos(2, this.iconGui.hook.size.y - 2);
			this.addChildGui(this.worldGui);

			this.hook.size.y += 4;
		}
	});
}
