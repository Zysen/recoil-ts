// Copyright 2006 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


import {contains, getFrameContentDocument, getOwnerDocument, setElementShown} from "./dom/dom.ts";
import type {Transition} from "./fx/transition.ts";
import {TagName} from "./dom/tags.ts";
import {userAgent} from "./dom/useragent.ts";
import {EventType as DomEventType} from "./dom/eventtype.ts";
import {EventType as TransEventType} from "./fx/transition.ts";
import {EventHandler,} from "./eventhelper.ts";

export enum Type {
    TOGGLE_DISPLAY = 'toggle_display',
    MOVE_OFFSCREEN = 'move_offscreen'
}


export class BrowserEvent extends Event {
    constructor(type: string, curTarget:EventTarget, src:Event) {
        super(type);
    }

    readonly NONE: 0 = 0;
    readonly CAPTURING_PHASE: 1 = 1;
    readonly AT_TARGET: 2 = 2;
    readonly BUBBLING_PHASE: 3 = 3;


}
/**
 * Constants for event type fired by Popup
 */
enum EventType {
    BEFORE_SHOW= 'beforeshow',
    SHOW= 'show',
    BEFORE_HIDE= 'beforehide',
    HIDE= 'hide'
}

/**
 * The PopupBase class provides functionality for showing and hiding a generic
 * container element. It also provides the option for hiding the popup element
 * if the user clicks outside the popup or the popup loses focus.
 *
 * @constructor
 * @extends {goog.events.EventTarget}
 * @param {Element=} opt_element A DOM element for the popup.
 * @param {goog.ui.PopupBase.Type=} opt_type Type of popup.
 */
export abstract class PopupBase extends EventTarget{

    protected readonly element_: HTMLElement;
    private autoHide_: boolean = true;
    private autoHidePartners_: Set<Element> = new Set();
    private autoHideRegion_: Element | null = null;
    private isVisible_: boolean = false;
    private readonly handler_ = new EventHandler();

    constructor(element: Element, opt_type?: Type) {
        super();
        this.element_ = element as HTMLElement;
        if (opt_type) {
            this.setType(opt_type);
        }

    }


    /**
     * Whether the popup should hide itself asynchrously. This was added because
     * there are cases where hiding the element in mouse down handler in IE can
     * cause textinputs to get into a bad state if the element that had focus is
     * hidden.
     */
    private shouldHideAsync_: boolean = false;


    /**
     * The time when the popup was last shown.
     */
    private lastShowTime_: number = -1;

    /**
     * The time when the popup was last hidden.
     */
    private lastHideTime_: number = -1;
    /**
     * Whether to hide when the escape key is pressed.
     */
    private hideOnEscape_:boolean = false;
    /**
     * Whether to enable cross-iframe dismissal.
     */
    private enableCrossIframeDismissal_:boolean = true;
    /**
     * The type of popup
     */

    type_:Type = Type.TOGGLE_DISPLAY;

    /**
     * Transition to play on showing the popup.
     */
  private showTransition_:Transition|undefined;


    /**
     * Transition to play on hiding the popup.
     */
    hideTransition_:Transition|undefined;



    /**
     * A time in ms used to debounce events that happen right after each other.
     *
     * A note about why this is necessary. There are two cases to consider.
     * First case, a popup will usually see a focus event right after it's launched
     * because it's typical for it to be launched in a mouse-down event which will
     * then move focus to the launching button. We don't want to think this is a
     * separate user action moving focus. Second case, a user clicks on the
     * launcher button to close the menu. In that case, we'll close the menu in the
     * focus event and then show it again because of the mouse down event, even
     * though the intention is to just close the menu. This workaround appears to
     * be the least intrusive fix.
     */
    static DEBOUNCE_DELAY_MS:number = 150;


    public getType():Type {
        return this.type_;
    };


    /**
     * Specifies the type of popup to use.
     *
     * @param type Type of popup.
     */
    private setType(type:Type) {
        this.type_ = type;
    };


