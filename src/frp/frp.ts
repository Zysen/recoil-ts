import {UniquePriorityQueue} from "../structs/uniquepriorityqueue.ts";
import Sequence from "../util/sequence.ts"
import {isEqual} from "../util/object.ts";
import {LoopDetected, NoAccessors, NotAttached, NotInTransaction} from "../exception/exception.ts";
import {SerializedSet, SerializedMap} from "../structs/serialized_collections.ts";
import {removeIf} from "../structs/array.ts";
import {fail} from "../util/goog.ts";
import {Message} from "../ui/message.ts";

export type BehaviourList = Behaviour<any,any, any, any>[];
export type BehaviourList1<Type = any> = [Behaviour<Type,any, any>, ...Behaviour<Type,any, any>[]];
export type BehaviourListInv1<Type = any> = [Behaviour<any,Type, any>, ...Behaviour<any,Type, any>[]];
export type BehaviourCalcFn<T> = (...args:any[]) => T;
export type BehaviourCalcThisFn<T> = (this:any,...args:any[]) => T;
type BehaviourListPrefix<T extends BehaviourList> =
    T extends [infer Head, ...infer Tail]
        ? (Head extends Behaviour<any> ? (Tail extends BehaviourList ? [Head, ...BehaviourListPrefix<Tail>] : never) : never)
        : [];

export type TypedBehaviourList<T extends any[]> =
    T extends [infer Head, ...infer Tail]
        ? (Tail extends any[] ? [Behaviour<Head>, ...TypedBehaviourList<Tail>] : never)
        : [];

type ListPrefix<T extends any[]> =
    T extends [infer Head, ...infer Tail]
        ? (Tail extends any[] ? [Head, ...BehaviourListPrefix<Tail>] : never)
        : [];

type DebugState = {
    args: [() => void, ...Behaviour<any>[]];
    visited: Set<Behaviour<any>>;
    dir: TraverseDirection;
    cur: Behaviour<any>;
    nextItr: ProviderInfoList;
    nextPending: UniquePriorityQueue<Behaviour<any>>;
    getDeps: () => BehaviourList | undefined;
    pendingTrans: (() => any)[];
    todoRefs_?:BehaviourIdMap<TodoInfo> | undefined
    todo?:BehaviourIdMap<TodoInfo>

}

type StatusFactoryFunc<T, InvType, OutType> = (() => EStatus<T,InvType>)|(() => BStatus<T,OutType>);
type InvFunctionType<T,InvType> = (this:Behaviour<any>, val: InvType, ...args: Behaviour<any>[]) => void;
type InvStatusFunctionType<T,InvType> = (this:Behaviour<any>,v: Status<T,T, InvType>, ...args: Behaviour<any>[]) => void;
type InvBStatusFunctionType<T, InvType> = ((this:Behaviour<any>,v: BStatus<T, InvType>, ...args: Behaviour<any>[]) => void) |
    ((this:Behaviour<any>,v: BStatus<T, T, InvType>, ...args: Behaviour<any>[]) => void);
type InvEStatusFunctionType<T,InvType> = (this:Behaviour<any>,v: EStatus<T, InvType>, ...args: Behaviour<any>[]) => void;
type InvAllStatusFunctionType<T, InvType> = InvStatusFunctionType<T,InvType>|
    InvBStatusFunctionType<T, InvType>|
    InvEStatusFunctionType<T, InvType>|
    InvFunctionType<T, InvType>;
type ToCalc<T> = T extends Behaviour<any,any,any,infer V> ? V : never;
type StripBehaviourArray<T extends any[]> = T extends [infer H, ...infer Tail]
    ?  (Tail extends Behaviour<any>[] ? ([ToCalc<H>, ...StripBehaviourArray<Tail>]  ): never) : [];

//((v: Status<any,T>) => void)|((v: BStatus<T>) => void)
interface ProviderInfo {
    behaviour: Behaviour<any>;
    force: boolean;
}

export interface Debugger {
    preVisit(node: Behaviour<any>, up: boolean): boolean;

    postVisit(node: Behaviour<any>): void;
}

type ProviderInfoList = ProviderInfo[];

class BehaviourIdMap<T> extends SerializedMap<BehaviourId, T> {
    static serializer = (key: BehaviourId) => key.join()

    constructor() {
        super(BehaviourIdMap.serializer);
    }
}

class BehaviourIdSet extends SerializedSet<BehaviourId> {
    static serializer = (key: BehaviourId) => key.join()

    constructor() {
        super(BehaviourIdMap.serializer);
    }
}

class TraverseDirection {
    private readonly comparator_: (x: Behaviour<any>, y: Behaviour<any>) => number;
    private readonly calc_: (behaviour: Behaviour<any>,
                     providers: BehaviourList,
                     dependents: BehaviourList|undefined,
                     nextItr: ProviderInfoList) => BehaviourList|undefined

    constructor(name: string,
                calc: (behaviour: Behaviour<any>,
                       providers: BehaviourList,
                       dependents: BehaviourList|undefined,
                       nextItr: ProviderInfoList) => BehaviourList|undefined,
                comparator: (x: Behaviour<any>, y: Behaviour<any>) => number) {
        this.calc_ = calc;
        this.comparator_ = comparator;
    }

    calculate(behaviour: Behaviour<any>,
              providers: BehaviourList,
              dependents: BehaviourList|undefined,
              nextItr: ProviderInfoList): BehaviourList|undefined {
        return this.calc_(behaviour, providers, dependents, nextItr);
    }

    heapComparator(): (x: Behaviour<any>, y: Behaviour<any>) => number {
        return this.comparator_;
    }


}


export class Frp {
    transactionManager_: TransactionManager;

    constructor() {
        this.transactionManager_ = new TransactionManager(this);
    }

    tm() {
        return this.transactionManager_;
    }

    /**
     * mark the behaviour that it is being used it will now receive update notifications
     */
    attach(behaviour: Behaviour<any>) {
        this.transactionManager_.attach(behaviour);
    }

    /**
     * mark the behaviour that it is no longer being used it will not receive update notifications
     *
     */
    detach(behaviour: Behaviour<any>) {
        this.transactionManager_.detach(behaviour);
    }

    static compareSeq_(a: BehaviourId, b: BehaviourId): number {
        let len = a.length > b.length ? b.length : a.length;

        for (let i = 0; i < len; i++) {
            let res: bigint = a[i] - b[i];

            if (res !== 0n) {
                return res < 0n ? -1 : 1;
            }
        }

        if (a.length > b.length) {
            return -1;
        }
        if (a.length < b.length) {
            return 1;
        }
        return 0;
    }

    /**
     * sets the debugger interface for the frp engine
     * @param {recoil.frp.Debugger} dbugger
     */
    setDebugger(dbugger: Debugger) {
        this.transactionManager_.debugger_ = dbugger;
    }

    /**
     * @param cb called with true if the transaction is started and false if the transaction it is ended
     */
    addTransactionWatcher(cb: (started: boolean) => void) {
        this.transactionManager_.watchers_.push(cb);
    }

    removeTransactionWatcher (cb: (started: boolean) => void) {
        removeIf(this.transactionManager_.watchers_, function (v) {
            return v === cb;
        });
    }

    /**
     * for debugging, if the debugger has paused the execution this resumes
     * it
     */
    resume() {
        this.transactionManager_.resume();
    };

    /**
     * @template T

     */
    createB<T,InvType=T,OutType=T,CalcType=T>(initial: T): Behaviour<T,InvType,OutType,CalcType> {
        let metaInitial = new BStatus<T,OutType,InvType>(initial);
        let newB = new Behaviour<T,InvType,OutType,CalcType>(this, metaInitial, undefined, undefined, this.transactionManager_.nextIndex(), []);
        return newB.setName('createB');
    }

    /**
     * helper function to create a behaviour that is not ready
     */

    createNotReadyB<Type>() {
        let metaInitial = BStatus.notReady();
        return new Behaviour<Type>(this, metaInitial, undefined, undefined, this.transactionManager_.nextIndex(), []);
    }

    /**
     * create a generator event set this value to send values up the tree
     */
    createE<T>(): FrpEvent<T> {
        let metaInitial = EStatus.notReady<T>(true);
        return new Behaviour<T,T,T[]>(this, metaInitial as EStatus<T, any>, undefined, undefined, this.transactionManager_.nextIndex(), []);
    }
    createMetaB<T>(initial: BStatus<T>): Behaviour<T> {
        return new Behaviour<T>(this, initial, undefined, undefined, this.transactionManager_.nextIndex(), []);
    }

