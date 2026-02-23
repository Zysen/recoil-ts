import {
    DefaultPathCompressor,
    Path,
    type PathCompressor,
    type PathSerializer,
    type ValueSerializor
} from "./path.ts";
import {PathChangeMap} from "./changepathmap.ts";
import {isEqual} from "../util/object.ts";
import {type StructType} from "../frp/struct.ts";
import {ChangeSet, diff} from "./changeset.ts";
import {ChangeDb, type ChangeDbInterface} from "./changedb.ts";
import { type Schema } from "./schema.ts";

export enum ChangeType  {
    SET= 0,
    ADD= 1,
    DEL= 2,
    MOVE= 3,
    REORDER= 4
}
export enum ChangePosition  {
    AFTER= 0,
    BEFORE= 1
}

export interface Change {
    /**
     * goes over all changes in the change
     * this function can also generate a new change tree if the iter returns changes
     */
    forEachChange(iter: (change: Change) => Change | null): Change | null;

    /**
     * goes over all changes in the change
     */

    setPathKeys(keys: any[], opt_level?: number): Change;

    applyToDb(db: ChangeDbInterface, schema: Schema): void;

    /**
     * returns the number of changes in this change
     */
    changeCount(): number;

    /**
     * true if this change has no effect e.g. setting a value to the same value, or move to the same loc
     */
    isNoOp(): boolean;

    /**
     * creates an inverse of the change
     */

    inverse(schema: Schema): Change;

    /**
     * removes changes that don't match the filter, this is useful for things
     * like security checks that may want parts of the change but not others
     */
    filter(filter: (v:Path) => boolean): Change|null;

    /**
     * moves the path of this change dependants
     */
    move(from: Path, to: Path): Change;

    merge(pathChangeMap: PathChangeMap, pAncestor: Change|null, maxPos: any[]): void;

    path(): Path;

    sortDesendents(pathMap: PathChangeMap): void;

    /**
     * convert all paths to absolute values and returns a copy
     */
    absolute(schema: Schema): Change;


    /**
     * converts a path to an object that can be turned into json
     * @param {boolean} keepOld do we need the undo information
     * @param schema
     * @param valSerializor
     * @param opt_compressor
     * @param opt_pathSerializer
     */
    serialize(keepOld: boolean, schema: Schema, valSerializor: ValueSerializor, opt_compressor?: PathCompressor<string>, opt_pathSerializer?: PathSerializer): StructType;

    get paths():Path[];

    removeDependant(change: Change): void;
}


export class Move implements Change {
    private oldPath_: Path;
    private newPath_: Path;

    constructor(oldPath:Path, newPath:Path) {
        this.oldPath_ = oldPath;
        this.newPath_ = newPath;
    }

    get paths():Path[] {
        return [this.oldPath_, this.newPath_];
    }
    addToPathMap(map:PathChangeMap, ancestor:Change, max:number[], opt_pos?:number[]) {
        map.addMove(this,  this.from(), this.to(),  ancestor, max, opt_pos );
    }
    /**
     * removes changes that don't match the filter, this is useful for things
     * like security checks that may want parts of the change but not others
     */

    filter(filter: (v:Path) => boolean): Change|null {
        if (!filter(this.oldPath_) || !filter(this.newPath_)) {
            return null;
        }
        return this;
    }


    /**
     * goes over all changes in the change
     */

    setPathKeys(keys:any[], opt_level?:number):Move {
        return new Move(this.oldPath_.setKeysAt(opt_level, null, keys), this.newPath_.setKeysAt(opt_level, null, keys));
    }

    /**
     * goes over all changes in the change
     */

    forEachChange(iter:(c:Change) => Change|null):Change|null{
        return iter(this);
    }


    /**
     * moves the path of this change dependants
     */

    move(from:Path, to:Path):Move {
        return new Move(this.oldPath_.move(from, to), this.newPath_.move(from, to));
    };

    /**
     * creates an inverse of the change
     */

    inverse(schema:Schema):Move {
        return new Move(this.newPath_, this.oldPath_);
    }

    /**
     * returns the number of changes in this change
     */
    changeCount():number {
        return 1;
    }

