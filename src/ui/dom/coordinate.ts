import {toRadians} from "../../util/goog.ts";

export class Coordinate {
    public x:number;
    public y:number;
    constructor(opt_x:number = 0, opt_y:number = 0) {
        this.x = opt_x;
        this.y = opt_y;
    }

    clone() {
        return new Coordinate(this.x, this.y);
    }

    /**
     * Returns the distance between two coordinates.
     * @param a A Coordinate.
     * @param b A Coordinate.
     * @return The distance between {@code a} and {@code b}.
     */
    static distance(a:Coordinate, b:Coordinate):number {
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }


    /**
     * Returns the magnitude of a coordinate.
     * @param a A Coordinate.
     * @return The distance between the origin and {@code a}.
     */
    static magnitude(a:Coordinate) {
        return Math.sqrt(a.x * a.x + a.y * a.y);
    };

    /**
     * Returns the squared distance between two coordinates. Squared distances can
     * be used for comparisons when the actual value is not required.
     *
     * Performance note: eliminating the square root is an optimization often used
     * in lower-level languages, but the speed difference is not nearly as
     * pronounced in JavaScript (only a few percent.)
     *
     * @param a A Coordinate.
     * @param b A Coordinate.
     * @return The squared distance between {@code a} and {@code b}.
     */
    static squaredDistance(a:Coordinate, b:Coordinate):number {
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        return dx * dx + dy * dy;
    };


    /**
     * Returns the difference between two coordinates as a new
     * @param a A Coordinate.
     * @param b A Coordinate.
     * @return A Coordinate representing the difference
     *     between {@code a} and {@code b}.
     */
    static difference(a:Coordinate, b:Coordinate) {
        return new Coordinate(a.x - b.x, a.y - b.y);
    };


    /**
     * Returns the sum of two coordinates as a new Coordinate.
     * @param a A Coordinate.
     * @param b A Coordinate.
     * @return A Coordinate representing the sum of the two
     *     coordinates.
     */
    static sum(a:Coordinate, b:Coordinate) {
        return new Coordinate(a.x + b.x, a.y + b.y);
    };


    /**
     * Rounds the x and y fields to the next larger integer values.
     * @return This coordinate with ceil'd fields.
     */
    ceil() {
        this.x = Math.ceil(this.x);
        this.y = Math.ceil(this.y);
        return this;
    };


    /**
     * Rounds the x and y fields to the next smaller integer values.
     * @return This coordinate with floored fields.
     */
    floor() {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        return this;
    };


    /**
     * Rounds the x and y fields to the nearest integer values.
     * @return This coordinate with rounded fields.
     */
    round() {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        return this;
    };


    /**
     * Translates this box by the given offsets. If a {@code Coordinate}
     * is given, then the x and y values are translated by the coordinate's x and y.
     * Otherwise, x and y are translated by {@code tx} and {@code opt_ty}
     * respectively.
     * @param tx The value to translate x by or the
     *     the coordinate to translate this coordinate by.
     * @param opt_ty The value to translate y by.
     * @return This coordinate after translating.
     */
    translate(tx:number|Coordinate, opt_ty?:number) {
        if (tx instanceof Coordinate) {
            this.x += tx.x;
            this.y += tx.y;
        } else {
            this.x += tx;
                this.y += opt_ty || 0;

        }
        return this;
    };


    /**
     * Scales this coordinate by the given scale factors. The x and y values are
     * scaled by {@code sx} and {@code opt_sy} respectively.  If {@code opt_sy}
     * is not given, then {@code sx} is used for both x and y.
     * @param sx The scale factor to use for the x dimension.
     * @param sy The scale factor to use for the y dimension.
     * @return This coordinate after scaling.
     */
    scale(sx:number, sy:number = sx) {
        this.x *= sx;
        this.y *= sy;
        return this;
    };


    /**
     * Rotates this coordinate clockwise about the origin (or, optionally, the given
     * center) by the given angle, in radians.
     * @param {number} radians The angle by which to rotate this coordinate
     *     clockwise about the given center, in radians.
     * @param center The center of rotation. Defaults
     *     to (0, 0) if not given.
     */
    rotateRadians(radians:number, center:Coordinate = new Coordinate(0,0) ) {
        let x = this.x;
        let y = this.y;
        let cos = Math.cos(radians);
        let sin = Math.sin(radians);

        this.x = (x - center.x) * cos - (y - center.y) * sin + center.x;
        this.y = (x - center.x) * sin + (y - center.y) * cos + center.y;
    };


    /**
     * Rotates this coordinate clockwise about the origin (or, optionally, the given
     * center) by the given angle, in degrees.
     * @param degrees The angle by which to rotate this coordinate
     *     clockwise about the given center, in degrees.
     * @param opt_center The center of rotation. Defaults
     *     to (0, 0) if not given.
     */
    rotateDegrees(degrees:number, opt_center?:Coordinate) {
        this.rotateRadians(toRadians(degrees), opt_center);
    }
}
