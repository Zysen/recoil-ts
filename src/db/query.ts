import {ColumnKey} from "../structs/table/columnkey.ts";
import {isEqual} from "../util/object.ts";
import {BasicType, Serializable, SerializableRecord} from "../util/serializable.ts";
import {StartsWith, ContainsStr, Concat} from "./expressions/string.ts";
import {
    Equals,
    GreaterThan,
    GreaterThanOrEquals,
    IsNull,
    LessThan,
    LessThanOrEquals,
    NotEquals
} from "./expressions/compare.ts";
import {And, Or, Not, True, False} from "./expressions/logic.ts";
import {Exists} from "./expressions/exists.ts";

export class QueryData {
    static join(...args:(QueryData|string)[]) {
        let newBinds:any[] = [];
        let queryParts:string[] = [];
        for (let arg of args) {
            if (typeof (arg) === 'string') {
                queryParts.push(arg);
            }
            else {
                for (let bind of arg.binds) {
                    newBinds.push(bind);
                }
                queryParts.push(arg.query);
            }
        }
        return new QueryData(queryParts.join(""), newBinds);
    }

    static joinList(list:QueryData[], seperator:string = ','): QueryData[] {
        let res:QueryData[] = [];
        for (let item of list) {
            res.push(item);
            res.push(new QueryData(seperator, []));
        }
        // remove the last separator
        if (res.length > 0) {
            res.pop();
        }
        return res;
    }
    readonly query: string;
    readonly binds: any[];
    constructor(query: string|null, binds: any[] ) {
        this.query = query === null ? '?' : query;
        this.binds = binds;
    }
}


export interface QueryHelper {
    true(): QueryData;
    false(): QueryData;
    and(x: QueryData, y: QueryData): QueryData;

    concat(values: QueryData[]): QueryData;

    or(x: QueryData, y: QueryData): QueryData;

    not(x: QueryData): QueryData;

    isNull(x: QueryData): QueryData;

    notEquals(x: QueryData, y: QueryData): QueryData;

    equals(x: QueryData, y: QueryData): QueryData;

    startsWith(x: QueryData, y: string): QueryData;

    containsStr(x: QueryData, y: string): QueryData;

    contains(scope:QueryScope, value:Field, list:QueryData[]|Raw, all:boolean):QueryData;

    field(scope: QueryScope, path:[ColumnKey<any>] | [string, ...string[]]): QueryData;

    in(value: QueryData, list: QueryData[]|QueryData): QueryData;

    notIn(value: QueryData, list: QueryData[]|Raw): QueryData;

    exists(value: QueryData, exists: boolean): QueryData;

    lessThanOrEqual(x: QueryData, y: QueryData): QueryData;

    lessThan(x: QueryData, y: QueryData): QueryData;

    greaterThanOrEqual(x: QueryData, y: QueryData): QueryData;

    greaterThan(x: QueryData, y: QueryData): QueryData;

    value(v:BasicType):QueryData
}

export interface QueryExp {
    eval(scope: QueryScope): any;

    /**
     * note this may throw which indicates it is unknown therefore the top level
     * evaluates to true, however since some expressions it needs to be dealt with differently at the top level
     */
    matches(scope: QueryScope): BasicType|undefined|BasicType[];

    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches
     */
    makeLookup(scope: QueryScope): Record<string, any>[]|null;


    /**
     * generates a query for the scope
     */
    query(scope:QueryScope): QueryData;

    serialize(serializer: Serializer): SerializableRecord;
}
export class QueryScope {
    protected map_: Record<string, any>;
    private query_: QueryHelper | undefined;
    private colKeyMap_: Map<ColumnKey<any>, [string, ...string[]]>;


    /**
     * @constructor
     * @param {Object} map
     * @param opt_helper note if you don't provide this query function will not work
     * @param {!Object<string,!Array<string>>=} opt_colKeyMap
     */

    constructor(map: Map<string, any>, opt_helper?: QueryHelper, opt_colKeyMap?: Map<string, string[]>) {
        this.map_ = map;
        this.query_ = opt_helper;
        this.colKeyMap_ = opt_colKeyMap || new Map();
    }

    static stripQuotes_(str:string) {
        if (str.length > 1
            && ((str.startsWith("'") && str.endsWith( "'"))
                || (str.startsWith('\"') && str.endsWith('\"')))) {

            return str.substring(1, str.length - 1);
        }
        return str;
    }


    /**
     * @param {string} exp  expressoin to eval
     * @return {Array<string>}
     */
    static parts(exp:string):string[] {
        let pos = 0;
        let start = 0;
        let quote:boolean|string = false;
        let parts = [];

        while (pos < exp.length) {
            let ch = exp.charAt(pos);
            if (quote && quote === ch) {
                quote = false;
            } else if (quote && ch === '\\') {
                pos = Math.min(pos + 2, exp.length);
                continue;
            } else if (ch === '"' || ch === "'") {
                quote = ch;
            } else if (!quote) {
                if (ch === '.' || ch === '[' || ch === ']') {
                    let str = exp.substring(start, pos);
                    if (str.length > 0) {
                        parts.push(QueryScope.stripQuotes_(str));
                    }
                    start = pos + 1;

                }
            }
            pos++;
        }

        if (start < exp.length) {
            let str = exp.substring(start);
            if (str.length > 0) {
                parts.push(QueryScope.stripQuotes_(str));
            }
        }

        if (parts.length === 0) {
            throw "invalid field '" + exp + "'";
        }

        return parts;
    }