    /**
     * Returns whether the popup should hide itself asynchronously using a timeout
     * instead of synchronously.
     * @return {boolean} Whether to hide async.
     */
    private shouldHideAsync() {
        return this.shouldHideAsync_;
    }
    /**
     * Sets whether the popup should hide itself asynchronously using a timeout
     * instead of synchronously.
     * @param {boolean} b Whether to hide async.
     */
    private setShouldHideAsync(b: boolean) {
        this.shouldHideAsync_ = b;
    }
    /**
     * Returns the dom element that should be used for the popup.
     *
     * @return {Element} The popup element.
     */
    protected getElement() {
        return this.element_;
    }

    /**
     * Returns whether the Popup dismisses itself when the user clicks outside of
     * it.
     * @return {boolean} Whether the Popup autohides on an external click.
     */
    private getAutoHide() {
        return this.autoHide_;
    }
    /**
     * Sets whether the Popup dismisses itself when the user clicks outside of it.
     * @param {boolean} autoHide Whether to autohide on an external click.
     */
    private setAutoHide(autoHide:boolean) {
        this.ensureNotVisible_();
        this.autoHide_ = autoHide;
    }
    /**
     * Mouse events that occur within an autoHide partner will not hide a popup
     * set to autoHide.
     * @param partner The auto hide partner element.
     */
    private addAutoHidePartner(partner: Element) {
        this.autoHidePartners_.add(partner);
    }


    /**
     * Removes a previously registered auto hide partner.
     * @param {!Element} partner The auto hide partner element.
     */
    private removeAutoHidePartner(partner:Element) {
        this.autoHidePartners_.delete(partner);
    }


    /**
     * @return {boolean} Whether the Popup autohides on the escape key.
     */
    private getHideOnEscape() {
        return this.hideOnEscape_;
    }
    /**
     * Sets whether the Popup dismisses itself on the escape key.
     * @param {boolean} hideOnEscape Whether to autohide on the escape key.
     */
    private setHideOnEscape(hideOnEscape: boolean) {
        this.ensureNotVisible_();
        this.hideOnEscape_ = hideOnEscape;
    }
    
    /**
     * @return {boolean} Whether cross iframe dismissal is enabled.
     */
    private getEnableCrossIframeDismissal() {
        return this.enableCrossIframeDismissal_;
    };


    /**
     * Sets whether clicks in other iframes should dismiss this popup.  In some
     * cases it should be disabled, because it can cause spurious
     * @param {boolean} enable Whether to enable cross iframe dismissal.
     */
    private setEnableCrossIframeDismissal(enable: boolean) {
        this.enableCrossIframeDismissal_ = enable;
    }


    /**
     * Returns the region inside which the Popup dismisses itself when the user
     * clicks, or null if it's the entire document.
     * @return {Element} The DOM element for autohide, or null if it hasn't been
     *     set.
     */
    private getAutoHideRegion() {
        return this.autoHideRegion_;
    }


    /**
     * Sets the region inside which the Popup dismisses itself when the user
     * clicks.
     * @param {Element} element The DOM element for autohide.
     */
    private setAutoHideRegion(element: Element) {
        this.autoHideRegion_ = element;
    }


    /**
     * Returns the time when the popup was last shown.
     *
     * @return {number} time in ms since epoch when the popup was last shown, or
     * -1 if the popup was never shown.
     */
    private getLastShowTime(): number {
        return this.lastShowTime_;
    }


    /**
     * Returns the time when the popup was last hidden.
     *
     * @return {number} time in ms since epoch when the popup was last hidden, or
     * -1 if the popup was never hidden or is currently showing.
     */
    private getLastHideTime(): number {
        return this.lastHideTime_;
    }


    /**
     * Helper to throw exception if the popup is showing.
     * @private
     */
    private ensureNotVisible_() {
        if (this.isVisible_) {
            throw Error('Can not change this state of the popup while showing.');
        }
    }


    /**
     * Returns whether the popup is currently visible.
     *
     * @return {boolean} whether the popup is currently visible.
     */
    protected isVisible() {
        return this.isVisible_;
    }


