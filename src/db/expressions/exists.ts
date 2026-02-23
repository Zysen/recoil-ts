import {SerializableRecord} from "../../util/serializable.ts";
import {Field, Query, QueryData, QueryExp, QueryScope, Serializer} from "../query.ts";

export class Exists implements QueryExp {
    private val_:Field;
    private exists_:boolean;

    constructor(field:Field, exists:boolean) {
        this.val_ = field;
        this.exists_ = exists;
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

    eval(scope: QueryScope): boolean {
        if (this.val_.path instanceof Function) {
            let path = this.val_.path();
            return scope.exists(path) === this.exists_;
        }
        throw 'exists must have field to be evaluated';
    };

    query(scope: QueryScope): QueryData {
        return scope.query().exists(this.val_.query(scope), this.exists_);
    }

    toString(): string {
        return '(' + (this.exists_ ? '' : 'NOT') + 'EXISTS ' + this.val_.toString() + ')';
    }

    matches(scope: QueryScope): boolean | undefined {
        try {
            return this.eval(scope);
        } catch (e) {
            return undefined;
        }
    }
    serialize(serializer:Serializer):SerializableRecord {
        return {op: '?', x: this.val_.serialize(serializer), exists: this.exists_};
    }

    static deserialize(data: SerializableRecord, serializer:Serializer):Exists {
        if (!Array.isArray(data.parts) || !(data.x instanceof Object)) {
            throw Error("Invalid Object data");
        }
        let x = Query.deserializeExp(data.x as SerializableRecord, serializer);

        if (!(x instanceof Field)) {
            throw Error("Invalid Object data");
        }
        return new Exists(x, !!data.exists);
    }

}
