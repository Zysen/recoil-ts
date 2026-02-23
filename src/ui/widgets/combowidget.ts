import {Widget} from "./widget.ts";
import {WidgetScope} from "./widgetscope.ts";
import {contains, createDom, setElementShown} from "../dom/dom.ts";
import {TagName} from "../dom/tags.ts";
import {StandardOptions, StandardOptionsType} from "../frp/util.ts";
import {AttachType} from "../../frp/struct.ts";
import {EventHandler, EventHelper, Unlistener} from "../eventhelper.ts";
import {EventType} from "../dom/eventtype.ts";
import {BoolWithExplanation} from "../booleanwithexplain.ts";
import { Behaviour } from "../../frp/frp.ts";
import {WidgetHelper} from "../widgethelper.ts";

/**
 * like a selectWidget but the mainWidget is the text entry box, this allows
 */
export class ComboWidget extends Widget {
    private widgetDiv_: HTMLDivElement;
    private menu_: HTMLDivElement;
    private mainWidget_: Widget;
    private enabled_ = true;
    private enabledB_?:Behaviour<BoolWithExplanation>;
    private itemCount_:number;
    private forceSet_: (v: any) => void;
    private listening_:Unlistener|null = null;
    private helper_: WidgetHelper;
    private button_: HTMLSpanElement;

    constructor(scope: WidgetScope, mainWidget: Widget, opt_forceSet?: (v: any) => void) {
        let widgetDiv = createDom(TagName.DIV, {class: 'recoil-combobox-widget'});
        super(scope, createDom(TagName.DIV, {class: 'recoil-combobox'}, widgetDiv));
        this.forceSet_ = opt_forceSet ||  (() => {});
        this.widgetDiv_ = widgetDiv;
        this.menu_ = createDom(TagName.DIV, {class: 'recoil-combomenu-list'});
        setElementShown(this.menu_, false);
        this.enabled_ = true;
        this.getElement().appendChild(this.menu_);
        this.itemCount_ = 0;
        this.listening_ = null;

        this.mainWidget_ = mainWidget;
        this.widgetDiv_.appendChild(mainWidget.getElement());

        this.button_ = createDom(
            TagName.SPAN, {class: 'recoil-combobox-button'}, '\u25BC');

        this.getElement().appendChild(this.button_);

        this.helper_ = new recoil.ui.ComponentWidgetHelper(scope, this.container_, this, this.updateState_, this.dispose_);

        // this.changeHelper_ = new recoil.ui.EventHelper(scope, this.selector_, goog.ui.Component.EventType.ACTION);
        this.changeHelper_ = new EventHelper(scope, this.menu_, EventType.ACTION);
        this.enabledHelper_ = new recoil.ui.TooltipHelper(scope, this.container_, this.container_.getElement());
        goog.events.listen(
            this.button_, goog.events.EventType.MOUSEDOWN,
            this.onComboMouseDown_.bind(this));


        goog.events.listen(this.button_, goog.events.EventType.MOUSELEAVE, this.onBlur_.bind(this));
        goog.events.listen(this.menu_.getElement(), goog.events.EventType.MOUSELEAVE, this.onBlur_.bind(this));
        goog.events.listen(this.menu_.getElement(), goog.events.EventType.MOUSEENTER, this.onFocus_.bind(this));
    };


    /**
     * Clears the dismiss timer if it's active.
     * @private
     */
    clearDismissTimer_() {
        if (this.dismissTimer_) {
            goog.Timer.clear(this.dismissTimer_);
            this.dismissTimer_ = null;
        }
    }

    /**
     * @param {goog.events.BrowserEvent} e The browser event.
     * @private
     */
    onComboMouseDown_(e) {
        // We only want this event on the element itself or the input or the button.
        if (this.enabled_ &&
            (goog.dom.contains(this.button_, /** @type {Node} */ (e.target)))) {
            if (this.menu_.isVisible()) {
                this.dismiss();
            } else {
                this.maybeShowMenu_(true);
            }
//        this.input_.select();
            this.menu_.setMouseButtonPressed(true);
            // Stop the click event from stealing focus
            e.preventDefault();
        }

        // Stop the event from propagating outside of the combo box
        e.stopPropagation();
    }

