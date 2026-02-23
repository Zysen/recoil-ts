import {Widget} from "./widget.ts";
import {WidgetScope} from "./widgetscope.ts";
import {createDom, createTextNode, DomHelper, removeChildren, setElementShown} from "../dom/dom.ts";
import {TagName} from "../dom/tags.ts";
import {WidgetHelper} from "../widgethelper.ts";
import {AttachType} from "../../frp/struct.ts";
import {getGroup, Options, StandardOptions} from "../frp/util.ts";
import {BoolWithExplanation} from "../booleanwithexplain.ts";
import {Behaviour} from "../../frp/frp.ts";
import {EventHandler, EventHelper} from "../eventhelper.ts";
import {EventType} from "../dom/eventtype.ts";
import {Message} from "../message.ts";
import {Corner} from "../positioning/positioning.ts";
import {MenuAnchoredPosition} from "../positioning/menuanchoredposition.ts";
import {isEqual} from "../../util/object.ts";
import {EnabledTooltipHelper} from "../tooltiphelper.ts";
import {Handle} from "../../util/handle.ts";


type RenderedMenuButton = {
    outer:Node, button:Element, list: HTMLElement
};
export type MenuRenderer = (value: string|Message|Node) => {outer:Node, container:Node};
export type MenuButtonRenderer = (value: string|Message|Node) => RenderedMenuButton;

function defaultButtonRenderer (value:string|Message|Node):RenderedMenuButton {
    let button:HTMLButtonElement;
    if (value instanceof Node) {
        button = createDom(TagName.BUTTON, {}, value);
    }
    else {
        button = createDom(TagName.BUTTON,{}, createTextNode(value?.toString() || "null"));
    }
    let list = createDom(TagName.DIV, {class:'recoil-menu-item-list', style: {
        display: 'none', position: 'absolute', zIndex: 10,
    }});

    return {outer: createDom(TagName.DIV,{}, button, list), button, list};

}

function defaultBarRenderer ():Node|null {
    return createDom(TagName.DIV)
}

export class MenuBarWidget extends Widget {
    private readonly menuBar_:HTMLDivElement;
    private configHelper_: WidgetHelper;
    private stateHelper_: WidgetHelper;
    private menusB_?: Behaviour<MenuButtonWidget<any>>;
    private configB_?: Behaviour<{
        classes: string[],
        domHelper:DomHelper,
        renderer:(v: any) => any,
    }>;

    constructor(scope: WidgetScope) {
        super(scope, createDom(TagName.DIV));
        this.menuBar_ = this.getElement() as HTMLDivElement;
        this.configHelper_ = new WidgetHelper(scope, this.menuBar_, this, this.updateConfig_);
        this.stateHelper_ = new WidgetHelper(scope, this.menuBar_, this, this.updateState_);

    }


    static options = StandardOptions('menus', {
        renderer: defaultBarRenderer,
        domHelper: new DomHelper(),
    })

    attachStruct(data: AttachType<{
        menus: MenuButtonWidget<any>[];
        renderer?: () => Node,
        domHelper?: DomHelper;
        classes?: string[];
        enabled?: BoolWithExplanation
    }>) {
        let frp = this.scope_.getFrp();

        let bound = MenuBarWidget.options.bind(frp, data)
        //   config, menus, enabled) {
        this.configB_ = bound[getGroup](['renderer','domHelper', 'classes', 'enabled']);
        this.menusB_ = bound.menus();
        this.configHelper_.debug("menu config");
        this.stateHelper_.debug("menu state");
        this.configHelper_.attach(this.configB_);
        this.stateHelper_.attach(this.menusB_, bound.enabled());
    }

    updateConfig_(helper: WidgetHelper) {
        if (helper.isGood() && this.configB_) {
            if (this.menuBar_ !== null) {
// todo               helper.clearContainer();
            }
            let config = this.configB_ .get();

            this.stateHelper_.forceUpdate();
        }
        else {
// todo            helper.clearContainer();
        }
    }