    query(): QueryHelper {
        if (!this.query_) {
            throw new Error('Query Helper was not provided');
        }
        return this.query_;
    }

    /**
     * @param parts indexes to get the object
     */
    resolve(parts:(ColumnKey<any>|string)[]): {field?:string[]} {
        let keyMap = this.colKeyMap_;
        let res:string[] = [];
        for (let i = 0; i < parts.length; i++) {
            let el = parts[i];
            if (el instanceof ColumnKey) {
                let path = keyMap.get(el);
                if (path === undefined) {
                    throw 'unable to find colkey path';
                }
                res = res.concat(path);
            } else {
                res.push(el);
            }
        }
        return {field: res};
    }
    /**
     * @param parts indexes to get the object
     */
    get(parts:[ColumnKey<any>] | [string, ...string[]]) :BasicType|BasicType[]|undefined{

        if (parts.length === 0) {
            return undefined;
        }

        let curScope = this.map_ as any;
        let stringParts: [string, ...string[]];
        if (parts[0] instanceof ColumnKey) {
            let res = this.colKeyMap_.get(parts[0]);
            if (!res) {
                return undefined;
            }
            stringParts = res;
        }
        else {
            stringParts = parts as [string, ...string[]];
        }

        for (let part of stringParts) {
            if (curScope instanceof Object && part in curScope) {
                curScope = curScope[part];
            }
            else {
                return undefined;
            }
        }
        return curScope as BasicType;
    }



    /**
     * @param  parts indexes to get the object
     * @return {boolean}
     */
    exists(parts:string[]|ColumnKey<any>[]):boolean {

        if (parts.length === 0) {
            return false;
        }

        let curScope = this.map_;

        for (let part of parts) {
            if (curScope instanceof Object) {
                let name = part instanceof ColumnKey ? part.getName() : part;
                if (curScope.hasOwnProperty(name)) {
                    curScope = curScope[name];
                }
                else {
                    return false;
                }
            }
            else {
                return false;
            }
        }
        return true;
    }
}

type PathTableNode = {table:null|string, children:Map<ColumnKey<any>|string, PathTableNode>};
export class PathTableMap {
    private root_: PathTableNode;
    private columns_: Map<string|ColumnKey<any>, Set<string>>;

    constructor() {
        this.root_ = {table: null, children: new Map()};
        // this is map that directly maps a column to a table for now
        // this only happens if the caller specifies just 1 column key
        this.columns_ = new Map();
    }

    setTable(path:(string|ColumnKey<any>)[], columns:ColumnKey<any>[], table:string) {
        let cur = this.root_;
        for (let name of path) {

            let child = cur.children.get(name);

            if (!child) {
                child = {table: null, children: new Map()};
                cur.children.set(name, child);
            }
            cur = child;
        }

        cur.table = table;
        for (let c of columns) {
            let tables = this.columns_.get(c) || new Set();
            tables.add(table);
            this.columns_.set(c, tables);
        }

    }

    getTable(path:(string|ColumnKey<any>)[]):string|null {
        let table = this.getTableAlias(path);
        if (table) {
            return table;
        }

        if (path.length === 1) {
            let tMap = this.columns_.get(path[0]);
            if (tMap && tMap.size == 1) {
                return tMap.keys().next().value || null;
            }
        }
        return null;
    };

    /**
     * get the name of the alias that we should use for the table
     * for example select * from bob b, b is the aliaus
     * @param path
     */
    getTableAlias(path:(string|ColumnKey<any>)[]):string|null {

        let cur:PathTableNode|undefined = this.root_;
        for (let i = 0; i < path.length && cur; i++) {
            let name = path[i];
            cur = cur.children.get(name);
        }
        if (cur && cur.table) {
            return cur.table;
        }
        return null;
    }

}
type QueryOptionsColFilter = {all:true, result:boolean, prefix:never}
    | {all?:false, prefix?:string[], result:boolean, substable:boolean};
type OptionsType = {
    count?:boolean,
    sortOrder?:[string, ...string[]],
    rate?:number,
    start?:{page?:number},
    size?:number,
    columnFilters?: [QueryOptionsColFilter, ...QueryOptionsColFilter[]]

};
export class QueryOptions {
    private options_: OptionsType;
    private columnFilter_;
    constructor(opt_options?:OptionsType) {
        this.options_ = opt_options || {};
        this.columnFilter_ = (path:string[], subtable:boolean):boolean => {
            let colFilters = this.options_.columnFilters || [];
            for (let filter of colFilters) {
                if (filter.all) {
                    return filter.result;
                }
                if (filter.prefix) {
                    let match = true;
                    for (let j = 0; match && j < Math.min(path.length, filter.prefix.length); j++) {
                        match = filter.prefix[j] === path[j];
                    }
                    if (match) {
                        return filter.result;
                    }
                }
                if (subtable && filter.hasOwnProperty('subtable')) {
                    return filter.substable;
                }
            }
            return true;
        };
    }
    isCount(): boolean {
        return !!this.options_.count;
    }
    size(): number | undefined {
        return this.options_.size;
    }

