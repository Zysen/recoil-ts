import {Path, PathItem, type ValueSerializor} from "./path.ts";
import {AvlTree} from "../structs/avltree.ts";
import {compare, compareKey, isEqual} from "../util/object.ts";
import {type StructType} from "../frp/struct.ts";
import {type ChangeMapNodeChild, PathChangeMap} from "./changepathmap.ts";
import {Add, type Change, ChangePosition, Delete, Move, Reorder, SetChange} from "./change.ts";
import {type ChangeDbInterface, FilterGetter, type Listener, type ReferenceFilter, trueFilter} from "./changedb.ts";
import {type Schema} from "./schema.ts";
import {Serializable} from "../util/serializable.ts";


export type Primitive = string | number | boolean | bigint | symbol | null | undefined;
export type PathListenerType = {path: Path, listener: Listener};
enum NullState {
    isNull, isUndefined, isDefined
}
/**
 * @constructor
 */
export class ChangeSet {
    /**
     * remove a path from the list
     */
    static removePath(path: Path, list: Path[]) {
        for (let i = 0; i < list.length; i++) {
            if (isEqual(list[i], path)) {
                list.splice(i, 1);
                return;
            }
        }
    }

    static findPath(path: Path, list: Path[]): Path | null {
        for (let i = 0; i < list.length; i++) {
            if (isEqual(list[i], path)) {
                return list[i];
            }
        }
        return null;
    };

    /**
     * takes a list of changes and converts it into a set of minimal changes
     */
    static merge(schema: Schema, changes: Change[]): Change[] {
        let pathChangeMap = new PathChangeMap();

        for (let i = 0; i < changes.length; i++) {
            let change = changes[i].absolute(schema);

            change.merge(pathChangeMap, null, []);

            // if the change is add just add

            // if the change is a delete
            // remove all changes sub changes
            // if was and add of this key then do not add us
            // if move to us change path to original

            // if move
            // if was added move all actions us and change path to dest
            // do not add
        }
        let toSort: ChangeMapNodeChild[] = [];
        pathChangeMap.forEach(function (change: ChangeMapNodeChild) {
            if (!change.ancestor && !change.hide) {
                change.change.sortDesendents(pathChangeMap);
                toSort.push(change);
            }
        });
        return toSort.sort(PathChangeMap.comparePos).map(v => v.change).filter(c => !c.isNoOp());
    }

    /**
     * @return {!AvlTree<!Path>} set of changed roots
     */
    static applyChanges(dbInterface: ChangeDbInterface, schema: Schema, changes: Change[]): AvlTree<Path> {
        let changedRoots = new AvlTree<Path>(compare);

        const addRoot = (root: Path) => {
            changedRoots.add(root);
        };
        const addRoots = (path: Path) => {
            dbInterface.getRoots(path).forEach(addRoot);
        };
        for (let i = 0; i < changes.length; i++) {
            let change = changes[i];

            addRoots(change.path());

            if (change instanceof Add || change instanceof Move) {
                // we may have changes in children
                schema.children(change.path()).forEach(function (child) {
                    addRoots(change.path().appendName(child));
                });
            }
            if (change instanceof Move) {
                addRoots(change.to());
                for (let child of schema.children(change.to())) {
                    addRoots(change.to().appendName(child));
                }
            }
            change.applyToDb(dbInterface, schema);
        }

        return changedRoots;
    }
}


/**
 * allows override to serialize/deserialize values, eg buffers
 */
class DefaultValueSerializor implements ValueSerializor {
    serializeKeys(_path: Path, val: any): any {
        return val;
    }

    serialize(_path: Path, val: any) {
        return val;
    }

    deserializeKeys(_path: Path, serialized: any): any {
        return serialized;
    }

    deserialize(_path: Path, serialized: any) {
        return serialized;
    }

}


/**
 * @interface
 */
interface ChangeSetError {
}

export class DupPk implements ChangeSetError {
    private path_: Path;

    constructor(path: Path) {
        this.path_ = path;
    }
}


export function inverseChanges(schema: Schema, changes: Change[]): Change[] {
    let res = [];
    for (let i = changes.length - 1; i >= 0; i--) {
        let c = changes[i].inverse(schema);
        if (c) {
            res.push(c);
        }
    }
    return res;
}

type ChangesAndErrors = { changes: Change[], errors: ChangeSetError[] }

/**
 * calculates a list of changes between an old an new objec
 *
 * it should be noted the origColumn is used to determine the original key if it is a keyed list
 *
 * @param oldObj the old object
 * @param newObj the new obj
 * @param path the path to the object
 * @param pkColumn the column key a unique immutable key for each object, only used for arrays of objects
 * @param schema an interface describing all the object in the schema
 * @param changes will add changes to this if provided
 */