    createConstB<T>(initial: T): Behaviour<T,T,T,T> {
        let metaInitial = new BStatus(initial);
        return new Behaviour<T>(this, metaInitial, () => metaInitial, Frp.nullInvFunc_, this.transactionManager_.nextIndex(), []);
    }

    /**
     * allows access to behaviours and also puts the callback in a transaction
     * Warning: DO NOT USE When you just need access to a behaviour, since you will not
     * receive updates from the behaviour.
     * It should only  be used when an event external to the frp system needs to update the
     * behaviours.
     * E.g: a user clicks on an element and you want to set a value based on the behaviour.
     *
     * @return {?}
     */

    accessTrans<T>(callback: () => T, ...behaviours: BehaviourList): T {
        let res = undefined;
        const func = function () {
            try {
                for (let b of  behaviours) {
                    b.accessors_++;
                }
                res = callback.apply(null);
            } finally {
                for (let b of  behaviours) {
                    b.accessors_--;
                }
            }
            return res;
        };
        return this.transactionManager_.doTrans(func);
    }

    /**
     * like access Trans however creates a function to this useful
     * for things like putting it in a callback
     *
     * @return {function(...)}
     */

    accessTransFunc<T>(callback: (...args: any) => T, ...var_behaviours: Behaviour<any>[]): (...args: any) => T {
        let me = this;
        return (...curArgs: any[]): T => {
            // this is so we can get the arguments into the inner function

            let func = (): T => {
                return callback.apply(me, curArgs);
            }
            return me.accessTrans.apply(this, [func, ...var_behaviours]) as T;
        };
    }

    static access(callback: () => void, ...var_behaviours: Behaviour<any>[]) {
        for (let i = 0; i < var_behaviours.length; i++) {
            if (!(var_behaviours[i] instanceof Behaviour)) {
                throw 'All arguments must be a behaviour';
            }
        }
        try {
            for (let i = 0; i < var_behaviours.length; i++) {
                var_behaviours[i].accessors_++;
            }
            callback();
        } finally {
            for (let i = 0; i < var_behaviours.length; i++) {
                var_behaviours[i].accessors_--;
            }
        }
    }

    /**
     * converts a behaviour that has a behaviour as its value, into a behaviour with the value of the inner behaviour
     * e.g. Behaviour<Behaviour<1>> -> Behaviour<1>
     * this is useful when you don't know what the inner behaviour is until some other behaviour(s) are updated
     * @template T
     * @return {T}
     */
    switchB<T>(Bb: Behaviour<Behaviour<T>>): Behaviour<T> {
        let me = this;
        // the function is important here it lets us access behaviour we are setting
        let res1 = this.metaLiftBI(function (this:Behaviour<any>){
            let switchB = this;
            let metaBb: BStatus<Behaviour<T>> = Bb.metaGet() as BStatus<Behaviour<T>>;
            let res = new BStatus<T>(null);
            res.merge(metaBb);
            let b: Behaviour<T> | null = null;
            me.transactionManager_.nestIds(Bb, () => {
                if (metaBb.value_ === null || !metaBb.good()) {
                    me.transactionManager_.updateProviders_(switchB, Bb);
                } else {
                    me.transactionManager_.updateProviders_(switchB, Bb, (metaBb.get() as Behaviour<any>));
                    res.merge(metaBb);
                }
                b = metaBb.get();
            });

            if (b !== null && b !== undefined) {
                Frp.access(() => {
                    res.merge((b as Behaviour<T>).metaGet());
                    res.set((b as Behaviour<T>).get());
                }, b);
                return res;
            }
            return res;
        }, (val:any) => {
            // should not be able to do a switch b on an event
            let metaBb = Bb.metaGet() as BStatus<any>;

            if (metaBb.value_ instanceof Behaviour) {
                metaBb.value_.metaSet(val);
            }

        }, Bb).setName('switchB');
        res1.isSwitch = true;
        return res1;
    }


    /**
     * calls function, arguments and return value should contain meta information
     */
    metaLiftB<T>(func: (...args: any[]) => BStatus<T>, ...var_args: BehaviourList1): Behaviour<T> {
        return this.metaLiftBI(func, undefined, ...var_args);
    }

    /**
     * similar to liftB however will be notified if object is changed back
     * to itself
     */
    observeB<T>(func: (...args: Status<any,any>[]) => BStatus<T>, ...var_args: Behaviour<any>[]): Behaviour<T> {
        let res = this.metaLiftBI(func, undefined, ...var_args);
        res.notifyReset_ = true;
        return res;
    }

    metaLiftStatusI<T,InvType, OutType, CalcType>(func: (this: Behaviour<T,InvType, OutType>, ...args: []) => Status<any,OutType>,
                       invFunc?: InvAllStatusFunctionType<T,InvType>,
                       ...providers: Behaviour<any>[]): Behaviour<T,InvType, OutType, CalcType> {
        if (!(func instanceof Function)) {
            throw 'func must be function';
        }
        if (invFunc != undefined && !(invFunc instanceof Function)) {
            throw 'invFunc arg must be function';
        }
        if (providers.length == 0) {
            throw 'you must have at least 1 provider';
        }
        return new Behaviour<T,InvType, OutType>(
            this, BStatus.notReady(), func, invFunc as (v: Status<T, any, InvType>) => void,
            this.transactionManager_.nextIndex(), providers).nameFunc(func, invFunc).setName('metaLiftStatusI');
    }
    /**
     * calls function, arguments and return value should contain meta information
     *
     *
     */
    metaLiftBI<T,InvType, OutType, CalcType>(
        func: (this: Behaviour<T,InvType, OutType, CalcType>, ...args: any[]) => BStatus<T,OutType, InvType>,
        invFunc?: InvAllStatusFunctionType<T,InvType>,
        ...providers: Behaviour<any>[]): Behaviour<T,InvType, OutType, CalcType> {
        return this.metaLiftStatusI(func, invFunc, ...providers).setName('metaLiftBI');
    }

    /**
     * calls function, arguments and return value should contain meta information
     *
     */
    metaLiftEI<T>(func: (...args: any[]) => EStatus<T,T>, invFunc: (v: EStatus<T,T>) => void, ...providers: Behaviour<any>[]): Behaviour<T,T,T[]> {
        return new Behaviour(this,
            EStatus.notReady(false) as Status<T, any>,
            func as (...args: any[]) => Status<T, any>,
            invFunc as (v: Status<T, any>) => void, this.transactionManager_.nextIndex(), providers);
    }

    /**
     * utility function lift without inverse
     * @param func gets called when provider behaviours change, arguments are the values of the behaviours provided in args
     * @param args behaviours used in calculating the value of func
     * @return a behaviour that contains the value that func calculates
     */
    liftB<RT, ArgList extends BehaviourList1 = BehaviourList1>(func: (this:Behaviour<any>, ...args: ListPrefix<StripBehaviourArray<ArgList>>) => RT, ...args: ArgList): Behaviour<RT,RT,RT,RT> {
        return this.liftBI(func, undefined, ...args);
    }

    /**
     * utility to return a behaviour that acts like an event, the difference between events and behaviours
     * is that events are arrays of values that have happened in the transaction phase and get cleared after that
     *
     * @param func used to calculate the event that is returned
     * @param args inputs into the event
     */
    liftE<RT>(func: (...args: any[]) => RT[], ...args: Behaviour<any>[]): Behaviour<RT, RT[], RT[], RT[]> {
        return this.liftEI<RT,RT>(func, undefined, ...args);
    }


    private static nullFunc_(): null {
        return null;
    }

    /**
     * @private
     */
    static nullInvFunc_() {
    }


    /**
     *
     * Creates callback, this is basically a behaviour with only an inverse
     * the calculate function always returns true
     */
    createCallback<InvType, ArgList extends BehaviourList>(
        func: (arg:InvType, ...args: BehaviourListPrefix<ArgList>) => void,
        ...dependants: ArgList): Behaviour<null,InvType> {
        let inv = (arg:InvType,...args: BehaviourListPrefix<ArgList>): void => {
            return func.apply(this, [arg,...args]);
        };
        if (dependants.length === 0) {
            dependants.push(this.createB(0))
        }

        return this.liftBI(Frp.nullFunc_ as any, inv as any , ...dependants as unknown as BehaviourList1) as Behaviour<null,InvType>;
    }