    /**
     * true if this change has no effect
     */
    isNoOp():boolean {
        return isEqual(this.oldPath_, this.newPath_);
    }

    /**
     * convert all paths to absolute values and returns a copy
     */
    absolute(schema:Schema):Move {
        return new Move(schema.absolute(this.oldPath_), schema.absolute(this.newPath_));
    }
    beforeMovePath(path:Path):Path {
        let pathItems = path.items();
        let newPathItems = this.from().items().slice(0);
        if (newPathItems.length > pathItems.length) {
            throw 'path must be >= move path';
        }
        for (let j = newPathItems.length; j < pathItems.length; j++) {
            newPathItems.push(pathItems[j]);
        }
        return new Path(newPathItems);
    }

    merge(pathChangeMap:PathChangeMap, pAncestor:Change, maxPos:number[]) {
        //TODO implement move

        // previous sets nothing to do they should be previous

        // previous adds just change the add path

        // previous deletes should be fine

        // previous moves
        // just add this object there is nothing that conflicts

        // we have to do previous adds because the could be invalid
        let adds = pathChangeMap.findExact(this.oldPath_, Add);
        for (let i = adds.length - 1; i >= 0; i--) {
            let add = /** @type {!Add} */ (adds[i]);

            let info = pathChangeMap.removeChangeInfo(add);
            // adjust any sets or sub moves after that

            if (info) {

                let newAdd = add.move(this.oldPath_, this.newPath_);
                newAdd.merge(pathChangeMap, pAncestor, info.pos);
                return;
            }
        }


        let moves = pathChangeMap.findExact(this.oldPath_, Move);


        for (let i = moves.length - 1; i >= 0; i--) {
            let move = /** @type {Move} */ (moves[i]);

            if (isEqual(move.to(), this.oldPath_)) {
                let info = pathChangeMap.removeChangeInfo(move);
                if (info) {
                    move.newPath_ = this.newPath_;
                    if (!isEqual(move.to(), move.from())) {
                        pathChangeMap.addMove(move, move.from(), move.to(), info.ancestor, maxPos, info.pos);
                    }
                    return;
                }
            }
        }

        this.addToPathMap(pathChangeMap, pAncestor, maxPos);
    }
    path():Path {
        return this.oldPath_;
    }

    to():Path {
        return this.newPath_;
    }

    from():Path {
        return this.oldPath_;
    }

    sortDesendents(pathMap:PathChangeMap) {
    }

    applyToDb(db:ChangeDbInterface, schema:Schema) {
        db.applyMove(this.oldPath_, this.newPath_);
    }

    /**
     * converts a path to an object that can be turned into json
     * @param keepOld do we need the undo information
     * @param schema
     * @param valSerializor
     * @param compressor
     * @param opt_pathSerializer
     */
    serialize(keepOld:boolean, schema:Schema, valSerializor:ValueSerializor, compressor :PathCompressor<string> = new DefaultPathCompressor(), opt_pathSerializer?: PathSerializer):StructType {
        return {
            type: ChangeType.MOVE,
            from: this.oldPath_.serialize(valSerializor, compressor, opt_pathSerializer),
            to: this.newPath_.serialize(valSerializor, compressor, opt_pathSerializer)
        };
    }

    removeDependant(change: Change) {}

}

export class Reorder implements Change {
    private path_: Path;
    private toPath_: Path|null;
    private oldAfter_: Path|null;
    private position_: ChangePosition;

    /**
     *
     * @param path the path item to move
     * @param toPath the path to move the item to, if null then moves to first position if change position is AFTER, otherwise
     *     moves it to the last position
     * @param position either before or after
     * @param oldAfter this is for undo information
     */
    constructor(path: Path, toPath: Path|null, position: ChangePosition, oldAfter: Path|null) {
        this.path_ = path;
        this.toPath_ = toPath;
        this.oldAfter_ = oldAfter;
        this.position_ = position;
    }

    get paths():Path[] {
        let to = this.toPos();
        return to ? [to, this.path()]: [this.path()];
    }


    removeDependant(change: Change) {
    }

