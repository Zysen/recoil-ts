import {Size} from "./size.ts";
import {Box} from "./box.ts";
import {Coordinate} from "./coordinate.ts";

export class Rect {
    left:number;
    top:number;
    width:number;
    height:number;

    constructor(x:number, y:number, w:number, h:number) {
        this.left = x;
        this.top = y;
        this.width = w;
        this.height = h;
    }

    getSize():Size {
        return new Size(this.width, this.height)
    }
    static createFromBox(box:Box) {
        return new Rect(
            box.left, box.top, box.right - box.left, box.bottom - box.top);
    }
    /**
     * Computes the intersection of this rectangle and the rectangle parameter.  If
     * there is no intersection, returns false and leaves this rectangle as is.
     * @param rect A Rectangle.
     * @return True iff this rectangle intersects with the parameter.
     */
    intersection(rect:Rect):boolean {
        let x0 = Math.max(this.left, rect.left);
        let x1 = Math.min(this.left + this.width, rect.left + rect.width);

        if (x0 <= x1) {
            let y0 = Math.max(this.top, rect.top);
            let y1 = Math.min(this.top + this.height, rect.top + rect.height);

            if (y0 <= y1) {
                this.left = x0;
                this.top = y0;
                this.width = x1 - x0;
                this.height = y1 - y0;

                return true;
            }
        }
        return false;
    }

    getTopLeft():Coordinate {
        return new Coordinate(this.left, this.top);
    }
}