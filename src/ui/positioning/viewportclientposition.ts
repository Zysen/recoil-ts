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

/**
 * @fileoverview Client viewport positioning class.
 *
 * @author robbyw@google.com (Robert Walker)
 * @author eae@google.com (Emil A Eklund)
 */
import {ClientPosition} from "./clientposition.ts";
import {Coordinate} from "../dom/coordinate.ts";
import {
    Corner,
    flipCornerHorizontal,
    flipCornerVertical,
    Overflow,
    OverflowStatus,
    positionAtCoordinate
} from "./positioning.ts";
import {Size} from "../dom/size.ts";
import {getClientViewportElement, getDomHelper, getVisibleRectForElement} from "../dom/dom.ts";
import {Box} from "../dom/box.ts";

/**
 * Encapsulates a popup position where the popup is positioned relative to the
 * window (client) coordinates, and made to stay within the viewport.
 *
 */
export class ViewPortClientPosition extends ClientPosition {
    private lastResortOverflow_ = 0;

    constructor(leftOrPos: Coordinate | number, top?: number) {
        super(leftOrPos, top);
    }

    /**
     * Set the last-resort overflow strategy, if the popup fails to fit.
     * @param overflow A bitmask of Overflow strategies.
     */
    setLastResortOverflow(overflow: number) {
        this.lastResortOverflow_ = overflow;
    }


    /**
     * Repositions the popup according to the current state.
     *
     * @param element The DOM element of the popup.
     * @param popupCorner The corner of the popup
     *     element that that should be positioned adjacent to the anchorElement.
     *     One of the Corner constants.
     * @param opt_margin A margin specified in pixels.
     * @param opt_preferredSize Preferred size fo the element.
     * @override
     */
    reposition(element: Element, popupCorner: Corner, opt_margin?: Box, opt_preferredSize?: Size) {
        let viewportElt = getClientViewportElement(element);
        let viewport = getVisibleRectForElement(viewportElt);
        let scrollEl = getDomHelper(element).getDocumentScrollElement();
        let clientPos = new Coordinate(
            this.coordinate.x + scrollEl.scrollLeft,
            this.coordinate.y + scrollEl.scrollTop);

        let failXY =
            Overflow.FAIL_X | Overflow.FAIL_Y;
        let corner = popupCorner;

        // Try the requested position.
        let status = positionAtCoordinate(
            clientPos, element, corner, opt_margin, viewport||undefined, failXY,
            opt_preferredSize);
        if ((status & OverflowStatus.FAILED) == 0) {
            return;
        }

        // Outside left or right edge of viewport, try to flip it horizontally.
        if (status & OverflowStatus.FAILED_LEFT ||
            status & OverflowStatus.FAILED_RIGHT) {
            corner = flipCornerHorizontal(corner);
        }

        // Outside top or bottom edge of viewport, try to flip it vertically.
        if (status & OverflowStatus.FAILED_TOP ||
            status & OverflowStatus.FAILED_BOTTOM) {
            corner = flipCornerVertical(corner);
        }

        // Try flipped position.
        status = positionAtCoordinate(
            clientPos, element, corner, opt_margin, viewport||undefined, failXY,
            opt_preferredSize);
        if ((status & OverflowStatus.FAILED) == 0) {
            return;
        }

        // If that failed, the viewport is simply too small to contain the popup.
        // Revert to the original position.
        positionAtCoordinate(
            clientPos, element, popupCorner, opt_margin, viewport||undefined,
            this.lastResortOverflow_, opt_preferredSize);
    }
}