    /**
     *
     * Creates callback, this is basically a behaviour with only an inverse
     * the calculate function always returns true, this differs from createCallback in that
     * the providers don't have to be good for it to be good
     */
    createGoodCallback<InvType>(
        func: (...args:[BStatus<boolean,boolean, InvType>,...Behaviour<any>[]])=>void, ...dependants: Behaviour<any>[]): Behaviour<any> {
        // todo as any
        let inv = function (this: Behaviour<boolean, InvType, boolean , boolean>, value:BStatus<boolean,boolean,InvType>, ...args: Behaviour<any>[]) {
            return func.apply(this, [value, ...args]);
        }
        let b = this.metaLiftBI<boolean, InvType,boolean, boolean>(
            () => new BStatus<boolean,boolean,InvType>(true),
            inv,
            ...dependants);
        (b as any).type = 'callback';
        return b;
    }

    /**
     * takes input behaviours and makes a new behaviour
     */

    liftBI<RT, InvType = any, ArgList extends BehaviourList1 = BehaviourList1>(
        func: (this:Behaviour<any>,...args: ListPrefix<StripBehaviourArray<ArgList>>) => RT,
        invFunc: ((val: InvType, ...args: BehaviourListPrefix<ArgList>) => void) | undefined,
        ...behaviours: ArgList): Behaviour<RT,InvType> {
        return this.liftBI_<RT,InvType, RT,RT>(
            this.metaLiftBI,
            (() => new BStatus<RT,RT, InvType>(null)) as any,
            func as any, invFunc as any, ...behaviours);
    }

    /**
     * like liftBI except returns a Status, this is useful for calculation
     * errors, inputs are still guaranteed to be good
     */
    statusLiftBI<RT, InvType>(
        func: (...args: any[]) => Status<any, RT>,
        invFunc: InvFunctionType<RT,InvType>,
        ...var_args: Behaviour<any>[]): Behaviour<RT, InvType> {
        return this.liftBI_(this.metaLiftBI, null, func, invFunc, ...var_args);
    }

    /**
     * takes input behaviours and makes a new behaviour that stores an event
     */

    liftEI<RT,InvType=RT>(
        func: (this: Behaviour<RT, InvType[], RT[], RT[]>, args: any[]) => RT[],
        invFunc: ((val: InvType[], ...args: Behaviour<any>[]) => void) | undefined,
        ...var_args: BehaviourList):Behaviour<RT, InvType[], RT[], RT[]> {
        // todo remove any
        return this.liftBI_<RT, InvType[], RT[],RT[]>(
            this.metaLiftBI, () => new EStatus<RT,InvType[]>(false),
            func as any, invFunc, ...var_args);
    }


    /**
     * creates an event from a behaviour, each time the behaviour changes
     * an event gets generated
     */
    changesE<T> (valB: Behaviour<T>):Behaviour<T,T[],T[],T[]> {
        return this.liftE(function (val:T) {
            return [val];
        }, valB);
    }

    mergeError(args: Status<any, any>[], opt_result:Status<any, any>) {
        let metaResult = opt_result || new BStatus(null);
        let metaResultB = null;

        for (let i = 0; i < args.length; i++) {
            let metaArgVal = args[i];
            metaResult.merge(metaArgVal);

            if (metaArgVal instanceof BStatus) {
                if (metaResultB === null) {
                    metaResultB = new BStatus(null);
                }
                metaResultB.merge(metaArgVal);
            }
        }
        return metaResult;

    }

    /**
     * converts a value to a behaviour, if the value is already a behaviour
     * does nothing
     *
     */
    toBehaviour<T, InvType = T, OutType = T, CalcType = T>(value:T|Behaviour<T,InvType,OutType,CalcType>, opt_default?:T):Behaviour<T,InvType,OutType,CalcType> {

        if (value instanceof Behaviour) {
            return value;
        }
        else {
            if (opt_default !== undefined && value === undefined) {
                return this.createConstB(opt_default) as Behaviour<T,InvType,OutType,CalcType>;
            }
            return this.createConstB(value) as unknown as Behaviour<T,InvType,OutType,CalcType>;
        }
    }
    static assertHasOneBehaviour(list : BehaviourList): asserts list is BehaviourList1 {
        if (list.length === 0) {
            throw new Error('the behaviourList is empty');
        }
    }
    /**
     * func will fire if all dependant behaviours are good
     * or there is 1 ready event
     * @template RT
     * @private
     * @param liftFunc function to call every event or behaviour
     * @param statusFactory function to create an empty status
     * @param func
     * @param invFunc
     * @param var_args
     * @return behaviour that is calculated with func and reversed with invFunc
     */

    //metaLiftBI<T>(func: (this: Behaviour<T>, ...args: []) => BStatus<T>,
    //                   invFunc?: (v: BStatus<T>) => void,
    //                   ...providers: Behaviour<any>[]): Behaviour<T>
/*
    private liftBI_<T, InvType, OutType, CalcType>(
        liftFunc: (func: (this: Behaviour<T,InvType, T>, ...args: []) => BStatus<CalcType>,
                   invFunc?: (v: BStatus<InvType>) => void,
                   ...providers: Behaviour<any>[])=> Behaviour<T>,
        statusFactory: null,
        func:((...args:any[])=> Status<any,T>), // this should return a status if statusFactory is null
        invFunc:((v:T, ...args:Behaviour<any>[])=> void)|undefined,
        ...var_args: Behaviour<any>[]):Behaviour<T, InvType, T>;
    private liftBI_<T, InvType, OutType, CalcType>(
        liftFunc: (func: (this: Behaviour<T, InvType, OutType, CalcType>, ...args: []) => BStatus<T,OutType>,
                   invFunc?: StatusFactoryFunc<T,InvType>,
                   ...providers: Behaviour<any>[])=> Behaviour<T, InvType, OutType, CalcType>,
        statusFactory: StatusFactoryFunc<T,OutType>,
        func:((...args:any[])=> CalcType), // this should return a status if statusFactory is null
        invFunc:InvAllStatusFunctionType<T,InvType>|undefined,
        ...var_args: Behaviour<any>[]):Behaviour<T, InvType, OutType, CalcType>;*/
    private liftBI_<T, InvType, OutType,CalcType>(
        liftFunc: (func: (this: Behaviour<T,InvType,OutType,CalcType>, ...args: any[]) => BStatus<T,OutType, InvType>,
                   invFunc?: (v: BStatus<T,InvType>, ) => void,
                    ...providers: Behaviour<any>[])=> Behaviour<T, InvType, OutType,CalcType>,
        statusFactory: null| StatusFactoryFunc<T,InvType,OutType>,
        func:((this:Behaviour<any>,...args:any[])=> T) | ((this:Behaviour<any>, ...args:any[])=> Status<T,any, InvType>), // this should return a status if statusFactory is null
        invFunc:InvAllStatusFunctionType<T,InvType>|undefined,
        ...var_args: Behaviour<any>[]): Behaviour<T, InvType,OutType,CalcType> {
        const outerArgs = [liftFunc, statusFactory, func, invFunc, ...var_args];
        const wrappedFunc = function (this:Behaviour<any>) {
            let args = [];
            let metaResult:Status<any, T> = (statusFactory === null ? new BStatus(null) : statusFactory()) as Status<any, T>;
            let metaResultB = null; // the result of all the behaviours
            let eventReady = false;

            for (let i = 4; i < outerArgs.length; i++) {
                let metaArg = outerArgs[i] as Behaviour<any>;
                let metaArgVal = metaArg.metaGet();
                metaResult.merge(metaArgVal);

                if (metaArgVal instanceof BStatus) {
                    if (metaResultB === null) {
                        metaResultB = new BStatus(null);
                    }
                    metaResultB.merge(metaArgVal);
                } else {
                    eventReady = eventReady || metaArgVal.ready();
                }
                args.push(metaArg.get());
            }

            // fires if all provider behaviours a good
            // or we have an event that is ready, note this means


            if ((metaResultB !== null && metaResultB.good()) || eventReady) {
                try {
                    let result = (func as any).apply(this, args);
                    if (statusFactory === null) {
                        // if status factory null then we expect the result a status object
                        metaResult = result as Status<any, T>;
                    } else {
                        metaResult.set_(result);
                    }
                } catch (error) {
                    metaResult.addError(error);
                }
            }
            return metaResult;
        };

        let wrappedFuncInv = undefined;
        if (invFunc !== undefined) {
            wrappedFuncInv = function (this:Behaviour<T,InvType,OutType,CalcType>, val:Status<any, T, any>) {
                let args: [T,...any[]] = [val.get()];

                for (let i = 4; i < outerArgs.length; i++) {
                    args.push(outerArgs[i]);
                }
                // todo remove any
                (invFunc as any).apply(this, args);
            };
        }
        let newArgs: [any, any,...Behaviour<any>[]]= [wrappedFunc, wrappedFuncInv];
        for (let i = 4; i < outerArgs.length; i++) {
            newArgs.push(outerArgs[i] as Behaviour<any>);
        }

        return liftFunc.apply(this, newArgs).nameFunc(func, invFunc);

    }
}