    /**
     * Returns whether the popup is currently visible or was visible within about
     * 150 ms ago. This is used by clients to handle a very specific, but common,
     * popup scenario. The button that launches the popup should close the popup
     * on mouse down if the popup is alrady open. The problem is that the popup
     * closes itself during the capture phase of the mouse down and thus the button
     * thinks it's hidden and this should show it again. This method provides a
     * good heuristic for clients. Typically in their event handler they will have
     * code that is:
     *
     * if (menu.isOrWasRecentlyVisible()) {
     *   menu.setVisible(false);
     * } else {
     *   ... // code to position menu and initialize other state
     *   menu.setVisible(true);
     * }
     * @return {boolean} Whether the popup is currently visible or was visible
     *     within about 150 ms ago.
     */
    private isOrWasRecentlyVisible() {
        return this.isVisible_ ||
            (new Date().getTime() - this.lastHideTime_ < PopupBase.DEBOUNCE_DELAY_MS);
    }


    /**
     * Sets whether the popup should be visible. After this method
     * returns, isVisible() will always return the new state, even if
     * there is a transition.
     *
     * @param {boolean} visible Desired visibility state.
     */
    protected setVisible(visible: boolean) {
        // Make sure that any currently running transition is stopped.
        if (this.showTransition_) this.showTransition_.stop();
        if (this.hideTransition_) this.hideTransition_.stop();

        if (visible) {
            this.show_();
        } else {
            this.hide_();
        }
    };


    /**
     * Repositions the popup according to the current state.6
     * Should be overriden by subclases.
     */
    abstract reposition():void;


    /**
     * Does the work to show the popup.
     * @private
     */
    private show_() {
        // Ignore call if we are already showing.
        if (this.isVisible_) {
            return;
        }

        // Give derived classes and handlers a chance to customize popup.
        if (!this.onBeforeShow()) {
            return;
        }

        // Allow callers to set the element in the BEFORE_SHOW event.
        if (!this.element_) {
            throw Error('Caller must call setElement before trying to show the popup');
        }

        // Call reposition after onBeforeShow, as it may change the style and/or
        // content of the popup and thereby affecting the size which is used for the
        // viewport calculation.
        this.reposition();

        var doc = getOwnerDocument(this.element_);

        if (this.hideOnEscape_) {
            // Handle the escape keys.  Listen in the capture phase so that we can
            // stop the escape key from propagating to other elements.  For example,
            // if there is a popup within a dialog box, we want the popup to be
            // dismissed first, rather than the dialog.
            this.handler_.listen(
                doc, DomEventType.KEYDOWN, this.onDocumentKeyDown_.bind(this), true);
        }

        // Set up event handlers.
        if (this.autoHide_) {
            // Even if the popup is not in the focused document, we want to
            // close it on mousedowns in the document it's in.
            this.handler_.listen(
                doc, DomEventType.MOUSEDOWN, this.onDocumentMouseDown_.bind(this), true);

            if (userAgent.IE) {
                // We want to know about deactivates/mousedowns on the document with focus
                // The top-level document won't get a deactivate event if the focus is
                // in an iframe and the deactivate fires within that iframe.
                // The active element in the top-level document will remain the iframe
                // itself.
                var activeElement;
                /** @preserveTry */
                try {
                    activeElement = doc.activeElement;
                } catch (e) {
                    // There is an IE browser bug which can cause just the reading of
                    // document.activeElement to throw an Unspecified Error.  This
                    // may have to do with loading a popup within a hidden iframe.
                }
                while (activeElement &&
                activeElement.nodeName == TagName.IFRAME) {
                    /** @preserveTry */
                    try {
                        var tempDoc = getFrameContentDocument(activeElement);
                    } catch (e) {
                        // The frame is on a different domain that its parent document
                        // This way, we grab the lowest-level document object we can get
                        // a handle on given cross-domain security.
                        break;
                    }
                    doc = tempDoc;
                    activeElement = doc.activeElement;
                }

                // Handle mousedowns in the focused document in case the user clicks
                // on the activeElement (in which case the popup should hide).
                this.handler_.listen(
                    doc, DomEventType.MOUSEDOWN, this.onDocumentMouseDown_,
                    true);

                // If the active element inside the focused document changes, then
                // we probably need to hide the popup.
                this.handler_.listen(
                    doc, DomEventType.DEACTIVATE, this.onDocumentBlur_);

            } else {
                this.handler_.listen(
                    doc, DomEventType.BLUR, this.onDocumentBlur_);
            }
        }

        // Make the popup visible.
        if (this.type_ == Type.TOGGLE_DISPLAY) {
            this.showPopupElement();
        } else if (this.type_ == Type.MOVE_OFFSCREEN) {
            this.reposition();
        }
        this.isVisible_ = true;

        this.lastShowTime_ = new Date().getTime();
        this.lastHideTime_ = -1;

        // If there is transition to play, we play it and fire SHOW event after
        // the transition is over.
        if (this.showTransition_) {

            this.handler_.listenOnce(
                this.showTransition_,
                TransEventType.END, this.onShow, false, this);
            this.showTransition_.play();
        } else {
            // Notify derived classes and handlers.
            this.onShow();
        }
    };