    /**
     * goes over all changes in the change
     */
    setPathKeys(keys:any[], opt_level?:number):Reorder {
        return new Reorder(this.path_.setKeysAt(opt_level, null, keys), this.toPath_ ?  this.toPath_.setKeysAt(opt_level, null, keys) : null, this.position_, this.oldAfter_);
    }


    /**
     * removes changes that don't match the filter, this is useful for things
     * like security checks that may want parts of the change but not others
     */

    filter(filter:(p:Path) => boolean) {
        if (!filter(this.path_) || (this.toPath_ && !filter(this.toPath_))) {
            return null;
        }
        return this;
    }

    /**
     * goes over all changes in the change
     */

    forEachChange(iter:(c:Change)=> Change|null):Change|null {
        return iter(this);
    }

    /**
     * moves the path of this
     */
    move(from:Path, to:Path):Reorder {
        return new Reorder(this.path_.move(from, to), this.toPath_ ? this.toPath_.move(from, to) : null, this.position_, this.oldAfter_);
    }

    /**
     * creates an inverse of the change
     */

    inverse(schema:Schema) {
        return new Reorder(this.path_, this.oldAfter_, ChangePosition.AFTER, null);
    }

    /**
     * returns the number of changes in this change
     */
    changeCount():number {
        return 1;
    }

    /**
     * true if this change has no effect
     * @return {boolean}
     */
    isNoOp():boolean {
        return isEqual(this.path_, this.toPath_);
    }

    /**
     * convert all paths to absolute values and returns a copy
     */
    absolute(schema:Schema):Reorder {
        return new Reorder(schema.absolute(this.path_), this.toPath_ ? schema.absolute(this.toPath_) : null, this.position_, this.oldAfter_ ? schema.absolute(this.oldAfter_) : null);
    }

    merge(pathChangeMap:PathChangeMap, pAncestor:Change|null, maxPos:number[]) {
        // can't really do much here multiple reorders cannot be merged because other reorders may depend on it

        // todo when moving we may change our path or the dest path
        // when deleting may remove path but then that is still dodgy because other dependant reorder
        // really best not to have ordered list at all and have a field that is the order
        pathChangeMap.add(this.path_, this, pAncestor, maxPos);
        if (this.toPath_) {
            pathChangeMap.add(this.toPath_, this, pAncestor, maxPos);
        }

    }
    path():Path {
        return this.path_;
    }

    toPos():Path|null {
        return this.toPath_;
    };

    from():Path {
        return this.path_;
    }

    /**
     * @param {!PathChangeMap} pathMap
     */
    sortDesendents(pathMap:PathChangeMap) {
    }
    applyToDb(db:ChangeDbInterface, schema:Schema) {
        db.applyReorder(this.path_, this.toPath_, this.position_);
    }

    /**
     * converts a path to an object that can be turned into json
     * @param keepOld do we need the undo information
     * @param schema
     * @param valSerializor
     * @param compressor
     * @param opt_pathSerializer
     */
    serialize(keepOld:boolean, schema:Schema, valSerializor:ValueSerializor, compressor:PathCompressor<string> =new DefaultPathCompressor(), opt_pathSerializer?:PathSerializer) {
        return {
            type: ChangeType.REORDER,
            path: this.path_.serialize(valSerializor, compressor, opt_pathSerializer),
            to: this.toPath_ ? this.toPath_.serialize(valSerializor, compressor, opt_pathSerializer) : null,
            pos: this.position_
        }
    }
}

export class SetChange implements Change {
    private readonly path_: Path;
    private readonly oldVal_: any;
    private newVal_: any;

    constructor(path: Path, oldVal: any, newVal: any) {
        this.path_ = path;
        this.oldVal_ = oldVal;
        this.newVal_ = newVal;
    }


    get paths():Path[] {return [this.path()]}

    removeDependant(_change: Change) {
    }

    /**
     * removes changes that don't match the filter, this is useful for things
     * like security checks that may want parts of the change but not others
     */

    filter(filter:(p:Path)=>boolean):Change|null {
        if (!filter(this.path_)) {
            return null;
        }
        return this;
    }