export function diff(oldObj: any, newObj: any, path: Path, pkColumn: string, schema: Schema, changes: ChangesAndErrors = {
    changes: [],
    errors: []
}): ChangesAndErrors {
    if (schema.isLeaf(path)) {
        if (oldObj === undefined || oldObj === null) {
            if (newObj === undefined || newObj === null) {
                // these are considered the same
                return changes;
            }
        }
        if (!isEqual(oldObj, newObj)) {
            changes.changes.push(new SetChange(schema.absolute(path), oldObj, newObj));
        }
        return changes;
    }

    if ((oldObj === null || oldObj === undefined) && (newObj == null)) {
        return changes;
    }
    if (schema.isKeyedList(path)) {
        // if the item is null and a list assume it is a list
        if (oldObj === null || oldObj === undefined) {
            oldObj = [];
        }
        if (newObj === null || newObj === undefined) {
            newObj = [];
        }
    }
    if (newObj === null || newObj === undefined) {
        let cloned = {...oldObj};
        for (let k of path.last().keyNames()) {
            delete cloned[k];
        }
        changes.changes.push(new Delete(schema.absolute(path), cloned));
        return changes;
    }
    let subChanges = changes;
    if (oldObj === null || oldObj === undefined) {
        subChanges = {changes: [], errors: changes.errors};
        changes.changes.push(new Add(schema.absolute(path), subChanges.changes));
    } else if (schema.isKeyedList(path)) {
        let needed: { idx: number | null, newIdx: number, key: Path, removeKey?: Path }[] = [];
        let used: Path[] = [];
        let newRowMap = new Map();
        let oldRowMap = new Map();
        let oldRowPos = new Map<string, number>();
        let curOrder = [];

        for (let i = 0; i < newObj.length; i++) {
            let origKey: string = newObj[i][pkColumn];
            newRowMap.set(origKey, {idx: i, val: newObj[i]});
        }

        // do any deletes first they are not going to conflict with any existing keys
        for (let i = 0; i < oldObj.length; i++) {
            let oldChild = oldObj[i];
            let oldKey = schema.createKeyPath(path, oldChild);
            let oldPk = oldChild[pkColumn];
            oldRowMap.set(oldPk, oldChild);
            oldRowPos.set(oldPk, i);
            let newChildEntry = newRowMap.get(oldPk);
            if (newChildEntry && newChildEntry.val) {
                let newKey = schema.createKeyPath(path, newChildEntry.val);
                used.push(oldKey);
                curOrder.push(oldChild);
                if (!isEqual(newKey, oldKey)) {
                    needed.push({idx: i, newIdx: newChildEntry.idx, key: newKey, removeKey: oldKey});
                } else {
                    diff(oldChild, newChildEntry.val, newKey, pkColumn, schema, changes);
                }
            } else {
                diff(oldChild, undefined, oldKey, pkColumn, schema, changes);
            }
        }
        for (let i = 0; i < newObj.length; i++) {
            let newChild = newObj[i];
            // this is a new item
            if (!oldRowMap.has(newChild[pkColumn])) {
                curOrder.push(newChild);
                let newKey = schema.createKeyPath(path, newChild);
                needed.push({idx: null, newIdx: i, key: newKey});
            }
        }


        while (needed.length > 0) {
            let newNeeded: { idx: number | null, newIdx: number, key: Path, removeKey?: Path }[] = [];
            needed.forEach((info) => {
                if (ChangeSet.findPath(info.key, used)) {
                    newNeeded.push(info);
                } else {
                    if (info.removeKey) {
                        diff(oldObj[info.idx as number], newObj[info.newIdx], info.removeKey, pkColumn, schema,
                            changes);
                        changes.changes.push(new Move(schema.absolute(info.removeKey), schema.absolute(info.key)));
                        ChangeSet.removePath(info.removeKey, used);
                    } else {
                        diff(null, newObj[info.newIdx], info.key, pkColumn, schema, changes);
                    }
                    used.push(info.key);
                }
            });
            if (needed.length === newNeeded.length) {
                // for now just leave we may deal with these at a higher level

                // first build up a map of dup needed or in used if they are in there then they are real duplicate
                // add to errors
                // the rest are just loops pick one and do a delete
                needed.forEach(function (info) {
                    changes.errors.push(new DupPk(schema.absolute(info.key)));
                });
                break;
            }
            needed = newNeeded;
        }
        if (schema.isOrderedList(path)) {
            let prev = null;
            let nextCur = 0;
            let seen = new Set<string>();
            for (let i = 0; i < newObj.length; i++) {
                let child = newObj[i];
                if (nextCur < curOrder.length) {
                    let old = curOrder[nextCur];


                    let newPk = child[pkColumn];
                    let curPk = old[pkColumn];

                    if (curPk === newPk) {
                        seen.add(newPk);
                        while (nextCur < curOrder.length && seen.has(curOrder[nextCur][pkColumn])) {
                            nextCur++;
                        }


                        continue;
                    }
                    seen.add(newPk);
                    let childKey = schema.createKeyPath(path, child);
                    let prevKey = prev ? schema.createKeyPath(path, child) : null;
                    changes.changes.push(new Reorder(schema.absolute(childKey), prevKey ? schema.absolute(prevKey) : null, ChangePosition.AFTER, null));
                }
                prev = child;
            }
        }
        return changes;

    }

    schema.children(path).forEach(
        function (child) {
            let keys = schema.keys(path);
            if (keys.indexOf(child) !== -1) {
                return;
            }
            let myChildren = schema.children(path.appendName(child));
            let oldV = oldObj ? oldObj[child] : null;
            let newV = newObj ? newObj[child] : null;
            diff(oldV, newV, path.appendName(child), pkColumn, schema, subChanges);
        });
    return changes;

}