export type ErrorType = string|Error|Message;
/**
 * an base interface EStatus (Event Status) and BStatus (Behaviour Status)
 *
 */
export interface Status<InType, OutType, InvType = InType> {
    errors(): ErrorType[];

    ready(): boolean;

    get(): OutType;

    good(): boolean;

    set(value: InvType): void;

    set_(value: OutType): void;

    addError(error: any): void;

    merge(other: Status<any, any>):void;

}

export function isStatus(b: any):boolean {
    return b instanceof BStatus || b instanceof EStatus;
}

/**
 * provides the status of the event, e.g. is it ready, or an error has occurred
 * events are cleared every pass off of the transaction, up or down
 * events are different than behaviours the contain a queue of values
 * @template T
 * @param generator if true this is only clears after up event
 * @constructor
 *
 */


export class EStatus<Type,InvType> implements Status<Type, Type[], InvType> {
    private errors_: ErrorType[];
    private values_: Type[]|InvType[];
    private readonly generator_: boolean;

    constructor(generator: boolean, opt_values: any[] = []) {
        this.generator_ = generator;
        this.errors_ = [];
        this.values_ = opt_values;
    }

    /**
     */
    errors(): any[] {
        return this.errors_;
    }
    /**
     * events always good
     * @return {boolean}
     */
    good(): boolean {
        return true;
    };

    /**
     * creates a not ready event
     * if  generator is true this is only clears after up event
     */
    static notReady<Type, InvType = Type>(generator: boolean): EStatus<Type, InvType> {
        return new EStatus(generator);
    }

    addError(error: ErrorType) {
        this.errors_.push(error);
    }


    ready(): boolean {
        return true;
    }


    get(): Type[] {
        return this.values_ as Type[];
    }

    addValue(value: Type): EStatus<Type, InvType> {
        let values = [...this.values_];
        values.push(value);
        return new EStatus<Type, InvType>(this.generator_, values);

    }

    set(value: InvType): EStatus<Type, InvType> {

        (this.values_ as InvType[]).push(value);
        return this;
    }

    set_(value: Type[]) {
        for (let i = 0; i < value.length; i++) {
            (this.values_ as Type[]).push(value[i]);
        }
    }

    /**
     * combine this error and another to get a result
     */
    merge(other: Status<any, any>) {
        this.errors_.concat(other.errors());
    }

    clear_(dir: Direction) {
        if (dir === Direction.UP || !this.generator_) {
            this.errors_ = [];
            this.values_ = [];
        }
    }
}

/**
 *
 * provides the status of the behaviour, e.g. is it ready, or an error occurred
 *
 * outtype is the type we return for get
 */
export class BStatus<T, OutType = T, InvType = T> implements Status<T, OutType, InvType> {
    private errors_: Array<ErrorType>;
    private ready_: boolean;
    public value_: T | OutType | InvType|undefined | null;

    constructor(initial: T | undefined | null) {
        this.errors_ = [];
        this.ready_ = true;
        this.value_ = initial;

    }


    static notReady<T>(): BStatus<T> {
        let res = new BStatus<T>(undefined);
        res.ready_ = false;
        return res;
    }

    static errors<T, OutType, InvType>(errors: ErrorType[]): BStatus<T, OutType, InvType> {
        let res = new BStatus<T, OutType, InvType>(undefined);
        res.ready_ = true;
        res.errors_ = errors;
        return res;
    }


    /**
     * combine this error and another to get a result
     *
     */
    merge(other: Status<any, any>) {
        if (!other || !other.errors) {
            console.log('merging with non error');
        }
        if (!(other.errors instanceof Function)) {
            console.log('merging with non-status');
        }
        this.errors_ = this.errors_.concat(other.errors());
        this.ready_ = this.ready_ && ((other instanceof EStatus) || other.ready());
    }

    /**
     * set the value of the status
     */
    set(val: InvType): Status<T,OutType, InvType> {
        this.value_ = val;
        return this;
    }


    set_(val: OutType | undefined) {
        this.value_ = val;
    }

    get(): OutType {
        return this.value_ as OutType;
    }

    ready(): boolean {
        return this.ready_;
    }

    good() {
        return this.ready_ && this.errors_.length === 0;
    }

    errors():any[] {
        return this.errors_;
    }

    addError(error: any) {
        this.errors_.push(error);
    }
}

export type FrpEvent<T> = Behaviour<T, T, T[], T>;

/**
 *
 * CalcType is the type of the calculation of the calc function this can be different the type of the behaviour if it an
 *  event since that should be an array of T
 * OutType is the type get returns this can be an array of T if it is an event
 * @template T
 */
export class Behaviour<T, InvType = T, OutType = T, CalcType = T> {
    private readonly  frp_: Frp;
    public notifyReset_: boolean;
    public seq_: BehaviourId;
    public origSeq_: BehaviourId;
    public accessors_: number = 0;
    public inv_: (v: Status<T, any,InvType>, ...src: Behaviour<any>[]) => void;
    private readonly refListeners_: ((hasListeners: boolean) => void) [] = [];
    public providers_: Behaviour<any>[];
    private readonly calc_: (...args: any[]) => Status<T, any, InvType>;
    public dirtyUp_: boolean;
    private readonly refs_: { [index: string]: { manager: TransactionManager, count: number } };
    public dirtyDown_: boolean;
    private val_: Status<T, OutType, InvType>;
    private name_?: string;
    public isSwitch?: boolean;
    public dirtyUpOldValue_: Status<T, any, InvType> | null;
    private debugSet_?:boolean;
    private srcCalc_?:(...args: any[]) => any;
    private srcInv_?:InvFunctionType<any, any>;

    constructor(
        frp: Frp,
        value: Status<T, any, InvType>,
        calc: ((...vals: any[]) => Status<T, any, InvType>) | undefined = undefined,
        inverse: ((v: Status<T, any, InvType>) => void) | undefined = undefined,
        sequence: BehaviourId,
        providers: Behaviour<any>[]) {
        this.frp_ = frp;
        this.notifyReset_ = false; // notify any dependants if this changes back to the value it was after a set

        let myValue = value;

        if (value === undefined) {
            console.log('SETTING UNDEFINED 3');
        }

        this.val_ = value;
        this.calc_ = calc || function () {
            return myValue;
        };
        if (!(this.calc_ instanceof Function)) {
            throw new Error('calc not function');
        }

        this.inv_ = inverse || function (newVal) {
            myValue = newVal;
        };

        if (!(this.inv_ instanceof Function)) {
            throw new Error('inverse not function');
        }

        // we have called set on this behaviour and we need to recalculate
        // all our dependants (maybe)
        this.dirtyUp_ = false;
        // this is value that was calculated before we set the new value
        this.dirtyUpOldValue_ = null;
        // we have set the value via metaSet and we need to inverse calculate
        this.dirtyDown_ = false;
        this.refs_ = {};
        this.seq_ = sequence;
        this.origSeq_ = this.seq_;

        if (providers) {
            providers.forEach(function (p) {
                if (!(p instanceof Behaviour)) {
                    throw new Error('provider not a behaviour');
                }
            });
        }
        this.refListeners_ = [];
        this.providers_ = providers || [];

        //    this.quickLoopCheck_();
        //    this.checkProvidersBefore_();

    }

    /**
     * the resulting behaviour will ignore all set
     */
    noInverseB(): Behaviour<T> {
        return this.frp_.liftB<T>(v => v, this);
    }

    /**
     * used for debugger gets the dependants of this behaviour
     */
    getDependants(): Behaviour<any>[] {
        return this.frp_.tm().dependencyMap_.get(this.seq_) || [];
    }

    /**
     * allows naming of behaviours for debugging
     */
    setName(name: string): this {
        this.name_ = name;
        return this;
    }


    /**
     * allows naming of behaviours for debugging
     */
    getName(): string {
        return this.name_ || '';
    }


    /**
     * for debugging this keeps track of the original functions
     * @template T
     */
    nameFunc(calc: (...args: any[]) => any, inv?: InvFunctionType<any,any>): Behaviour<T, InvType, OutType> {
        this.srcCalc_ = calc;
        this.srcInv_ = inv;
        return this;
    }

