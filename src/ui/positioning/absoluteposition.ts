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
 * @author eae@google.com (Emil A Eklund)
 */

import {AbstractPosition} from "./abstractposition.ts";
import {Coordinate} from "../dom/coordinate.ts";
import {Corner, positionAtCoordinate} from "./positioning.ts";
import {Box} from "../dom/box.ts";
import {Size} from "../dom/size.ts";

/**
 * Encapsulates a popup position where the popup absolutely positioned by
 * setting the left/top style elements directly to the specified values.
 * The position is generally relative to the element's offsetParent. Normally,
 * this is the document body, but can be another element if the popup element
 * is scoped by an element with relative position.
 *
 */
class AbsolutePosition extends AbstractPosition {
    private readonly coordinate: Coordinate;

    constructor(leftOrPos: Coordinate | number, top?: number) {
        super();
        this.coordinate = leftOrPos instanceof Coordinate ?
            leftOrPos : new Coordinate(leftOrPos, top);
    }

    /**
     * Repositions the popup according to the current state.
     *
     * @param movableElement The DOM element to position.
     * @param movableCorner The corner of the movable
     *     element that should be positioned at the specified position.
     * @param opt_margin A margin specified in pixels.
     * @param opt_preferredSize Preferred size of the movableElement.
     * @override
     */
    reposition(
        movableElement:Element, movableCorner:Corner, opt_margin?:Box, opt_preferredSize?: Size) :void {
        positionAtCoordinate(
            this.coordinate, movableElement, movableCorner, opt_margin, undefined, undefined,
            opt_preferredSize);
    }
}
