import { Behaviour } from "../../frp/frp";
import { AttachType } from "../../frp/struct";
import { Box } from "../dom/box";
import { append, createDom, removeChildren, setElementShown, setProperties } from "../dom/dom";
import { EventType } from "../dom/eventtype";
import { KeyCodes, Keys } from "../dom/keycodes";
import { TagName } from "../dom/tags";
import { EventHelper } from "../eventhelper";
import { Options } from "../frp/util";
import { Popup } from "../popup";
import { AnchoredViewportPosition } from "../positioning/anchoredviewportposition";
import { Corner } from "../positioning/positioning";
import { WidgetHelper } from "../widgethelper";
import { Widget } from "./widget";
import { WidgetScope } from "./widgetscope";

/**
 *
 * @template T
 * @param {!recoil.ui.WidgetScope} scope
 * @implements {recoil.ui.Widget}
 * @constructor
 */
export class PopupWidget extends Widget<HTMLDivElement> {    
    private popupContainer_: HTMLDivElement;
    private displayContainer_: HTMLDivElement;
    private buttonContainer_: HTMLDivElement;
    private displayAndButtonContainer_: HTMLDivElement;
    private popup_:Popup;
    private displayWidgetB_?: Behaviour<Widget>;
    private popupWidgetB_?: Behaviour<Widget>;
    private displayElement_?: Element;
    private popupElement_?: Element;
    private helper_:WidgetHelper;

    constructor(scope: WidgetScope) {
        super(scope, createDom(TagName.DIV));
        this.popupContainer_ = createDom(TagName.DIV);

        this.displayContainer_ = createDom(
            TagName.DIV,
            { 'class': 'goog-inline-block goog-menu-button-caption', tabindex: 0 });
        this.buttonContainer_ = createDom(TagName.DIV, { 'class': 'goog-inline-block goog-menu-button-dropdown' });
        this.displayAndButtonContainer_ = createDom(TagName.DIV, { 'class': 'goog-inline-block goog-menu-button' });
        let outerBox = createDom(TagName.DIV, { 'class': 'goog-inline-block goog-menu-button-outer-box' });
        let innerBox = createDom(TagName.DIV, { 'class': 'goog-inline-block goog-menu-button-inner-box' });

        append(this.displayAndButtonContainer_, outerBox);
        append(outerBox, innerBox);
        append(innerBox, this.displayContainer_);
        append(innerBox, this.buttonContainer_);

        this.getElement().appendChild(this.displayAndButtonContainer_);
        this.getElement().appendChild(this.popupContainer_);
        this.popup_ = new Popup(this.popupContainer_);
        setProperties(this.popupContainer_, { class: 'recoil-popup' });

        this.popup_.setVisible(false);
        let doPopup = () => {
            this.popup_.setVisible(false);
            this.popup_.setPinnedCorner(Corner.TOP_LEFT); // button corner
            this.popup_.setMargin(new Box(0, 0, 0, 0));
            this.popup_.setPosition(new AnchoredViewportPosition(this.displayAndButtonContainer_,
                Corner.BOTTOM_LEFT));

            this.popup_.setVisible(true);

        };
        this.displayAndButtonContainer_.onmousedown = doPopup;

        EventHelper.listen(this.displayAndButtonContainer_
            , EventType.KEYDOWN,
            (e: KeyboardEvent) => {
                if (e.key === Keys.SPACE) {

                    if (this.popup_.isVisible()) {
                        setElementShown(this.popupContainer_, false)
                    }
                    else {
                        doPopup();
                    }
                }
                else if (e.key === Keys.ESCAPE) {
                    setElementShown(this.popupContainer_, false)
                }

            });

        this.popup_.setHideOnEscape(true);
        this.popup_.setAutoHide(true);
        this.helper_ = new WidgetHelper(scope, this.getElement(), this, this.updateState_);
    };

    static options = Options('displayWidget', 'popupWidget');

    /**
     * @param popupWidget the widget that will be displayed in the popup
     * @param displayWidget the widget that will be displayed normally (no popup required
     * @suppress {missingProperties}
     */

    attach(popupWidget:Widget|Behaviour<Widget>, displayWidget:Widget|Behaviour<Widget>) {
        PopupWidget.options.displayWidget(displayWidget).popupWidget(popupWidget).attach(this);
    }


    /**
     * see recoil.ui.widgets.PopupWidget.options fro valid options
     * @param {!Object|!recoil.frp.Behaviour<Object>} options
     * @suppress {missingProperties}
     */
    attachStruct(data: AttachType<
    {
        popupWidget: Widget,
        displayWidget: Widget
    }>) {
        var frp = this.scope_.getFrp();
        var bound = PopupWidget.options.bind(frp, data);

        this.displayWidgetB_ = bound.displayWidget();
        this.popupWidgetB_ = bound.popupWidget();

        this.helper_.attach(this.popupWidgetB_, this.displayWidgetB_);

    }

    /**
     * @private
     * @param {!Element} container where the component goes
     * @param {goog.ui.Component} current the currently renderd component
     * @param {goog.ui.Component} newComponent the component we want to render
     * @return {goog.ui.Component} the new Component
     */
    private replaceComponent_<Type extends Element> (container:Element, current:Type|undefined, newComponent:Type) : Type {
        if (current !== newComponent) {
            removeChildren(container);
            container.appendChild(newComponent);
        }
        return newComponent;
    }
    /**
     *
     * @param {recoil.ui.WidgetHelper} helper
     * @private
     */
    updateState_(helper:WidgetHelper) {
        if (helper.isGood() && this.displayWidgetB_ && this.popupWidgetB_) {
            this.displayElement_ = this.replaceComponent_(this.displayContainer_, this.displayElement_, this.displayWidgetB_.get().getElement());
            this.popupElement_ = this.replaceComponent_(this.popupContainer_, this.popupElement_, this.popupWidgetB_.get().getElement());
        }
        else {
        }
    }

}
