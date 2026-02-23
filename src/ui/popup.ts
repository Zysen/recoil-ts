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

import {PopupBase, Type} from "./popupbase.ts";
import {AbstractPosition} from "./positioning/abstractposition.ts";
import {Corner} from "./positioning/positioning.ts";
import {Box} from "./dom/box.ts";
import {setElementShown} from "./dom/dom.ts";

export class Popup extends PopupBase {
    private popupCorner_: Corner;
    protected position_?: AbstractPosition;
    private margin_: Box | null;

    constructor(element: Element, opt_position?: AbstractPosition) {
        super(element);
        this.margin_ = null;
        this.popupCorner_ = Corner.TOP_START;
        this.position_ = opt_position || undefined;

    }


    /**
     * Returns the corner of the popup to used in the positioning algorithm.
     *
     * @return The popup corner used for positioning.
     */
    getPinnedCorner(): Corner {
        return this.popupCorner_;
    }


    /**
     * Sets the corner of the popup to used in the positioning algorithm.
     *
     * @param  corner The popup corner used for
     *     positioning.
     */
    setPinnedCorner(corner: Corner) {
        this.popupCorner_ = corner;
        if (this.isVisible()) {
            this.reposition();
        }
    }


    /**
     * @return The position helper object associated with the popup.
     */
    getPosition(): AbstractPosition | null {
        return this.position_ || null;
    }


    /**
     * Sets the position helper object associated with the popup.
     *
     * @param position A position helper object.
     */
    setPosition(position: AbstractPosition) {
        this.position_ = position || undefined;
        if (this.isVisible()) {
            this.reposition();
        }
    }


    /**
     * Returns the margin to place around the popup.
     *
     * @return The margin.
     */
    getMargin():Box|null {
        return this.margin_ || null;
    }


    /**
     * Sets the margin to place around the popup.
     *
     */
    setMargin(arg1: Box | null): void;
    setMargin(top: number, right: number, bottom: number, left: number): void;
    setMargin(arg1: Box | null | number, opt_arg2?: number, opt_arg3?: number, opt_arg4?: number): void {
        if (arg1 == null || arg1 instanceof Box) {
            this.margin_ = arg1 as Box | null;
        } else {
            this.margin_ = new Box(arg1, opt_arg2 as number, opt_arg3 as number, opt_arg4 as number);
        }
        if (this.isVisible()) {
            this.reposition();
        }
    }


    /**
     * Repositions the popup according to the current state.
     * @override
     */
    reposition() {
        if (!this.position_) {
            return;
        }

        let hideForPositioning = !this.isVisible() &&
            this.getType() != Type.MOVE_OFFSCREEN;
        let el = this.getElement();
        if (hideForPositioning) {
            el.style.visibility = 'hidden';
            setElementShown(el, true);
        }

        this.position_.reposition(el, this.popupCorner_, this.margin_);

        if (hideForPositioning) {
            // NOTE(eae): The visibility property is reset to 'visible' by the show_
            // method in PopupBase. Resetting it here causes flickering in some
            // situations, even if set to visible after the display property has been
            // set to none by the call below.
            setElementShown(el, false);
        }
    }
}
