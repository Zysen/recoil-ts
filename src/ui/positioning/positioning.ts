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
 * @fileoverview Common positioning code.
 *
 * @author eae@google.com (Emil A Eklund)
 */


import {Coordinate} from "../dom/coordinate.ts";
import {Box} from "../dom/box.ts";
import {Size} from "../dom/size.ts";
import {
    getBounds,
    getComputedPosition,
    getDomHelper,
    getPageOffset, getScrollLeft,
    getSize,
    getVisibleRectForElement, isRightToLeft, setBorderBoxSize,
    setPosition, translateRectForAnotherFrame
} from "../dom/dom.ts";
import {TagName} from "../dom/tags.ts";
import {Rect} from "../dom/rect.ts";

/**
 * Enum for bits in the {@see Corner} bitmap.
 */
export enum CornerBit {
    BOTTOM = 1,
    CENTER = 2,
    RIGHT = 4,
    FLIP_RTL = 8
}


/**
 * Enum for representing an element corner for positioning the popup.
 *
 * The START constants map to LEFT if element directionality is left
 * to right and RIGHT if the directionality is right to left.
 * Likewise, END maps to RIGHT or LEFT depending on the directionality.
 *
 * @enum {number}
 */
export enum Corner {
    TOP_LEFT = 0,
    TOP_RIGHT = CornerBit.RIGHT,
    BOTTOM_LEFT = CornerBit.BOTTOM,
    BOTTOM_RIGHT = CornerBit.BOTTOM | CornerBit.RIGHT,
    TOP_START = CornerBit.FLIP_RTL,
    TOP_END =
        CornerBit.FLIP_RTL | CornerBit.RIGHT,
    BOTTOM_START = CornerBit.BOTTOM | CornerBit.FLIP_RTL,
    BOTTOM_END = CornerBit.BOTTOM | CornerBit.RIGHT | CornerBit.FLIP_RTL,
    TOP_CENTER = CornerBit.CENTER,
    BOTTOM_CENTER = CornerBit.BOTTOM | CornerBit.CENTER
}


/**
 * Enum for representing position handling in cases where the element would be
 * positioned outside the viewport.
 *
 * @enum {number}
 */
export enum Overflow {
    /** Ignore overflow */
    IGNORE = 0,

    /** Try to fit horizontally in the viewport at all costs. */
    ADJUST_X = 1,

    /** If the element can't fit horizontally, report positioning failure. */
    FAIL_X = 2,

    /** Try to fit vertically in the viewport at all costs. */
    ADJUST_Y = 4,

    /** If the element can't fit vertically, report positioning failure. */
    FAIL_Y = 8,

    /** Resize the element's width to fit in the viewport. */
    RESIZE_WIDTH = 16,

    /** Resize the element's height to fit in the viewport. */
    RESIZE_HEIGHT = 32,

    /**
     * If the anchor goes off-screen in the x-direction, position the movable
     * element off-screen. Otherwise, try to fit horizontally in the viewport.
     */
    ADJUST_X_EXCEPT_OFFSCREEN = 64 | 1,

    /**
     * If the anchor goes off-screen in the y-direction, position the movable
     * element off-screen. Otherwise, try to fit vertically in the viewport.
     */
    ADJUST_Y_EXCEPT_OFFSCREEN = 128 | 4
}


/**
 * Enum for representing the outcome of a positioning call.
 *
 * @enum {number}
 */
export enum OverflowStatus {
    NONE = 0,
    ADJUSTED_X = 1,
    ADJUSTED_Y = 2,
    WIDTH_ADJUSTED = 4,
    HEIGHT_ADJUSTED = 8,
    FAILED_LEFT = 16,
    FAILED_RIGHT = 32,
    FAILED_TOP = 64,
    FAILED_BOTTOM = 128,
    FAILED_OUTSIDE_VIEWPORT = 256,
    FAILED = FAILED_LEFT |
        OverflowStatus.FAILED_RIGHT |
        OverflowStatus.FAILED_TOP |
        OverflowStatus.FAILED_BOTTOM |
        OverflowStatus.FAILED_OUTSIDE_VIEWPORT,
    FAILED_HORIZONTAL =
        OverflowStatus.FAILED_LEFT |
        OverflowStatus.FAILED_RIGHT,
    FAILED_VERTICAL =
        OverflowStatus.FAILED_TOP |
        OverflowStatus.FAILED_BOTTOM
}