    /**
     * Hides the popup. This call is idempotent.
     *
     * @param {?Node=} opt_target Target of the event causing the hide.
     * @return {boolean} Whether the popup was hidden and not cancelled.
     * @private
     */
    private hide_(opt_target?: Event|null) {
        // Give derived classes and handlers a chance to cancel hiding.
        if (!this.isVisible_ || !this.onBeforeHide(opt_target)) {
            return false;
        }

        // Remove any listeners we attached when showing the popup.
        if (this.handler_) {
            this.handler_.unlisten();
        }

        // Set visibility to hidden even if there is a transition.
        this.isVisible_ = false;
        this.lastHideTime_ = new Date().getTime();

        // If there is transition to play, we play it and only hide the element
        // (and fire HIDE event) after the transition is over.
        if (this.hideTransition_) {
            new EventHandler().listenOnce(
                this.hideTransition_,
                TransEventType.END,
                () => this.continueHidingPopup_(opt_target), false, this);
            this.hideTransition_.play();
        } else {
            this.continueHidingPopup_(opt_target);
        }

        return true;
    };


    /**
     * Continues hiding the popup. This is a continuation from hide_. It is
     * a separate method so that we can add a transition before hiding.
     * @param opt_target Target of the event causing the hide.
     * @private
     */
    private continueHidingPopup_(opt_target?:Event|null) {
        // Hide the popup.
        if (this.type_ == Type.TOGGLE_DISPLAY) {
            if (this.shouldHideAsync_) {
                setTimeout(this.hidePopupElement.bind(this), 0);
            } else {
                this.hidePopupElement();
            }
        } else if (this.type_ == Type.MOVE_OFFSCREEN) {
            this.moveOffscreen_();
        }

        // Notify derived classes and handlers.
        this.onHide(opt_target);
    };


    /**
     * Shows the popup element.
     * @protected
     */
    private showPopupElement() {
        this.element_.style.visibility = 'visible';
        setElementShown(this.element_, true);
    }


    /**
     * Hides the popup element.
     * @protected
     */
    private hidePopupElement() {
        this.element_.style.visibility = 'hidden';
        setElementShown(this.element_, false);
    }


    /**
     * Hides the popup by moving it offscreen.
     *
     * @private
     */
    private moveOffscreen_() {
        this.element_.style.top = '-10000px';
    };


    /**
     * Called before the popup is shown. Derived classes can override to hook this
     * event but should make sure to call the parent class method.
     *
     * @return If anyone called preventDefault on the event object (or
     *     if any of the handlers returns false this will also return false.
     */
    protected onBeforeShow():boolean {
        return this.dispatchEvent(new Event(EventType.BEFORE_SHOW));
    };


    /**
     * Called after the popup is shown. Derived classes can override to hook this
     * event but should make sure to call the parent class method.
     * @protected
     */
    private onShow() {
        this.dispatchEvent(new Event(EventType.SHOW));
    };