    /**
     * Shows the menu if it isn't already showing.  Also positions the menu
     * correctly, resets the menu item visibilities and highlights the relevant
     * item.
     * @param {boolean} showAll Whether to show all items, with the first matching
     *     item highlighted.
     * @private
     */
    private maybeShowMenu_(showAll) {
        var isVisible = this.menu_.isVisible();

        if (isVisible && this.itemCount_ == 0) {
            this.hideMenu_();

        } else if (!isVisible && this.itemCount_ > 0) {
            // In Safari 2.0, when clicking on the combox box, the blur event is
            // received after the click event that invokes this function. Since we want
            // to cancel the dismissal after the blur event is processed, we have to
            // wait for all event processing to happen.

            goog.Timer.callOnce(this.clearDismissTimer_, 1, this);

            this.showMenu_();
        }

        this.positionMenu();
    }

    /**
     * Show the menu and add an active class to the combo box's element.
     * @private
     */
    private showMenu_() {
        this.menu_.setVisible(true);
        goog.dom.classlist.add(
            goog.asserts.assert(this.containerDiv_),
            goog.getCssName('goog-combobox-active'));
    };


    /**
     * Positions the menu.
     * @protected
     */
    positionMenu() {
        if (this.menu_ && this.menu_.isVisible()) {
            var position = new goog.positioning.MenuAnchoredPosition(
                this.button_, goog.positioning.Corner.BOTTOM_END, true, true);
            position.reposition(
                this.menu_.getElement(), goog.positioning.Corner.TOP_END);
        }
    };


    /**
     * Dismisses the menu and resets the value of the edit field.
     */
    dismiss() {
        this.clearDismissTimer_();
        this.hideMenu_();
        this.menu_.setHighlightedIndex(-1);
    };


    /**
     * Hide the menu and remove the active class from the combo box's element.
     * @private
     */
    private hideMenu_() {
        this.menu_.setVisible(false);
        goog.dom.classlist.remove(
            goog.asserts.assert(this.containerDiv_),
            goog.getCssName('goog-combobox-active'));
    };


    /**
     * list of functions available when creating a selectorWidget
     */
    static options = StandardOptions({
            'renderer': SelectorWidget.RENDERER,
            'enabledItems': [],
        }, 'value', 'list');


    /**
     * @param {!Object| !recoil.frp.Behaviour<Object>} options
     */
    attachStruct(options:AttachType<{ value, list, renderer, enabledItems } & StandardOptionsType>) {
        var frp = this.helper_.getFrp();
        var util = new recoil.frp.Util(frp);
        var bound = ComboWidget.options.bind(frp, options);
        this.valueB_ = bound.value();
        this.editableB_ = bound.editable();
        this.listB_ = bound.list();
        /**
         * @type {recoil.frp.Behaviour<!Array<recoil.ui.BoolWithExplanation>>}
         * @private
         */
        this.enabledItemsB_ = bound.enabledItems();
        /**
         * @type {recoil.frp.Behaviour.<!recoil.ui.BoolWithExplanation>}
         * @private
         */
        this.enabledB_ = bound.enabled();
        this.rendererB_ = bound.renderer();

        this.helper_.attach(this.valueB_, this.listB_, this.enabledB_, this.rendererB_,
            this.enabledItemsB_, this.editableB_);

        var me = this;
        this.changeHelper_.listen(this.scope_.getFrp().createCallback(function (e) {
            if (e.target instanceof goog.ui.MenuItem) {
                var val = e.target.getValue();
                if (val && val.valid) {
                    me.forceSet_(val.value);
                    me.valueB_.set(val.value);
                }
                me.dismiss();
            }
        }, this.valueB_, this.listB_));
        this.enabledHelper_.attach(
            /** @type {!recoil.frp.Behaviour<!recoil.ui.BoolWithExplanation>} */ (this.enabledB_),
            this.helper_);
    }