/**
 * Positions a movable element relative to an anchor element. The caller
 * specifies the corners that should touch. This functions then moves the
 * movable element accordingly.
 *
 * @param anchorElement The element that is the anchor for where
 *    the movable element should position itself.
 * @param anchorElementCorner The corner of the
 *     anchorElement for positioning the movable element.
 * @param movableElement The element to move.
 * @param movableElementCorner The corner of the
 *     movableElement that that should be positioned adjacent to the anchor
 *     element.
 * @param opt_offset An offset specified in pixels.
 *    After the normal positioning algorithm is applied, the offset is then
 *    applied. Positive coordinates move the popup closer to the center of the
 *    anchor element. Negative coordinates move the popup away from the center
 *    of the anchor element.
 * @param opt_margin A margin specified in pixels.
 *    After the normal positioning algorithm is applied and any offset, the
 *    margin is then applied. Positive coordinates move the popup away from the
 *    spot it was positioned towards its center. Negative coordinates move it
 *    towards the spot it was positioned away from its center.
 * @param {?number=} opt_overflow Overflow handling mode. Defaults to IGNORE if
 *     not specified. Bitmap, {@see Overflow}.
 * @param opt_preferredSize The preferred size of the
 *     movableElement.
 * @param opt_viewport Box object describing the dimensions of
 *     the viewport. The viewport is specified relative to offsetParent of
 *     {@code movableElement}. In other words, the viewport can be thought of as
 *     describing a "position: absolute" element contained in the offsetParent.
 *     It defaults to visible area of nearest scrollable ancestor of
 *     {@code movableElement} (see {@code getVisibleRectForElement}).
 * @return Status bitmap,
 *     {@see OverflowStatus}.
 */
export function positionAtAnchor(
    anchorElement:Element, anchorElementCorner:Corner, movableElement:Element, movableElementCorner:Corner,
    opt_offset?:Coordinate|null, opt_margin?:Box|null, opt_overflow?:number, opt_preferredSize?:Size, opt_viewport?:Box):OverflowStatus {
    
    let movableParentTopLeft =
        getOffsetParentPageOffset(movableElement);

    // Get the visible part of the anchor element.  anchorRect is
    // relative to anchorElement's page.
    let anchorRect = getVisiblePart_(anchorElement);

    // Translate anchorRect to be relative to movableElement's page.
    translateRectForAnotherFrame(
        anchorRect, getDomHelper(anchorElement),
        getDomHelper(movableElement));

    // Offset based on which corner of the element we want to position against.
    let corner =
        getEffectiveCorner(anchorElement, anchorElementCorner);
    let offsetLeft = anchorRect.left;
    if (corner & CornerBit.RIGHT) {
        offsetLeft += anchorRect.width;
    } else if (corner & CornerBit.CENTER) {
        offsetLeft += anchorRect.width / 2;
    }

    // absolutePos is a candidate position relative to the
    // movableElement's window.
    let absolutePos = new Coordinate(
        offsetLeft, anchorRect.top +
        (corner & CornerBit.BOTTOM ? anchorRect.height : 0));

    // Translate absolutePos to be relative to the offsetParent.
    absolutePos =
        Coordinate.difference(absolutePos, movableParentTopLeft);

    // Apply offset, if specified
    if (opt_offset) {
        absolutePos.x +=
            (corner & CornerBit.RIGHT ? -1 : 1) * opt_offset.x;
        absolutePos.y +=
            (corner & CornerBit.BOTTOM ? -1 : 1) * opt_offset.y;
    }

    // Determine dimension of viewport.
    let viewport;
    if (opt_overflow) {
        if (opt_viewport) {
            viewport = opt_viewport;
        } else {
            viewport = getVisibleRectForElement(movableElement);
            if (viewport) {
                viewport.top -= movableParentTopLeft.y;
                viewport.right -= movableParentTopLeft.x;
                viewport.bottom -= movableParentTopLeft.y;
                viewport.left -= movableParentTopLeft.x;
            }
        }
    }

    return positionAtCoordinate(
        absolutePos, movableElement, movableElementCorner, opt_margin, viewport || undefined,
        opt_overflow, opt_preferredSize);
}


