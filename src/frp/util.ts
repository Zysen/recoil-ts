import {Behaviour, type BehaviourCalcThisFn, type BehaviourList, type BehaviourList1, BStatus, Frp} from "./frp.ts";
import {LocalBehaviour} from "../ui/frp/localbehaviour.ts";
import {type Serializer} from "../ui/frp/cache.ts";
import {type StructType} from "./struct.ts";


export class Util {
    private frp: Frp;

    constructor(frp: Frp) {
        this.frp = frp
    }

    toBehaviour<T, InvType = T, OutType = T, CalcType = T>(val: Behaviour<T,InvType, OutType, CalcType> | T, opt_default?: T) {
        return this.frp.toBehaviour(val, opt_default);
    }

    /**
     * converts an object with attributes that are behaviours
     * to a list of behaviours
     */
    structToBehaviours(struct: { [index: string]: any }): Behaviour<any>[] {
        let res: Behaviour<any>[] = [];
        for (var key in struct) {
            if (struct.hasOwnProperty(key)) {
                res.push(this.toBehaviour(struct[key]));
            }
        }
        return res;
    };

    private static resolveStruct_ = function (struct: { [index: string]: any }): { [index: string]: any } {
        let res: { [index: string]: any } = {};
        for (var k in struct) {
            if (struct.hasOwnProperty(k)) {
                res[k] = struct[k] instanceof Behaviour ? struct[k].get() : struct[k];
            }
        }
        return res;
    };

    /**
     * like liftBI but takes structure of behaviours
     */
    structLiftBI<T, InvType = T>(
        calc: (v: { [index: string]: any }) => T,
        inv: (v: InvType) => StructType|undefined, struct: {
            [index: string]: any
        }, ...extra: BehaviourList): Behaviour<T, InvType> {
        let behaviours = this.structToBehaviours(struct).concat(extra);
        if (behaviours.length == 0) {
            behaviours.push(this.frp.createB(0))
        }
        return this.frp.liftBI(() => {
                return calc(Util.resolveStruct_(struct))
            }, (val: InvType) => {
                let invVal = inv(val);
                if (invVal) {
                    for (let k in invVal) {
                        let v = invVal[k];
                        let srcV = struct[k];
                        if (srcV instanceof Behaviour) {
                            srcV.set(v);
                        }
                    }
                }
            }
            , ...behaviours as BehaviourList1);
    }

    /**
     * like liftB but takes structure of behaviours
     */
    structLiftB<T>(
        calc: (v: { [index: string]: any }) => T,
        struct: { [index: string]: any },
        ...extra: BehaviourList) {

        return this.frp.liftB(
            (): T => {
                return calc(Util.resolveStruct_(struct));
            }, ...this.structToBehaviours(struct) as BehaviourList1, ...extra);
    }

    /**
     * converts an array values to a array of behaviours, if the value is already a behaviour
     * does nothing
     */
    static toBehaviours(frp: Frp, values: [any, ...any[]]): BehaviourList1;
    static toBehaviours(frp: Frp, values: any[]): Behaviour<any>[] {
        return values.map(v => frp.toBehaviour(v));
    }


    /**
     * if value is undefined returns behaviour with def
     */
    getDefault<T>(value: Behaviour<T> | T, def: T | Behaviour<T>) {
        value = this.toBehaviour(value);
        def = this.toBehaviour(def);

        return this.frp.liftBI(() => {
            if (value.get() === undefined) {
                return def.get();
            }
            return value.get();
        }, function (v) {
            value.set(v);
        }, value, def);

    }

    /**
     * if this is good keeps it good the value goes to not ready, good for lookup tables
     * that may change, and you don't want it to flash off for a while
     */
    static lastGood<T, InvType>(b: Behaviour<T>): Behaviour<T> {
        let last: BStatus<T, any, InvType> | null = null;
        return b.frp().metaLiftB((v: BStatus<T, any, InvType>): BStatus<T, any, InvType> => {
            if (v.good()) {
                last = v;
                return v;
            } else if (last) {
                return last;
            }
            return v;
        }, b);
    }

    /**
     * if all behaviours are good returns true, else false
     */
    isAllGood(...values: BehaviourList1): Behaviour<boolean> {
        return this.frp.metaLiftB((): BStatus<boolean> => {
            for (let b of values) {
                if (!b.metaGet().good()) {
                    return new BStatus<boolean>(false);
                }
            }
            return new BStatus(true);
        }, ...values);
    }

    /**
     * if all behaviours are good returns true, else false
     */
    static isAllGood(...values: BehaviourList1): Behaviour<boolean> {
        return new Util(values[0].frp()).isAllGood(...values);
    }


    /**
     * creates a behaviour that has a default value but then just changes
     * a local value
     *
     */
    static defaultValue<T>(defaultB: Behaviour<T>): Behaviour<T> {
        let notSet = {};
        let frp = defaultB.frp();
        let storeB: Behaviour<{} | T> = frp.createB(notSet);

        return frp.liftBI(function (store: T | {}, def: T): T {
            if (store === notSet) {
                return def;
            }
            return store as T;
        }, function (val) {
            storeB.set(val);
        }, storeB, defaultB);
    };