    /**
     * Called before the popup is hidden. Derived classes can override to hook this
     * event but should make sure to call the parent class method.
     *
     * @param opt_target Target of the event causing the hide.
     * @return If anyone called preventDefault on the event object (or
     *     if any of the handlers returns false this will also return false.
     * @protected
     */
    protected onBeforeHide(opt_srcEvent?:Event|null): boolean {
        if (opt_srcEvent) {
            return this.dispatchEvent(new BrowserEvent(EventType.BEFORE_HIDE, this, opt_srcEvent))
        }
        else {
            return this.dispatchEvent(new Event(EventType.BEFORE_HIDE));
        }
    }


    /**
     * Called after the popup is hidden. Derived classes can override to hook this
     * event but should make sure to call the parent class method.
     * @param {?Node=} opt_target Target of the event causing the hide.
     * @protected
     */
    protected onHide(opt_srcEvent?:Event|null) {
        if (opt_srcEvent) {
            this.dispatchEvent(new BrowserEvent(EventType.HIDE, this, opt_srcEvent));
        }
        else {
            this.dispatchEvent(new Event(EventType.HIDE));
        }
    }


    /**
     * Mouse down handler for the document on capture phase. Used to hide the
     * popup for auto-hide mode.
     *
     * @param {goog.events.BrowserEvent} e The event object.
     * @private
     */
    private onDocumentMouseDown_(e:MouseEvent) {
        let target = e.target as Element;

        if (!contains(this.element_, target) &&
            !this.isOrWithinAutoHidePartner_(target) &&
            this.isWithinAutoHideRegion_(target) && !this.shouldDebounce_()) {
            // Mouse click was outside popup and partners, so hide.
            this.hide_(e);
        }
    };


    /**
     * Handles key-downs on the document to handle the escape key.
     *
     * @param {goog.events.BrowserEvent} e The event object.
     * @private
     */
    private onDocumentKeyDown_(e:KeyboardEvent) {
        if (e.key == "Escape") {
            if (this.hide_(e)) {
                // Eat the escape key, but only if this popup was actually closed.
                e.preventDefault();
                e.stopPropagation();
            }
        }
    };


    /**
     * Deactivate handler(IE) and blur handler (other browsers) for document.
     * Used to hide the popup for auto-hide mode.
     *
     * @param e The event object.
     * @private
     */
    private onDocumentBlur_(e:Event) {
        if (!this.enableCrossIframeDismissal_) {
            return;
        }

        let doc = getOwnerDocument(this.element_);

        // Ignore blur events if the active element is still inside the popup or if
        // there is no longer an active element.  For example, a widget like a
        // goog.ui.Button might programatically blur itself before losing tabIndex.
        if (typeof document.activeElement != 'undefined') {
            var activeElement = doc.activeElement;
            if (!activeElement || contains(this.element_, activeElement) ||
                activeElement.tagName == TagName.BODY) {
                return;
            }

            // Ignore blur events not for the document itself in non-IE browsers.
        } else if (e.target != doc) {
            return;
        }

        // Debounce the initial focus move.
        if (this.shouldDebounce_()) {
            return;
        }

        this.hide_();
    }


    /**
     * @param {Node} element The element to inspect.
     * @return {boolean} Returns true if the given element is one of the auto hide
     *     partners or is a child of an auto hide partner.
     * @private
     */
    private isOrWithinAutoHidePartner_(element:Node) {
        for (let partner of this.autoHidePartners_) {
            if (element === partner || contains(partner, element)) {
                return true;
            }
        }
        return false;
    }


    /**
     * @param {Node} element The element to inspect.
     * @return {boolean} Returns true if the element is contained within
     *     the autohide region. If unset, the autohide region is the entire
     *     entire document.
     * @private
     */
    private isWithinAutoHideRegion_(element: Node): boolean {
        return this.autoHideRegion_ ?
            contains(this.autoHideRegion_, element) :
            true;
    }

    /**
     * @return Whether the time since last show is less than the debounce delay.
     */
    private shouldDebounce_() {
        return new Date().getTime() - this.lastShowTime_ < PopupBase.DEBOUNCE_DELAY_MS;
    }

    protected disposeInternal() {
        this.handler_.unlisten();
        this.autoHidePartners_.clear();
    }
}