/**
 * Calculates the page offset of the given element's
 * offsetParent. This value can be used to translate any x- and
 * y-offset relative to the page to an offset relative to the
 * offsetParent, which can then be used directly with as position
 * coordinate for {@code positionWithCoordinate}.
 * @param movableElement The element to calculate.
 * @return The page offset, may be (0, 0).
 */
export function getOffsetParentPageOffset  (movableElement:Element):Coordinate {
    // Ignore offset for the BODY element unless its position is non-static.
    // For cases where the offset parent is HTML rather than the BODY (such as in
    // IE strict mode) there's no need to get the position of the BODY as it
    // doesn't affect the page offset.
    let movableParentTopLeft;
    let parent =  (movableElement as any).offsetParent;
    if (parent) {
        let isBody = parent.tagName == TagName.HTML ||
            parent.tagName == TagName.BODY;
        if (!isBody || getComputedPosition(parent) != 'static') {
            // Get the top-left corner of the parent, in page coordinates.
            movableParentTopLeft = getPageOffset(parent);

            if (!isBody) {
                movableParentTopLeft = Coordinate.difference(
                    movableParentTopLeft,
                    new Coordinate(
                        getScrollLeft(parent), parent.scrollTop));
            }
        }
    }

    return movableParentTopLeft || new Coordinate();
}


/**
 * Returns intersection of the specified element and getVisibleRectForElement for it.
 *
 * @param el The target element.
 * @return Intersection of getVisibleRectForElement
 *     and the current bounding rectangle of the element.  If the
 *     intersection is empty, returns the bounding rectangle.
 */
function getVisiblePart_ (el:Element):Rect {
    let rect = getBounds(el);
    let visibleBox = getVisibleRectForElement(el);
    if (visibleBox) {
        rect.intersection(Rect.createFromBox(visibleBox));
    }
    return rect;
}


/**
 * Positions the specified corner of the movable element at the
 * specified coordinate.
 *
 * @param absolutePos The coordinate to position the
 *     element at.
 * @param {Element} movableElement The element to be positioned.
 * @param movableElementCorner The corner of the
 *     movableElement that that should be positioned.
 * @param opt_margin A margin specified in pixels.
 *    After the normal positioning algorithm is applied and any offset, the
 *    margin is then applied. Positive coordinates move the popup away from the
 *    spot it was positioned towards its center. Negative coordinates move it
 *    towards the spot it was positioned away from its center.
 * @param opt_viewport Box object describing the dimensions of
 *     the viewport. Required if opt_overflow is specified.
 * @param opt_overflow Overflow handling mode. Defaults to IGNORE if
 *     not specified, {@see Overflow}.
 * @param  opt_preferredSize The preferred size of the
 *     movableElement. Defaults to the current size.
 * @return {OverflowStatus} Status bitmap.
 */
export function positionAtCoordinate (
    absolutePos:Coordinate, movableElement:Element, movableElementCorner:Corner, opt_margin?:Box|null, opt_viewport?:Box|null,
    opt_overflow?:number, opt_preferredSize?:Size):OverflowStatus {
    absolutePos = absolutePos.clone();

    // Offset based on attached corner and desired margin.
    let corner =
        getEffectiveCorner(movableElement, movableElementCorner);
    let elementSize = getSize(movableElement);
    let size =
        opt_preferredSize ? opt_preferredSize.clone() : elementSize.clone();

    let positionResult = getPositionAtCoordinate(
        absolutePos, size, corner, opt_margin, opt_viewport, opt_overflow);

    if (positionResult.status & OverflowStatus.FAILED) {
        return positionResult.status;
    }

    setPosition(movableElement, positionResult.rect.getTopLeft());
    size = positionResult.rect.getSize();
    if (!Size.equals(elementSize, size)) {
        setBorderBoxSize(movableElement, size);
    }

    return positionResult.status;
}


