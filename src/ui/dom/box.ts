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

import {Coordinate} from "./coordinate.ts";

export class Box {
    left: number;
    right: number;
    top: number;
    bottom: number;

    /**
     * Class for representing a box. A box is specified as a top, right, bottom,
     * and left. A box is useful for representing margins and padding.
     *
     * This class assumes 'screen coordinates': larger Y coordinates are further
     * from the top of the screen.
     *
     * @param {number} top Top.
     * @param {number} right Right.
     * @param {number} bottom Bottom.
     * @param {number} left Left.
     * @struct
     * @constructor
     */
    constructor(top: number, right: number, bottom: number, left: number) {
        /**
         * Top
         * @type {number}
         */
        this.top = top;

        /**
         * Right
         * @type {number}
         */
        this.right = right;

        /**
         * Bottom
         * @type {number}
         */
        this.bottom = bottom;

        /**
         * Left
         * @type {number}
         */
        this.left = left;
    }


    /**
     * Creates a Box by bounding a collection of goog.math.Coordinate objects
     * remaining     *     the box.
     * @return A Box containing all the specified Coordinates.
     */
    static boundingBox(first: Coordinate, ...remaining: Coordinate[]): Box {
        let box = new Box(first.y, first.x, first.y, first.x);
        for (let c of remaining) {
            box.expandToIncludeCoordinate(c);
        }
        return box;
    }


    /**
     * @return {number} width The width of this Box.
     */
    get width(): number {
        return this.right - this.left;
    }


    /**
     * @return  height The height of this Box.
     */
    get height():number {
        return this.bottom - this.top;
    }


    /**
     * Creates a copy of the box with the same dimensions.
     * @return A clone of this Box.
     */
    clone():Box {
        return new Box(this.top, this.right, this.bottom, this.left);
    }


    /**
     * Returns whether the box contains a coordinate or another box.
     *
     * @param other A Coordinate or a Box.
     * @return Whether the box contains the coordinate or other box.
     */
    contains(other: Coordinate | Box):boolean {
        return Box.contains(this, other);
    }


    /**
     * Expands box with the given margins.
     *
     * @param top Top margin or box with all margins.
     * @param opt_right Right margin.
     * @param opt_bottom Bottom margin.
     * @param opt_left Left margin.
     * @return A reference to this Box.
     */
    expand(top: number | Box, opt_right?: number, opt_bottom?: number, opt_left?: number): this {
        if (typeof top !== "number") {
            this.top -= top.top;
            this.right += top.right;
            this.bottom += top.bottom;
            this.left -= top.left;
        } else {
            this.top -= top;
            this.right += opt_right || 0;
            this.bottom += opt_bottom || 0;
            this.left -= opt_left || 0;
        }

        return this;
    }


    /**
     * Expand this box to include another box.
     * NOTE(user): This is used in code that needs to be very fast, please don't
     * add functionality to this function at the expense of speed (variable
     * arguments, accepting multiple argument types, etc.).
     * @param box The box to include in this one.
     */
    expandToInclude(box: Box) {
        this.left = Math.min(this.left, box.left);
        this.top = Math.min(this.top, box.top);
        this.right = Math.max(this.right, box.right);
        this.bottom = Math.max(this.bottom, box.bottom);
    }


    /**
     * Expand this box to include the coordinate.
     * @param {!goog.math.Coordinate} coord The coordinate to be included
     *     inside the box.
     */
    expandToIncludeCoordinate(coord: Coordinate) {
        this.top = Math.min(this.top, coord.y);
        this.right = Math.max(this.right, coord.x);
        this.bottom = Math.max(this.bottom, coord.y);
        this.left = Math.min(this.left, coord.x);
    }


    /**
     * Compares boxes for equality.
     * @param a A Box.
     * @param b A Box.
     * @return {boolean} True iff the boxes are equal, or if both are null.
     */
    static equals(a: Box, b: Box): boolean {
        if (a == b) {
            return true;
        }
        if (!a || !b) {
            return false;
        }
        return a.top == b.top && a.right == b.right && a.bottom == b.bottom &&
            a.left == b.left;
    }


    /**
     * Returns whether a box contains a coordinate or another box.
     *
     * @param box A Box.
     * @param {goog.math.Coordinate|Box} other A Coordinate or a Box.
     * @return {boolean} Whether the box contains the coordinate or other box.
     */
    static contains(box: Box, other: Box | Coordinate): boolean {
        if (!box || !other) {
            return false;
        }

        if (other instanceof Box) {
            return other.left >= box.left && other.right <= box.right &&
                other.top >= box.top && other.bottom <= box.bottom;
        }

        // other is a Coordinate.
        return other.x >= box.left && other.x <= box.right && other.y >= box.top &&
            other.y <= box.bottom;
    }