    /**
     * @return {?{next:?, page:number}}
     */
    start():{page?:number}|undefined {
        return this.options_.start;
    }


    /**
     * @return {function(!Array<string>,boolean):boolean}
     */
    columnFilter() {
        return this.columnFilter_;
    }

    sortOrder():string[] {
        return this.options_.sortOrder || [];
    }


    /**
     * @return {?}
     */
    serialize(): Serializable {
        return this.options_;
    }

    cleanStart() {
        let options = Object.assign({}, this.options_);

        if (options.start) {
            if (options.start.page !== undefined) {
                options.start = {page: options.start.page};
            }
        }
        return new QueryOptions(options);
    }

    static deserialize(obj: Serializable): QueryOptions {
        if (obj instanceof Object) {
            return new QueryOptions({...obj} as OptionsType);
        }
        return new QueryOptions();
    }
}


/**
 * @interface
 */
export interface Serializer {

    deserializeCol(val:Serializable):ColumnKey<any>;
    serializeCol(col:ColumnKey<any>): Serializable;
    deserializeValue(val: Serializable): any;
    serializeValue(val:any): Serializable;
}

export class In implements QueryExp {
    private field_:QueryExp;
    private list_:QueryExp[]|Raw;

    constructor(field:QueryExp, list:QueryExp[]|Raw) {
        this.field_ = field;
        this.list_ = list;
    };


    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     */
    makeLookup(scope: QueryScope) {
        return [];
    };

    static deserialize(data:SerializableRecord, serializer:Serializer) {
        if (!('field' in data) || !Array.isArray(data.list) || !(data.field instanceof Object)) {
            throw new Error('Invalid Object data');
        }
        return new In(Query.deserializeExp(data.field as SerializableRecord, serializer), data.list.map(
            (v) => {
                if (!(v instanceof Object)) {
                    throw new Error("Invalid Object data");
                }
                return Query.deserializeExp(v as SerializableRecord, serializer);
            }));
    }

    serialize(serializer:Serializer):SerializableRecord {
        if (this.list_ instanceof Raw) {
            throw new Error('Unserializable Query');
        }
        return {
            op: 'in', field: this.field_.serialize(serializer), list: this.list_.map(function (v) {
                return v.serialize(serializer);
            })
        };
    }

    eval(scope: QueryScope) {
        let v = this.field_.eval(scope);
        return In.contains(scope, v, this.list_);

    }

    matches(scope: QueryScope) {
        let v = this.field_.eval(scope);
        if (v === undefined) {
            return undefined;
        }
        return In.contains(scope, v, this.list_, true);
    }

    query(scope: QueryScope): QueryData {
        if (this.list_ instanceof Raw) {
            return scope.query().in(this.field_.query(scope), this.list_.query(scope));
        }
        return scope.query().in(this.field_.query(scope), this.list_.map(function (v) {
            return v.query(scope);
        }));
    }

    static contains(scope:QueryScope, val:BasicType, expList:QueryExp[]|Raw, opt_matches?:boolean):boolean|undefined {
        if (expList instanceof Raw) {
            return undefined;
        }
        for (let i = 0; i < expList.length; i++) {
            let exp = expList[i].eval(scope);
            if (opt_matches && exp === undefined) {
                return undefined;
            }
            if (Equals.isEqual(val, exp)) {
                return true;
            }
        }
        return false;
    }
}

export class NotIn implements QueryExp {
    private field_: QueryExp;
    private list_: QueryExp[]|Raw;
    constructor(field:QueryExp, list: QueryExp[]|Raw) {
        this.field_ = field;
        this.list_ = list;
    }

    eval(scope: QueryScope):BasicType {
        let v = this.field_.eval(scope);
        return ! In.contains(scope, v, this.list_ || []);
    }

    matches(scope: QueryScope):boolean|undefined {
        let v = this.field_.eval(scope);
        if (v === undefined || this.list_ instanceof Raw) {
            return undefined;
        }
        let res = In.contains(scope, v, this.list_ || [], true);
        return res === undefined ? undefined : !res;
    }

    query(scope: QueryScope): QueryData {
        if (this.list_ instanceof Raw) {
            return scope.query().notIn(this.field_.query(scope), this.list_);
        }
        return scope.query().notIn(this.field_.query(scope), this.list_.map(function (v) {
            return v.query(scope);
        }));
    }
    static deserialize(data: SerializableRecord, serializer:Serializer) {

        if (!Array.isArray(data.list) || !(data.field instanceof Object)) {
            throw new Error('Invalid Object data');
        }
        return new NotIn(Query.deserializeExp(data.field as SerializableRecord, serializer), data.list.map(
            (v) => {
                if (!(v instanceof Object)) {
                    throw new Error('Invalid Object data');
                }
                return Query.deserializeExp(v as SerializableRecord, serializer);
            }));
    }