export function createDbNode(schema: Schema, path: Path, parent: ChangeDbNode): ChangeDbNode {
    if (schema.isKeyedList(path)) {
        return new ListNode(parent, path);
    }
    if (schema.isList(path)) {
        return new IndexedListNode(parent, path);
    }
    if (schema.isLeaf(path)) {
        return new LeafNode(parent, path);
    }
    return new ContainerNode(parent, path);

}


type ContainerChildrenType = { [key: string]: ChangeDbNode };
export type ChangeListenerKeyType = { listener: Listener, path: Path, filter: ReferenceFilter };

export abstract class ChangeDbNode {
    private parent_: ChangeDbNode | null = null;
    protected readonly absolutePath_: Path;

    /**
     * the number references that point a child node but not directly to this node
     *
     */
    private descendantRefs_ = 0;
    private readonly changeListeners_ = new AvlTree<{ key: ChangeListenerKeyType, count: number }, {
        key: ChangeListenerKeyType
    }>(compareKey);

    abstract get(schema: Schema, path: Path, getter:FilterGetter, filter:ReferenceFilter, serialized?:boolean): any;

    abstract updatePk(schema: Schema, path: Path, keys: any[]): void;

    abstract getChildNode(schema: Schema, item: PathItem | null, path: Path, create: true): ChangeDbNode;
    abstract getChildNode(schema: Schema, item: PathItem | null, path: Path, create: boolean): ChangeDbNode | null;
    abstract getChildNode(schema: Schema, item: PathItem | null, path: Path, create: boolean): ChangeDbNode | null;
    abstract getChildNode(schema: unknown, item: unknown, path: unknown, create: unknown): ChangeDbNode | null;
    abstract cloneData(parent:ChangeDbNode) : ChangeDbNode;


    abstract getChildren(): ChangeDbNode[];

    /**
     *
     * @param db
     * @param schema
     * @param path
     * @param val
     * @param opt_filter
     * @param serialized is the data we are setting serialize
     * @return if null then there were no changes, otherwise a list of changes to listeners to notify
     */
    abstract set(db: ChangeDbInterface, schema: Schema, getter:FilterGetter, path: Path, val: any, opt_filter?: ReferenceFilter, serialize?: boolean): ChangeListenerKeyType[] | null;

    abstract setKeys(item: PathItem): void;


    addChangeListener(path: Path, listener: Listener, filter: ReferenceFilter) {
        let key = {path, listener, filter};
        this.changeListeners_.safeFind({key, count: 0}).count++;
        this.parent()?.updateDescendantReferences(1);
    }

    removeChangeListener(path: Path, listener: Listener, filter: ReferenceFilter) {
        let key = {path, listener, filter};
        let found = this.changeListeners_.findFirst({key});
        if (found) {
            if (found.count > 0) {
                found.count--;
                this.parent()?.updateDescendantReferences(-1);
            }
            if (found.count <= 0) {
                this.changeListeners_.remove({key})
            }
        }
    }

    getChangeListeners():ChangeListenerKeyType[] {
        let res:ChangeListenerKeyType[] = [];

        for (let {key:listener} of this.changeListeners_) {
            res.push(listener);
        }
        return res;

    }

    updateDescendantReferences(count: number): void {
        let cur: ChangeDbNode | null = this;
        while (cur) {
            cur.descendantRefs_ += count;
            cur = cur.parent_;
        }
    }

    constructor(parent: ChangeDbNode | null, absolutePath:Path) {
        this.parent_ = parent;
        this.absolutePath_ = absolutePath;
    }

    addUnresolved(unresolved: Map<ReferenceFilter, PathListenerType[]>) {
        let added = 0;
        for (let [filter, listeners] of unresolved) {
            added += listeners.length;
            for (let pathListeners of listeners) {
                this.addChangeListener(pathListeners.path, pathListeners.listener, filter);
            }
        }
    }


    /**
     * how many references are there this includes direct listeners,
     * number of things listening to my children
     */

    public getReferenceCount(): number {
        let sum = this.descendantRefs_;
        for (let l of this.changeListeners_) {
            sum += l.count;
        }
        return sum;
    }


    parent(): ChangeDbNode | null {
        return this.parent_;
    }