    good(): boolean {
        return this.metaGet().good();
    };

    /**
     *  this is unique cannot be cloned
     */
    clone(): Behaviour<T, InvType, OutType> {
        return this;
    }

    loopCheck(path: Set<Behaviour<any>>) {
        if (path.has(this) !== undefined) {
            throw new LoopDetected();
        }
        path = new Set(path);
        path.add(this);

        for (let prov of this.providers_) {
            prov.loopCheck(path);
        }

    }

    /**
     * utility function to ensures all our providers are before us
     * this is not called but may be useful for debugging purposes in the future
     */
    private checkProvidersBefore_() {
        let comp = Direction.UP.heapComparator();
        for (let i = 0; i < this.providers_.length; i++) {
            let prov = this.providers_[i];
            if (comp(this, prov) <= 0) {
                throw new Error('provider not before');
            }
        }
    };

    /**
     * loopCheck is a bit slow when it comes to large amounts of
     * items this is a quicker version that assumes all the providers
     * do not have any loops so the only loop that can be introduced must point to source
     */
    public quickLoopCheck_() {
        let stack = [];
        let seen = new BehaviourIdSet();

        for (let i = 0; i < this.providers_.length; i++) {
            stack.push(this.providers_[i]);
        }

        while (stack.length > 0) {
            let cur = stack.pop() as Behaviour<any>;
            if (cur === this) {
                throw new LoopDetected();
            }
            if (seen.has(cur.seq_)) {
                continue;
            }
            seen.add(cur.seq_);
            for (let p of cur.providers_) {
                stack.push(p);
            }
        }


    }

    /**
     * deprecated this since we can just use a map behaviours now
     */
    getUniqId(): string {
        return this.origSeq_.join('.');
    }


    /**
     * a utility function to print out an frp node when it changes
     * @template T
     */
    debug(name: string): Behaviour<T,InvType, OutType, CalcType> {
        let behaviour = this;

        let getDebug = (metaV: Status<T, any, InvType>) => {
            if (metaV.good()) {
                let val = metaV.get();
                if (val && val.toDebugObj) {
                    return val.toDebugObj();
                } else {
                    return val;
                }
            }
            return metaV;
        };

        return behaviour.frp().metaLiftStatusI<T,InvType, OutType, CalcType>(
            (): Status<T, OutType, InvType> => {
                if (behaviour.metaGet().good()) {
                    console.log(name, 'calc', getDebug(behaviour.metaGet()));
                } else {
                    console.log(name, 'calc (not good)', behaviour.metaGet());
                }
                return behaviour.metaGet();
            },
            function (val: Status<T, any, InvType>) {
                console.log(name, 'inv', getDebug(val));
                behaviour.metaSet(val);
            }, behaviour).setName(name + 'metaLiftBI');
    }

    /**
     * return the associated frp engine
     */
    frp(): Frp {
        return this.frp_;
    }

    /**
     * this adds a listener when the that behaviours come in and out of use
     * it calls the callback with true when it goes into use and false when it stops being used
     *
     */
    refListen(callback: (hasListeners: boolean) => void) {
        this.refListeners_.push(callback);
    }

    private getTm_() {
        return this.frp_.transactionManager_;
    }

    /**
     * @private
     * @param {boolean} hasRef
     */
    public fireRefListeners_(hasRef: boolean) {
        let tm = this.getTm_();
        if (tm && tm.todoRefs_) {
            let myTodo = tm.todoRefs_.get(this.origSeq_)
            if (myTodo) {
                myTodo.end = hasRef;
            } else {
                tm.todoRefs_.set(this.origSeq_, {b: this, start: hasRef, end: hasRef});
            }
            return;
        }
        // since we can't get rid of a
        let len = this.refListeners_.length;
        for (let l of this.refListeners_) {
            // only fire if hasRef === this.hasRef()
            // if we commiting a transaction then we should really schedule this
            // do this by putting it in a map and firing at the end if  hasRef === this.hasRef()
            // also stop this from being re-entrant
            l(hasRef);
        }
        if (len !== this.refListeners_.length) {
            console.error('ref length changed');
        }

    }

    /**
     * increases the reference count
     * @return {boolean} true if count was zero
     *
     */
    public addRefs_(
        manager: TransactionManager, dependant: Behaviour<any> | null,
        added: BehaviourIdMap<Behaviour<any>>): boolean {
        if (dependant) {
            manager.addProvidersToDependencyMap(dependant, this);
        }


        let hadRefs = this.hasRefs();
        manager.watching_++;

        let curRefs = this.refs_[manager.id_];

        if (curRefs === undefined) {
            added.set(this.seq_, this);
            this.refs_[manager.id_] = {
                manager: manager,
                count: 1
            };
            for (let i = 0; i < this.providers_.length; i++) {
                this.providers_[i].addRefs_(manager, this, added);
            }
            if (!hadRefs) {
                this.fireRefListeners_(true);
            }
            return true;
        } else {
            this.refs_[manager.id_].count++;
            if (!hadRefs) {
                this.fireRefListeners_(true);
            }

            return false;
        }
    }

    /**
     * decreases the reference count
     * @return true if count was zero
     */
    public removeRefs_(
        manager: TransactionManager, dependant: Behaviour<any> | null,
        removed: BehaviourIdMap<Behaviour<any>>): boolean {

        if (dependant) {
            manager.removeProvidersFromDependencyMap(dependant, this);
        }
        let curRefs = this.refs_[manager.id_];
        manager.watching_--;

        if (curRefs === undefined || curRefs.count < 1) {
            fail('Behaviour ' + this.origSeq_ + ' removing reference when not referenced');

        } else if (curRefs.count === 1) {
            delete this.refs_[manager.id_];
            removed.set(this.seq_, this);
            for (let i = 0; i < this.providers_.length; i++) {
                this.providers_[i].removeRefs_(manager, this, removed);
            }

            if (!this.hasRefs()) {
                this.fireRefListeners_(false);
            }
            return true;
        } else {
            this.refs_[manager.id_].count--;
            return false;
        }
    }

    /**
     * increases the reference count
     * @param manager the current transaction manager to add a ref for
     * @param  count this can add more than 1 used internally
     * @return  true if count was zero
     *
     */
    addRef(manager: TransactionManager, count: number = 1): boolean {
        let hadRefs = this.hasRefs();
        manager.watching_ += count;
        let curRefs = this.refs_[manager.id_];
        if (curRefs === undefined) {
            this.refs_[manager.id_] = {
                manager: manager,
                count: count
            };
            if (!hadRefs) {
                this.fireRefListeners_(true);
            }
            return true;
        } else {
            this.refs_[manager.id_].count += count;
            if (!hadRefs) {
                this.fireRefListeners_(true);
            }

            return false;
        }
    }

    /**
     * @return {boolean}
     *
     */
    hasRefs(): boolean {
        for (let prop in this.refs_) {
            if (this.refs_.hasOwnProperty(prop)) {
                return true;
            }
        }
        return false;
    };

    /**
     * gets the reference count for the transaction manager
     *
     */
    getRefs(manager: TransactionManager): number {

        const curRefs = this.refs_[manager.id_];
        if (curRefs === undefined) {
            return 0;
        }
        return curRefs.count;
    }

    /**
     * gets the reference count for the transaction manager
     *
     */
    private forEachManager_(callback: (tm: TransactionManager) => void) {

        for (let idx in this.refs_) {
            callback(this.refs_[idx].manager);
        }
    }

    unsafeMetaGet(): Status<T, OutType, InvType> {
        return this.val_;
    }

    /**
     * @return {T}
     */
    get(): T {
        let meta = this.metaGet();
        if (meta instanceof BStatus || meta instanceof EStatus) {
            return meta.get();
        }
        // should not happen
        return null as T;
    }

    metaGet(): Status<T, OutType, InvType> {
        let hasTm = this.hasRefs();
        let hasProviders = this.providers_.length > 0;

        if (!hasTm && hasProviders) {
            // if it has providers then it is not ok to set it with no
            // transaction manager attached
            throw new NotAttached();
        }

        if (this.accessors_ === 0) {
            // if providers are feeding into me then it is NOT ok just to set the value
            throw new NoAccessors();
        }

        return this.val_;
    }

