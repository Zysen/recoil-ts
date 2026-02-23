import {Widget} from "./widget.ts";
import {WidgetScope} from "./widgetscope.ts";
import {createDom, removeChildren, setElementShown} from "../dom/dom.ts";
import {TagName} from "../dom/tags.ts";
import {BoolWithExplanation} from "../booleanwithexplain.ts";
import {getGroup, StandardOptions, StandardOptionsBoundType, StandardOptionsType} from "../frp/util.ts";
import {WidgetHelper} from "../widgethelper.ts";
import {isEqual} from "../../util/object.ts";
import {AttachType} from "../../frp/struct.ts";
import {Behaviour} from "../../frp/frp.ts";
import {EventType} from "../dom/eventtype.ts";
import {EventHandler} from "../eventhelper.ts";
import {EnabledTooltipHelper} from "../tooltiphelper.ts";
import {AvlTree} from "../../structs/avltree.ts";
import {enable} from "../dom/classlist.ts";
import {MenuAnchoredPosition} from "../positioning/menuanchoredposition.ts";
import {Corner} from "../positioning/positioning.ts";

export type RendererFn<Type> = (obj: Type, valid: boolean, enabled: BoolWithExplanation) => Element;
export type EnabledItemsType<Type> = BoolWithExplanation[] | AvlTree<{ key: Type; value: BoolWithExplanation }, {
    key: Type
}> | Map<Type, BoolWithExplanation>;

export class SelectorWidget<Type> extends Widget {

    private configB_?: Behaviour<{
        name: string,
        value: Type,
        list: Type[],
        // this can be a map or a list, just for backwards compatibility, really a map is much easier
        // to use. To use is a list the index in enabledItems has to match the index in list, if it is there
        // it uses that to enable/disable the option, otherwise the option is enabled.
        //
        // to use the map, create a map with the items you wish to disable, the reason that AvlTree is allowed
        // because it allows overrinding the comparison operator so you can use arbitrary data
        enabledItems: BoolWithExplanation[] | AvlTree<{ key: Type, value: BoolWithExplanation }, {
            key: Type
        }> | Map<Type, BoolWithExplanation>,
        renderer: RendererFn<Type>,

    } & StandardOptionsBoundType>
    private valueB_?: Behaviour<Type>;
    private readonly selected_: HTMLDivElement;
    private readonly options_: HTMLDivElement;
    private readonly readonly_: HTMLDivElement;
    private readonly helper_: WidgetHelper;
    private eventHandler_: EventHandler;
    private readonly enabledHelper_: EnabledTooltipHelper;
    private optionData_ = new WeakMap<Element, { val: any, valid: boolean, enabled: BoolWithExplanation }>();
    private dismissTimer_?: any;

    private static readonly DISMISS_TIMEOUT = 250;

    constructor(scope: WidgetScope) {
        super(scope, createDom(TagName.DIV, {class: 'recoil-select'}));
        this.selected_ = createDom(TagName.DIV, {class: 'recoil-select-selected', tabIndex: 0});
        this.options_ = createDom(TagName.DIV, {class: 'recoil-select-options'});
        this.readonly_ = createDom(TagName.DIV, {class: 'recoil-select-readonly'});

        const frp = scope.getFrp();

        // todo test removing and then menu hide

        this.getElement().appendChild(this.readonly_);
        this.getElement().appendChild(this.selected_);
        this.getElement().appendChild(this.options_);
        this.eventHandler_ = new EventHandler();
        this.helper_ = new WidgetHelper(scope, this.getElement(), this, this.updateState_, {
            detach: () => this.eventHandler_.unlisten(),
            attach: this.attachListeners_
        });
        this.enabledHelper_ = new EnabledTooltipHelper(scope, this.getElement(), this.selected_);
    }

    private isShowing_(): boolean {
        return this.options_.style.display === "block";
    }

    private clearDismiss_(): void {
        if (this.dismissTimer_) {
            clearTimeout(this.dismissTimer_);
            this.dismissTimer_ = undefined;
        }
    }

    private dismiss_() {
        this.clearDismiss_();
        setElementShown(this.options_, false);
    }