    /**
     * removes any node that doesn't have references to it
     *
     * @param root
     * @return true if there are no refs and node should be deleted
     */
    cleanupTree(): boolean {
        for (let child of this.getChildren()) {
            if (child.getReferenceCount() == 0) {
                this.removeChild(child);
            }
        }
        return this.getReferenceCount() === 0;
    }

    abstract removeChild(child: ChangeDbNode): void;

    protected getRoot() {
        let cur: ChangeDbNode = this;
        while (cur.parent_) {
            cur = cur.parent_
        }
        return cur;
    }

    addAncestorListeners(changed: ChangeListenerKeyType[]) {
        let cur = this.parent();
        while (cur) {
            for (let l of cur.changeListeners_) {
                changed.push(l.key);
            }
            cur = cur.parent_;
        }
    }

    /**
     * just get the object, ignore schema, references, filters used for testing to see what is actually in the database
     */
    abstract unsafeGet(): any;

    notifyMove(from: Path, to: Path) {
        if (!this.absolutePath_.isAncestor(from, true)) {
            return;
        }
        let toMove:{l: { key: ChangeListenerKeyType, count: number }, newPath: Path}[] = [];
        for (let l of this.changeListeners_) {
            //{ listener: Listener, path: Path, filter: ReferenceFilter }
            if (from.isAncestor(l.key.path, true)) {
                let newPath = l.key.path.move(from, to);
                toMove.push({l, newPath});
                l.key.listener.path(newPath);
            }
        }
        for (let moving of toMove) {
            this.changeListeners_.remove(moving.l);
            this.changeListeners_.add({key: {...moving.l.key, path: moving.newPath}, count: moving.l.count });

        }
        for (let child of this.getChildren()) {
            child.notifyMove(from, to);
        }
        for (let moving of toMove) {
            moving.l.key.listener.path(moving.newPath);
        }
    }
}


export class LeafNode extends ChangeDbNode {
    private value_: Primitive;

    constructor(parent:ChangeDbNode, absolutePath:Path) {
        super(parent, absolutePath);
    }
    cloneData(parent:ChangeDbNode): ChangeDbNode {
        let res = new LeafNode(parent, this.absolutePath_);
        res.value_ = this.value_;
        return res;
    }

    getChildren(): ChangeDbNode[] {
        return [];
    }

    removeChild(child: ChangeDbNode) {
    }

    set(db: ChangeDbInterface, schema: Schema,getter:FilterGetter,  path: Path, val: any, opt_filter: ReferenceFilter = trueFilter, serialized:boolean = false):ChangeListenerKeyType[]|null {
        // what happens if
        // 1. the value changes and the filter is no longer applies
        // 2. the value changes and the filter now applies
        if (serialized) {
            this.value_ = schema.deserialize(path, val);
        }
        else {
            this.value_ = val;
        }
        return this.getChangeListeners();
    }

    updatePk(schema: Schema, path: Path, keys: any[]) {
        // leaves don't have primary keys
    }

    get(schema: Schema, path: Path, getter:FilterGetter, filter:ReferenceFilter, serialized: boolean = false): any {
        if (serialized) {
            return schema.serialize(path, this.value_)
        }
        return this.value_;
    }
    unsafeGet():any {
        return this.value_;
    }

    setValue(val: any) {
        this.value_ = val;
    }

    setKeys(item: PathItem): void {
    }

    /**
     * @param schema
     * @param item the item to create or get
     * @param path if not null then specifies what type to create otherwise creates container
     * @param {boolean} create create if not present

     */
    getChildNode(schema: Schema, item: PathItem | null, path: Path, create: true): ChangeDbNode;
    getChildNode(schema: Schema, item: PathItem | null, path: Path, create: boolean): ChangeDbNode | null;
    getChildNode(schema: Schema, item: PathItem | null, path: Path, create: boolean): ChangeDbNode | null {
        throw 'unsupported operation, leaves have no children';
    }
}

export class ContainerNode extends ChangeDbNode {
    private children_: ContainerChildrenType = {};
    private useVal_ = false; // only true for null and undefined
    private val_: StructType | null = null;

    cloneData(parent: ChangeDbNode): ChangeDbNode {
        let res = new ContainerNode(parent,this.absolutePath_);
        res.val_ = this.val_;
        res.useVal_ = this.useVal_;
        for (let childName in this.children_) {
            res.children_[childName] = this.children_[childName].cloneData(res);
        }
        return res;
    }

    removeChild(child: ChangeDbNode) {
        for (let name in this.children_) {
            if (this.children_[name] === child) {
                delete this.children_[name];
            }
        }
    }

    getChildren(): ChangeDbNode[] {
        let res: ChangeDbNode[] = [];
        for (let name in this.children_) {
            res.push(this.children_[name]);
        }
        return res;
    }