    private updateState_(helper: WidgetHelper, menusB: Behaviour<MenuButtonWidget<any>[]>) {
        if (this.menuBar_) {

            //this.menuBar_.setEnabled(helper.isGood() && enabledB.get());

            helper.clearContainer();

            if (helper.isGood()) {
                for (let menuWidget of menusB.get()) {
                    console.log("menuWidget", menuWidget.getElement());
                    this.menuBar_.appendChild(menuWidget.getElement());
                    if (menuWidget.reposition) {
                        menuWidget.reposition();
                    }
                }

            }
        }
    }
}
export class MenuButtonWidget<Type> extends Widget {
    private rendererB_?: Behaviour<MenuButtonRenderer>;
    private readonly stateHelper_: WidgetHelper;
    private nameB_?:Behaviour<Type>;
    private classesB_?:Behaviour<string[]>;
    private itemsB_?:Behaviour<MenuItemWidget[]>;
    private enabledB_?:Behaviour<{enabled:BoolWithExplanation, tooltip:string|Message}>;
    private rendered_?: RenderedMenuButton;
    private enabledHelper_: EnabledTooltipHelper;
    private eventHandler_: EventHandler = new EventHandler();

    constructor(scope: WidgetScope) {
        super(scope, createDom(TagName.DIV));
        this.getElement().addEventListener(EventType.CLICK, () => {
            console.log("menuButtonWidget", this.getElement());
        })


        this.stateHelper_ = new WidgetHelper(scope, this.getElement(), this, this.updateState_, {attach:this.attachListeners_, detach:() => this.eventHandler_.unlisten()});
        this.enabledHelper_ = new EnabledTooltipHelper(scope, this.getElement(), null);

    }

    private attachListeners_() {
        this.eventHandler_.listen(document, EventType.CLICK, () => {
            if (this.rendered_) {
                setElementShown(this.rendered_.list, false)
            }
        });

        this.eventHandler_.listen(document, EventType.CLICK, () => {})
        this.eventHandler_.listen(this.getElement(), EventType.CLICK, (e:MouseEvent) => {
            console.log("OPEN MENU");
            if (!this.rendered_ || this.rendered_.button !== e.target) {
                return;
            }
            setTimeout(()=> {
                if (this.rendered_) {
                    setElementShown(this.rendered_.list, true);
                    this.reposition();
                }
            }, 1);

        });

    }


    /**
     * attachable behaviours for widget
     */
    static options = StandardOptions(
        'name', 'items',
        {
            action: null,
            renderer: defaultButtonRenderer,
            classes: ['recoil-menu-button'],
            enabled: BoolWithExplanation.TRUE
        }
    );

    /**
     * Associates a list of menu items widget with this Menu Widget
     * @param options
     */
    attachStruct(options:AttachType<{
        name: Type,
        renderer?: (v:Type)=>{outer:Node, container:Node};
        items: MenuItemWidget[],
        action?: any,
        tooltip?: Message|string,
        enabled?:BoolWithExplanation,
    }>) {
        let frp = this.scope_.getFrp();

        let bound = MenuButtonWidget.options.bind(frp, options);

        this.nameB_ = bound.name();
        this.itemsB_ = bound.items();
        this.rendererB_ = bound.renderer();
        this.classesB_ = bound.classes();
        this.enabledB_ = bound[getGroup](['enabled','tooltip'])
        this.stateHelper_.attach(this.itemsB_, this.nameB_, this.classesB_, this.rendererB_);
        this.enabledHelper_.attach(this.enabledB_, this.stateHelper_);

    }

    /**
     *  repositions menu under button
     */
    reposition() {
        if (this.rendered_) {
            let position = new MenuAnchoredPosition(
                this.rendered_.button, Corner.BOTTOM_LEFT, true, true);
            position.reposition(this.rendered_.list, Corner.TOP_LEFT);

        }
    }
  private updateState_(helper:WidgetHelper) {
        WidgetHelper.updateClasses(this.getElement(), this.classesB_);
        removeChildren(this.getElement());

        if (helper.isGood() && this.rendererB_) {
            let rendered = this.rendererB_.get()(this.nameB_?.get() as any);
            this.enabledHelper_.setElement(rendered.button);
            this.rendered_ = rendered;
            this.getElement().appendChild(rendered.outer);
            for (let item of this.itemsB_?.get() as MenuItemWidget[]) {
                rendered.list.appendChild(item.getElement());
            }
        }

    }
}

export interface MenuItemWidget {
    getElement(): Element;
}

/**
 * looks like a top level menu but is actually just button
 */
export class MenuActionWidget extends Widget {
    private eventHelper_: EventHandler;
    private actionB_?: Behaviour<any, Event, any, any>;
    private nameB_?:Behaviour<string|Message>
    private enabledB_?:Behaviour<BoolWithExplanation>;
    private rendererB_?:Behaviour<MenuRenderer>;
    private readonly stateHelper_: WidgetHelper;
    private readonly actionHelper_: WidgetHelper;
    private readonly enabledHelper_: EnabledTooltipHelper;
    private curName_?: string|Message;
    private curRenderer_?:MenuRenderer;

