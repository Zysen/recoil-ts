
import {type Change, ChangePosition} from "./change.ts";
import {Path, PathItem} from "./path.ts";
import {clone, compareKey, isEqual} from "../util/object.ts";
import {ChangeDbNode, ChangeListenerKeyType, ContainerNode, LeafNode, ListNode, PathListenerType} from "./changeset.ts";
import {type Schema} from "./schema.ts";
import {AvlTree} from "../structs/avltree.ts";
import {safeGet} from "../util/map.ts";

/**
 * just to speed up getting objects so we don't need to calculate the object every time
 */
export class FilterGetter {
    private cache_ = new AvlTree<{ key: Path, value: any },{ key: Path}>(compareKey);
    private get_: (path: Path) => any;

    constructor(schema: Schema, get: (path: Path) => any, noCache:boolean = false) {
        this.get_ = get;
    }


    get(path:Path):any {
        let val = this.cache_.findFirst({key: path});
        if (val) {
            return val.value;
        }
        val = this.get_(path);
        this.cache_.add({key: path, value: val});
        return val;
    }
}

export type ReferenceFilter = (getter: FilterGetter, path:Path) => boolean;
type ResolveOutType = {pathFound:PathItem[], pathToDo:PathItem[]};
export type Listener = {
    update: (val:any) => void, // fired when the object changes
    remove: () => void, // fired when an object is removed
    path(path:Path):void, // fired when the path is deleted
};
export type UpdateListener = (val:any) => void;

export const trueFilter = () => true;

export interface ChangeDbInterface {
    getRoots(path:Path):Path[];
    applyAdd(path:Path):void;
    applyDelete(path:Path):void;
    applyMove(from:Path, to:Path):void;
    applyReorder(from:Path, to:Path|null, position:ChangePosition):void;
    applySet(path:Path, val:any):void;
    set(path:Path, val:any, filter:ReferenceFilter):void;
    unsafeGet(path: Path):any;
    /**
     * @return a function to call when you want to remove the reference
     */
    addReference(path:Path, listener: Listener, filter: ReferenceFilter): ()=> void;
    get(path:Path):any;
    /**
     * stops new roots from being added this is useful
     *//*
    lockRoots(callback: () => void):void;*/
    getUnresolved(absPath: Path): {path:Path, listener: Listener, filter:ReferenceFilter}[];
}
export class ChangeDb implements ChangeDbInterface {

    private schema_: Schema;
    private rootLock_: number = 0;
    private data_:ContainerNode|null = null;
    private roots_:Path[] = [];
    private transactionCount_: number = 0;
    private possibleRefChanges_ = new Map<ChangeDbNode, Path>();
    // this is a map of
    private unresolvedReferences_ = new AvlTree<{key:Path, listeners: Map<ReferenceFilter, PathListenerType[]>},{key:Path}>(compareKey)
    constructor(schema: Schema) {
        this.schema_ = schema;
        this.data_ = new ContainerNode(null, new Path([]));/*
        this.rootLock_ = 0;
        this.roots_ = [];*/
    }

    getUnresolved(absPath: Path): { path:Path, listener: Listener; filter: ReferenceFilter; }[] {
        let res :{path:Path, listener: Listener, filter: ReferenceFilter; }[] = []

        let found = this.unresolvedReferences_.findFirst({key: absPath});
        if (found) {
            let x = found.listeners;

            for (let [filter, pathListeners] of found.listeners) {
                for (let {path, listener} of pathListeners) {
                    let l = listener;

                    res.push({path, filter, listener});
                }
            }
        }
        return res;

    }