    private attachListeners_() {
        let frp = this.scope_.getFrp();

        this.selected_.addEventListener("blur", (e) => {
        })

        this.eventHandler_.listen(this.selected_, EventType.BLUR, (e: FocusEvent) => {
            this.clearDismiss_();
            this.dismissTimer_ = setTimeout(() => this.dismiss_(), SelectorWidget.DISMISS_TIMEOUT);
        });

        this.eventHandler_.listen(this.selected_, EventType.KEYDOWN, (e: KeyboardEvent) => {
            return this.handleKeyDown_(e);
        })
        this.selected_.addEventListener(EventType.CLICK, () => {
            this.selected_.focus();
            if (this.isShowing_()) {
                this.dismiss_();
            }
            else {
                this.showOptions_(undefined);
            }
        });

        this.eventHandler_.listen(this.options_, EventType.CLICK, frp.accessTransFunc((e: MouseEvent) => {
            if (!(e.target instanceof Element) || !this.valueB_) {
                return;
            }

            const option = e.target.closest(".recoil-selector-option");
            if (option) {
                let data = this.optionData_.get(option);
                this.valueB_.set(data?.val);
                this.dismiss_();
            }
        }, this.valueB_!, this.configB_!));

        this.eventHandler_.listen(document, EventType.CLICK, (e: MouseEvent) => {
            if (!this.selected_.contains(e.target as Element)) {
                setElementShown(this.options_, false);
            }
        });

    }

    static RENDERER<Type extends number | string>(obj: Type, valid: boolean, enabled: BoolWithExplanation): Element {
        let toRender = String(obj);
        if (enabled && enabled.reason && enabled.reason()) {
            if (enabled.reason()!.toString().trim() !== '') {
                return createDom('div', {
                    disabled: true,
                    class: valid ? 'recoil-select-disabled' : 'recoil-error',
                    title: enabled.reason()!.toString()
                }, toRender);
            }
        }

        return createDom(TagName.DIV, valid ? undefined : 'recoil-error', toRender);

    }

    /**
     * list of functions available when creating a selectorWidget
     */
// recoil.ui.widgets.SelectorWidget.options =  recoil.util.Options('value' , {'!list': [1, 2, 3]}, {'renderer' : recoil.util.widgets.RENDERER},
//     { renderers :['button', 'menu']}, 'enabledItems');
    static options = StandardOptions({
        'name': '',
        'renderer': SelectorWidget.RENDERER,
        'enabledItems': [],
    }, 'value', 'list');


    /**
     * @param {!Object| !recoil.frp.Behaviour<Object>} options
     */
    attachStruct(options: AttachType<{
        value: Type;
        list: Type[],
        renderer?: RendererFn<Type>,
        enabledItems?: EnabledItemsType<Type>// matches list index
    } & StandardOptionsType>) {
        let frp = this.helper_.getFrp();
        let bound = SelectorWidget.options.bind(frp, options);

        // let optionsB = structs.flatten(frp, options);

        // let bound = recoil.ui.widgets.SelectorWidget.options.bind(optionsB);
        // this.nameB_ =  bound.name();

        this.configB_ = bound[getGroup]([
            bound.name, bound.editable, bound.enabled,
            bound.renderer,
            bound.list, bound.enabledItems, bound.tooltip]);
        this.valueB_ = bound.value();
        this.helper_.attach(this.configB_, this.valueB_);
        /*        this.changeHelper_.listen(this.scope_.getFrp().createCallback((v)=> {
                    if (!this.valueB_|| !this.configB_) {
                        return;
                    }
                    let idx = v.target.getSelectedIndex();
                    let list = this.configB_.get().list;
                    if (idx < list.length) {
                        this.valueB_.set(list[idx]);
                    }

                }, this.valueB_, this.configB_));*/
        this.enabledHelper_.attach(this.configB_, this.helper_);
    }


    private createMenuItem_<T>(renderer: RendererFn<T>, val: T, valid: boolean, enabled: BoolWithExplanation): HTMLDivElement {
        let item = createDom(TagName.DIV, {
                class: 'recoil-selector-option'
            },
            renderer(val, valid, enabled)
        );
        this.optionData_.set(item, {val, valid, enabled});
        return item;
    };

    /**
     *
     * @param {recoil.ui.WidgetHelper} helper
     * @private
     */
    private updateState_(helper: WidgetHelper) {

        if (helper.isGood() && this.configB_) {
            // console.log('in selectWidget updateState');
            let config = this.configB_.get();
            let list = config.list;
            let enabledItems = config.enabledItems;
            //sel.setEnabled(this.enabledB_.get().val());
            setElementShown(this.selected_, config.editable);
            setElementShown(this.readonly_, !config.editable);
            removeChildren(this.options_);
            const renderer = config.renderer;


            let found = -1;
            if (list) {
                for (let i = 0; i < list.length; i++) {
                    let val = list[i];
                    let enabled = SelectorWidget.getItemEnabled(i, val, enabledItems);
                    let item = this.createMenuItem_(renderer, val, true, enabled)
                    this.options_.appendChild(item);
                    if (isEqual(this.valueB_?.get(), val)) {
                        enable(item, "recoil-selected", true);
                        found = i;
                    }
                }
                if (found === -1) {
                    this.options_.appendChild(this.createMenuItem_(renderer, this.valueB_!.get(), false, BoolWithExplanation.FALSE));
                    found = list.length;
                }


                //sel.setSelectedIndex(found);
            }
            console.log("update selected");
            removeChildren(this.selected_);
            this.selected_.appendChild(renderer(this.valueB_!.get(), found !== -1, BoolWithExplanation.TRUE));
        }

    }