    metaSet(value: Status<T, any, InvType>) {
        let hasTm = this.hasRefs();
        let hasProviders = this.providers_.length > 0;

        if (!value) {
            throw new Error('value must be of type status');
        }
        if (!hasTm && hasProviders) {
            // if it has providers then it is not ok to set it with no
            // transaction manager attached
            throw new NotAttached();
        }

        if (hasProviders && this.accessors_ === 0) {
            // if providers are feeding into me then it is NOT ok just to set the value
            throw new NoAccessors();
        }

        if (hasTm) {
            let hasTransaction = false;
            this.forEachManager_(function (manager) {
                hasTransaction = hasTransaction || manager.level_ > 0;
            });

            if (!hasTransaction) {
                throw new NotInTransaction();

            }

        }
        let me = this;

        if (!isEqual(value, me.val_)) {
            if (hasTm) {
                if (!this.dirtyUp_) {
                    this.dirtyUp_ = true;
                    this.dirtyUpOldValue_ = this.val_;
                }

                me.dirtyDown_ = true;
                if (value === undefined) {
                    console.error('SETTING UNDEFINED');
                }
                me.val_ = value;
                me.forEachManager_(function (manager) {
                    manager.addPending_(Direction.UP, me);
                    manager.addPending_(Direction.DOWN, me);
                });

            } else {
                // we don't have a transaction we are simple
                // and nobody is listening so just set my value
                // and calculate down
                if (value === undefined) {
                    console.error('SETTING UNDEFINED');
                }
                me.val_ = value;
                if (value instanceof BStatus) {
                    // events don't do this they get cleared anyway
                    // so if you are not in a transaction leave it
                    me.inv_(value);
                }
            }

        }

    }

    /**
     * used to debug setting
     */
    debugSet(v: boolean): Behaviour<T,InvType, OutType> {
        this.debugSet_ = v;
        return this;
    }

    set(value: InvType) {
        if (this.debugSet_) {
            console.log('setting', value);
        }
        if (this.val_ instanceof EStatus) {
            this.metaSet(this.val_.addValue(value));
        } else {
            this.metaSet(new BStatus(value));
        }
    }
	/**
	 * a function to get dirty down providers, this is useful inorder to see what values have been set
	 * in a callback
	 */
	private static getDirtyDown(dependants: BehaviourList): Set<Behaviour<any>> {
		let res = new Set<Behaviour<any>>();
		for (let dep of dependants) {
			if (dep.dirtyDown_) {
				res.add(dep);
			}
		}
		return res;
	}

    /**
     * make an array of all providers of behaviour
     */
    static visit(behaviour: Behaviour<any>, opt_stopSwitch: boolean = false): BehaviourIdMap<Behaviour<any>> {

        let toDo: { b: Behaviour<any>, path?: {} }[] = [{
            b: behaviour,
            path: {}
        }];
        let visited = new BehaviourIdMap<Behaviour<any>>();

        while (toDo.length > 0) {
            let cur = toDo.pop() as { b: Behaviour<any> };
            if (cur.b === null) {
                console.log('behaviour is: ', cur.b);
            }

            if (visited.has(cur.b.seq_)) {
                continue;
            }
            visited.set(cur.b.seq_, cur.b);

            for (let prov = 0; prov < cur.b.providers_.length; prov++) {
                let provObj = cur.b.providers_[prov];
                // loop check seems to take a long time we shouldn't need it since
                // the constructor of the behaviour checks anyway
                //            if (cur.path[provObj.seqStr_] !== undefined) {
                //                throw new recoil.exception.LoopDetected();
                //            }

                //            let newPath = [...cur.path];
                //          newPath[provObj.seqStr_] = provObj;
                toDo.push({
                    b: provObj
                    //            path: newPath
                });
            }

        }
        return visited;

    }
	static upFunction (behaviour: Behaviour<any>, providers: BehaviourList, dependents: BehaviourList|undefined, nextItr: ProviderInfoList): BehaviourList |undefined {
		let oldVal = behaviour.val_;
		let getDirty = Behaviour.getDirtyDown;

		let params : any[] = [];
		// TODO put a loop around this so we get all events, take care if we clear the events
		// other behaviours may not get the events so we have to probably queue them unless
		// we consider an event as always a seqenence of events, then the lift just has to deal
		// with them this may allow more power to the function, alternatively events could just have
		// a sequence associated with them you only get one at a time, but this could be dealt with
		// outside the engine xxx
		providers.forEach(function (b) {
			params.push(b.metaGet());
		});
		let oldDirty = getDirty(behaviour.providers_);
		let newVal;

		if (behaviour.dirtyDown_) {
			// do nothing here. Calculating here is pointless since we need to recalc anyway
			// but ensure we calculate it next phase,

			// we have to temporarily set value back
			newVal = behaviour.val_;
			nextItr.push({behaviour: behaviour, force: true});

			if (behaviour.dirtyUp_) {
				return [];
			}
		} else {
			newVal = behaviour.calc_.apply(behaviour, params);
			if (!newVal) {
				console.log('ERROR newVal should be status');
				behaviour.calc_.apply(behaviour, params);
			}
		}

		let newDirty = getDirty(behaviour.providers_);
		for (let prov of newDirty) {
			if (!oldDirty.has(prov)) {
				nextItr.push({behaviour: prov, force: false});
			}
		}
		let res: BehaviourList|undefined = [];
		if (behaviour.dirtyUp_ && isEqual(behaviour.dirtyUpOldValue_, newVal)) {
			if (behaviour.dirtyUpOldValue_ === undefined) {
				console.error('SETTING UNDEFINED 2');
			}
			if (dependents) {
				for (let i = 0; i < dependents.length; i++) {
					let d = dependents[i];
					if (d.notifyReset_) {
						res.push(d);
					}
				}
			}

			behaviour.val_ = behaviour.dirtyUpOldValue_ || BStatus.notReady();
		} else if (behaviour.dirtyUp_ || !isEqual(oldVal, newVal)) {
			if (newVal === undefined) {
				console.error('SETTING UNDEFINED 2');
			}
			behaviour.val_ = newVal;
			res = dependents;
		}
		behaviour.dirtyUpOldValue_ = null;
		behaviour.dirtyUp_ = false;
		return res;
	}
    static compareUpSeq (a:Behaviour<any>, b:Behaviour<any>):number {
        return Frp.compareSeq_(a.seq_, b.seq_);
    }
    static compareDownSeq(a:Behaviour<any>, b:Behaviour<any>):number {
        return Frp.compareSeq_(b.seq_, a.seq_);
    }
    static downFunction(behaviour: Behaviour<any>, _providers: BehaviourList, _dependants: BehaviourList|undefined, _nextItr: ProviderInfoList): BehaviourList {
        const getDirty = Behaviour.getDirtyDown;
        let changedDirty = [];
        if (behaviour.dirtyDown_) {
            let oldDirty = getDirty(behaviour.providers_);
            let args: [Status<any, any>, ...Behaviour<any>[]] = [behaviour.val_];
            for (let i = 0; i < behaviour.providers_.length; i++) {
                args.push(behaviour.providers_[i]);
            }
            try {
                behaviour.inv_.apply(behaviour, args);
            } catch (e) {
                console.error('error setting', e);
            }
            let newDirty = getDirty(behaviour.providers_);


            for (let prov of newDirty) {
                if (!oldDirty.has(prov)) {
                    changedDirty.push(prov);
                }

            }
            behaviour.dirtyDown_ = false;
        }

        return changedDirty;
    }
}


type BehaviourId = bigint[];
type TodoInfo = {
    b: Behaviour<any>;
    start: boolean;
    end: boolean;
}

class TransactionManager {
    private frp_: Frp;
    private providers_: BehaviourList;
    public level_: number;
    public watching_: number;
    public watchers_: ((v: boolean) => void) [];
    public dependencyMap_: BehaviourIdMap<BehaviourList>;
    private readonly curIndexPrefix_: bigint[][];
    private curIndexLock_: number;
    public todoRefs_: BehaviourIdMap<TodoInfo> | undefined;
    private readonly pending_: [UniquePriorityQueue<Behaviour<any>>, UniquePriorityQueue<Behaviour<any>>];
    public id_: string;
    private curIndex_: Sequence;
    public debugger_?: Debugger;
    private debugPaused_?: boolean;
    private debugState_?: DebugState | null;

    constructor(frp: Frp) {
        this.providers_ = [];
        this.level_ = 0;
        this.watching_ = 0;
        this.watchers_ = [];
        this.pending_ = [new UniquePriorityQueue(Direction.UP.heapComparator()),
            new UniquePriorityQueue(Direction.DOWN.heapComparator())];
        this.dependencyMap_ = new BehaviourIdMap();
        this.curIndex_ = new Sequence();
        this.curIndexPrefix_ = [[]];
        this.curIndexLock_ = 0;
        this.id_ = TransactionManager.nextId_.next();
        this.frp_ = frp;
    }


