import {Path, PathItem} from "./path.ts";
import {AvlTree} from "../structs/avltree.ts";
import {compareKey} from "../util/object.ts";
import {type Change} from "./change.ts";


/**
 * @constructor
 * @private
 */

export type ChangeMapNodeChild = {change:Change,ancestor:Change|null,pos:number[], hide?:boolean};

class PathChangeMapNode_ {
    private children_ = new AvlTree<{key:PathItem, value:PathChangeMapNode_}, {key:PathItem}>(compareKey);
    private values_ :ChangeMapNodeChild[]= [];

    removeChange(change: Change):ChangeMapNodeChild|null {
        for (let i = 0; i < this.values_.length; i++) {
            if (this.values_[i].change === change) {
                return this.values_.splice(i, 1)[0];
            }
        }
        return null;
    }
    forEach(callback:(change:ChangeMapNodeChild) => void) {
        this.values_.forEach(callback);
        for (let node of this.children_) {
            node.value.forEach(callback);
        }

    }

    forEachDecendants(callback:(change:ChangeMapNodeChild) => void) {
        for (let node of this.children_) {
            node.value.forEach(callback);
        }
    }
    values():ChangeMapNodeChild[] {
        return this.values_;
    }
    get(item:PathItem):PathChangeMapNode_|null {
        let node = this.children_.findFirst({key: item});
        if (node) {
            return node.value;
        }
        return null;
    }

    create(item: PathItem): PathChangeMapNode_ {
        return this.children_.safeFind({key: item, value: new PathChangeMapNode_()}).value;
    }

    /**
     * removes the path specified in items, if the child node becomes empty then remove the child node, this is recursive
     * and will follow the removal upwards
     *
     * @param items the path to the child node
     * @param index index into items to start from
     * @param node the node to remove
     * @return true if node was removed
     */
     static removeIfEmptyNode_(items:PathItem[], index:number, node:PathChangeMapNode_):boolean {
        if (index === items.length) {
            return node.children_.getCount() === 0 && node.values().length === 0;
        }

        let item = items[index];
        let cur = node.get(items[index]);

        if (!cur) {
            return false;
        }
        if (PathChangeMapNode_.removeIfEmptyNode_(items, index + 1, cur)) {
            node.children_.remove({key: item});
            return node.values().length === 0 && node.children_.getCount() === 0;
        }
        return false;
    }

    addValue(value: ChangeMapNodeChild) {
        this.values_.push(value);
    }
}

export class PathChangeMap implements Iterable<ChangeMapNodeChild>{
    [Symbol.iterator](): Iterator<ChangeMapNodeChild> {
        let res:ChangeMapNodeChild[] = [];
        this.root_.forEach(v => res.push(v));
        return res[Symbol.iterator]();
    }

    private root_ = new PathChangeMapNode_();
    private next_ = 0;

    static comparePos(x: { pos: number [] }, y: { pos: number[] }): number {
        return PathChangeMap.compareNumArray(x.pos, y.pos);
    }

    static compareNumArray(x: number [], y: number[]): number {
        for (let i = 0; i < x.length && y.length; i++) {
            let res = x[i] - y[i];
            if (res !== 0) {
                return res;
            }
        }
        // the longer length is smaller
        return y.length - x.length;
    }
    forEach(callback: (item: ChangeMapNodeChild) => void) {
        this.root_.forEach(callback);
    }

    findChangeInfo(change: Change):ChangeMapNodeChild| null {
        let cur: PathChangeMapNode_ | null = this.root_;
        let items = change.path().items();
        for (let i = 0; i < items.length && cur; i++) {
            let item = items[i];
            cur = cur.get(item);
        }

        if (cur) {
            let values = cur.values();
            for (let i = 0; i < values.length; i++) {
                if (values[i].change === change) {
                    return values[i];
                }
            }
        }
        return null;
    }