    /**
     * moves the path of this
     */
    move(from:Path, to:Path):SetChange {
        return new SetChange(this.path_.move(from, to), this.oldVal_, this.newVal_);
    }

    value():any {
        return this.newVal_;
    }

    orig():any {
        return this.oldVal_;
    }

    /**
     * creates an inverse of the change
     */

    inverse(schema:Schema):SetChange {
        return new SetChange(this.path_, this.newVal_, this.oldVal_);
    };

    /**
     * @return {!Path}
     */
    path():Path {
        return this.path_;
    }
    /**
     * returns the number of changes in this change
     * @return {number}
     */
    changeCount():number {
        return 1;
    }


    /**
     * goes over all changes in the change
     */

    forEachChange(iter:(c:Change) =>Change|null):Change|null {
        return iter(this);
    }


    /**
     * true if this change has no effect
     */
    isNoOp():boolean {
        return isEqual(this.oldVal_, this.newVal_);
    }
    /**
     * if the change is a set
     * if exists move change with our to path, make path the move from path and repeat
     * if add , add us as dependant of the add
     * if delete exist invalid anyway
     */
    merge(pathChangeMap:PathChangeMap, pAncestor:Change|null, maxPos:number[]) {
        let sets = pathChangeMap.findExact(this.path_, SetChange);
        // if exists set change update to and stop
        if (sets.length > 0) {
            if (sets.length > 1) {
                throw 'mutiple set on same key not merged correctly';
            }
            // should only be 1
            sets[0].newVal_ = this.newVal_;
        }
        else {
            // if exists move change with our to path, make path the move from path and repeat
            let moves = pathChangeMap.findAncestors(this.path_);
            let ancestor = null;

            let lastDel = false;
            for (let j = 0; j < moves.length; j++) {
                lastDel = false;
                let move = moves[j];
                if (move instanceof Move) {
                    if (move.to().isAncestor(this.path_, true)) {
                        ancestor = move;
                        break;
                    }
                }
                if (move instanceof Delete) {
                    lastDel = true;
                }
                if (move instanceof Add) {
                    lastDel = false;
                }
            }

            if (lastDel) {
                return;
            }
            if (ancestor) {

                let newPath = ancestor.beforeMovePath(this.path_);
                // we know longer paths are moved before shorter paths
                //
                let moveInfo = pathChangeMap.findChangeInfo(ancestor);


                // we have to place the set before the move
                new SetChange(newPath, this.oldVal_, this.newVal_)
                    .merge(pathChangeMap, pAncestor, moveInfo ? moveInfo.pos:[]);
                return;
            }


            let len = 0;
            for (let j = 0; j < moves.length; j++) {
                let add = moves[j];
                if (add instanceof Add) {
                    if (add.path().parts().length > len) {
                        ancestor = add;
                    }
                }
            }

            // if add , add us as dependant of the add
            if (ancestor) {
                ancestor.addDependant(this);
                pathChangeMap.add(this.path_, this, ancestor, maxPos, undefined);
                return;
            }
            // just a set nothing to change
            pathChangeMap.add(this.path_, this, pAncestor, maxPos);
        }

    }
    /**
     * @param {!PathChangeMap} pathMap
     */
    sortDesendents(pathMap:PathChangeMap) {
    }

    /**
     * convert all paths to absolute values and returns a copy
     */
    absolute(schema:Schema):SetChange {
        return new SetChange(schema.absolute(this.path_), this.oldVal_, this.newVal_);
    }

    applyToDb(db:ChangeDbInterface, _schema:Schema) {
        db.applySet(this.path_, this.newVal_);
    }

    /**
     * converts a change an object that can be turned into json
     * @param keepOld do we need the undo information
     * @param schema
     * @param valSerializor serializor
     * @param compressor
     * @param opt_pathSerializer
     */
    serialize(keepOld:boolean, schema:Schema, valSerializor:ValueSerializor, compressor:PathCompressor<string> = new DefaultPathCompressor(), opt_pathSerializer?:PathSerializer) {
        if (keepOld) {
            return {
                type: ChangeType.SET,
                path: this.path_.serialize(valSerializor, compressor, opt_pathSerializer),
                old: valSerializor.serialize(this.path_, this.oldVal_),
                new: valSerializor.serialize(this.path_, this.newVal_)
            };
        }
        return {
            type: ChangeType.SET,
            path: this.path_.serialize(valSerializor, compressor, opt_pathSerializer),
            new: valSerializor.serialize(this.path_, this.newVal_)
        };
    }
    /**
     * goes over all changes in the change
     */
    setPathKeys(keys:any[], opt_level?:number):SetChange {
        return new SetChange(this.path_.setKeysAt(opt_level, null, keys), this.oldVal_, this.newVal_);
    }
}