    updatePk(schema: Schema, path: Path, keys: any[]) {

        // update the keys in the node
        let item = path.last();
        let names = item.keyNames();
        let children = this.children_;

        for (let i = 0; i < names.length; i++) {
            let child = names[i];
            let val = keys[i];
            if (!children[child]) {
                children[child] = new LeafNode(this, this.absolutePath_.appendName(child));
                this.useVal_ = false;
            }
            let node = children[child];
            if (!(node instanceof LeafNode)) {
                throw Error('Key not leaf node')
            }
            node.setValue(val);
        }

    }

    setKeys(item: PathItem) {
        // update the keys in the node
        let keys = item.keys();
        let names = item.keyNames();
        let children = this.children_;

        for (let i = 0; i < names.length; i++) {
            let child = names[i];
            let val = keys[i];
            if (!children[child]) {
                children[child] = new LeafNode(this, this.absolutePath_.appendName(child));
                this.useVal_ = false;
            }
            let node = children[child];
            if (!(node instanceof LeafNode)) {
                throw Error('Key not leaf node')
            }
            node.setValue(val);
        }
    }

    set(database: ChangeDbInterface, schema: Schema, getter:FilterGetter, path: Path, val: any, opt_filter: ReferenceFilter = trueFilter, serialized: boolean = false):ChangeListenerKeyType[]|null {
        let children = this.children_;
        let changes:ChangeListenerKeyType[] = this.getChangeListeners();
        if (val != undefined) {
            this.useVal_ = false;
            for (let child of schema.children(path)) {
                let subPath = path.appendName(child);
                if (val.hasOwnProperty(child)) {
                    if (!children[child]) {
                        children[child] = createDbNode(schema, subPath, this);
                    }
                    changes.push(...children[child].set(database, schema, getter, subPath, val[child], opt_filter, serialized) || []);
                } else if (opt_filter(getter, subPath)) {
                    delete children[child];
                }
            }
        } else {
            this.useVal_ = true;
            this.children_ = {};
            this.val_ = val;
        }
        return changes;
    }

    remove(item: PathItem) {
        delete this.children_[item.name()];
    }

    get(schema: Schema, path: Path, getter:FilterGetter, filter:ReferenceFilter, serialized:boolean = false): StructType | null {
        let res: StructType = {};
        if (this.useVal_) {
            return this.val_;
        }
        let children = this.children_;
        for (let child of schema.children(path)) {
            let childPath = path.appendName(child);
            if (children.hasOwnProperty(child) && filter(getter, childPath)) {
                res[child] = children[child].get(schema, childPath, getter, filter, serialized);
            }
        }
        return res;
    }

    unsafeGet(): any {
        let res: StructType = {};
        if (this.useVal_) {
            return this.val_;
        }
        let children = this.children_;
        for (let childName in this.children_) {
            res[childName] = this.children_[childName].unsafeGet();
        }
        return res;
    }

    /**
     * @param schema
     * @param item the item to create or get
     * @param path if not null then specifies what type to create otherwise creates container
     * @param create create if not present
     */
    getChildNode(schema: Schema, item: PathItem, path: Path, create: true): ChangeDbNode;
    getChildNode(schema: Schema, item: PathItem, path: Path, create: boolean): ChangeDbNode | null;
    getChildNode(schema: Schema, item: PathItem, path: Path, create: boolean): ChangeDbNode | null {
        let res = this.children_[item.name()];
        if (res) {
            return res;
        }
        if (!create) {
            return null;
        }
        if (path) {
            res = createDbNode(schema, path, this);
        } else {
            res = new ContainerNode(this, this.absolutePath_.append(item));
        }
        this.children_[item.name()] = res;
        this.useVal_ = false;
        return res;
    }
}

type ListNodeKeyType = { key: any, pos: number, value: ChangeDbNode, lookup?: any };

export class IndexedListNode extends ChangeDbNode {
    private items_: ChangeDbNode[]|null|undefined;

    cloneData(parent: ChangeDbNode): IndexedListNode {
        let res = new IndexedListNode(parent, this.absolutePath_);

        if (this.items_) {
            res.items_ = this.items_.map(v => v.cloneData(res));
        }
        else {
            res.items_= this.items_;
        }
        return res;
    }

    getChildren(): ChangeDbNode[] {
        return this.items_ || [];
    }

    /**
     * this is used to remove a child however we can't delete it since that would screw up other indexed references,
     * what we will do is replace it with undefinde
     *
     * @param child
     */
    removeChild(child: ChangeDbNode) {
        if (this.items_) {
            for (let i = 0; i < this.items_.length; i++) {
                if (this.items_[i] === child) {
                    let newVal = new LeafNode(this, this.absolutePath_.appendIndex(i));
                    newVal.setValue(undefined)
                    this.items_[i] = newVal;
                    break;
                }
            }
        }
    }

    /**
     * @param schema
     * @param {!Path} path
     * @param {!Array<?>} keys
     */
    updatePk(schema: Schema, path: Path, keys: any[]) {
    }