    serialize(serializer:Serializer) {
        let list = Array.isArray(this.list_) ? this.list_.map(v => v.serialize(serializer)) :this.list_.serialize(serializer);
        return {op: '!in', field: this.field_.serialize(serializer), list: list}
    }

    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded

     */

    makeLookup(scope: QueryScope) {
        return [];
    }
}
export class Field implements QueryExp {
    private parts_: [ColumnKey<any>] | [string, ...string[]];
    constructor(name:FieldType) {
        if (typeof name === 'string') {
            this.parts_ = [name];
        }
        else if (Array.isArray(name)) {
            this.parts_ = name;
        }
        else {
            this.parts_ = [name];
        }
        // I know the type stops this but just in case this is constructed from deserialized data I need to check
        if (this.parts_.length === 0) {
            throw "invalid field '" + name + "'";
        }
    }
    toString(): string {
        return '`' + this.parts_.join('.') + '`';
    };

    path():[ColumnKey<any>] | [string, ...string[]] {
        return this.parts_;
    };

    eval(scope: QueryScope) :BasicType | BasicType[] | undefined{
        return scope.get(this.parts_);
    }

    matches(scope: QueryScope):BasicType[]|undefined|BasicType {
        try {
            return scope.get(this.parts_);
        } catch (e) {
            return undefined;
        }
    }

    static deserialize(data: SerializableRecord, serializer:Serializer) {
        if (!Array.isArray(data.parts)) {
            throw Error("Invalid Object data");
        }
        // we can only deserialize to column keys this is for safety, that means the client
        // can't send over random nonsense for columns
        let parts: Serializable[] = data.parts;
        let field:ColumnKey<any> =  serializer.deserializeCol(parts)
        return new Field(field);
    }

    serialize(serializer:Serializer):SerializableRecord {
        return {
            op: 'field', parts: this.parts_.map(
                function (v) {
                    if (typeof (v) === 'string') {
                        return v;
                    }

                    return {path: serializer.serializeCol(v)};

                })
        };
    }
    query(scope: QueryScope): QueryData {
        return scope.query().field(scope, this.parts_);
    };

    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     */
    makeLookup(scope: QueryScope):Record<string, any> [] {
        let res =  this.eval(scope);
        return [res] as Record<string, any> [];
    }
}

/**
 * this is dangerous that is why there is no serialize or unserialize for this function so it can never be created on the server
 * it also cannot be evaluated it jsut returns true
 *
 * it is used on the server to construct queries that the normal mechinisim cannot support
 */
export class Raw implements QueryExp {

    expr_: QueryData;

    constructor(expr: QueryData) {
        this.expr_ = expr;
    }

    eval(_scope: QueryScope) {
        return true; // can't eval this
    }

    /**
     * @return {string}
     */
    toString(): string {
        return 'RAW[' + this.expr_ + ']';
    }

    matches(scope: QueryScope):undefined {
        return undefined;
    }

    static deserialize(data: Serializable, serializer:Serializer) {
        // we can't deserialize this it is a security risk sending arbitary queries to the
        // database bad
        return new Not(new True());
    }

    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     *
     */
    makeLookup(scope: QueryScope) {
        return [];
    }
    serialize(serializer:Serializer): SerializableRecord {
        return {op: 'raw'};
    }

    query(scope: QueryScope): QueryData {
        return this.expr_;
    }
}

/**
 * class that implements a user value, this will bind variables to it
 */

export class Value implements QueryExp {

    private val_: BasicType;

    constructor(val: BasicType) {
        this.val_ = val;
    }


    eval(scope: QueryScope): BasicType {
        return this.val_;
    }

    toString(): string {
        return this.val_ == null ? 'null' : JSON.stringify(this.val_);
    }


    /**
     * @param {recoil.db.QueryScope} scope
     * @return {*}
     */
    matches(_scope: QueryScope) {
        return this.val_;
    };

    /**
     * @param {recoil.db.QueryScope} scope
     * @return {string}
     */
// Value
    query(scope: QueryScope): QueryData {
        return scope.query().value(this.val_);
    }

    /**
     * @param {!recoil.db.Query.Serializer} serializer
     * @return {?}
     */
// Value
    serialize(serializer:Serializer):SerializableRecord {
        return {op: 'value', x: serializer.serializeValue(this.val_)};
    };

    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     */

    makeLookup(scope: QueryScope) {
        let v = (/** @type {recoil.db.expr.Value} */ (this)).eval(scope);
        return [{'': v}];
    }

    static deserialize(data: SerializableRecord, serializer:Serializer) {
        return new Value(serializer.deserializeValue(data.x));
    }
}

export class RegularExp implements QueryExp {
    private field_:QueryExp;
    private pattern_:RegExp;

    /**
     * @param field this can be a dot seperated and use [] to acces arrays or maps
     * @param pattern the pattern to match
     * @param opt_options extra options for matching only used when pattern is a string
     */
    constructor(field:QueryExp, pattern:RegExp);
    constructor(field:QueryExp, pattern:string, opt_options:string);
    constructor(field:QueryExp, pattern:RegExp|string, opt_options?:string) {
        this.field_ = field;

        if (pattern instanceof RegExp) {

            this.pattern_ = pattern;
        } else {
            this.pattern_ = new RegExp(pattern, opt_options);
        }
    }