export class Add implements Change {
    private readonly path_: Path;
    private dependants_: Change[];

    constructor(path: Path, dependants: Change[]) {
        this.path_ = path;
        this.dependants_ = dependants;
    }

    get paths():Path[] {return [this.path()]}

    /**
     * removes changes that don't match the filter, this is useful for things
     * like security checks that may want parts of the change but not others
     */

    filter(filter:(p:Path)=>boolean):Add|null {
        if (!filter(this.path_)) {
            return null;
        }
        let newDeps = [];
        for (let i = 0; i < this.dependants_.length; i++) {
            let dep = this.dependants_[i].filter(filter);
            if (dep) {
                newDeps.push(dep);
            }
        }
        return new Add(this.path_, newDeps);

    }


    /**
     * goes over all changes in the change
     * this function can also generate a new change tree if the iter returns changes
     */
    forEachChange(iter:(c:Change)=>Change|null):Add|null {
        let newDeps = [];
        for (let i = 0; i < this.dependants_.length; i++) {
            let dep = this.dependants_[i].forEachChange(iter);
            newDeps.push(dep ? dep : this.dependants_[i]);
        }
        let res = iter(this);

        if (res) {
            return new Add(res.path(), newDeps);
        }
        return res;
    };


    /**
     * goes over all changes in the change
     */
    setPathKeys(keys:any[], opt_level?:number):Add {
        let pathItems = this.path_.items();
        let level = opt_level === undefined ? pathItems.length - 1 : opt_level;

        let deps = [];
        for (let i = 0; i < this.dependants_.length; i++) {
            let change = this.dependants_[i];
            deps.push(change.setPathKeys(keys, level));

        }
        return new Add(this.path_.setKeysAt(level, null, keys), deps);
    }

    /**
     * creates an inverse of the change
     */
    inverse(schema: Schema):Delete {
        /*todo let db = new ChangeDb(schema);
        this.applyToDb(db, schema);
        return new Delete(this.path_, db.get(this.path_));*/
        return new Delete(this.path_, null);
    }

    /**
     * returns the number of changes in this change
     */
    changeCount():number {
        let res = 1;
        this.dependants_.forEach(function (d) {
            res += d.changeCount();
        });
        return res;
    }

    /**
     * moves the path of this add and all its dependants
     */
    move(from:Path, to:Path):Add {
        let newDeps = this.dependants_.map( d=>d.move(from,to));
        return new Add(this.path_.move(from, to), newDeps);
    }

    /**
     * true if this change has no effect
     */
    isNoOp():boolean {
        return false;
    }


    /**
     * invariants
     *
     * for all cur < added
     *   count(set(path)) < 2;
     *   del(path) then no add(path/...) before it
     *   del(path) then no set(path/...) before it
     *   del(path) then no move(_, path/...) before it
     *   add(path)
     */