    set(db: ChangeDbInterface, schema: Schema, getter:FilterGetter, path: Path, val: any, opt_filter: ReferenceFilter = trueFilter, serialized:boolean= false): ChangeListenerKeyType[] | null {
        let changes:ChangeListenerKeyType[] = [];
        if (val) {
            this.items_ = this.items_ || [];
            for (let i = 0; i < val.length; i++) {
                let subPath = path.appendIndex(i);
                let newNode = createDbNode(schema, subPath, this);
                if (i < this.items_.length) {
                    let old = this.items_[i];
                    if (newNode.constructor === old.constructor) {
                        newNode = old;
                    }
                    else {
                        // todo transfer references from old to new
                    }
                }
                else {
                    this.items_.push(newNode)
                }
                changes.push(...(newNode.set(db, schema, getter, subPath, val[i], opt_filter, serialized) || []));
            }
            if (val.length < this.items_.length) {
                // todo remove references from old nodes
                this.items_.splice(val.length, this.items_.length - val.length);
            }
        }
        else if (schema.allowNullValue(path, val)) {
            this.items_ = val;
        }
        changes.push(...this.getChangeListeners())
        return changes;
    }


    move(from: PathItem, to: PathItem): ChangeDbNode {
        let fromIndex = from.getLastIndex();
        let toIndex = to.getLastIndex();

        if (fromIndex === null || toIndex === null) {
            throw new Error("move node '" + from.toString() + "' to '" + to.toString() +  "' index does not exist");
        }

        if (!this.items_ || fromIndex < 0 || fromIndex >= this.items_.length) {
            throw new Error("move node '" + from.toString() + "' does not exist");
        }
        if (toIndex >= this.items_.length || toIndex < 0) {
            throw new Error("moving node '" + from.toString() + "' to '" + to.toString() +  "' would move it out of the list");
        }

        if (fromIndex === toIndex) {
            return this.items_[fromIndex];
        }



        let item = this.items_.splice(fromIndex, 1)[0];
        this.items_.splice(toIndex, 0, item);
        return  item;
    }

    reorder(schema: Schema, from: PathItem, to: PathItem | null, position: ChangePosition) {
        let fromIndex = from.getLastIndex();
        if (to && to.getLastIndex() === null) {
            return;
        }
        let toIndex = to ? to.getLastIndex() : null;

        if (this.items_ == null || fromIndex === null || fromIndex < 0 || fromIndex >= this.items_.length) {
            return;
        }

        if (fromIndex === toIndex) {
            return;
        }

        if (toIndex === null) {
            let item = this.items_.splice(fromIndex, 1)[0];
            if (position == ChangePosition.AFTER) {
                this.items_.unshift(item);
            }
            else {
                this.items_.push(item);
            }
            return;
        }

        if (toIndex < 0 || toIndex >= this.items_.length) {
            return;
        }


        let item = this.items_.splice(fromIndex, 1)[0];
        let adjIndex = fromIndex < toIndex ? -1 : 1;
        if (position == ChangePosition.AFTER) {
            this.items_.splice(fromIndex + adjIndex + 1, 0, item);
        } else {
            this.items_.splice(fromIndex + adjIndex, 0, item);
        }


    }

    remove(item: PathItem): ChangeDbNode | null {
        let index = item.getLastIndex();
        if (this.items_ && index !== null && index < this.items_.length && index >= 0) {
            this.items_.splice(index, 1)[0];

        }
        return null;
    }

    add(item: PathItem, node: ChangeDbNode) {
        node.setKeys(item);
        if (!this.items_) {
            this.items_ = [];
        }
        this.items_.push(node);
    }

    unsafeGet(): any {
        if (this.items_) {
            let res:any[] = [];
            for (let val of this.items_) {
                res.push(val.unsafeGet());
            }
            return res;
        }
        return this.items_;
    }

    get(schema: Schema, path: Path, getter:FilterGetter, filter: ReferenceFilter, serialized:boolean = false): any[]|undefined|null {
        if (this.items_) {
            let res:any[] = [];
            let i = 0;
            for (let val of this.items_) {
                let subPath = path.appendIndex(i);
                if (filter(getter, subPath)) {
                    // not sure filtering here seem like a bad idea how can we tell if 2 filters differ and we are indexing
                    // stuff
                    res.push(val.get(schema, subPath, getter, filter, serialized));
                }
                i++
            }
            return res;
        }
        return this.items_;
    }

    setKeys(item: PathItem): void {
    }