    constructor(scope: WidgetScope) {
        super(scope, createDom(TagName.BUTTON))
        this.eventHelper_ = new EventHandler();
        this.stateHelper_ = new WidgetHelper(scope, this.getElement(), this, this.updateState_);
        this.actionHelper_ = new WidgetHelper(scope, this.getElement(), this, () => {});
        this.enabledHelper_ = new EnabledTooltipHelper(scope, this.getElement(), this.getElement());
    }


    /**
     * attachable behaviours for widget
     */
    static options = Options(
        'name', 'action', {
            renderer: defaultButtonRenderer,
            classes: ['recoil-menu-item'],
            enabled: BoolWithExplanation.TRUE,
        }
    );

    /**
     * Associates a list of menu items widget with this Menu Widget
     */
    attachStruct(options: AttachType<{
        name: Message | string,
        classes?: string[],
        enabled?: Boolean,
        tooltip?: string|Message|null,
        renderer?: (val: string|Message|Node) => Node,
        action: any
    }>) {
        let frp = this.scope_.getFrp();

        let bound = MenuActionWidget.options.bind(frp, options);

        this.actionB_ = bound.action();

        this.eventHelper_.unlisten();

        this.eventHelper_.listenCallback(this.getElement(), EventType.CLICK, this.actionB_)
        this.nameB_ = bound.name();
        this.rendererB_ = bound.renderer();
        this.enabledB_ = bound[getGroup](['enabled','tooltip']);
        this.stateHelper_.attach(this.nameB_, this.rendererB_, this.enabledB_);
        this.actionHelper_.attach(this.actionB_);
        this.enabledHelper_.attach(this.enabledB_, this.stateHelper_, this.actionHelper_);
    }

    private updateState_(helper:WidgetHelper) {
        if (helper.isGood()) {

            if (this.rendererB_ && this.nameB_) {
                let renderer = this.rendererB_.get();
                let name = this.nameB_.get();

                if (!isEqual(this.curRenderer_, renderer) || !isEqual(this.curName_, name)) {
                    this.curRenderer_ = renderer;
                    this.curName_ = name;
                    removeChildren(this.getElement());
                    this.getElement().appendChild(renderer(this.nameB_.get() as any).outer);
                }


            }
            else {
                removeChildren(this.getElement());
            }
        }
        else {
            removeChildren(this.getElement());

        }
    }
}


/**
 *
 * @param {!recoil.ui.WidgetScope} scope
 * @constructor
 * @implements {recoil.ui.widgets.MenuItemWidget}
 */
export class SubMenuWidget extends Widget {
    private state_: WidgetHelper;
    private subMenu_: HTMLDivElement;
    private actionB_?: Behaviour<any>;
    private nameB_?: Behaviour<any>;
    private actionBHandle_ = new Handle<Behaviour<any>>()
    constructor(scope: WidgetScope) {
        super(scope, createDom(TagName.DIV));
        this.subMenu_ = createDom(TagName.DIV);
        this.state_ = new WidgetHelper(scope, this.subMenu_, this, this.updateState_);
        EventHelper.listen(this.subMenu_, EventType.CLICK, (e:MouseEvent) => {
            if (this.actionB_) {
                this.scope_.getFrp().accessTrans(()=> {
                    this.actionB_!.set(e);
                }, this.actionB_);
            }
        });

    }
    static options = StandardOptions('name', {
        enabled: BoolWithExplanation.TRUE,
    });

    /**
     *
     * @param {recoil.frp.Behaviour<string>|string} name
     * @param {recoil.frp.Behaviour<boolean>|boolean} enabledB
     */
    attachStruct (options: AttachType<{name:string, enabled:BoolWithExplanation}>) {
        let bound = SubMenuWidget.options.bind(this.scope_.getFrp(), options);
        this.nameB_ = bound.name();
        this.state_.attach(this.nameB_, bound.enabled());
    };

    /**
     *
     * @param {recoil.ui.WidgetHelper} helper
     * @private
     */
    updateState_(helper: WidgetHelper) {
        removeChildren(this.subMenu_);
        if (helper.isGood()) {
            this.subMenu_.appendChild(createTextNode(this.nameB_!.get()));
        } else {
            this.subMenu_.appendChild(createTextNode("?"));
        }

        //this.subMenu_.setDispatchTransitionEvents(goog.ui.Component.State.ALL, true);
    }
}