    merge(pathChangeMap: PathChangeMap, pAncestor: Change, maxPos: number[]) {
        let me = this;

        // set ... add do nothing we can't of set something before we added it
        // add ... add if add is a ancestor add ourselves as a dependant
        // delete ... add this add stays because this could potentually unset other values
        // move ... add(desendant to) move to before move
        // move ... add(desendant from)
        // move ... add(from) that is ok

        let ancestors = pathChangeMap.findAncestors(this.path_);
        let add:Add|null = null;

        for (let i = ancestors.length - 1; i >= 0; i--) {
            let ancestor = ancestors[i];
            if (ancestor instanceof Delete) {
                break;
            } else if (ancestor instanceof Move) {
                // adjust path to before move
                if (ancestor.to().isAncestor(this.path_, true)) {
                    let newPath = ancestor.beforeMovePath(this.path_);
                    // we know longer paths are moved before shorter paths
                    //
                    if (isEqual(ancestor.to(), this.path_)) {
                        throw 'add object that already exists';
                    }

                    let moveInfo = pathChangeMap.findChangeInfo(ancestor);


                    // we have to place the set before the move
                    new Add(newPath, this.dependants_)
                        .merge(pathChangeMap, pAncestor, moveInfo ? moveInfo.pos : []);
                    return;
                }
            } else if (ancestor instanceof Add) {
                // add this to decendants
                add = ancestor;
                break;
            }
        }
        if (add) {
            add.addDependant(this);
            pathChangeMap.add(this.path_, this, add, maxPos);
        } else {
            pathChangeMap.add(this.path_, this, null, maxPos);
        }
        this.dependants_.forEach(function (change) {
            change.merge(pathChangeMap, me, maxPos);
        });

    }
    dependants() {
        return this.dependants_;
    }
    addDependant(dep:Change) {
        for (let i = 0; i < this.dependants_.length; i++) {
            if (dep === this.dependants_[i]) {
                return;
            }
        }
        this.dependants_.push(dep);
    }
    removeDependant(dep:Change) {
        for (let i = 0; i < this.dependants_.length; i++) {
            if (dep === this.dependants_[i]) {
                this.dependants_.splice(i, 1);
                return;
            }
        }
    }

    /**
     * convert all paths to absolute values and returns a copy
     */
    absolute(schema: Schema):Add {
        return new Add(schema.absolute(this.path_), this.dependants_.map(dep =>dep.absolute(schema)));
    }

    path(): Path {
        return this.path_;
    }

    sortDesendents(pathMap:PathChangeMap) {
        let toSort:{pos:number[], change:Change}[] =[]
        this.dependants_.forEach(function (dep) {
            let info = pathMap.findChangeInfo(dep);
            if (dep.isNoOp() || !info) {
                return;
            }
            toSort.push({pos: info.pos, change: dep});
        });
        this.dependants_ = toSort.sort(PathChangeMap.comparePos).map(v => v.change);

    }
    applyToDb(db: ChangeDbInterface, schema: Schema) {
        db.applyAdd(this.path_);
        ChangeSet.applyChanges(db, schema, this.dependants_);
    }

    /**
     * converts a change an object that can be turned into json
     * @param keepOld do we need the undo information
     * @param schema
     * @param valSerializor
     * @param compressor
     * @param opt_pathSerializer
     */
    serialize(keepOld: boolean, schema: Schema, valSerializor: ValueSerializor, compressor: PathCompressor<string> = new DefaultPathCompressor(), opt_pathSerializer?:PathSerializer):StructType {
        return {
            type: ChangeType.ADD, path: this.path_.serialize(valSerializor, compressor, opt_pathSerializer),
            deps: serializeChangeList(this.dependants_, keepOld, schema, valSerializor, compressor, opt_pathSerializer)
        };
    }

}


export class Delete implements Change {
    private readonly path_: Path;
    private readonly orig_: any;

    /**
     * @param path
     * @param orig the original value of the deleted item
     */
    constructor(path: Path, orig: any) {
        this.path_ = path;
        this.orig_ = orig;
    }


    get paths():Path[] {return [this.path()]}
    orig():any {
        return this.orig_;
    }


    /**
     * removes changes that don't match the filter, this is useful for things
     * like security checks that may want parts of the change but not others
     */

    filter(filter:(p:Path)=>boolean):this|null {
        if (!filter(this.path_)) {
            return null;
        }
        return this;
    }
    /**
     * goes over all changes in the change
     */
    forEachChange(iter:(c:Change) => Change|null):Change|null {
        return iter(this);
    };