    /**
     * @param schema
     * @param item the item to create or get
     * @param path if not null then specifies what type to create otherwize creates container
     * @param create create if not present
     */
    getChildNode(schema: Schema, item: PathItem | null, path: Path, create: true): ChangeDbNode;
    getChildNode(schema: Schema, item: PathItem | null, path: Path, create: boolean): ChangeDbNode | null;
    getChildNode(schema: Schema, item: PathItem, path: Path, create: boolean): ChangeDbNode | null {
        let absPath = schema.absolute(path);
        let index = item.getLastIndex();
        if (index !== null) {
            if (this.items_ && index < this.items_.length) {
                return this.items_[index];
            }
            if (create) {
                this.items_ = this.items_ || [];
                // create all the nodes upto this index
                for (let i = this.items_.length; i < index; i++) {
                    this.items_.push(createDbNode(schema, absPath.setIndex(i), this));
                }
                return createDbNode(schema, absPath, this);
            }
        }
        return null;
    }

}


export class ListNode extends ChangeDbNode {
    private keys_ = new AvlTree<ListNodeKeyType, { key: any }>(compareKey);
    private positions_ = new AvlTree<number>(compare);
    private nullState_ = NullState.isUndefined;

    cloneData(parent: ChangeDbNode): ChangeDbNode {
        let res = new ListNode(parent, this.absolutePath_);

        this.positions_.inOrderTraverse(v => res.positions_.add(v));
        this.keys_.inOrderTraverse(v => res.keys_.add({key: v.key, pos: v.pos, value: v.value.cloneData(res)}));
        return res;
    }

    getChildren(): ChangeDbNode[] {
        return this.keys_.toList().map(v => v.value);
    }

    removeChild(child: ChangeDbNode) {
        let matches = this.keys_.toList().filter(v => v.value === child);
        if (matches.length > 0) {
            this.keys_.remove(matches[0]);
            this.positions_.remove(matches[0].pos)
        }
    }

    /**
     * @param schema
     * @param {!Path} path
     * @param {!Array<?>} keys
     */
    updatePk(schema: Schema, path: Path, keys: any[]) {
        let removed = this.keys_.remove({key: path.lastKeys()});
        if (removed) {
            let last = path.last();
            let newNode = {...removed};
            newNode.key = keys;
            if (newNode.value) {
                newNode.value.setKeys(last.setKeys(keys));
            }
            this.keys_.add(newNode);
        }

    }

    set(db: ChangeDbInterface, schema: Schema, getter:FilterGetter, path: Path, val: any, opt_filter: ReferenceFilter = trueFilter, serialized: boolean=false): ChangeListenerKeyType[] | null {
        let keys = this.keys_;
        // we could schemas that filter nodes but not yet
        let newKeys = new AvlTree<ListNodeKeyType, { key: any }>(compareKey);
        let newPositions = new AvlTree<number>(compare);
        let changes:ChangeListenerKeyType[] = []
        if (val) {
            this.setKeyedList(db, schema, getter, path, val, keys, newPositions, newKeys, changes, opt_filter, serialized);
        }
        else if (schema.allowNullValue(path, val)) {
            this.nullState_ = val === null ? NullState.isNull :  NullState.isUndefined;
        }
        this.keys_ = newKeys;
        this.positions_ = newPositions;

        changes.push(...this.getChangeListeners())
        return changes;
    }

    private setKeyedList(
        db: ChangeDbInterface, schema: Schema, getter: FilterGetter, path: Path, val: any,
        keys: AvlTree<ListNodeKeyType, {key: any}>,
        newPositions: AvlTree<number, number>,
        newKeys: AvlTree<ListNodeKeyType, {key: any}>,
        changes: ChangeListenerKeyType[], opt_filter: ReferenceFilter, serialized: boolean) {
        let pos = 0;
        let maxPos = 0;
        for (let keyVal of this.keys_) {
            maxPos = Math.max(keyVal.pos + 1, maxPos);
        }
        for (let item of val) {
            let ourPos = pos;
            // if this partial then our pos needs to be calculated
            let subKey = schema.createKeyPath(path, item);
            let oldNode = keys.findFirst({
                key: subKey.lastKeys()
            });
            if (oldNode) {
                ourPos = oldNode.pos;
            } else {
                ourPos = maxPos;
                maxPos++;
            }
            newPositions.add(ourPos);
            let existing = keys.findFirst({key: subKey.lastKeys()});
            let absSubPath = schema.absolute(subKey);
            let newNode = existing || keys.safeFind({
                key: subKey.lastKeys(),
                pos: ourPos,
                value: new ContainerNode(this, absSubPath)
            });
            pos++;
            let subChanges = newNode.value.set(db, schema, getter, subKey, item, opt_filter, serialized);
            newKeys.add(newNode);
            if (subChanges) {
                changes.push(...subChanges);
            }

        }
        this.keys_.inOrderTraverse((item) => {


            let subKey = path.setKeys(schema.keys(path), item.key);
            // leave anything that doesn't match the query here we are not replacing these
            if (!opt_filter(getter, subKey)) {
                if (!newKeys.findFirst(item)) {
                    newKeys.add(item);
                }
            }
        });
    }

