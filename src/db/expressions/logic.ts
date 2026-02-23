import {BinaryQueryExp} from "./binaryexp.ts";
import {QueryData, QueryExp, QueryScope, Serializer} from "../query.ts";
import {BasicType, Serializable, SerializableRecord} from "../../util/serializable.ts";

export class And extends BinaryQueryExp {
    constructor(x:QueryExp, y:QueryExp) {
        super(x, y, '&', (x, y) => x && y)
        this.x_ = x;
        this.y_ = y;
    }

    /**
     * @return {string}
     */
    toString():string {
        return '(' + this.x_.toString() + ' and ' + this.y_.toString() + ')';
    }

    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     *
     * @param {!recoil.db.QueryScope} scope
     * @return {?Array<Object<string,?>>}
     */
    makeLookup(scope:QueryScope):Record<string, any>[]|null {
        let x = this.x_.makeLookup(scope);
        let y = this.y_.makeLookup(scope);

        if (x === null || y === null) {
            return null;
        }
        if (x.length === 0) {
            return y;
        }
        if (y.length === 0) {
            return x;
        }
        let res = [];
        for (let i = 0; i < x.length; i++) {
            let out = {...x[i]};
            for (let j = 0; j < y.length; j++) {
                for (let yPath in y[i]) {
                    let yVal = y[i][yPath];
                    let xVal = x[i][yPath];
                    if (xVal === undefined) {
                        out[yPath] = yVal;
                    } else if (xVal != yVal) {
                        return null;
                    }
                }
            }
            if (out !== null) {
                res.push(out);
            }
        }

        return res;
    }

    matches(scope:QueryScope): BasicType|undefined|BasicType[] {
        let resx = this.x_.matches(scope);
        if (resx === undefined || resx === false) {
            return resx;
        }
        return this.y_.matches(scope);
    }

    query(scope:QueryScope):QueryData {
        return scope.query().and(this.x_.query(scope), this.y_.query(scope));
    }
}


export class Not implements QueryExp {
    private x_: QueryExp;

    constructor(x:QueryExp) {
        this.x_ = x;
    }

    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     *
     */
    makeLookup(scope: QueryScope):[]|null {

        let x = this.x_.makeLookup(scope);

        if (x === null) {
            return [];
        }
        if (x.length === 0) {
            return null;
        }
        return [];
    }

    /**
     * @return {string}
     */
    toString(): string {
        return '(not ' + this.x_.toString() + ')';
    }

    eval(scope: QueryScope) {
        return !this.x_.eval(scope);
    }


    matches(scope: QueryScope) {
        let res = this.x_.matches(scope);
        return res === undefined ? res : !res;
    }


    query(scope: QueryScope): QueryData {
        return scope.query().not(this.x_.query(scope));
    }

    serialize(serializer:Serializer): any {
        return {op: '!', x: this.x_.serialize(serializer)};
    }
}


export class Or extends BinaryQueryExp {
    constructor(x: QueryExp, y: QueryExp) {
        super(x, y, '|', (x, y) => x || y);
    }

    eval(scope: QueryScope) {
        return this.x_.eval(scope) || this.y_.eval(scope);
    }

    toString(): string {
        return '(' + this.x_.toString() + ' or ' + this.y_.toString() + ')';
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
        let x = this.x_.makeLookup(scope);
        let y = this.y_.makeLookup(scope);

        if (x === null && y === null) {
            return null;
        }
        if (x === null) {
            return y;
        }
        if (y === null) {
            return x;
        }
        return x.concat(y);
    }

    matches(scope: QueryScope) {
        let resx = this.x_.matches(scope);
        if (resx && resx !== undefined) {
            return true;
        }
        let resy = this.y_.matches(scope);
        if (resy !== undefined) {
            return !!resy;
        }

        return undefined;
    };


    query(scope: QueryScope): QueryData {
        return scope.query().or(this.x_.query(scope), this.y_.query(scope));
    }

}

export class True implements QueryExp {
    constructor() {
    }

    eval(scope: QueryScope) {
        return true;
    }
    matches(scope: QueryScope):boolean {
        return true;
    }

    toString(): string {
        return 'true';
    }

    query(scope: QueryScope): QueryData {
        return scope.query().true();
    }

    serialize(_serializer:Serializer): SerializableRecord {
        return {op: 'true'};
    }

    static deserialize(_data: Serializable, _serializer:Serializer) {
        return new True();
    }


    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     *
     * @param {!recoil.db.QueryScope} scope
     * @return {?Array<Object<string,?>>}
     */
    makeLookup(_scope: QueryScope) {
        return [];
    }
}

export class False implements QueryExp {
    constructor() {
    }

    eval(scope: QueryScope) {
        return true;
    }
    matches(scope: QueryScope):boolean {
        return true;
    }

    toString(): string {
        return 'false';
    }

    query(scope: QueryScope): QueryData {
        return scope.query().false();
    }

    serialize(_serializer:Serializer): SerializableRecord {
        return {op: 'false'};
    }

    static deserialize(_data: Serializable, _serializer:Serializer) {
        return new False();
    }


    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     *
     * @param {!recoil.db.QueryScope} scope
     * @return {?Array<Object<string,?>>}
     */
    makeLookup(_scope: QueryScope) {
        return [];
    }
}