    /**
     * ensures the result does not fire more than once in ms
     * @param valB
     * @param ms time  in milliseconds
     */
    static calm<T>(valB: Behaviour<T>, ms: number): Behaviour<T> {
        const frp = valB.frp();
        let timer: any = null;
        let tmpE = frp.createE<boolean>();
        let tmp: T | null = null;
        let redo = false;

        return frp.liftBI(function (val: T, tmps: T[]) {
            if (timer) {
                redo = true;
                return tmp as T;
            }
            redo = false;
            if (tmps.length > 0) {
                // this was triggered by a timeout so don't start a new timer
                return val;
            }

            tmp = val;
            timer = setTimeout(function () {
                timer = null;
                tmp = null;
                if (redo) {
                    frp.accessTrans(function () {
                        tmpE.set(true);
                    }, tmpE);
                }
            }, ms);
            return val;
        }, function (v) {
            valB.set(v);
        }, valB, tmpE);
    }

    /**
     * this creates a liftB that calls the member function on an object with the arguments, for
     * example:

     *  let stringB = frp.createB("hello");
     *  let subB =  liftMememberFunc(String.prototype.substring, stringB, 1)
     *
     */

    static liftMemberFunc<T>(func: BehaviourCalcThisFn<T>, ...args: [any, ...any[]]): Behaviour<T> {
        let frp = getFrp(args);
        return frp.liftB(
            (me: any, ...args:any[]):T => {
            return func.apply(me, args);
        }, ...Util.toBehaviours(frp, args));
    }

}


let timeInfo_: { timeB: null | Behaviour<number>, interval: number | null } = {
    timeB: null,
    interval: null,
};

/**
 * returns a behaviour that fires every second with the date time in it
 * @return  time in miliseconds
 */
export function timeB(frp: Frp) {
    if (timeInfo_.timeB === null) {
        timeInfo_.timeB = frp.createNotReadyB();
        let setTime = frp.accessTransFunc(
            () => {
                (timeInfo_.timeB as Behaviour<number>).set(new Date().getTime());
            }, timeInfo_.timeB as Behaviour<number>);

        timeInfo_.timeB.refListen(function (listen) {
            if (listen) {
                if (timeInfo_.interval === null) {
                    setTime();
                    timeInfo_.interval = setInterval(setTime, 1000) as unknown as number;
                }
            } else {
                if (timeInfo_.interval !== null) {
                    clearInterval(timeInfo_.interval);
                    timeInfo_.interval = null;
                }
            }
        });
    }

    return timeInfo_.timeB as Behaviour<number>;

}


let dateB_: Behaviour<number> | null = null;

/**
 * returns a behaviour that fires every day with the date at the begin in it
 * @return time in miliseconds
 */
export function dateB(frp: Frp): Behaviour<number> {
    if (dateB_ === null) {
        dateB_ = frp.createB(new Date().setHours(0, 0, 0, 0));
        let dateB = dateB_;
        let timeout: any = null;
        const setDate = frp.accessTransFunc(
            () => {
                let now = new Date().getTime();
                let dt = new Date(now);
                dateB.set(dt.setHours(0, 0, 0, 0));
                let tomorrow = new Date(now);
                tomorrow.setHours(0, 0, 0, 0);
                tomorrow.setDate(tomorrow.getDate() + 1);
                if (timeout) {
                    clearTimeout(timeout);
                }
                timeout = setTimeout(setDate, Math.max(1, tomorrow.getDate() - now));
            }, dateB);

        dateB.refListen(function (listen) {
            if (listen) {
                setDate();
            } else {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
            }
        });
    }

    return dateB_ as Behaviour<number>;

}

/**
 * this creates a behaviour with a memory, that is every
 * time the behaviour is set the memory behaviour is set to the same value
 * this can be useful for storing setting that are not sent to the server
 */

export function memoryB<T>(val: Behaviour<T>, memory: Behaviour<T>): Behaviour<T> {
    return val.frp().liftBI<T,T>(
        (v: T): T => {
            return v;
        },
        (v: T) => {
            val.set(v);
            memory.set(v);
        },
        val, memory);
}

/**
 * creates a behaviour that can be set without updating the original behaviour
 */
export function memoryOnlyB<T>(val: Behaviour<T>) {
    const frp = val.frp();
    let uniq = {};
    let memory: Behaviour<T | {}> = frp.createB(uniq);
    return val.frp().liftBI(
        (v: T, m: {} | T): T => m === uniq ? v : m as T,
        (v) => {
            memory.set(v);
        },
        val, memory);
}


/**
 * utilty to get the frp engin out of the arguments
 */
export function getFrp(args: any[]): Frp {
    for (var i = 0; i < args.length; i++) {
        if (args[i] instanceof Behaviour) {
            return args[i].frp();
        }
    }
    throw 'No Behaviours given';
}


/**
 * creates a behaviour thats has a default value but then just changes
 * a local value, but also remembers the current setting
 * @param defaultB the default value to set it to
 * @param version use this old values are lost if you upgrade
 * @param key the key to store this var under
 * @param storage either local or session storage
 * @param opt_serializer
 *
 */
function localDefaultValue<T>(defaultB: Behaviour<any>, version: string, key: string, storage: any, opt_serializer?: Serializer) {
    let notSet = {};
    let frp = defaultB.frp();
    let storeB = LocalBehaviour.create<T>(frp, version, key, defaultB, storage, opt_serializer);

    return frp.liftBI(
        (store, def) => {
            if (store === notSet) {
                return def;
            }
            return store;
        }, (val: T): void => {
            storeB.set(val);
        },
        storeB, defaultB);
}

/**
 * the purpose of this is to do a liftB but you can pass any value to the liftB function not just
 * behaviours
 * techically we could make func a behaviour as well but for now I will leave it
 */

function liftFunc<T>(func: (...args: any[]) => T, ...args: [any, ...any[]]) {
    let frp = getFrp(args);
    return frp.liftB((...args: any[]) => {
        return func(...args);
    }, ...Util.toBehaviours(frp, args));
}