    /**
     * moves the path of this change dependants
     */
    move(from:Path, to:Path):Delete {
        return new Delete(this.path_.move(from, to), this.orig_);
    }
    /**
     * creates an inverse of the change
     */
    inverse(schema:Schema):Add {
        let dependants = diff(null, this.orig_, this.path_, '', schema);
        return new Add(this.path_, dependants.changes);
    }
    /**
     * returns the number of changes in this change
     */
    changeCount():number {
        return 1;
    }
    /**
     * true if this change has no effect
     */
    isNoOp():boolean {
        return false;
    }
    merge(pathChangeMap:PathChangeMap, pAncestor:Change|null, maxPos:number[]) {

        // find all my decendants and remove them they are not relevant
        let relations = pathChangeMap.findRelations(this.path_, true, maxPos);
        for (let i = relations.length - 1; i >= 0; i--) {
            let relation = relations[i];
            if (relation instanceof Move) {
                if (isEqual(this.path_, relation.to())) {

                    // remove
                    let moveInfo = pathChangeMap.removeChangeInfo(relation);
                    // we have to place the set before the move
                    new Delete(relation.from(), this.orig_)
                        .merge(pathChangeMap, pAncestor, moveInfo ? moveInfo.pos : []);
                    return;
                } else if (this.path_.isAncestor(relation.to(), false)) {
                    pathChangeMap.removeChangeInfo(relation);
                } else {
                    let newPath = relation.beforeMovePath(this.path_);
                    // we know longer paths are moved before shorter paths
                    //
                    if (isEqual(newPath, this.path_)) {
                        continue;
                    }
                    let moveInfo = pathChangeMap.findChangeInfo(relation);
                    new Delete(newPath, this.orig_)
                        .merge(pathChangeMap, pAncestor, moveInfo ? moveInfo.pos : []);
                    return;
                }
            } else if (relation instanceof Reorder) {
                if (this.path_.isAncestor(relation.path(), true)) {
                    pathChangeMap.removeChangeInfo(relation);
                } else {
                    let toPos = relation.toPos();
                    if (toPos && this.path_.isAncestor(toPos, true)) {
                        // technically deleting the 2 should places after the previous one
                        // but we don't have that info
                        pathChangeMap.removeChangeInfo(relation);
                    }
                }
            } else {
                if (this.path_.isAncestor(relation.path(), false)) {
                    pathChangeMap.removeChangeInfo(relation);
                } else if (relation instanceof Add) {
                    if (isEqual(this.path_, relation.path())) {
                        pathChangeMap.removeChangeInfo(relation);
                        return;
                    }
                    relation.addDependant(this);
                    pathChangeMap.add(this.path_, this, relation, maxPos);
                    return;
                }

            }
        }
        pathChangeMap.add(this.path_, this, null, maxPos);

    }

    /**
     * convert all paths to absolute values and returns a copy
     */
    absolute(schema:Schema):Delete {
        return new Delete(schema.absolute(this.path_), this.orig_);
    }

    path():Path {
        return this.path_;
    }
    sortDesendents(_pathMap:PathChangeMap) {
    }
    applyToDb(db:ChangeDbInterface, schema:Schema) {
        db.applyDelete(this.path_);
    }

    /**
     * goes over all changes in the change
     */
    setPathKeys(keys:any[], opt_level?:number):Delete {
        return new Delete(this.path_.setKeysAt(opt_level, null, keys), this.orig_);
    }

    /**
     * converts a change an object that can be turned into json
     * @param keepOld do we need the undo information
     * @param schema
     * @param valSerializor
     * @param compressor
     * @param opt_pathSerializer
     */
    serialize(keepOld:boolean, schema:Schema, valSerializor:ValueSerializor, compressor:PathCompressor<string> = new DefaultPathCompressor(), opt_pathSerializer?:PathSerializer) :StructType{
        let old = keepOld ? serializeObject_(this.orig_, schema, valSerializor, this.path_) : undefined;
        return {
            type: ChangeType.DEL,
            path: this.path_.serialize(valSerializor, compressor, opt_pathSerializer),
            orig: old
        };
    }
    removeDependant(change: Change){}

}


/**
 * converts a path to an object that can be turned into json
 * @suppress {missingProperties}
 * @param object
 * @param schema
 * @param valSerializor
 * @param compressor
 */