    toString(): string {
        return 'regex(' + this.field_.toString() + ',' + this.pattern_.toString() + ')';
    }

    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     *
     * @param {!recoil.db.QueryScope} scope
     * @return {?Array<Object<string,?>>}
     */
    makeLookup(scope: QueryScope) {
        return [];
    }

    eval(scope: QueryScope) {
        return this.field_.eval(scope).search(this.pattern_) !== -1;
    }


    /**
     * @param {!recoil.db.Query.Serializer} serializer
     * @return {?}
     */
    serialize(serializer:Serializer):SerializableRecord {
        return {op: 'reg', field: this.field_.serialize(serializer), pat: this.pattern_.source, flags: this.pattern_.flags};
    }

    matches(_scope: QueryScope):undefined {
        return undefined;
    }

    /**
     * @param {?} data
     * @param {!recoil.db.Query.Serializer} serializer
     * @return {!recoil.db.expr.RegExp} ;
     */
    static deserialize(data: Serializable, serializer:Serializer):RegularExp {
        if (!(data instanceof Object) ||!('field' in data) ||!('pat' in data) ||!('flags' in data) || typeof (data.pat) !== 'string'  || typeof (data.flags) !== 'string')  {
            throw new Error('Missing fields');
        }

        return new RegularExp(Query.deserializeExp(data.field as SerializableRecord, serializer), data.pat, data.flags);
    }

    query(scope: QueryScope): QueryData {
        throw 'Not implemented yet';
    }
}


export class Contains implements QueryExp {
    private field_: Field;
    private list_: Value[]|Raw;
    private all_: boolean;

    constructor(field: Field, list: Value[]|Raw, all: boolean) {
        this.field_ = field;
        this.list_ = list;
        this.all_ = all;
    }

    serialize(serializer:Serializer): SerializableRecord {
        return {
            op: 'contains',
            'all': this.all_,
            field: this.field_.serialize(serializer),
            list: this.list_ instanceof Raw ? this.list_.serialize(serializer) : this.list_.map(v => v.serialize(serializer))
        };
    }

    static deserialize(data: SerializableRecord, serializer:Serializer) {
        if (!(data.field instanceof  Object)||  !('list' in data) || !Array.isArray(data.list)) {
            throw new Error('Invalid Object data');
        }

        let field = Query.deserializeExp(data.field as SerializableRecord, serializer);
        if (!(field instanceof Field)) {
            throw new Error('invalid field type');
        }
        return new Contains(field, data.list.map(
            (v:Serializable)=> {
                if (!(v instanceof Object)) {
                    throw new Error('Invalid Object data');
                }
                let res = Query.deserializeExp(v as SerializableRecord, serializer);
                if (!(res instanceof Value)) {
                    throw new Error('Invalid Object data');
                }
                return res;
            }), !!data['all']);
    }

    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     *
     */
    makeLookup(scope: QueryScope):[] {
        return [];
    }

    eval(scope: QueryScope):boolean {
        let values = this.field_.eval(scope) as BasicType[];
        if (!(Array.isArray(this.list_))) {
            return false; // this is a sub query we can't do this
        }
        let lookup = this.list_.map(function (e) {
            return e.eval(scope);
        });
        for (let j = 0; j < lookup.length; j++) {
            let l = lookup[j];
            let found = false;
            for (let i = 0; !found && i < values.length; i++) {

                if (isEqual(values[i], l)) {
                    found = true;
                    if (!this.all_) {
                        return true;
                    }
                }
            }
            if (!found && this.all_) {
                return false;
            }
        }
        return this.all_;

    }

    matches(scope: QueryScope) {
        let values = this.field_.eval(scope);
        if (this.list_ instanceof Raw) {
            return undefined;
        }
        let lookup = this.list_.map(function (e) {
            return e.eval(scope);
        });

        if (!Array.isArray(values)) {
            return  this.all_;
        }
        for (let j = 0; j < lookup.length; j++) {
            let l = lookup[j];
            if (l === undefined) {
                return undefined;
            }
            let found = false;
            for (let i = 0; !found && i < values.length; i++) {
                if (values[i] === undefined) {
                    return undefined;
                }
                if (isEqual(values[i], l)) {
                    found = true;
                    if (!this.all_) {
                        return true;
                    }
                }
            }
            if (!found && this.all_) {
                return false;
            }
        }
        return this.all_;

    };


    /**
     * generates a query for the scope
      */
    query(scope: QueryScope): QueryData {
        if (this.list_ instanceof Raw) {
            return scope.query().contains(scope, this.field_, this.list_, this.all_);

        }
        return scope.query().contains(scope, this.field_, this.list_.map(function (v) {
            return v.query(scope);
        }), this.all_);
    }
}


export type ValueExpOrField = Query|QueryExp|ColumnKey<any>|BasicType;
export type FieldOrValue = Query|string|ColumnKey<any>|string[];
export type ArrayValues = Query|BasicType[]|Query[]|Raw;

export type FieldType = string|[string, ...string[]]|ColumnKey<any>;

export class Query {
    private expr_: null | QueryExp;

