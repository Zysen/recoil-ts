import {Query, QueryData, QueryExp, QueryScope, Serializer} from "../query.ts";
import {BasicType, Serializable, SerializableRecord} from "../../util/serializable.ts";

export class ContainsStr implements QueryExp {
    private x_: QueryExp;
    private y_:string;

    constructor(x:QueryExp, y:string) {
        this.x_ = x;
        this.y_ = y;
    }

    eval(scope: QueryScope) {
        return (this.x_.eval(scope) + '').toLowerCase().indexOf((this.y_ + '').toLowerCase()) !== -1;
    }

    matches(scope: QueryScope):boolean|undefined {
        let val = this.x_.eval(scope);
        if (val === undefined) {
            return undefined;
        }
        return (val + '').toLowerCase().indexOf((this.y_ + '').toLowerCase()) !== -1;
    }

    query(scope: QueryScope): QueryData {
        return scope.query().containsStr(this.x_.query(scope), this.y_);
    }

    serialize(serializer:Serializer) {
        return {op: 'containsStr', x: this.x_.serialize(serializer), y: this.y_};
    };

    static deserialize(data:SerializableRecord, serializer:Serializer):ContainsStr {
        if (!('x' in data) || !('y' in data) || !(data.x instanceof Object)) {
            throw new Error('Invalid Object data');
        }
        return new ContainsStr(Query.deserializeExp(data.x as SerializableRecord, serializer), data.y + '');
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

export class StartsWith implements QueryExp {
    private x_: QueryExp;
    private y_: string;

    constructor(x: QueryExp, y: string) {
        this.x_ = x;
        this.y_ = y;
    }

    eval(scope: QueryScope) {
        return (this.x_.eval(scope) + '').toLowerCase().indexOf((this.y_ + '').toLowerCase()) === 0;
    }

    toString(): string {
        return '(' + this.x_.toString() + ' StartsWith ' + JSON.stringify(this.y_) + ')';
    }

    matches(scope: QueryScope): boolean | undefined {
        let resx = this.x_.eval(scope);
        if (resx === undefined) {
            return undefined;
        }

        return (resx + '').toLowerCase().indexOf((this.y_ + '').toLowerCase()) === 0;
    }

    query(scope: QueryScope): QueryData {
        return scope.query().startsWith(this.x_.query(scope), this.y_);
    }


    serialize(serializer:Serializer):SerializableRecord {
        return {op: 'startsWith', x: this.x_.serialize(serializer), y: this.y_};
    }

    static deserialize(data:Serializable, serializer:Serializer):StartsWith {
        if (!data || !(data instanceof Object) ||  !('x' in data) || !('y' in data)) {
            throw new Error('Invalid Object data');
        }
        return new StartsWith(Query.deserializeExp(data.x as SerializableRecord, serializer), data.y + '');
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

export class Concat implements QueryExp {
    private args_:QueryExp[];

    constructor(args:QueryExp[]) {
        this.args_ = args;
    }


    /**
     * returns an array of things to check to see if this matches
     * if null is return nothing can match, if empty list is return every thing
     * matches, items in array are ored, items in map are anded
     *
     */
    makeLookup(scope:QueryScope) {
        return [];
    }

    static deserialize(data:Serializable, serializer:Serializer):Concat {
        if (!data || !(data instanceof Object) ||  !('args' in data) || !Array.isArray(data.args)) {
            throw new Error('Invalid Object data');
        }
        return new Concat(data.args.map((v)=> {
            return Query.deserializeExp(v as SerializableRecord, serializer);
        }));
    }

    eval(scope:QueryScope):BasicType {
        return this.args_.map(function (v) {
            return v.eval(scope);
        }).join('');
    }
    query(scope:QueryScope):QueryData {

        return scope.query().concat(this.args_.map(function (v) {
            return v.query(scope);
        }));
    }


    /**
     * @param {!recoil.db.QueryScope} scope
     * @suppress {checkTypes}
     * @return {?}
     */
    matches(scope:QueryScope):BasicType {
        return this.eval(scope);
    }

    serialize(serializer:Serializer) {
        return {
            op: 'concat', args: this.args_.map(function (v) {
                return v.serialize(serializer);
            })
        };
    }

    /**
     * @return {string}
     */
    toString():string {
        return 'concat(' + this.args_.map(function (c) {
            return c.toString();
        }).join(',') + ')';
    }
}
