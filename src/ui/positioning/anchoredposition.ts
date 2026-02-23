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

import {Corner, positionAtAnchor} from "./positioning.ts";
import {AbstractPosition} from "./abstractposition.ts";
import {Box} from "../dom/box.ts";
import {Size} from "../dom/size.ts";

export class AnchoredPosition extends AbstractPosition {
    readonly element: Element;
    private readonly overflow_: number | undefined;
    readonly corner: Corner;

    /**
     * Encapsulates a popup position where the popup is anchored at a corner of
     * an element.
     *
     * When using AnchoredPosition, it is recommended that the popup element
     * specified in the Popup constructor or Popup.setElement be absolutely
     * positioned.
     *
     * @param anchorElement Element the movable element should be
     *     anchored against.
     * @param corner Corner of anchored element the
     *     movable element should be positioned at.
     * @param opt_overflow Overflow handling mode. Defaults to IGNORE if
     *     not specified. Bitmap, {@see goog.positioning.Overflow}.
     */
    constructor(
        anchorElement: Element, corner: Corner, opt_overflow?: number) {

        super();
        this.element = anchorElement;
        this.corner = corner;
        this.overflow_ = opt_overflow;
    }

    /**
     * Repositions the movable element.
     *
     * @param movableElement Element to position.
     * @param movableCorner Corner of the movable element
     *     that should be positioned adjacent to the anchored element.
     * @param opt_margin A margin specifin pixels.
     * @param opt_preferredSize PreferredSize of the
     *     movableElement (unused in this class).
     * @override
     */
    reposition(
        movableElement: Element, movableCorner: Corner, opt_margin?: Box, opt_preferredSize?: Size): void {
        positionAtAnchor(
            this.element, this.corner, movableElement, movableCorner, undefined,
            opt_margin, this.overflow_);
    }
}