    constructor(opt_expr?: QueryExp) {
        this.expr_ = opt_expr || null;
    }
    static binaryDeserializer(cls: new (x: QueryExp, y: QueryExp) => QueryExp) {
        return (data:SerializableRecord, serializer:Serializer):QueryExp => {
            if (data instanceof Object && 'x' in data && 'y' in data) {
                return new cls(Query.deserializeExp((data as any).x, serializer), Query.deserializeExp((data as any).y, serializer));
            }
            throw Error("invalid data");
        }
    }


    static unaryDeserializer(cls:new (x: QueryExp) => QueryExp): (data: SerializableRecord, serialier: Serializer) => QueryExp {
        return (data:SerializableRecord, serializer)=> {
            if ('x' in data && data.x instanceof Object) {
                return new cls(Query.deserializeExp(data.x as SerializableRecord, serializer));
            }
            throw new Error("invalid data");
        }
    }

    static deserialize(data:Serializable, serializer:Serializer) {
        if (!data || !(data instanceof Object) || !( 'op' in data )) {
            throw new Error('Data has no operator ' + JSON.stringify(data));
        }
        let rec = data as SerializableRecord;

        if (typeof(rec.op) !== 'string') {
            throw new Error('Data has no operator ' + JSON.stringify(data));
        }
        let factory = Query.deserializeMap.get( rec.op);

        if (!factory) {
            throw new Error('Unknown Expression Type ' + data.op);
        }

        return new Query(factory(data, serializer));
    }


    /**
     * @param {!recoil.db.QueryScope} scope
     * @return {*}
     */
    query (scope:QueryScope):QueryData {
        if (!this.expr_) {
            throw new Error("no expresssion");
        }
        return this.expr_.query(scope);
    }

    raw(expr:string|QueryData) {
        return expr instanceof  QueryData ? expr :new QueryData(expr, []);
    }

    field$(field:string|ColumnKey<any>) {
        return this.set_(this.field(field));
    }
    /**
     * checks if a field exists in the object
     * nulls and undefined exist
     */
    exists(field:FieldType) {
        return this.query_(new Exists(this.fromField_(field), true));
    }
    /**
     * checks if a field exists in the object, also sets the result to this query
     * nulls and undefined exist
     * @param {string} field
     * @return {!recoil.db.Query}
     */

    exists$(field:string):this {
        return this.set_(this.exists(field));
    }


    /**
     * this is not called equals because that should compare to queries
     */
    eq(left:ValueExpOrField, right:ValueExpOrField) {
        return this.query_(new Equals(this.toExpr(left), this.toExpr(right)));
    }

    static deserializeExp(data:SerializableRecord, serializer:Serializer):QueryExp {
        if (typeof(data.op) !== 'string') {
            throw new Error('No Operation type specified ' + data);
        }
        let factory = Query.deserializeMap.get(data.op);
        if (!factory) {
            throw new Error('Unknown Expression Type ' + data.op);
        }
        return factory(data, serializer);
    }
    /**
     * convert a query or an expression to an expression
     * @param {recoil.db.Query|recoil.db.QueryExp|!recoil.structs.table.ColumnKey|*} exp
     * @return {!recoil.db.QueryExp}
     */
    toExpr (exp:ValueExpOrField):QueryExp {
        if (exp instanceof Query) {
            if (exp.expr_ === null) {
                throw 'unexpected null in expression';
            }
            return exp.expr_;
        }
        if (exp instanceof ColumnKey) {
            return new Field(exp);
        }
        if (exp instanceof String || typeof(exp) === 'string') {
            return new Field(exp.toString());
        }

        if (exp instanceof Object) {
            return /** @type {!recoil.db.QueryExp} */ (exp);
        }

        return new Value(exp);
    }


    /**
     * this needs a special scope that doesn't resolve fields that are in the database
     */
    makeLookup(scope:QueryScope) {
        return this.expr_!.makeLookup(scope);
    };

    toString():string {
        return this.expr_ ? this.expr_.toString() : "null";
    }

    eval(scope:QueryScope) {
        return this.expr_!.eval(scope);
    }


    /**
     * @param {!recoil.db.QueryScope} scope
     * @return {boolean} returns true if there is a possiblity that expression may return true
     */
    mayMatch(scope:QueryScope):boolean {
        let res = this.expr_?.matches(scope);
        if (res === undefined) {
            return true;
        }
        return !!res;
    }

    /**
     * returns a basic object that can stringified and sent over the wire
     */
    serialize(serializer:Serializer) {
        return this.expr_!.serialize(serializer);
    }


    private chain_<T extends QueryExp>(constructor:new (x:QueryExp, y:QueryExp) =>T, args:(Query|QueryExp)[]) {
        if (this.expr_ === null && args.length === 0) {
            throw new Error('Not enough parameters');
        }
        let start = args.length - 2;
        let cur = (args.length > 0 ? this.toExpr(args[args.length - 1]) : this.expr_)!;

        for (let i = start; i >= 0; i--) {
            cur = new constructor(this.toExpr(args[i]), cur);
        }

        if (this.expr_ !== null && args.length > 0) {
            cur = new constructor(this.expr_, cur);
        }
        return new Query(cur);
    }
    /**
     * utilty to function to set this expression to the query
     */
    private set_(query:Query):this {
        this.expr_ = query.expr_;
        return this;
    };