    /**
     * this adds a direct reference into the structure, if it doesn't exist in the tree we still need to remember that
     * reference exists since this can be done while loading an object, that is yet to be referenced
     *
     * @param path
     * @param filter
     * @return a function that will let you remove the reference
     */
    addReference(path: Path, listenerIn:Listener|UpdateListener, filter: ReferenceFilter = trueFilter): ()=> void {
        let resolveInfo:ResolveOutType = {pathToDo:[], pathFound:[]};
        let node = this.resolve_(path, false, filter, resolveInfo);
        let listener = {
            update: (val:any) => {
                if ('update' in listenerIn) {
                    listenerIn.update(val);
                }
                else {
                    listenerIn(val);
                }
            },
            // todo this will not fire yet
            remove: () => {
                if ('remove' in listenerIn) {
                    listenerIn.remove();
                }
            },
            // todo this will not fire yet
            path: (newPath:Path) => {
                if ('remove' in listenerIn) {
                    listenerIn.remove();
                }
                path = newPath;

            }
        }

        if (!node) {
            // if we have not found the node we need remember the that we wanted to add so if they are created
            // we will add the reference
            let ref = this.unresolvedReferences_.safeFind({
                key: path,
                listeners: new Map
            });
            safeGet(ref.listeners, filter, []).push({path, listener})
        }
        else {
            node.addChangeListener(path, listener, filter);
        }

        return () => {
            this.removeReference(path, listener, filter);
        }
    }


    private removeReference(path: Path, listener:Listener, filter: ReferenceFilter): void {
        filter = this.schema_.getAliasFilter(path, filter);
        let node = this.resolve_(path, false, filter);

        // remove any nodes on the path that we had a reference to

        // remove any unresolved references
        if (!node) {
            let found = this.unresolvedReferences_.safeFind({
                key: path,
                listeners: new Map()
            });

            if (found) {
                let list = safeGet(found.listeners, filter, []);
                let index = list.findIndex(value => isEqual({path,listener}, value));
                if (index !== -1) {
                    list.splice(index, 1);
                }
                if (list.length === 0) {
                    found.listeners.delete(filter);
                }
                if (found.listeners.size === 0) {
                    this.unresolvedReferences_.remove({key: path});
                }

            }
        }
        else {
            node.removeChangeListener(path, listener, filter);
            this.cleanupTree(path, node);
        }
    }

    getReferenceCount(path:Path):number {
        let node = this.resolve_(path, false);

        if (node) {
            return node.getReferenceCount();
        }
        let found = this.unresolvedReferences_.findFirst({key:path});

        let sum = 0;
        if (found) {
            for (let listeners of found.listeners) {
                for (let l of listeners.values()) {
                    sum += l.length;
                }
            }
        }
        return sum;
    }

    updatePk(schema: Schema, path:Path, keys:any[]) {
        let node = this.resolve_(path.unsetKeys(), false);
        if (node) {
            node.updatePk(schema, path, keys);
        }

    }

    applyAdd(path: Path) {
        let getter = new FilterGetter(this.schema_, path => this.unsafeGet(path));
        let listNode;
        if (path.lastKeys().length > 0) {
            // this is a list node we are adding
            listNode = this.resolve_(path.unsetKeys(), this.rootLock_ === 0);
            if (!listNode) {
                return;
            }
            if (!(listNode instanceof ListNode)) {
                throw new Error("cannot add node '" + path.toString() + "' to non-list");
            }

            let newNode = new ContainerNode(listNode, this.schema_.absolute(path));
            listNode.add(path.last(), newNode);
        } else {
            listNode = this.resolve_(path.parent(), false);

            if (!(listNode instanceof ContainerNode)) {
                // a root container maybe added because it maybe an object and null
                if (listNode !== null) {
                    throw new Error("cannot add node '" + path.toString() + "' to non-container");
                }
            }
            listNode = this.resolve_(path, true);
            if (listNode instanceof ContainerNode) {
                if (!listNode.get(this.schema_, path, new FilterGetter(this.schema_,
                    (path) => this.resolve_(path, false)?.unsafeGet()
                ), trueFilter)) {
                    listNode.set(this, this.schema_, getter, path, {});
                }
            }
        }
        this.schema_.applyDefaults(path, this);
    }


    applyDelete(path:Path) {
        let getter = new FilterGetter(this.schema_, path => this.unsafeGet(path));

        let listNode;
        if (path.lastKeys().length > 0) {
            // this is a list node we are deleting from
            listNode = this.resolve_(path.unsetKeys(), false);
            if (!listNode) {
                return;
            }
            if (!(listNode instanceof ListNode)) {
                throw new Error("cannot delete node '" + path.toString() + "' from non-list");
            }

            listNode.remove(path.last());
            return;
        } else {
            listNode = this.resolve_(path.parent(), false);

            if (!(listNode instanceof ContainerNode)) {
                throw new Error("cannot remove node '" + path.toString() + "' to non-container");
            }
            let curNode = this.resolve_(path, false);
            if (curNode) {
                curNode.set(this, this.schema_,getter, path, null);
            }
            return;
        }
    }