/**
 * Computes the position for an element to be placed on-screen at the
 * specified coordinates. Returns an object containing both the resulting
 * rectangle, and the overflow status bitmap.
 *
 * @param absolutePos The coordinate to position the
 *     element at.
 * @param elementSize The size of the element to be
 *     positioned.
 * @param elementCorner The corner of the
 *     movableElement that that should be positioned.
 * @param opt_margin A margin specified in pixels.
 *    After the normal positioning algorithm is applied and any offset, the
 *    margin is then applied. Positive coordinates move the popup away from the
 *    spot it was positioned towards its center. Negative coordinates move it
 *    towards the spot it was positioned away from its center.
 * @param opt_viewport Box object describing the dimensions of
 *     the viewport. Required if opt_overflow is specified.
 * @param opt_overflow Overflow handling mode. Defaults to IGNORE
 *     if not specified, {@see Overflow}.
 * @return Object containing the computed position and status bitmap.
 */
export function getPositionAtCoordinate (
    absolutePos:Coordinate, elementSize:Size, elementCorner:Corner, opt_margin?:Box|null, opt_viewport?:Box|null,
    opt_overflow?:number) : {rect:Rect,status:OverflowStatus} {
    absolutePos = absolutePos.clone();
    elementSize = elementSize.clone();
    let status = OverflowStatus.NONE;

    if (opt_margin || elementCorner != Corner.TOP_LEFT) {
        if (elementCorner & CornerBit.RIGHT) {
            absolutePos.x -= elementSize.width + (opt_margin ? opt_margin.right : 0);
        } else if (elementCorner & CornerBit.CENTER) {
            absolutePos.x -= elementSize.width / 2;
        } else if (opt_margin) {
            absolutePos.x += opt_margin.left;
        }
        if (elementCorner & CornerBit.BOTTOM) {
            absolutePos.y -=
                elementSize.height + (opt_margin ? opt_margin.bottom : 0);
        } else if (opt_margin) {
            absolutePos.y += opt_margin.top;
        }
    }

    // Adjust position to fit inside viewport.
    if (opt_overflow) {
        status = opt_viewport ?
            adjustForViewport_(
                absolutePos, elementSize, opt_viewport, opt_overflow) :
            OverflowStatus.FAILED_OUTSIDE_VIEWPORT;
    }

    let rect = new Rect(0, 0, 0, 0);
    rect.left = absolutePos.x;
    rect.top = absolutePos.y;
    rect.width = elementSize.width;
    rect.height = elementSize.height;
    return {rect: rect, status: status};
}


/**
 * Adjusts the position and/or size of an element, identified by its position
 * and size, to fit inside the viewport. If the position or size of the element
 * is adjusted the pos or size objects, respectively, are modified.
 *
 * @param pos Position of element, updated if the
 *     position is adjusted.
 * @param size Size of element, updated if the size is
 *     adjusted.
 * @param viewport Bounding box describing the viewport.
 * @param overflow Overflow handling mode,
 *     {@see Overflow}.
 * @return Status bitmap,
 *     {@see OverflowStatus}.
 * @private
 */