    /**
     * utilty to function to set this expression to the query
     */
    private query_(query:QueryExp):Query {
        return new Query(query);
    }

    and$(var_others: (Query|QueryExp)[]) {
        return this.set_(this.chain_(And, var_others));
    };

    /**
     * ands together all the arguments, and the current query
     * if the curernt query is not null also includes that query
     */
    and(other:(Query|QueryExp), ...rest:(Query|QueryExp)[]) {
        return this.chain_(And, [other, ...rest]);
    }



    /**
     * ands together all the arguments, and the current query
     * if the curernt query is not null also includes that query
     */
    concat(args:(Query|QueryExp|ColumnKey<any>)[]) {
        let me = this;
        return this.query_(new Concat(args.map(function(v) {return me.toExpr(v);})));
    }

    /**
     * ors together all the arguments, and the current query
     * if the curernt query is not null also includes that query
     */
    or(other:(Query|QueryExp), ...rest:(Query|QueryExp)[]) {
        return this.chain_(Or, [other, ...rest]);
    };

    /**
     * ors together all the arguments, and the current query
     * if the curernt query is not null also includes that query
     */

    or$(other:(Query|QueryExp), ...rest:(Query|QueryExp)[]):this {
        return this.set_(this.chain_(Or, [other, ...rest]));
    }

    not(opt_x?:Query|QueryExp|ColumnKey<any>|string) {
        let x;
        if (opt_x === undefined) {
            x = this.expr_;
        }
        else  {
            x = opt_x;
        }

        return this.query_(new Not(this.toExpr(x)));
    }

    not$(opt_x?:Query|QueryExp|ColumnKey<any>|string) {
        return this.set_(this.not(opt_x));
    }

    True():Query {
        return this.query_(new True());
    }

    False():Query {
        return this.query_(new False());
    }

    True$():this {
        return this.set_(this.True());
    }

    val(val:BasicType) {
        return this.query_(new Value(val));
    }

    field(field:FieldType):Query {
        return this.query_(new Field(field));
    }

    /**
     * this is not called equals because that should compare to queries
     */
    null(op:Query|QueryExp|ColumnKey<any>):Query {
        return this.query_(new IsNull(this.toExpr(op)));
    }
    startsWith(left:ValueExpOrField, match:string):Query {
        return this.query_(new StartsWith(this.toExpr(left), match));
    }
    containsStr(left:ValueExpOrField, match:string):Query {
        return this.query_(new ContainsStr(this.toExpr(left), match));
    }
    containsAll(field:QueryExp|Query|ColumnKey<any>|string, values:Query|BasicType[]|Query[]|Raw):Query {
        return this.query_(new Contains(this.toField(field), this.fromArray_(values), true));
    }

    /**
     * @param field
     * @param values non query values are assumed to be values
     */
    containsAny(field:QueryExp|Query|ColumnKey<any>|string, values:Query|BasicType[]|Query[]|Raw) {
        return this.query_(new Contains(this.toField(field), this.fromArray_(values), false));
    }

    eq$(left:ValueExpOrField, right:ValueExpOrField) {
        return this.set_(this.eq(left, right));
    }

    neq(left:ValueExpOrField, right:ValueExpOrField) {
        return this.query_(new NotEquals(this.toExpr(left), this.toExpr(right)));
    };
    /**
     * nulls and undefined exist
     */

    neq$(left:ValueExpOrField, right:ValueExpOrField):this {
        return this.set_(this.neq(left, right));
    }

    lt(left:ValueExpOrField, right:ValueExpOrField):Query {
        return this.query_(new LessThan(this.toExpr(left), this.toExpr(right)));
    }
    lt$(left:ValueExpOrField, right:ValueExpOrField) {
        return this.set_(this.lt(left, right));
    }

    lte(left:ValueExpOrField, right:ValueExpOrField):Query {
        return this.query_(new LessThanOrEquals(this.toExpr(left), this.toExpr(right)));
    }

    lte$(left:ValueExpOrField, right:ValueExpOrField):this {
        return this.set_(this.lte(left, right));
    }

    gt(left:ValueExpOrField, right:ValueExpOrField):Query {
        return this.query_(new GreaterThan(this.toExpr(left), this.toExpr(right)));
    }

    gt$(left:ValueExpOrField, right:ValueExpOrField):this {
        return this.set_(this.gt(left, right));
    }

    gte(left:ValueExpOrField, right:ValueExpOrField) {
        return this.query_(new GreaterThanOrEquals(this.toExpr(left), this.toExpr(right)));
    }
    gte$(left:ValueExpOrField, right:ValueExpOrField) {
        return this.set_(this.gte(left, right));
    }

    /**
     * checks if a field does not exists in the object
     * nulls and undefined exist
     */
    notExists(field:FieldType):Query {
        return this.query_(new Exists(this.fromField_(field), false));
    };
    /**
     * checks if a field does not exist in the object, also sets the result to this query
     * nulls and undefined exist
     */

