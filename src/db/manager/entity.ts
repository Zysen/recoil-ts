import {Behaviour} from "../../frp/frp.ts";
import {compare} from "../../util/object.ts";

export class Entity<T> {
    private key_: any;
    private value_: Behaviour<T>;
    private owners_: number;
    private refs_: number;

    constructor(key:any, value:Behaviour<T>, owned:boolean) {
        this.key_ = key;
        this.value_ = value;
        this.refs_ = 0;
        this.owners_ = owned ? 1 : 0;
    }

    public behaviour(): Behaviour<T> {
        return this.value_;
    }

    private setBehaviour_ (value: Behaviour<T>) {
        this.value_ = value;
    }
    /**
     * @return true if the ref count was 0
     */
    addRef():boolean {
        this.refs_++;
        return this.refs_ === 0;
    }

    /**
     * @return true if the ref count became 0
     */
    removeRef():boolean {
        this.refs_--;
        return this.refs_ === 0;
    }
    static comparator_<Type>(x:Entity<Type>, y:Entity<Type>):number {
        return compare(x.key_, y.key_);
    }

}