    /**
     * moves a node in an ordered list
     * @param from the path to the item to move
     * @param to the place to move the node, if this is null move to first position if position is after otherwise moves
     *     the item to the last position
     * @param position to move it after or before
     */
    applyReorder(from:Path, to:Path|null, position:ChangePosition) {
        let listNode = this.resolve_(from.unsetKeys(), false);
        if (!listNode) {
            return;
        }

        if (!(listNode instanceof ListNode)) {
            throw new Error("move node '" + from.unsetKeys().toString() + "' is not a list");
        }

        if (this.schema_.isOrderedList(from)) {
            listNode.reorder(this.schema_, from.last(), to ? to.last() : null, position);
        }

    }
    applyMove(from:Path, to:Path) {
        let listNode = this.resolve_(from.unsetKeys(), false);
        if (!listNode) {
            return;
        }
        if (!(listNode instanceof ListNode)) {
            throw new Error("move node '" + from.unsetKeys().toString() + "' is not a list");
        }

        if (this.schema_.isOrderedList(from)) {
            listNode.move(from.last(), to.last());
            listNode.notifyMove(from, to);
        } else {
            let oldNode = listNode.remove(from.last());
            if (!oldNode) {
                throw new Error("move node '" + from.toString() + "' does not exist");
            }
            listNode.add(to.last(), oldNode);
            oldNode.notifyMove(from, to);

        }
    }
    applySet(path:Path, val:any) {
        let node = this.resolve_(path, false);
        if (!node) {
            let parent = this.resolve_(path.parent(), false);
            if (!parent) {
                if (this.rootLock_ === 0) {
                    throw new Error("set node '" + path.toString() + "' does not exist");
                }
                let roots = this.getRoots(path);
                if (roots.length === 0) {
                    // there is no existing root for this path
                    // and the roots are locked so we don't want to add it
                    return;
                }
                // this will add the node
                parent = this.resolve_(path.parent(), true);
            }

            node = parent.getChildNode(this.schema_, path.last(), path, true);
        }
        if (!(node instanceof LeafNode)) {
            throw new Error("set node '" + path.toString() + "' is not a leaf");
        }
        node.setValue(val);

    }

    isRoot(path:Path):boolean {
        let absolutePath = this.schema_.absolute(path);
        for (let i = 0; i < this.roots_.length; i++) {
            let root = this.roots_[i];
            if (isEqual(absolutePath, this.schema_.absolute(root))) {
                return true;
            }
        }
        return false;
    }

    getRoots(path:Path):Path[] {
        let res:Path[] = [];
        let me = this;
        let absolutePath = me.schema_.absolute(path);
        this.roots_.forEach(function (root) {
            let absRoot = me.schema_.absolute(root);
            if (absRoot.isAncestor(absolutePath, true)) {
                let suffix = absolutePath.getSuffix(absRoot);
                if (me.schema_.exists(root.appendSuffix(suffix as any))) {
                    res.push(root);
                }
            }
        });
        return res;
    }

    /**
     * stops new roots from being added
     * @param {function()} callback
     *//*todo
    lockRoots(callback:() => void) {
        try {

            this.rootLock_++;
            callback();
        } finally {
            this.rootLock_--;
        }
    }

    /**
     * replaces this db with the src db
     */
    replaceDb(srcDb:ChangeDb):Path[] {
        this.schema_ = srcDb.schema_;
        this.data_ = clone(srcDb.data_);
        this.roots_ = [...srcDb.roots_];
        return this.roots_;
    }
    applyChanges(changes:Change[]) {
        for (let i = 0; i < changes.length; i++) {
            let change = changes[i];
            change.applyToDb(this, this.schema_);
        }
    }
    private addPossibleChanges_(node:ChangeDbNode, path:Path) {
        this.possibleRefChanges_.set(node, path);

    }

    setSerialize(rootPath:Path, val: any, opt_filter:ReferenceFilter = trueFilter) {
        return this.set(rootPath, val, opt_filter, true);
    }