    /**
     * Number of milliseconds to wait before dismissing combowidget after blur.
     * @type {number}
     */
    static BLUR_DISMISS_TIMER_MS = 250;

    /**
     * Event handler for when the input box looses focus -- hide the menu
     * @param {goog.events.BrowserEvent} e The browser event.
     * @private
     */
    private onBlur_(e) {
        this.clearDismissTimer_();
        this.dismissTimer_ = goog.Timer.callOnce(
            this.dismiss, recoil.ui.widgets.ComboWidget.BLUR_DISMISS_TIMER_MS, this);
    }

    /**
     * Event handler for when the input box looses focus -- hide the menu
     * @param {goog.events.BrowserEvent} e The browser event.
     * @private
     */
    private onFocus_(e) {
        this.clearDismissTimer_();
    }

    /**
     * @template T
     * @param {function(T,boolean, recoil.ui.BoolWithExplanation) : string} renderer
     * @param {Object} val
     * @param {boolean} valid
     * @param {recoil.ui.BoolWithExplanation} enabled
     * @return {goog.ui.MenuItem}
     * @private
     */
    static createMenuItem_ = function (renderer, val, valid, enabled) {
        var item = new goog.ui.MenuItem(renderer(val, valid, enabled), {
            value: val,
            valid: valid,
            enabled: enabled,
            renderer: renderer
        });
        if (enabled && enabled.val && !enabled.val()) {
            item.setEnabled(false);
        }
        return item;
    }

    /**
     * Event handler for when the document is clicked.
     * @param {goog.events.BrowserEvent} e The browser event.
     * @private
     */
    private onDocClicked_(e:MouseEvent) {
        if (!contains(
            this.menu_.getElement(), /** @type {Node} */ (e.target))) {
            this.dismiss();
        }
    };

    /**
     *
     * @private
     */
    private dispose_() {
        if (this.listening_) {
            goog.events.unlistenByKey(this.listening_);
            this.listening_ = null;
        }
    }

    /**
     *
     * @param {recoil.ui.WidgetHelper} helper
     * @private
     */
    private updateState_(helper) {
        var me = this;
        if (!this.listening_) {
            this.listening_ = EventHelper.listen(document, EventType.MOUSEDOWN,           this.onDocClicked_.bind(this));
        }
        var enabled = false;
        var editable = true;
        for (var i = this.menu_.getChildCount() - 1; i >= 0; i--) {
            me.menu_.removeChild(this.menu_.getChildAt(i), true);
        }
        if (helper.isGood()) {
            var list = this.listB_.get() || [];
            var enabledItems = this.enabledItemsB_.get();
            var renderer = this.rendererB_.get();

            for (var i = 0; i < list.length; i++) {
                var en = enabledItems.length > i ? enabledItems[i] : recoil.ui.BoolWithExplanation.TRUE;
                var val = list[i];
                var item = recoil.ui.widgets.ComboWidget.createMenuItem_(renderer, val, true, en);

                this.menu_.addChild(item, true);
            }
            this.itemCount_ = list.length;
            enabled = this.enabledB_.get().val();
            editable = this.editableB_.get() && list.length > 0;

        } else {
            this.itemCount_ = 0;
        }


        goog.dom.classlist.enable(
            goog.asserts.assert(this.containerDiv_),
            goog.getCssName('goog-combobox-disabled'), !enabled);
        this.button_.disabled = !enabled;
        goog.style.setElementShown(this.button_, editable);
        this.enabled_ = enabled && editable;
        if (this.itemCount_ === 0 || !enabled || !editable) {
            this.dismiss();
        }
    }

}