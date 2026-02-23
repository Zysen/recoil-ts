import {BinaryQueryExp} from "./binaryexp.ts";
import {QueryData, QueryExp, QueryScope, Serializer} from "../query.ts";
import {SerializableRecord} from "../../util/serializable.ts";
import {firstKey} from "../../util/object.ts";

export class LessThan extends BinaryQueryExp {
    constructor(x: QueryExp, y: QueryExp) {
        super(x, y, '<', (x, y) => x < y);
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

    /**
     * @param {!recoil.db.QueryScope} scope
     * @return {string}
     */
    query(scope: QueryScope): QueryData {
        return scope.query().lessThan(this.x_.query(scope), this.y_.query(scope));
    }
}

export class GreaterThanOrEquals extends BinaryQueryExp {
    constructor(x: QueryExp, y: QueryExp) {
        super(x, y, '>=', (x, y) => x >= y);
    }

    query(scope: QueryScope): QueryData {
        return scope.query().greaterThanOrEqual(this.x_.query(scope), this.y_.query(scope));
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
}
export class GreaterThan extends BinaryQueryExp {
    constructor(x: QueryExp, y: QueryExp) {
        super(x, y, '>', (x:any,y:any) => x > y);
    }

    serialize(serializer:Serializer): SerializableRecord {
        return {op: '>', x: this.x_.serialize(serializer), y: this.y_.serialize(serializer)};
    }



    query(scope: QueryScope): QueryData {
        return scope.query().greaterThan(this.x_.query(scope), this.y_.query(scope));
    }


    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     */
    makeLookup(scope: QueryScope):[] {
        return [];
    }
}



export class LessThanOrEquals extends BinaryQueryExp {
    constructor(x: QueryExp, y: QueryExp) {
        super(x, y, '<=', (x, y) => x <= y);
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
    query(scope: QueryScope): QueryData {
        return scope.query().lessThanOrEqual(this.x_.query(scope), this.y_.query(scope));
    }

}

export class NotEquals extends BinaryQueryExp {
    constructor(x:QueryExp, y:QueryExp) {
        super(x, y, '<>', (x,y) => !Equals.isEqual(x,y));
    };

    toString(): string {
        return this.x_.toString() + ' != ' + this.y_.toString();
    }

    query(scope: QueryScope): QueryData {
        return scope.query().notEquals(this.x_.query(scope), this.y_.query(scope));
    }

    serialize(serializer:Serializer): SerializableRecord {
        return {op: '!=', x: this.x_.serialize(serializer), y: this.y_.serialize(serializer)};
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
}

export class IsNull implements QueryExp {
    private x_: QueryExp;

    constructor(x: QueryExp) {
        this.x_ = x;
    }

    /**
     * @param {!recoil.db.QueryScope} scope
     * @return {*}
     */
    eval(scope: QueryScope): boolean {
        return this.x_.eval(scope) === null;
    }


    /**
     * @param {!recoil.db.QueryScope} scope
     * @return {*}
     */
    matches(scope: QueryScope) {
        let res = this.x_.eval(scope);

        if (res === undefined) {
            return undefined;
        }
        return res == null;
    }

    query(scope: QueryScope): QueryData {
        return scope.query().isNull(this.x_.query(scope));
    }

    toString(): string {
        return this.x_.toString() + ' IS NULL';
    }

    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     *
     * @return {?Array<Object<string,?>>}
     */
    makeLookup(scope: QueryScope) {
        let res = this.x_.makeLookup(scope);
        // set all values to null
        return res === null ? null : res.map(function (x) {
            for (let k in x) {
                x[k] = null;
            }
            return x;

        });
    }

    /**
     * @param {!recoil.db.Query.Serializer} serializer
     * @return {?}
     */
    serialize(serializer:Serializer) {
        return {op: 'null', x: this.x_.serialize(serializer)};
    }
}

export class Equals extends BinaryQueryExp{
    constructor(x:QueryExp, y:QueryExp) {
        super(x, y, '=', (x,y) => Equals.isEqual(x,y));
    }
    toString(): string {
        return this.x_.toString() + ' = ' + this.y_.toString();
    }

    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     *
     */
    makeLookup(scope: QueryScope):Record<string,any>[]|null {
        let resx = this.x_.makeLookup(scope);
        let resy = this.y_.makeLookup(scope);

        if (resx === null || resy === null) {
            return null;
        }
        if (resx.length === 0 || resy.length === 0) {
            return [];
        }

        if (isField_(resx) && isField_(resy)) {
            return [];
        }

        if (isValue_(resx) && isValue_(resy)) {
            return [];
        }

        function makeMap(path:string, value:any):Record<string,any> {
            let res:Record<string, any> = {};
            res[path] = value;
            return res;
        }

        if (isField_(resx) && isValue_(resy)) {
            return [makeMap(firstKey(resx[0]), resy[0][''])];
        }
        if (isField_(resy) && isValue_(resx)) {
            return [makeMap(firstKey([0]), resx[0][''])];
        }
        return [];
    }

    matches(scope: QueryScope):boolean|undefined {
        let resx = this.x_.eval(scope);
        let resy = this.y_.eval(scope);
        if (resx === undefined || resy === undefined) {
            return undefined;
        }

        return Equals.isEqual(resx, resy);
    }

    /**
     * @param {?} x
     * @param {?} y
     * @return {boolean}
     */
    static isEqual(x:any, y:any) {
        if (x === y) {
            return true;
        }
        let typex = typeof (x);
        let typey = typeof (y);

        if (typex !== typey && ((typex === 'bigint' && typey === 'number') || (typey === 'bigint' && typex === 'number'))) {
            return x == y;
        }
        return false;
    }

    query(scope: QueryScope): QueryData {
        return scope.query().equals(this.x_.query(scope), this.y_.query(scope));
    }


    serialize(serializer:Serializer):SerializableRecord {
        return {op: '=', x: this.x_.serialize(serializer), y: this.y_.serialize(serializer)};
    }
}

/**
 * @const
 */
const FIELD = Symbol("Field");
/**
 * used by makeLookup to check if the result is a field
 * @private
 * @param {?Array<Object<string,?>>} v
 * @return {boolean}
 */
function isField_(v:Record<string, any>[]|undefined) {
    if (!v || v.length !== 1) {
        return false;
    }
    let c = 0;
    for (let k in v[0]) {
        if (c > 0) {
            return false;
        }
        if (v[0][k] !== FIELD) {
            return false;
        }
    }
    return true;
}

/**
 * used by makeLookup to check if the result is a field
 * @private
 * @param {?Array<Object<string,?>>} v
 * @return {boolean}
 */
function isValue_(v:Record<string, any>[]|undefined) {
    if (!v || v.length !== 1) {
        return false;
    }
    for (let k in v[0]) {
        if (k !== '') {
            return false;
        }
    }
    return true;
}
