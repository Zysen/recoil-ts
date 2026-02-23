import {BasicType, Serializable, SerializableRecord} from "../../util/serializable.ts";
import {QueryData, QueryExp, QueryScope, Serializer} from "../query.ts";

export abstract class BinaryQueryExp implements QueryExp {
    protected x_: QueryExp;
    protected y_: QueryExp;
    protected sym_: string;
    protected eval_: (x:any, y:any) => any;

    constructor(x:QueryExp, y:QueryExp, sym: string, ev: (x:any, y:any) => any) {
        this.x_ = x;
        this.y_ = y;
        this.sym_ = sym;
        this.eval_ = ev;
    }

    eval(scope: QueryScope):any {
        return this.eval_(this.x_.eval(scope), this.y_.eval(scope));
    }
    matches(scope: QueryScope):  BasicType|undefined|BasicType[]  {
        let resx = this.x_.eval(scope);
        let resy = this.y_.eval(scope);
        if (resx === undefined || resy === undefined) {
            return resy === undefined;
        }
        return this.eval_(resx, resy);

    }
    abstract makeLookup(scope: QueryScope): Record<string, any>[]|null;
    abstract query(scope: QueryScope): QueryData;

    serialize(serializer: Serializer): SerializableRecord {
        return {op: this.sym_, x: this.x_.serialize(serializer), y: this.y_.serialize(serializer)};
    }
}
