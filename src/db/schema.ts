import {type ChangeDbInterface, ReferenceFilter} from "./changedb.ts";
import {Path} from "./path.ts";
import {Primitive} from "./changeset.ts";
import {Serializable} from "../util/serializable.ts";

export interface Schema {
    /**
     * @return the children
     */
    children(path: Path): string[];

    isOrderedList(path: Path): boolean;

    /**
     * @return true if the user has to create
     */
    isCreatable(path: Path): boolean;

    /**
     * set up container after item is added
     */
    applyDefaults(path: Path, db:ChangeDbInterface): void;

    /**
     * this is used to filter out items that may exist in the aboslute path
     * but not in the named path
     *
     * @return true if the path exist for this path
     */
    exists(path: Path): boolean;

    /**
     * this is a partial list and may set only the keys in this path
     * this does not mean the other items get deleted
     * @return true if the path exist for this path
     */
    isPartial(path: Path): boolean;

    /**
     * returns a list of keys at the path level not parent keys
     * @param {recoil.db.ChangeSet.Path} path
     * @return {!Array<string>} keys
     */
    keys(path: Path): string[];

    isLeaf(path: Path): boolean;

    /**
     * @return true if the path is a list of object and the keys are not specified, else false
     */
    isKeyedList(path: Path): boolean;

    isList(path: Path): boolean;

    /**
     * converts a path into an absolute path this solve
     * so you can have different paths for the same thing
     *
     */
    absolute(path: Path): Path;

    createKeyPath(path:Path, obj:Record<string, any>): Path;

    allowNullValue(path: Path, val: null|undefined): boolean;

    deserialize(path: Path, val: Serializable): any;

    serialize(path: Path, value: any): Serializable;

    getAliasFilter(rootPath: Path, filter: ReferenceFilter): ReferenceFilter;
}