    move(from: PathItem, to: PathItem): ChangeDbNode {

        let node = this.keys_.remove({key: from.keys()});
        if (node && node.value) {
            node.value.setKeys(to);
            this.keys_.add({key: to.keys(), pos: node.pos, value: node.value});
            return node.value;
        } else {
            throw new Error("move node '" + from.toString() + "' does not exist");
        }
    }

    reorder(schema: Schema, from: PathItem, to: PathItem | null, position: ChangePosition) {
        let changeEntry = this.keys_.findFirst({key: from.keys()});
        let pos = 0;
        // new order of the list
        let order = [];
        let after = ChangePosition.AFTER;
        let before = ChangePosition.BEFORE;
        if (!changeEntry) {
            // the entry we are trying to reorder doesn't exist do nothing
            return;
        }

        let entries = [...this.keys_];
        entries.sort((e1, e2) => e1.pos - e2.pos);
        let found = false;
        if (position === after && !to) {
            // gos in the first position
            order.push({key: changeEntry.key, pos: pos++, value: changeEntry.value});
            found = true;
        }

        entries.forEach(function (entry) {
            if (isEqual(from.keys(), entry.key)) {
                // ignore this one it will be added later
                return;
            }

            if (to && isEqual(to.keys(), entry.key)) {
                found = true;
                if (changeEntry) {
                    if (position === after) {
                        order.push({key: entry.key, pos: pos++, value: entry.value});
                        order.push({key: changeEntry.key, pos: pos++, value: changeEntry.value});
                    } else if (position === before) {
                        order.push({key: changeEntry.key, pos: pos++, value: changeEntry.value});
                        order.push({key: entry.key, pos: pos++, value: entry.value});
                    }
                }
            } else {
                order.push({key: entry.key, pos: pos++, value: entry.value});
            }
        });
        if (position === before && !to) {
            found = true;
            order.push({key: changeEntry.key, pos: pos++, value: changeEntry.value});
        }
        if (found) {
            let me = this;
            this.positions_ = new AvlTree(compare);
            this.keys_ = new AvlTree<ListNodeKeyType, { key: any }>(compareKey);
            order.forEach(function (e) {
                me.keys_.add(e);
                me.positions_.add(e.pos);
            });
        }

    }

    remove(item: PathItem): ChangeDbNode | null {
        let node = this.keys_.remove({key: item.keys()});
        if (node) {
            this.positions_.remove(node.pos);
            return node.value;
        }
        return null;
    }

    add(item: PathItem, node: ChangeDbNode) {
        node.setKeys(item);
        let pos = this.positions_.getCount() === 0 ? 0 : this.positions_.getMaximum() + 1;
        this.positions_.add(pos);
        this.keys_.add({key: item.keys(), pos: pos, value: node});
    }

    static comparePosThenKey(x:{pos: number, key:any}, y:{pos: number, key:any}) :number {
        let res = x.pos - y.pos;
        if (res !== 0) {
            return res;
        }
        return compare(x.key, y.key );
    }
    unsafeGet(): any {
        let res:any[] = [];
        let map = new AvlTree<ListNodeKeyType, { key: any, pos: number }>(ListNode.comparePosThenKey, this.keys_);
        for (let val of map) {
            res.push(val.value.unsafeGet());
        }
        return res;
    }

    get(schema: Schema, path: Path, getter:FilterGetter, filter: ReferenceFilter, serialized: boolean = false): any[]|undefined|null {
        let res: any[] = [];
        let map = this.keys_;
        if (this.nullState_ != NullState.isUndefined) {
            return this.nullState_ === NullState.isNull ? null : undefined;
        }
        if (schema.isOrderedList(path)) {
            map = new AvlTree<ListNodeKeyType, { key: any }>(compareKey);
            for (let val of this.keys_) {
                map.add({value: val.value, key: val.pos, lookup: val.key, pos: 0});
            }
        }

        for (let val of map) {
            // we use lookup not key here because we want the real key to set the path not the index
            let subKey = path.setKeys(schema.keys(path), val.lookup || val.key);
            if (val.value) {
                if (filter(getter, subKey)) {
                    res.push(val.value.get(schema, subKey, getter, filter, serialized));
                }
            }
        }
        return res;
    }

    setKeys(item: PathItem): void {
    }

    /**
     * @param schema
     * @param item the item to create or get
     * @param path if not null then specifies what type to create otherwize creates container
     * @param create create if not present
     */
    getChildNode(schema: Schema, item: PathItem | null, path: Path, create: true): ChangeDbNode;
    getChildNode(schema: Schema, item: PathItem | null, path: Path, create: boolean): ChangeDbNode | null;
    getChildNode(schema: Schema, item: PathItem, path: Path, create: boolean): ChangeDbNode | null {
        let lookup = {key: item.keys(), pos: 0, value: new ContainerNode(this, schema.absolute(path))};
        let entry = create ?
            this.keys_.safeFind(lookup) : this.keys_.findFirst(lookup);
        if (entry) {
            return entry.value;
        }
        return null;

    }

}