    /**
     * used by debugger, returns all pending behaviours in the up direction
     *
     */
    getPendingUp(): BehaviourList {
        return this.getPending_(Direction.UP).asArray();
    }

    /**
     * used by debugger, returns all pending behaviours in the down direction
     *
     */

    getPendingDown(): BehaviourList {
        return this.getPending_(Direction.DOWN).asArray();
    }

    /**
     * for debug purposes returns the number of items we are watching
     */
    watching(): number {
        return this.watching_;
    }

    private static nextId_ = new Sequence();


    /**
     * this makes all ids generated sub ids of the current one I think this is wrong really we need it to be children of the
     * behaviour that depends on it TODO
     *
     * behaviour the parent behaviour all generated sequences will be less than this
     */
    nestIds<T>(behaviour: Behaviour<Behaviour<any>>, callback: () => T) {
        let res: T;
        try {
            this.curIndexPrefix_.push(behaviour.seq_);
            res = callback();
        } finally {
            this.curIndexPrefix_.pop();
        }
        return res;
    }

    /**
     * stops new ids from being created, this will stop new behaviours from being created in inappropriate places such as
     * inverse functions
     *
     */
    private lockIds_<T>(callback: () => T) {
        try {
            this.curIndexLock_++;
            return callback();
        } finally {
            this.curIndexLock_--;
        }
    }

    /**
     * resumes the transaction after it has been paused by the debugger
     */
    resume() {
        if (this.debugState_) {
            this.debugPaused_ = false;
            let pending = this.debugState_.pendingTrans;
            this.debugState_.pendingTrans = [];
            if (this.transDone_()) {
                this.level_--;
                this.notifyWatchers_(false);
                for (let i = 0; i < pending.length; i++) {
                    this.doTrans(pending[i]);
                }
            } else {
                for (let i = 0; i < pending.length; i++) {
                    pending[i]();
                }
            }
        }
    }

    /**
     * notify the transaction watcher if a transaction is about to start

     */
    private notifyWatchers_(start: boolean) {
        if (this.level_ === 0) {
            try {
                this.watchers_.forEach(function (cb) {
                    cb(start);
                });
            } catch (e) {
                console.error(e);
            }
        }
    }

    /**
     * to a transaction nothing should fire until we exit out the top level
     *
     * @param {function()} callback
     * @return {?}
     */

    doTrans<ReturnType>(callback: () => ReturnType) : ReturnType {

        if (this.debugState_) {
            this.debugState_.pendingTrans.push(callback);
            return undefined as ReturnType;
        }
        this.notifyWatchers_(true);
        this.level_++;
        let res = undefined;

        try {
            res = callback();
        } finally {
            let decrement = true;
            try {
                if (this.level_ === 1) {
                    decrement = this.transDone_();
                }
            } finally {
                if (decrement) {
                    this.level_--;
                    this.notifyWatchers_(false);
                }
            }
        }
        return res;
    }

