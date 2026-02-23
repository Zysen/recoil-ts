import Sequence from "../../util/sequence.ts";
import {MutableTableRow, TableRow, type WrapInColumnKey} from "./table.ts";
import { compare } from "../../util/object.ts";

export class ColumnKey<Type> {
    private static nextId_ = new Sequence();

    private readonly name_:string;
    private readonly comparator_:(x:Type,y:Type)=>number;
    private readonly castTo_:(v: any)=> Type;
    private hasDefault_:boolean;
    private readonly default_?:Type;
    private defaultFunc_?:() => Type;
    private readonly id_:bigint;


    /**
     * @param name
     * @param opt_comparator used for key values only needed if > < = do not work and it is a primary key
     * @param opt_castTo
     * @param opt_default
     * @param opt_defaultFunc
     */
    constructor(name:string, opt_comparator?:(x:Type,y:Type)=>number, opt_castTo?:(v: any)=> Type, opt_default?:Type, opt_defaultFunc?: () => Type) {
        this.name_ = name;
        this.comparator_ = opt_comparator || ColumnKey.defaultComparator_;
        this.castTo_ = opt_castTo || function (x) {
            return x;
        };
        this.hasDefault_ = arguments.length > 3;
        this.default_ = opt_default;
        this.defaultFunc_ = opt_defaultFunc;
        this.id_ = ColumnKey.nextId_.nextLong();
    }

    static createUnique(name: string): ColumnKey<string> {
        let seq = new Sequence();
        return new ColumnKey<string>(name, undefined, undefined, '', () => seq.next());
    }

    /**
     * this function can be used to make 2 primary keys have
     * the same default function, this can be useful if you want
     * to have primary keys to be unique between accross to keys
     *
     * note this should really be called only once and before the column is
     * used to generate any primary keys
     *
     */
    setSameDefaultFunc(otherKey: ColumnKey<Type>) {
        if (this.defaultFunc_ instanceof Function) {
            otherKey.defaultFunc_ = this.defaultFunc_;
            otherKey.hasDefault_ = true;
            return;
        }
        throw new Error(this + ' does not have a default function');
    }

    /**
     * @return {T}
     */
    getDefault():Type {
        if (this.defaultFunc_ instanceof Function) {
            return this.defaultFunc_();
        }
        return this.default_ as Type;
    }

    clone():this {
        return this;
    }

    hasDefault():boolean {
        return this.hasDefault_;
    }

    /**
     * given the primary keys converts keys into a table, if there is more than
     * 1 primary key this requires keys to be an array
     */
    static normalizeColumns(primaryKeys:ColumnKey<any>[], keys:any[], opt_order?:number):TableRow {
        let res = new MutableTableRow(opt_order);

        if (primaryKeys.length !== keys.length) {
            throw 'incorrect number of primary keys';
        } else {
            for (let i = 0; i < primaryKeys.length; i++) {
                res.set(primaryKeys[i], primaryKeys[i].castTo(keys[i]));
            }
        }
        return res.freeze();
    }

    /**
     * @private
     * @param {*} a
     * @param {*} b
     * @return {number}
     */
    private static defaultComparator_(a: any, b: any): number {
        if (a === b) {
            return 0;
        }
        if (a === null) {
            return -1;
        }
        if (b === null) {
            return 1;
        }
        if (a === undefined) {
            return -1;
        }
        if (b === undefined) {
            return 1;
        }

        if (typeof (a) !== typeof (b)) {
            return typeof (a) < typeof (b) ? -1 : 1;
        }
        if (a < b) {
            return -1;
        }
        if (b < a) {
            return 1;
        }
        return 0;
    }

    /**
     * A default column key if none is provided they will be added sequentially
     */
    static INDEX =
        new ColumnKey<bigint>(
            'index', undefined,
            (x:number|string|bigint):bigint => BigInt(x));

    /**
     * A default column that is used to store meta information for the row
     */
    static ROW_META = new ColumnKey<undefined>('meta', undefined, undefined);


    /**
     * compares to values for column
     */
    valCompare(a: Type, b: Type): number {
        return this.comparator_(a, b);
    }

    /**
     * compares to values for column
     */
    compare(a: Type): number | undefined {
        if (a instanceof CombinedColumnKey) {
            let res = a.compare(this);
            return res == undefined ? undefined : -res;
        }
        if (a instanceof ColumnKey) {
            let res = this.id_ - a.id_;
            return res == 0n ? 0 : (res < 0 ? -1 : 1);
        }
        return undefined;
    }

    equals(y: any): boolean {
        return this.compare(y) === 0;
    }

    getId(): string {
        return this.toString();
    }

    toString(): string {
        return this.name_ === undefined ? this.id_.toString() : this.name_ + ':' + this.id_;

    }


    castTo(a: any): Type {
        return this.castTo_(a);
    }

    getName(): string {
        return this.name_ === undefined ? ('ID(' + this.id_ + ')') : this.name_;
    }


    static comparator(a: ColumnKey<any>, b: ColumnKey<any>): number {
        if (a.id_ < b.id_) {
            return -1;
        }
        if (a.id_ > b.id_) {
            return 1;
        }
        return 0;
    }
}

export class CombinedColumnKey<Type extends any[]> extends ColumnKey<Type> {
    private subKeys_: WrapInColumnKey<Type>;

    constructor(columnKeys: WrapInColumnKey<Type>) {
        super(columnKeys.map((c:ColumnKey<any>) => {
            return c.getName();
        }).join(','))
        this.subKeys_ = columnKeys;
    }


    /**
     * not implemented for combined keys set the column keys to be the same
     */
    setSameDefaultFunc(otherKey: ColumnKey<Type>) {
        throw new Error('not supported fro combined keys');
    }

    getDefault(): Type {
        return this.subKeys_.map((c: ColumnKey<any>): any => {
            return c.getDefault();
        }) as Type;
    }

    clone(): this {
        return this;
    }

    hasDefault(): boolean {
        return this.subKeys_.reduce((acc: boolean, v: ColumnKey<any>) => {
            return acc && v.hasDefault();
        }, true);
    }


    /**
     * compares to values for column
     * @param {T} a
     * @param {T} b
     * @return {number}
     */
    valCompare<T>(a: T, b: T): number {
        if (a instanceof Array && b instanceof Array) {
            if (a.length === this.subKeys_.length && b.length === this.subKeys_.length) {
                for (let i = 0; i < this.subKeys_.length; i++) {
                    let res = this.subKeys_[i].valCompare(a[i], b[i]);
                    if (res !== 0) {
                        return res;
                    }
                }
                return 0;
            }
        }
        return compare(a, b);
    }

    compare(a: any) {
        if (a instanceof CombinedColumnKey) {
            let res = this.subKeys_.length - a.subKeys_.length;
            if (res !== 0) {
                return res;
            }
            for (let i = 0; i < this.subKeys_.length; i++) {
                res = this.subKeys_[i].compare(a.subKeys_[i]) as number;
                if (res !== 0) {
                    return res;
                }
            }
            return 0;
        }
        if (a instanceof ColumnKey) {
            return -1;
        }
        return undefined;
    }

    equals(y: any) {
        return this.compare(y) === 0;
    }

    getId(): string {
        return this.toString();
    }

    toString(): string {
        return '[' + this.subKeys_.map((c:ColumnKey<any>)=> {
            return c.toString();
        }).join(',') + ']';
    }


    castTo(a: any): Type {
        let res:any[] = [];
        for (let i = 0; i < this.subKeys_.length; i++) {
            res.push(this.subKeys_[i].castTo(a[i]));
        }
        return res as Type;
    }
}