    /**
     * Sets the root node this should be called after the reference ahs been added for the rootPath, if not it will
     * throw an error
     *
     * This is because it will not update unresolved references that are references that are not loaded from the database yet
     *
     * @param rootPath
     * @param val
     * @param opt_filter
     * @param serialized is the data that is being set serialized
     * @return returns a list of roots that have changed
     */
    set(rootPath:Path, val:any, opt_filter: ReferenceFilter = trueFilter, serialized: boolean = false):void {
        let newListeners= this.checkReferenced(rootPath, opt_filter, true);
        let cur = this.resolve_(rootPath, true);
        opt_filter = this.schema_.getAliasFilter(rootPath, opt_filter);
        let absolutePath = this.schema_.absolute(rootPath);
        this.addPossibleChanges_(cur, absolutePath);
        let getter = new FilterGetter(this.schema_, path => this.unsafeGet(path));

        let changed = cur.set(this, this.schema_, getter, rootPath, val, opt_filter, serialized);

        /*
          if (!found && this.rootLock_ === 0) {
            this.roots_.push(rootPath);
            changed.push(rootPath);
        }*/
        changed = changed || [];
        for (let l of newListeners) {
            this.resolveChangeListener(cur, rootPath, l, opt_filter);
            changed.push({listener: l, path: rootPath, filter: opt_filter});
        }
        cur.addAncestorListeners(changed);

        if (changed) {

            for (let change of changed) {
                change.listener.update(this.get(change.path, change.filter))
            }
        }
    }


    private resolveChangeListener(cur: ChangeDbNode, rootPath: Path, l: Listener, opt_filter:ReferenceFilter) {
        cur.addChangeListener(rootPath, l, opt_filter);
        let unresolved = this.unresolvedReferences_.findFirst({key: rootPath});
        if (unresolved) {
            let ll = unresolved.listeners;
            let ii = ll.get(opt_filter);
            if (ii) {
                for (let i = ii.length - 1; i >= 0; i--) {
                    let pathListener = ii[i];
                    if (pathListener.listener === l || isEqual(pathListener.path, rootPath)) {
                        ii.splice(i, 1);
                        break;
                    }
                }
                if (ii.length === 0) {
                    ll.delete(opt_filter);
                }
                if (ll.size === 0) {
                    this.unresolvedReferences_.remove({key: rootPath});
                }
            }
        }
    }

    private checkReferenced(rootPath: Path, filter: ReferenceFilter, opt_setting:boolean = false): Listener[] {
        let node = this.resolve_(rootPath, false);
        let nodeListeners = [];
        if (node) {
            for (let l of node.getChangeListeners()) {
                if (l.filter === filter && isEqual(l.path, rootPath)) {
                    // this seems wrong if opt_setting is true
                    nodeListeners.push(l);
                    break;

                }
            }

            if (!opt_setting) {
                // if we are just getting, the node reference needs to be set otherwise we are getting before we set
                if (nodeListeners.length > 0)  {
                    return [];
                }
                throw new Error("path " +  rootPath.toString() +   " not set");
            }

        }
        // if the path doesn't already exist remove see if the unresolved reference exists if not throw an exception

        let foundPath = this.unresolvedReferences_.findFirst({key: rootPath});

        if (!foundPath) {
            if (nodeListeners.length > 0) {
                return [];
            }
            throw new Error("path not referenced");
        }
        let found = [];

        let listenerPaths = foundPath.listeners.get(filter);

        if (!listenerPaths) {
            if (nodeListeners.length>0) {
                return [];
            }
            throw new Error("path not referenced");
        }


        for (let lPath of listenerPaths) {
            if (isEqual(lPath.path, rootPath)) {
                found.push(lPath.listener);
            }
        }

        if (found.length === 0) {
            if (nodeListeners.length) {
                return [];
            }
            throw new Error("path not referenced");
        }
        return found;

    }

    remove(rootPath:Path) {
        let cur = this.resolve_(rootPath, false);
        if (!cur) {
            return;
        }
        let absolutePath = this.schema_.absolute(rootPath);
        let found = false;

        for (let i = this.roots_.length - 1; i >= 0; i--) {
            let root = this.roots_[i];
            if (isEqual(root, rootPath)) {
                this.roots_.splice(i, 1);
            } else if (this.schema_.absolute(root).isAncestor(absolutePath, true)) {
                found = true;
            }
        }
        // TODO remove data from the tree no other roots access it
    }