    notExists$(field:FieldType) {
        return this.set_(this.notExists(field));
    }

    regex(field:FieldType, pattern:RegExp):Query;
    regex(field:FieldType, pattern:string, opt_options:string):Query;
    regex(field:FieldType, pattern:string|RegExp, opt_options?:string):Query {
        if (pattern instanceof RegExp) {
            return this.query_(new RegularExp(this.fromFieldOrValue_(field), pattern));
        }
        else {
            return this.query_(new RegularExp(this.fromFieldOrValue_(field), pattern, opt_options!));
        }
    }
    regex$(field:FieldType, pattern:RegExp):this;
    regex$(field:FieldType, pattern:string, opt_options:string):this;
    regex$(field:FieldType, pattern:string|RegExp, opt_options?:string):this {
        if (pattern instanceof RegExp) {
            return this.set_(this.regex(field, pattern));
        } else {
            return this.set_(this.regex(field, pattern, opt_options!));
        }
    }

    private fromField_(field:FieldType|Query) {
        if (typeof (field) === 'string' || Array.isArray(field)|| field instanceof ColumnKey) {
            return new Field(field);
        }
        if (field.expr_ === null) {
            throw 'unexpected null in expression';
        }
        if (!(field.expr_ instanceof Field)) {
            throw 'field expected';
        }
        return field.expr_;
    }

    private fromFieldOrValue_(field:FieldOrValue):QueryExp {
        if (typeof (field) === 'string' || field instanceof Array || field instanceof ColumnKey) {
            return new Field(field as any);
        }
        if (field.expr_ === null) {
            throw new Error('unexpected null in expression');
        }
        return field.expr_;
    }

    private fromArray_(values:ArrayValues):Raw|Value[] {
        if (values instanceof Query) {
            if (values.expr_ instanceof Raw) {
                return values.expr_;
            }
            throw new Error('Invalid Query');
        }
        if (values instanceof Raw) {
            return values;
        }
        return values.map(function(value) {
            if (value instanceof Query) {
                if (!(value.expr_ instanceof Value)) {
                    throw 'unexpected value in expression';
                }
                return value.expr_ ;
            }
            return new Value(value);
        });
    };


    /**
     * @param value string is assumed to be a value
     * @param values non query values are assumed to be values
     */
    isIn(value:FieldOrValue, values:ArrayValues) {
        return this.query_(new In(this.fromFieldOrValue_(value), this.fromArray_(values)));
    }
    /**
     * function with $ after replace self
     * @param field string is assumed to be a field
     * @param values non query values are assumed to be values
     */

    isIn$(field:FieldOrValue, values:ArrayValues) {
        return this.set_(this.isIn(field, values));
    }

    /**
     * @param field string is assumed to be a field
     * @param values non query values are assumed to be values
     */
    notIn(field:FieldOrValue, values:ArrayValues) {
        return this.query_(new NotIn(this.fromFieldOrValue_(field), this.fromArray_(values)));
    }
    /**
     * @param field string is assumed to be a field
     * @param values non query values are assumed to be values
     */

    notIn$(field:FieldOrValue, values:ArrayValues) {
        return this.set_(this.notIn(field, values));
    }

    /**
     * @param {recoil.db.Query|recoil.db.QueryExp|!recoil.structs.table.ColumnKey|*} exp
     * @return {!recoil.db.expr.Field}
     */
    toField (exp:QueryExp|Query|ColumnKey<any>|string) {
        if (exp instanceof Query) {
            if (exp.expr_ === null) {
                throw new Error('unexpected null in expression');
            }
            exp = exp.expr_;
        }
        if (exp instanceof Field) {
            return exp;
        }
        if (exp instanceof ColumnKey) {
            return new Field(exp);
        }
        if (exp instanceof String) {
            return new Field(exp.toString());
        }
        if (typeof(exp) === 'string') {
            return new Field(exp.toString());
        }
        throw new Error('unexpected type');
    };

    static readonly deserializeMap = new Map<string, (data:SerializableRecord, serializer:Serializer)=>QueryExp>([
        ['null', Query.unaryDeserializer(IsNull)],
        ['!', Query.unaryDeserializer(Not)],
        ['&', Query.binaryDeserializer(And)],
        ['|', Query.binaryDeserializer(Or)],
        ['=', Query.binaryDeserializer(Equals)],
        ['<>', Query.binaryDeserializer(NotEquals)],
        ['>', Query.binaryDeserializer(GreaterThan)],
        ['<', Query.binaryDeserializer(LessThan)],
        ['<=', Query.binaryDeserializer(LessThanOrEquals)],
        ['>=', Query.binaryDeserializer(GreaterThanOrEquals)],
        ['concat', Concat.deserialize],
        ['startsWith', StartsWith.deserialize],
        ['containsStr', ContainsStr.deserialize],
        ['contains', Contains.deserialize],
        ['in', In.deserialize],
        ['!in', NotIn.deserialize],
        ['reg', RegularExp.deserialize],
        ['value', Value.deserialize],
        ['field', Field.deserialize],
        ['?', Exists.deserialize],
        ['raw', Raw.deserialize],
        ['true', () => new True()]]);
}