    /**
     * Returns the relative x position of a coordinate compared to a box.  Returns
     * zero if the coordinate is inside the box.
     *
     * @param box A Box.
     * @param coord A Coordinate.
     * @return {number} The x position of {@code coord} relative to the nearest
     *     side of {@code box}, or zero if {@code coord} is inside {@code box}.
     */
    static relativePositionX(box: Box, coord: Coordinate): number {
        if (coord.x < box.left) {
            return coord.x - box.left;
        } else if (coord.x > box.right) {
            return coord.x - box.right;
        }
        return 0;
    }


    /**
     * Returns the relative y position of a coordinate compared to a box.  Returns
     * zero if the coordinate is inside the box.
     *
     * @param box A Box.
     * @param coord A Coordinate.
     * @return The y position of {@code coord} relative to the nearest
     *     side of {@code box}, or zero if {@code coord} is inside {@code box}.
     */
    static relativePositionY(box: Box, coord: Coordinate): number {
        if (coord.y < box.top) {
            return coord.y - box.top;
        } else if (coord.y > box.bottom) {
            return coord.y - box.bottom;
        }
        return 0;
    }


    /**
     * Returns the distance between a coordinate and the nearest corner/side of a
     * box. Returns zero if the coordinate is inside the box.
     *
     * @param box A Box.
     * @param coord A Coordinate.
     * @return The distance between {@code coord} and the nearest
     *     corner/side of {@code box}, or zero if {@code coord} is inside
     *     {@code box}.
     */
    static distance(box: Box, coord: Coordinate) :number{
        let x = Box.relativePositionX(box, coord);
        let y = Box.relativePositionY(box, coord);
        return Math.sqrt(x * x + y * y);
    }

    /**
     * Returns whether two boxes intersect.
     *
     * @param a A Box.
     * @param b A second Box.
     * @return {boolean} Whether the boxes intersect.
     */
    static intersects(a:Box, b:Box):boolean {
        return (
            a.left <= b.right && b.left <= a.right && a.top <= b.bottom &&
            b.top <= a.bottom);
    }


    /**
     * Returns whether two boxes would intersect with additional padding.
     *
     * @param a A Box.
     * @param b A second Box.
     * @param {number} padding The additional padding.
     * @return {boolean} Whether the boxes intersect.
     */
    static intersectsWithPadding(a:Box, b:Box, padding:number):boolean {
        return (
            a.left <= b.right + padding && b.left <= a.right + padding &&
            a.top <= b.bottom + padding && b.top <= a.bottom + padding);
    }


    /**
     * Rounds the fields to the next larger integer values.
     */
    ceil(): this {
        this.top = Math.ceil(this.top);
        this.right = Math.ceil(this.right);
        this.bottom = Math.ceil(this.bottom);
        this.left = Math.ceil(this.left);
        return this;
    }


    /**
     * Rounds the fields to the next smaller integer values.
     *
     * @return This box with floored fields.
     */
    floor(): this {
        this.top = Math.floor(this.top);
        this.right = Math.floor(this.right);
        this.bottom = Math.floor(this.bottom);
        this.left = Math.floor(this.left);
        return this;
    }


    /**
     * Rounds the fields to nearest integer values.
     *
     * @return This box with rounded fields.
     */
    round(): this {
        this.top = Math.round(this.top);
        this.right = Math.round(this.right);
        this.bottom = Math.round(this.bottom);
        this.left = Math.round(this.left);
        return this;
    }


    /**
     * Translates this box by the given offsets. If a {@code goog.math.Coordinate}
     * is given, then the left and right values are translated by the coordinate's
     * x value and the top and bottom values are translated by the coordinate's y
     * value.  Otherwise, {@code tx} and {@code opt_ty} are used to translate the x
     * and y dimension values.
     *
     * @param tx The value to translate the x
     *     dimension values by or the coordinate to translate this box by.
     * @param opt_ty The value to translate y dimension values by.
     * @return This box after translating.
     */
    translate(tx: number | Coordinate, opt_ty?: number): this {
        if (tx instanceof Coordinate) {
            this.left += tx.x;
            this.right += tx.x;
            this.top += tx.y;
            this.bottom += tx.y;
        } else {
            this.left += tx;
            this.right += tx;

            this.top += opt_ty || 0;
            this.bottom += opt_ty || 0;

        }
        return this;
    }


    /**
     * Scales this coordinate by the given scale factors. The x and y dimension
     * values are scaled by {@code sx} and {@code opt_sy} respectively.
     * If {@code opt_sy} is not given, then {@code sx} is used for both x and y.
     *
     * @param sx The scale factor to use for the x dimension.
     * @param opt_sy The scale factor to use for the y dimension.
     * @return This box after scaling.
     */
    scale(sx: number, opt_sy?: number): this {
        let sy = opt_sy != undefined ? opt_sy : sx;
        this.left *= sx;
        this.right *= sx;
        this.top *= sy;
        this.bottom *= sy;
        return this;
    }
}