    private static getItemEnabled<Type>(index: number, val: Type, enabledItems: EnabledItemsType<Type>): BoolWithExplanation {
        if (Array.isArray(enabledItems)) {
            return enabledItems.length > index ? enabledItems[index] : BoolWithExplanation.TRUE;
        } else if (enabledItems instanceof Map) {
            return enabledItems.get(val) || BoolWithExplanation.TRUE;
        } else {
            return enabledItems.safeFind({key: val, value: BoolWithExplanation.TRUE}).value;
        }
    }

    private selectItem_(e:Event) {
        if (!this.valueB_) {
            return;
        }
        this.scope_.getFrp().accessTrans(() => {
            let highlighted = this.options_.querySelector(".recoil-highlighted");

            if (highlighted && this.valueB_) {
                let data = this.optionData_.get(highlighted);


                if (data) {
                    this.valueB_.set(data.val);
                }
            }

        }, this.valueB_);
        this.dismiss_();
    }
    private handleMenuKeyEvent_(e: KeyboardEvent) {
        switch (e.key) {
            case 'Enter':
                this.selectItem_(e);
                return true;
            case 'ArrowDown':
            case 'ArrowUp':
                this.progressHighlight_(e.key === 'ArrowDown');
                return true;
        }

        return false;
    }
    private handleKeyDown_(e: KeyboardEvent):boolean|undefined {
        let menuShowing = this.isShowing_();
        if (menuShowing && this.handleMenuKeyEvent_(e)) {
            return true;
        }
        let selected = this.options_.querySelector(".recoil-selected");
        let highlighted = this.options_.querySelectorAll(".recoil-highlighted");

        let handled = true;
        switch (e.key) {
            case 'Escape':
                if (menuShowing) {
                    this.dismiss_();
                    handled = true;
                }
                break;
            case 'Tab':
                if (menuShowing && highlighted) {
                    this.selectItem_(e);
                }
                return undefined;

            case 'ArrowDown':
            case 'ArrowUp':
                this.showOptions_(e.key === 'ArrowDown');
                break;
        }

        if (handled) {
            e.preventDefault();
        }

        return handled;
    }

    private showOptions_(down: boolean|undefined) {
        let showing = this.isShowing_();
        let options = this.options_.querySelectorAll(".recoil-selector-option");
        let selected = this.options_.querySelector(".recoil-selected");
        let firstChild = this.options_.firstElementChild;
        let lastChild = this.options_.lastChild;

        if (showing && options.length === 0) {
            this.dismiss_();
        } else if (firstChild instanceof HTMLElement && lastChild instanceof HTMLElement) {
            if (!showing) {
                this.options_.style.display = "block";

                for (let highlighted of this.options_.querySelectorAll(".recoil-highlighted")) {
                    enable(highlighted as HTMLElement, "recoil-highlighted", false);
                }
                if (selected) {
                    if (down !== undefined) {
                        enable(selected as HTMLElement, "recoil-highlighted", true);
                    }
                } else {
                    this.progressHighlight_(down || false);
                }

            }
            setTimeout(() => {
                this.clearDismiss_()
            }, 1);

            this.positionMenu_();
        }
    }

    private positionMenu_() {
        if (this.isShowing_()) {
            let position = new MenuAnchoredPosition(
                this.getElement(), Corner.BOTTOM_START, true);
            position.reposition(
                this.options_, Corner.TOP_START);


        }

    }

    private highlightElement_(el: HTMLElement) {
        enable(el, "recoil-highlighted", true);
        el.scrollIntoView();
    }
    private progressHighlight_(down: boolean) {
        let highlighted = this.options_.querySelector(".recoil-highlighted");
        if (highlighted instanceof HTMLElement) {
            enable(highlighted, "recoil-highlighted", false);
            if (down){
               if (highlighted.nextElementSibling instanceof HTMLElement) {
                   this.highlightElement_(highlighted.nextElementSibling);
               }
               else if (this.options_.firstElementChild instanceof HTMLElement) {
                   this.highlightElement_(this.options_.firstElementChild);
               }
            }
            else if (highlighted.previousElementSibling instanceof HTMLElement) {
                this.highlightElement_(highlighted.previousElementSibling);

            }
            else if (this.options_.lastElementChild instanceof HTMLElement) {
                this.highlightElement_(this.options_.lastElementChild);
            }
        }
        else {
            if (down) {
                if (this.options_.firstElementChild instanceof HTMLElement) {
                    this.highlightElement_(this.options_.firstElementChild);
                }
            } else if (this.options_.lastElementChild instanceof HTMLElement) {
                this.highlightElement_(this.options_.lastElementChild);
            }
        }
    }
}