export function deserializeChange(object:StructType, schema:Schema, valSerializor:ValueSerializor, compressor:PathCompressor<string> = new DefaultPathCompressor()):Change {
    let path;
    if (object.type === ChangeType.MOVE) {
        return new Move(
            Path.deserialize(object.from, schema, valSerializor, compressor),
            Path.deserialize(object.to, schema, valSerializor, compressor));
    }

    if (object.type === ChangeType.REORDER) {
        return new Reorder(
            Path.deserialize(object.path, schema, valSerializor, compressor),
            object.to ? Path.deserialize(object.to, schema, valSerializor, compressor) : null, object.pos, null);
    }
    if (object.type === ChangeType.DEL) {
        path = Path.deserialize(object.path, schema, valSerializor, compressor);
        return new Delete(
            path,
            deserializeObject_(object.orig, schema, valSerializor, path));
    }

    if (object.type === ChangeType.ADD && object.deps !== undefined) {
        return new Add(
            Path.deserialize(object.path, schema, valSerializor, compressor),
            deserializeChangeList(object.deps, schema, valSerializor, compressor));
    }

    if (object.type === ChangeType.SET) {
        path = Path.deserialize(object.path, schema, valSerializor, compressor);
        return new SetChange(
            path,
            valSerializor.deserialize(path, object.old), valSerializor.deserialize(path, object.new));

    }


    throw 'unrecoginized change type';
}


/**
 * converts a path to an object that can be turned into json
 */
function deserializeChangeList(objects: StructType[], schema: Schema, valSerializor: ValueSerializor, compressor?: PathCompressor<string>): Change[] {
    return objects.map(object => deserializeChange(object, schema, valSerializor, compressor));
}

/**
 * converts a path to an object that can be turned into json
 * @param changes
 * @param keepOld do we need the undo information
 * @param schema
 * @param valSerializor
 * @param compressor
 * @param opt_pathSerializer
 * @return {!Array<!Object>}
 */
function serializeChangeList(changes:Change[], keepOld:boolean, schema:Schema, valSerializor:ValueSerializor, compressor?:PathCompressor<string>, opt_pathSerializer?:PathSerializer):StructType[] {
    return changes.map(change => change.serialize(keepOld, schema, valSerializor, compressor, opt_pathSerializer));
}

/**
 * deserialize an object that contains
 * @param val the item to deserialize
 * @param schema
 * @param valSerializor
 * @param path
 * @return the deserialzed object
 */
function deserializeObject_(val:any, schema:Schema, valSerializor:ValueSerializor, path:Path) {
    return serializeHelper_(valSerializor.deserialize, val, schema, valSerializor, path);
}


/**
 * (de)serialize an object that contains
 * @return the deserialzed object
 */

function serializeHelper_(leafSerializer:(p:Path, val:any)=>any, val:any, schema:Schema, valSerializor:ValueSerializor, path:Path):any {
    if (val == undefined || !schema.exists(path)) {
        return val;
    }

    if (schema.isLeaf(path)) {
        return leafSerializer.call(valSerializor, path, val);
    }

    let deserialize = leafSerializer === valSerializor.deserialize;

    if (schema.isKeyedList(path)) {
        let res:any[] = [];
        for (let item of val) {
            let keyNames = schema.keys(path);
            let keys = [];
            for (let i = 0; i < keyNames.length; i++) {
                let name = keyNames[i];
                let k = deserialize ? valSerializor.deserialize(path.appendName(name), item[name]) : item[name];
                keys.push(k);
            }

            res.push(serializeHelper_(leafSerializer, item, schema, valSerializor, path.setKeys(keyNames, keys)));
        }
        return res;
    }

    let res:StructType = {};
    for (let field in val) {
        if (val.hasOwnProperty(field)) {
            res[field] = serializeHelper_(leafSerializer, val[field], schema, valSerializor, path.appendName(field));
        }
    }
    return res;

}

/**
 * serialize an object that contains
 * @private
 * @param {?} val the item to deserialize
 * @param schema
 * @param valSerializor
 * @param {!Path} path
 * @return the serialzed object
 */
function serializeObject_ (val:any, schema:Schema, valSerializor:ValueSerializor, path:Path):any {
    return serializeHelper_(valSerializor.serialize, val, schema, valSerializor, path);
}