    /**
     * returns true if we should continue
     * finishes of the transaction if it at level 1, it performs behaviour tree traversal
     */
    private transDone_(): boolean {
        let seen = true;
        while (seen) {
            seen = false;
            this.todoRefs_ = this.debugState_ ? this.debugState_.todoRefs_ : new BehaviourIdMap<TodoInfo>();
            let todo;
            try {
                this.propagateAll_();
            } finally {
                if (this.debugState_) {
                    this.debugState_.todo = this.todoRefs_;
                    this.todoRefs_ = undefined;
                    return false;
                }
                todo = this.todoRefs_;
                this.todoRefs_ = undefined;
            }
            if (todo) {
                for (let [_, ref] of todo) {
                    seen = true;
                    if (ref.start === ref.end) {
                        try {
                            ref.b.fireRefListeners_(ref.start);
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            }
        }
        return true;

    }


    /**
     * generates the next index for behaviours
     */
    nextIndex(): BehaviourId {
        let res = [...this.curIndexPrefix_[this.curIndexPrefix_.length - 1]];
        res.push(this.curIndex_.nextLong());
        return res;
    };

    private getPending_(direction: TraverseDirection): UniquePriorityQueue<Behaviour<any>> {
        return this.pending_[Direction.UP === direction ? 0 : 1];
    };


    public addPending_(direction: TraverseDirection, behaviour: Behaviour<any>, opt_propogate: boolean = false) {
        this.getPending_(direction).push(behaviour);
        if (this.level_ === 0 && opt_propogate) {
            this.propagateAll_();
        }
    };

    /**
     * propagate the changes through the FRP tree, until no more changes
     *
     */
    private propagateAll_() {
        let pendingDown = this.getPending_(Direction.DOWN);
        let pendingUp = this.getPending_(Direction.UP);
        let wasUp = false;
        let wasDown = false;


        while ((!pendingUp.isEmpty() || !pendingDown.isEmpty() || this.debugState_) && !this.debugPaused_) {
            if ((!pendingDown.isEmpty() && !wasDown && !this.debugState_) || (this.debugState_ && this.debugState_.dir === Direction.DOWN)) {
                this.propagate_(Direction.DOWN);
                wasUp = false;
                wasDown = true;
                continue;
            }

            if ((!pendingUp.isEmpty() && !wasUp && !this.debugState_) || (this.debugState_ && this.debugState_.dir === Direction.UP)) {
                this.propagate_(Direction.UP);
                wasUp = true;
                wasDown = false;
                continue;
            }
            wasUp = false;
            wasDown = false;
        }
    }

    /**
     * propagate the changes through the FRP tree, the direction is if it is going up or down
     *
     */
    private propagate_(dir: TraverseDirection) {
        let pendingHeap = this.getPending_(dir);
        let nextPending = this.debugState_ ? this.debugState_.nextPending : new UniquePriorityQueue(dir.heapComparator());
        let visited = this.debugState_ ? this.debugState_.visited : new Set<Behaviour<any>>();

        let cur: Behaviour<any> | undefined = this.debugState_ ? this.debugState_.cur : pendingHeap.pop();
        let prev = null;
        let me = this;
        while (cur !== undefined) {

            // calculate changed something
            let deps: BehaviourList | undefined;
            let getDeps;
            let nextItr: ProviderInfoList = [];
            let args: [() => void, ...Behaviour<any>[]];

            if (this.debugState_) {
                getDeps = this.debugState_.getDeps;
                nextItr = this.debugState_.nextItr;
                args = this.debugState_.args;
                delete this.debugState_;
                this.debugPaused_ = false;
                this.debugState_ = null;

            } else {
                const ccur = cur;
                let accessFunc = () => {
                    if (dir === Direction.UP) {
                        deps = me.nestIds(ccur, () => dir.calculate(ccur, ccur.providers_, me.dependencyMap_.get(ccur.seq_), nextItr));
                    } else {
                        deps = me.lockIds_(() => dir.calculate(ccur, ccur.providers_, me.dependencyMap_.get(ccur.seq_), nextItr));

                    }
                };

                args = [accessFunc, cur];
                for (let i = 0; i < cur.providers_.length; i++) {
                    args.push(cur.providers_[i]);
                }
                if (this.debugger_ && !this.debugger_.preVisit(cur, dir === Direction.UP)) {
                    this.debugPaused_ = true;
                    this.debugState_ = {
                        args: args,
                        visited: visited,
                        dir: dir,
                        cur: cur,
                        nextItr: nextItr,
                        nextPending: nextPending,
                        // we need this because the deps comes from a different function invocation
                        getDeps: function () :BehaviourList|undefined {
                            return deps;
                        },

                        pendingTrans: []
                    };
                    return;
                }
                getDeps = null;

            }
            try {
                Frp.access.apply(this, args);
                if (getDeps) {
                    deps = getDeps();
                }
            } finally {
                if (this.debugger_) {
                    this.debugger_.postVisit(cur);
                }
            }
            let delayed = false;
            for (let i = 0; i < nextItr.length && !delayed; i++) {
                delayed = nextItr[i].force && nextItr[i].behaviour === cur;
            }
            if (!delayed) {
                visited.add(cur);
            }

            if (deps) {
                for (let dep of deps) {
                    pendingHeap.push(dep);
                }
            }
            for (let it of nextItr) {
                let next = pendingHeap.remove(it.behaviour);
                if (next) {
                    nextPending.push(next);
                } else if (it.force) {
                    nextPending.push(it.behaviour);
                }
            }
            prev = cur;
            cur = pendingHeap.pop();
        }
        // put this on for later
        cur = nextPending.pop();
        while (cur !== undefined) {
            pendingHeap.push(cur);
            cur = nextPending.pop();
        }
        this.clearEvents_(dir, visited);
    };

    /**
     * clear all event data after a pass
     */
    private clearEvents_(dir: TraverseDirection, visited: Set<Behaviour<any>>) {
        for (let b of visited) {
            let meta = b.unsafeMetaGet();
            if (meta instanceof EStatus) {
                meta.clear_(dir);
            }
        }
    }

    /**

     * helper function to add the inverse mapping provider to list of dependants
     */
    public addProvidersToDependencyMap(
        b: Behaviour<any>,
        opt_provider: Behaviour<any> | undefined = undefined) {
        let me = this;
        let doAdd = (prov: Behaviour<any>) => {
            let deps = me.dependencyMap_.get(prov.seq_);
            if (deps === undefined) {
                deps = [b];
                me.dependencyMap_.set(prov.seq_, deps);
            } else {
                if (deps.indexOf(b) === -1) {
                    deps.push(b);
                }
            }
        };

        if (opt_provider) {
            doAdd(opt_provider);
        } else {
            b.providers_.forEach(doAdd);
        }
    };

    /**
     * helper function to remove the inverse mapping provider to list of dependants
     */
    removeProvidersFromDependencyMap(b: Behaviour<any>, opt_provider: Behaviour<any> | null = null) {
        const doRemove = (prov: Behaviour<any>) => {
            let deps = this.dependencyMap_.get(prov.seq_);
            if (deps !== undefined) {
                // TODO what about the same provider twice? i think it ok
                // because we always use visited so we only ever count
                // each child once
                for (let i = 0; i < deps.length; i++) {
                    if (deps[i] === b) {
                        deps.splice(i, 1);
                        break;
                    }
                }
                if (deps.length === 0) {
                    this.dependencyMap_.delete(prov.seq_);
                }
            }
        };
        if (opt_provider) {
            doRemove(opt_provider);
        } else {
            b.providers_.forEach(doRemove);
        }

    }

    /**
     * mark the behaviour that it is being used it will now receive update notifications
     *
     */
    attach(...behaviours: BehaviourList) {
        for (let behaviour of behaviours) {
            if (!(behaviour instanceof Behaviour)) {
                throw 'you can only attach to a behaviour';
            }
            // if this is a keyed behaviour that is not already in the attached
            // behaviours and there already exists a behaviour TODO what if we attached
            // but not at the top level

            let newStuff = this.getPending_(Direction.UP);
            this.doTrans(() => {
                let added = new BehaviourIdMap<Behaviour<any>>();
                behaviour.addRefs_(this, null, added);
                for (let [_id, b] of added) {
                    newStuff.push(b);
                }
            });
        }

    }

    /**
     * update the dependence of the behaviour
     */
    public updateProviders_(dependant: Behaviour<any>, ...var_providers: Behaviour<any>[]) {
        let oldProviders = [...dependant.providers_];
        dependant.providers_ = [...var_providers];
        dependant.providers_.forEach(function (v) {
            if (!(v instanceof Behaviour)) {
                throw new Error('provider not a behaviour in switch for ' + dependant.origSeq_);
            }
        });
        let oldProvMap = new BehaviourIdMap<Behaviour<any>>();
        let newProvMap = new BehaviourIdMap<Behaviour<any>>();

        let removed: BehaviourIdMap<Behaviour<any>> = new BehaviourIdMap();
        let added: BehaviourIdMap<Behaviour<any>> = new BehaviourIdMap();

        if (dependant.hasRefs()) {
            for (let p of oldProviders) {
                oldProvMap.set(p.seq_, p);
            }
            for (let p of dependant.providers_) {
                newProvMap.set(p.seq_, p);
            }


            for (let [seq, b] of oldProvMap) {
                if (!newProvMap.has(seq)) {
                    b.removeRefs_(this, dependant, removed);
                }
            }
            for (let [seq, b] of newProvMap) {
                if (!oldProvMap.has(seq)) {
                    b.addRefs_(this, dependant, added);
                }
            }
        }


        for (let [idx, rem] of removed) {
            if (!added.has(idx)) {
                this.removePending_(rem);
            }
        }

        let pending = this.getPending_(Direction.UP);
        for (let [idx, add] of added) {
            let rem = removed.get(idx);
            if (!rem) {
                pending.push(add);
            }
        }


        // if the providers have changed then we need to recalculate the dependant
        // even just the order

        if (oldProviders.length !== dependant.providers_.length) {
            pending.push(dependant);

        } else {
            for (let i = 0; i < oldProviders.length; i++) {
                if (oldProviders[i] !== dependant.providers_[i]) {
                    pending.push(dependant);
                    break;
                }
            }
        }

        this.ensureProvidersBefore_(dependant, new BehaviourIdSet());
        // dependant.checkProvidersBefore_();
        dependant.quickLoopCheck_();
    }

    /**
     * make sure that all providers and providers of those providers have a lower
     * sequence number than b, this will also re-queue and update the dependency map
     * of all providers that have changed
     *
     **/
    private ensureProvidersBefore_(b: Behaviour<any>, visited: BehaviourIdSet) {
        let curSeq = b.seq_;
        if (visited.has(b.seq_)) {
            return;
        }

        visited.add(b.seq_);

        for (let i = 0; i < b.providers_.length; i++) {
            let p = b.providers_[i];

            if (Frp.compareSeq_(b.seq_, p.seq_) < 0) {
                // not consistent renumber the provider
                visited.add(p.seq_);
                this.changeSequence_(b, p);
                this.ensureProvidersBefore_(p, visited);
            }
        }
    }

    /**
     * changes the sequence number provider to be less than the sequence number of b
     */
    private changeSequence_(b: Behaviour<any>, provider: Behaviour<any>) {
        let newSeq = this.nestIds(b, () => this.nextIndex());
        let oldSeq = provider.seq_;

        let up = this.getPending_(Direction.UP);
        let down = this.getPending_(Direction.DOWN);

        // remove this provider if it has pending changes because they will be out of order

        let hadUp = up.remove(provider);
        let hadDown = down.remove(provider);

        // change the provider
        provider.seq_ = newSeq;

        // update the dependency map
        let oldEntry = this.dependencyMap_.get(oldSeq);
        if (oldEntry) {
            this.dependencyMap_.delete(oldSeq);
            this.dependencyMap_.set(provider.seq_, oldEntry);
        }

        // put pending changes back with new sequence number
        if (hadUp) {
            up.push(provider);
        }
        if (hadDown) {
            down.push(provider);
        }
    }

    removePending_(behaviour: Behaviour<any>) {
        const up = this.getPending_(Direction.UP);
        const down = this.getPending_(Direction.DOWN);

        up.remove(behaviour);
        down.remove(behaviour);
    };

    /**
     * mark the behaviour that it is no longer being used it will no longer recieve update notifications
     *
     */
    detach(behaviour: Behaviour<any>) {
        this.doTrans(() => {
            let removed = new BehaviourIdMap<Behaviour<any>>();
            behaviour.removeRefs_(this, null, removed);

            for (let [_idx, b] of removed) {
                // this may not account for 2 thing in the tree pointing to the
                // same thing
                b.dirtyDown_ = false;
                this.removePending_(b);
            }
        });
        //    console.log('Detach Watching = ', this.watching_);
    }
}

class Direction {
	/**
	 * Up is from providers to behaviour
	 *
	 * @final
	 */
	static UP = new TraverseDirection(
		'up',Behaviour.upFunction, Behaviour.compareUpSeq);
	/**
	 * Down is from behaviour to providers
	 *
	 * @final
	 */
	static DOWN = new TraverseDirection(
		'down', Behaviour.downFunction, Behaviour.compareDownSeq);

}


function bob <ArgList extends any[]>(cb:(...cbArgs: StripBehaviourArray<ArgList>) => void, ...args: ArgList) {
    let frp = new Frp();

    frp.liftB((a:number, b:string) => {}, frp.createB(1), frp.createB("x"), frp.createB(""));
    bob((a:number, b:string) => {}, frp.createB(1), frp.createB("x"), frp.createB(1));
    frp.liftBI((a:number, b:string) => {}, (x:number, y:Behaviour<number,number,number,number>) => {}, frp.createB(1), frp.createB("x"), frp.createB(1));

}