    private resolve_(path: Path, create: true, filter?:ReferenceFilter, resolveOut?: ResolveOutType): ChangeDbNode;
    private resolve_(path: Path, create: boolean, filter?:ReferenceFilter, resolveOut?: ResolveOutType): ChangeDbNode|null;
    private resolve_(path: Path, create: boolean, filter?:ReferenceFilter, resolveOut?: ResolveOutType): ChangeDbNode|null {
        let items = this.schema_.absolute(path).items();
        let cur:ChangeDbNode|null = this.data_;
        let seenItems = [];
        let i = 0;
        for (; i < items.length && cur; i++) {
            //cur.updateRef(this, refChange, possibleRefChange);
            let item = items[i];
            let unkeyed = item.unsetKeys();
            seenItems.push(unkeyed);
            cur = cur.getChildNode(this.schema_, item, new Path(seenItems), create);
            if (cur && item.keys().length > 0) {
                seenItems[seenItems.length - 1] = item;
                cur = cur.getChildNode(
                    this.schema_, item,
                    new Path(seenItems), create);
            }
            else if (cur) {
                let curIndex = unkeyed;
                for (let idx of item.getIndexes()) {
                    curIndex = curIndex.appendIndex(idx);
                    seenItems[seenItems.length - 1] = curIndex;
                    cur = cur.getChildNode(
                        this.schema_, curIndex,
                        new Path(seenItems), create);
                    if (!cur) {
                        return  null;
                    }

                }
            }
        }
        if (!cur) {
            if (resolveOut) {
                resolveOut.pathFound = items.slice(0, i -1);
                resolveOut.pathToDo = items.slice(i - 1);
            }
        }
        return cur;
    }

    getSerialized(rootPath:Path, filter: ReferenceFilter = trueFilter):any {
        return this.get(rootPath, filter, true);
    }

    exists(rootPath:Path, filter: ReferenceFilter = trueFilter, serialized: boolean = false):boolean {
        filter = this.schema_.getAliasFilter(rootPath, filter);
        let fullObj = this.resolve_(rootPath, false);

        return fullObj !== null;
    }

    /**
     *
     * @param rootPath
     * @param filter
     * @param serialized true to get the serialized value
     */
    get(rootPath:Path, filter: ReferenceFilter = trueFilter, serialized: boolean = false):any {
        filter = this.schema_.getAliasFilter(rootPath, filter);
        this.checkReferenced(rootPath, filter);
        let fullObj = this.resolve_(rootPath, false);
        if (fullObj === null) {
            throw new Error("Object not registered in database");
        }
        return fullObj.get(this.schema_, rootPath,new FilterGetter(this.schema_, (path:Path) => this.resolve_(path, false)?.unsafeGet()), filter, serialized);
    }

    /**
     * should only be used for testing this is used to see if unreferenced objects are actually deleted
     * @param listPath
     */
    unsafeGet(path: Path) {
        let node = this.resolve_(path, false);

        if (node === null) {
            throw new Error("Object not registered in database");
        }
        return node.unsafeGet();
    }

    recalculateNodeReferences_(node:ChangeDbNode, items:PathItem[] ):void {
        let unresolved = this.unresolvedReferences_.findFirst({key:new Path(items)});
        if (unresolved) {
            this.unresolvedReferences_.remove(unresolved);
            node.addUnresolved(unresolved.listeners);
        }
    }
    /**
     * a wrapper to be called around function that modifies the data, this allows the reference counts
     * to be updated correctly since changing data inside the transaction can cause the transaction to change
     *
     * @param func
     */
    transaction<T>(func:() => T):T {
       let res;
        try {
           this.transactionCount_ ++;
           res = func();
       } finally {
           this.transactionCount_ --;
           if (this.transactionCount_ === 0) {
           }
       }
       return res;
    }

    private cleanupTree(path: Path, node: ChangeDbNode) {
        let cur:ChangeDbNode|null = node;

        // go up the tree and delete any nodes that no longer have references
        while (cur && cur.cleanupTree()) {
            cur = cur.parent();
        }

    }

}

