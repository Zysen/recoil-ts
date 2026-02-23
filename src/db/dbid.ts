import {StructType} from "../frp/struct.ts";
import {Path} from "./path.ts";
import {ReferenceFilter, trueFilter} from "./changedb.ts";
import {Query, QueryOptions} from "./query.ts";

export interface DbId<Type> {
    /**
     * @param obj the object
     * @param parents the parents of object
     * @return the primary keys of the object
     */
    getKeys(obj: Record<string, any>, parents: Record<string, any>[]): any[];

    /**
     * @param {!IArrayLike<!Object>} parents the parents of object
     * @return {!Array<?>} the primary keys of the object
     */
    getParentKeys(parents: Record<string, any>): any[];

    /**
     * @return an unique id identifing this key, use .seq in order to generate one
     */
    uniqueId(): Symbol;

    getPath(): Path;

    /**
     * function that this id will filter the data with
     */
    getFilter(pks: any[] | undefined | Query, opt_options: QueryOptions | undefined): ReferenceFilter;
}

function simpleKeyGetter(...keys: any[]): (object: StructType, parents: StructType[]) => any[] {
    return (object, parents) => {
        let res = [];
        let arg = 0;
        if (keys.length > 0 && object !== undefined) {

            for (let i = 0; i < keys[arg].length; i++) {
                let key = keys[arg][i];
                res.push(object[key]);
            }
        }

        let parent = 0;
        for (let arg = keys.length - 1;
             arg > 0 && parent < parents.length; arg--) {
            for (let i = 0; i < keys[arg].length; i++) {
                let key = keys[arg][i];
                res.push(parents[parent][key]);
            }
            parent++;
        }
        return res;
    };
}
type FilterFactoryType = (pks: any[] | Query | undefined, opt_options: QueryOptions | undefined)=> ReferenceFilter;

function trueFilterFactory(pks: any[] | Query | undefined, opt_options: QueryOptions | undefined): ReferenceFilter {
    return trueFilter;
}
/**
 * A simple identifier for a database table
 */

export class BasicDbId<Type> implements DbId<Type> {
    private keys_: string[];
    private data_: any;
    private keyGetter_: (object: any, parents: Record<string, any>[]) => any[];
    private path_: Path;
    private id_: Symbol;
    private filterFactory_: FilterFactoryType;
    /**
     * @param path the path you need to follow in the database to get to this object
     * @param keys
     * @param data
     * @param opt_keyGetter
     */
    constructor(path: Path|string, keys: string[], data: any, opt_keyGetter?: (object: any, parent: Record<string, any>[]) => any[],
                refFilter?:ReferenceFilter, filterFactory?:FilterFactoryType) {
        if (refFilter && filterFactory) {
            throw new Error("you cannot specify both a ref filter and a filter factory");
        }

        if (filterFactory) {
            this.filterFactory_ = filterFactory;
        }
        else if (refFilter && refFilter !== trueFilter) {
            this.filterFactory_ = () => refFilter;
        }
        else {
            this.filterFactory_ = trueFilterFactory;
        }
        this.keys_ = keys;
        this.data_ = data;
        this.keyGetter_ = opt_keyGetter ? opt_keyGetter : simpleKeyGetter(keys);
        this.path_ = typeof path === "string" ? Path.fromString(path) : path;
        this.id_ = Symbol();

    }

    /**
     * gets a list of all the objects that this object can be made up out of
     * @return {!Array<!recoil.db.TypePath>}
     */
    getPath(): Path {
        return this.path_;
    }

    /**
     * function that this id will filter the data with
     */
    getFilter(pks: any[] | Query | undefined, opt_options: QueryOptions | undefined): ReferenceFilter {
        return this.filterFactory_(pks, opt_options)
    }

    /**
     * @return {*}
     */
    getData() {
        return this.data_;
    }

    /**
     * @return an unique id identifing this key
     */
    uniqueId() {
        return this.id_;
    }


    /**
     * @param {Object} obj the object
     * @param {!Array<!Object>} parents the parents of object
     * @return {!Array<?>} the primary keys of the object
     */
    getKeys(obj: StructType, parents: StructType[]): any[] {
        return this.keyGetter_(obj, parents);
    }


    /**
     * @param parents the parents of object
     * @return the primary keys of the object
     */
    getParentKeys(parents: StructType[]): any[] {
        return this.keyGetter_(undefined, parents);
    }
}