function adjustForViewport_ (pos:Coordinate, size:Size, viewport:Box, overflow:number):OverflowStatus {
    let status = OverflowStatus.NONE;

    let ADJUST_X_EXCEPT_OFFSCREEN =
        Overflow.ADJUST_X_EXCEPT_OFFSCREEN;
    let ADJUST_Y_EXCEPT_OFFSCREEN =
        Overflow.ADJUST_Y_EXCEPT_OFFSCREEN;
    if ((overflow & ADJUST_X_EXCEPT_OFFSCREEN) == ADJUST_X_EXCEPT_OFFSCREEN &&
        (pos.x < viewport.left || pos.x >= viewport.right)) {
        overflow &= ~Overflow.ADJUST_X;
    }
    if ((overflow & ADJUST_Y_EXCEPT_OFFSCREEN) == ADJUST_Y_EXCEPT_OFFSCREEN &&
        (pos.y < viewport.top || pos.y >= viewport.bottom)) {
        overflow &= ~Overflow.ADJUST_Y;
    }

    // Left edge outside viewport, try to move it.
    if (pos.x < viewport.left && overflow & Overflow.ADJUST_X) {
        pos.x = viewport.left;
        status |= OverflowStatus.ADJUSTED_X;
    }

    // Ensure object is inside the viewport width if required.
    if (overflow & Overflow.RESIZE_WIDTH) {
        // Move left edge inside viewport.
        let originalX = pos.x;
        if (pos.x < viewport.left) {
            pos.x = viewport.left;
            status |= OverflowStatus.WIDTH_ADJUSTED;
        }

        // Shrink width to inside right of viewport.
        if (pos.x + size.width > viewport.right) {
            // Set the width to be either the new maximum width within the viewport
            // or the width originally within the viewport, whichever is less.
            size.width = Math.min(
                viewport.right - pos.x, originalX + size.width - viewport.left);
            size.width = Math.max(size.width, 0);
            status |= OverflowStatus.WIDTH_ADJUSTED;
        }
    }

    // Right edge outside viewport, try to move it.
    if (pos.x + size.width > viewport.right &&
        overflow & Overflow.ADJUST_X) {
        pos.x = Math.max(viewport.right - size.width, viewport.left);
        status |= OverflowStatus.ADJUSTED_X;
    }

    // Left or right edge still outside viewport, fail if the FAIL_X option was
    // specified, ignore it otherwise.
    if (overflow & Overflow.FAIL_X) {
        status |=
            (pos.x < viewport.left ? OverflowStatus.FAILED_LEFT :
                0) |
            (pos.x + size.width > viewport.right ?
                OverflowStatus.FAILED_RIGHT :
                0);
    }

    // Top edge outside viewport, try to move it.
    if (pos.y < viewport.top && overflow & Overflow.ADJUST_Y) {
        pos.y = viewport.top;
        status |= OverflowStatus.ADJUSTED_Y;
    }

    // Ensure object is inside the viewport height if required.
    if (overflow & Overflow.RESIZE_HEIGHT) {
        // Move top edge inside viewport.
        let originalY = pos.y;
        if (pos.y < viewport.top) {
            pos.y = viewport.top;
            status |= OverflowStatus.HEIGHT_ADJUSTED;
        }

        // Shrink height to inside bottom of viewport.
        if (pos.y + size.height > viewport.bottom) {
            // Set the height to be either the new maximum height within the viewport
            // or the height originally within the viewport, whichever is less.
            size.height = Math.min(
                viewport.bottom - pos.y, originalY + size.height - viewport.top);
            size.height = Math.max(size.height, 0);
            status |= OverflowStatus.HEIGHT_ADJUSTED;
        }
    }

    // Bottom edge outside viewport, try to move it.
    if (pos.y + size.height > viewport.bottom &&
        overflow & Overflow.ADJUST_Y) {
        pos.y = Math.max(viewport.bottom - size.height, viewport.top);
        status |= OverflowStatus.ADJUSTED_Y;
    }

    // Top or bottom edge still outside viewport, fail if the FAIL_Y option was
    // specified, ignore it otherwise.
    if (overflow & Overflow.FAIL_Y) {
        status |=
            (pos.y < viewport.top ? OverflowStatus.FAILED_TOP :
                0) |
            (pos.y + size.height > viewport.bottom ?
                OverflowStatus.FAILED_BOTTOM :
                0);
    }

    return status;
}


/**
 * Returns an absolute corner (top/bottom left/right) given an absolute
 * or relative (top/bottom start/end) corner and the direction of an element.
 * Absolute corners remain unchanged.
 * @param {Element} element DOM element to test for RTL direction.
 * @param corner The popup corner used for
 *     positioning.
 * @return Effective corner.
 */
function getEffectiveCorner(element:Element, corner:Corner):Corner {
    return  (
        (corner & CornerBit.FLIP_RTL &&
        isRightToLeft(element) ?
            corner ^ CornerBit.RIGHT :
            corner) &
        ~CornerBit.FLIP_RTL) as Corner;
}


/**
 * Returns the corner opposite the given one horizontally.
 * @param corner The popup corner used to flip.
 * @return The opposite corner horizontally.
 */
export function flipCornerHorizontal(corner:Corner):Corner {
    return (corner ^ CornerBit.RIGHT) as Corner;
}


/**
 * Returns the corner opposite the given one vertically.
 * @param corner The popup corner used to flip.
 * @return The opposite corner vertically.
 */
export function flipCornerVertical(corner:Corner):Corner {
    return  (
        corner ^ CornerBit.BOTTOM) as Corner;
}


/**
 * Returns the corner opposite the given one horizontally and vertically.
 * @param corner The popup corner used to flip.
 * @return The opposite corner horizontally and
 *     vertically.
 */
export function flipCorner(corner:Corner):Corner {
    return (
        corner ^ CornerBit.BOTTOM ^
        CornerBit.RIGHT) as Corner;
}