    findExact<Type extends Change>(path: Path, opt_type?: new(...args:any[]) => Type): Type[] {
        let items = path.items();

        let cur: PathChangeMapNode_ | null = this.root_;

        for (let i = 0; i < items.length && cur; i++) {
            let item = items[i];
            cur = cur.get(item);
        }

        let toSort: ChangeMapNodeChild[] = [];
        if (cur) {
            for (let val of cur.values()) {
                if (opt_type === undefined || val.change instanceof opt_type) {
                    toSort.push(val);
                }
            }
        }

        return toSort.sort(PathChangeMap.comparePos).map(v => v.change as Type);

    }
    removeChangeInfo(change: Change): ChangeMapNodeChild | null {

        let removeInternal = (path: Path): ChangeMapNodeChild | null => {
            let items = path.items();

            let cur: PathChangeMapNode_ | null = this.root_;

            for (let i = 0; i < items.length && cur; i++) {
                let item = items[i];
                cur = cur.get(item);
            }
            if (cur) {
                let removed = cur.removeChange(change);
                if (removed) {
                    if (removed.ancestor) {
                        removed.ancestor.removeDependant(change);
                    }

                    PathChangeMapNode_.removeIfEmptyNode_(items, 0, this.root_);
                    return removed;
                }
            }
            return null;
        }


        if (change) {

            let val: ChangeMapNodeChild | null = null;
            for (let path of change.paths) {
                val = removeInternal(path);
            }
            return val;
        }
        return null;

    }

    findAncestors(path: Path, opt_type?: any): Change[] {
        let items = path.items();
        let cur: PathChangeMapNode_ | null = this.root_;
        let toSort: { pos: number[], change: Change }[] = [];

        for (let i = 0; i < items.length && cur; i++) {
            let item = items[i];
            cur = cur.get(item);
            if (cur) {
                // nothing should be at root so that is ok
                cur.values().forEach(function (val) {
                    if (opt_type === undefined || val.change instanceof opt_type) {
                        toSort.push({pos: val.pos, change: val.change});
                    }
                });
            }
        }
        return toSort.sort(PathChangeMap.comparePos).map(v => v.change);
    }

    /**
     * all changes at path level and above, and directly below
     * @param path
     * @param equal should we include equal
     * @param max the maxiumn value to return
     */
    findRelations(path: Path, equal: boolean, max: number[] | undefined | null): Change[] {
        let items = path.items();
        let cur: PathChangeMapNode_ | null = this.root_;
        let toSort: { pos: number[], change: Change }[] = [];

        max = max || [];
        for (let i = 0; i < items.length && cur; i++) {
            cur.values().forEach(function (val) {
                if (max.length === 0
                    || PathChangeMap.compareNumArray(max, val.pos) <= 0) {
                    toSort.push({pos: val.pos, change: val.change});
                }
            });
            let item = items[i];
            cur = cur.get(item);
        }

        if (cur) {
            if (equal) {
                cur.forEach(function (val) {
                    if (max === undefined || max === null || max.length === 0
                        || PathChangeMap.compareNumArray(max, val.pos) <= 0) {
                        toSort.push({pos: val.pos, change: val.change});
                    }
                });
            } else {
                cur.forEachDecendants(function (val) {
                    if (max === undefined || max === null || max.length === 0
                        || PathChangeMap.compareNumArray(max, val.pos) <= 0) {

                        toSort.push({pos: val.pos, change: val.change});
                    }
                });
            }
        }
        return toSort.sort(PathChangeMap.comparePos).map(v => v.change);
    }

    addMove(change: Change, from: Path, to: Path, ancestor: Change|null, max: number[], opt_pos?: number[]) {
        let toItems = to.items();
        let fromItems = from.items();
        let cur = this.root_;
        max = max.slice(0);


        if (opt_pos === undefined) {
            max.push(this.next_);
            this.next_++;
        } else {
            max = opt_pos;
        }
        for (let i = 0; i < toItems.length; i++) {
            let item = toItems[i];
            cur = cur.create(item);
        }

        cur.addValue({change: change, ancestor: ancestor, pos: max})

        cur = this.root_;
        for (let i = 0; i < fromItems.length; i++) {
            cur = cur.create(fromItems[i]);
        }
        cur.addValue({change: change, ancestor: ancestor, pos: max, hide: true});

    };

    add(path: Path, change: Change, ancestor: Change | null, max: number[], opt_pos?: number) {
        let items = path.items();
        let cur = this.root_;
        max = max.slice(0);
        let pos = opt_pos === undefined ? this.next_ : opt_pos;
        if (opt_pos === undefined) {
            this.next_++;
        }

        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            cur = cur.create(item);
        }
        max.push(pos);
        cur.addValue({change: change, ancestor: ancestor, pos: max});
    }
}