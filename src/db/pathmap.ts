import {Path, PathItem} from "./path";
import {AvlTree} from "../structs/avltree";
import {compareKey} from "../util/object";
import {Schema} from "./schema.ts";

/**
 * a map that given a path finds all items subitems
 * @template T
 * @private
 * @constructor
 */
class PathMapNode_ {

    values_: any[] = [];
    children_ = new AvlTree<{ key: PathItem, node: PathMapNode_ },{ key: PathItem }>(compareKey);


    /**
     * @param items
     * @param pos
     * @param create should we create nodes if they don't exist
     * @return  the node containing the data
     */
    resolve(items: PathItem[], pos: number, create: true): PathMapNode_;
    resolve(items: PathItem[], pos: number, create: boolean): PathMapNode_|null;
    resolve(items: PathItem[], pos: number, create: boolean): PathMapNode_ | null {
        if (pos === items.length) {
            return this;
        }
        let key = {key: items[pos], node: new PathMapNode_()};
        let child = create ? this.children_.safeFind(key) : this.children_.findFirst(key);
        if (child) {
            return child.node.resolve(items, pos + 1, create);
        }
        return null;
    }

    /**
     * @param {!recoil.db.ChangeSet.Schema} schema used to filter not in our object
     * @param {!recoil.db.ChangeSet.Path} path
     * @param {!Array<T>} res
     */
    getAll(schema: Schema, path: Path, res: any[]) {
        if (schema.exists(path)) {
            this.values_.forEach(function (v) {
                res.push(v);
            });
            this.children_.inOrderTraverse(function (node) {
                node.node.getAll(schema, path.append(node.key), res);
            });
        }
    }

    /**
     * @param {!Array<!recoil.db.ChangeSet.PathItem>} items
     * @param {number} pos
     * @return {boolean} delete this node;
     */
    removeRec(items: PathItem[], pos: number): boolean {
        if (pos === items.length) {
            this.values_ = [];
            return this.children_.getCount() === 0;
        }
        let key = {key: items[pos]};
        let sub = this.children_.findFirst(key);

        if (sub && sub.node.removeRec(items, pos + 1)) {
            this.children_.remove(key);
            return this.children_.getCount() === 0;
        }
        return false;
    }
}

/**
 * a map that given a path finds all items subitems
 * @template T
 * @constructor
 * @param {!recoil.db.ChangeSet.Schema} schema
 */
export class PathMap {
    private readonly schema_: Schema;
    private readonly root_: PathMapNode_;

    constructor(schema: Schema) {
        this.root_ = new PathMapNode_();
        this.schema_ = schema;
    }

    put(path: Path, value: any) {
        let node = this.root_.resolve(this.schema_.absolute(path).items(), 0, true);
        node.values_ = [value];
    }

    add(path: Path, value: any) {
        let node = this.root_.resolve(this.schema_.absolute(path).items(), 0, true);
        node.values_.push(value);
    }

    /**
     * it will put a list, however if the list is empty it will remove the node and all
     * parents, that are no longer required
     * @param {!recoil.db.ChangeSet.Path} path
     * @param {!Array<T>} values
     */
    putList(path: Path, values: any[]) {
        let node;
        if (values.length === 0) {
            this.remove(path);
        } else {
            node = this.root_.resolve(this.schema_.absolute(path).items(), 0, true);
            node.values_ = values;
        }
    }

    remove(path: Path) {
        this.root_.removeRec(this.schema_.absolute(path).items(), 0);
    }

    /**
     * gets the node for this path and all the value for its desendents
     *
     */
    get(path: Path): any[] {
        let absPath = this.schema_.absolute(path);
        let items = absPath.items();
        let node = this.root_.resolve(items, 0, false);
        let res:any[] = [];
        if (node) {
            node.getAll(this.schema_, path, res);
        } else if (absPath.size() > 0 && absPath.lastKeys().length === 0) {
            // this is a list
            let last = items.pop() as PathItem;
            node = this.root_.resolve(items, 0, false);
            if (node) {
                let pPath = new Path(items);
                for (let child of node.children_) {
                    if (child.key.name() == last.name()) {
                        child.node.getAll(this.schema_, pPath.append(child.key), res);
                    }
                }


            }
        }
        return res;
    }

    /**
     * note path is considered an ancestor of itself
     *
     * @param {!recoil.db.ChangeSet.Path} path
     * @return {!Array<T>}
     */
    getAncestors(path: Path): any[] {
        let res:any[] = [];
        let items = this.schema_.absolute(path).items();
        const push = function (item:any) {
            // TODO check schema
            res.push(item);
        };
        let cur:PathMapNode_|null = this.root_;
        for (let i = 0; i < items.length && cur; i++) {
            let item = items[i];
            let hasParams = item.keys().length > 0;
            if (hasParams) {

                let child = cur.resolve([item.unsetKeys()], 0, false);
                if (child) {
                    child.values_.forEach(push);
                }
            }
            cur = cur.resolve([item], 0, false);
            if (cur) {
                cur.values_.forEach(push);
            }

        }
        return res;
    };


    getExact(path: Path): any[] {
        let node = this.root_.resolve(this.schema_.absolute(path).items(), 0, false);
        let res:any[] = [];
        if (node) {
            if (this.schema_.exists(path)) {
                for (let v of node.values_) {
                    res.push(v);
                }
            }
        }
        return res;
    }


}