import {Behaviour, type BehaviourList, type BehaviourList1, BStatus, Frp, isStatus, type Status} from "./frp.ts";
import {addProps, uniq} from "../util/object.ts";
import {ColumnKey} from "../structs/table/columnkey.ts";

export const FLATTEN = Symbol("flatten");
export const NO_FLATTEN = uniq();

export type StructType = {[index:string]: any};
export type StructBehaviour = Behaviour<StructType>;
export type StructBehaviourOrType = StructType|StructBehaviour;
export type StructBehaviourOrTypeList = StructBehaviourOrType[];
export type BehaviourOrType<T> = T|Behaviour<T>
export type AttachType<T extends Record<string, any>> = T|Behaviour<T>|{
    [K in keyof T]: T[K] | Behaviour<T[K]>;
}
export type NullRecordType<T extends Record<string, any>> = {
    [K in keyof T]: null;
}

export type AttachCallbackType<CbT extends Record<string, any>, T extends Record<string, any>> = T|Behaviour<T & NullRecordType<CbT>>|({
    [K in keyof T]: T[K] | Behaviour<T[K]>;
} & {
    [K in keyof CbT]: Behaviour<null, CbT[K], null, null>;
})

export type WrapInColumnKey<T extends any[]> = {
    [K in keyof T]: T[K] extends any ? ColumnKey<T[K]> : never;
}
/**
 * @template T,O
 * @param name the attribute name of the element to get out of the struct
 * @param value the structure to get it out of
 * @param opt_default
 * @return 
 */

export function get<T>(name:string, value: StructBehaviour, opt_default?:T) {
    return value.frp().liftBI(function() {
        let val = value.get();
        let res = val ? val[name] : undefined;
        if (res === undefined) {
            res = opt_default;
        }
        return res;

    }, function(newVal) {
        let res = {...value.get()};
        res[name] = newVal;
        value.set(res);
    }, value).setName('struct.get(\'' + name + '\')');
}

/**
 * gets only fields specified by the map defs
 * @template T
 * @param value
 * @param defs
 * @return
 */
export function getSubset(value:StructBehaviour, defs:StructType): Behaviour<StructType>
export function getSubset<T>(value:StructBehaviour, defs:StructType, opt_lift:(v:StructType)=>T): Behaviour<T>
export function getSubset<T>(value:StructBehaviour, defs:StructType, opt_lift?:(v:StructType)=>T,opt_inv?:(v:T)=>StructType): Behaviour<T>
export function getSubset<T>(value:StructBehaviour, defs:StructType, opt_lift?:(v:StructType)=>T,opt_inv?:(v:T)=>StructType): Behaviour<T> {
    let behavior = value.frp().liftBI(() => {
        let val = value.get();
        let res:StructType = {};
        for (let k in defs) {
            if (val.hasOwnProperty(k) || val[k] !== undefined) {
                res[k] = val[k];
            }
            else {
                res[k] = defs[k];
            }
        }
        return opt_lift ? opt_lift(res) : res;

    }, (val) :void=> {
        if (!opt_inv && opt_lift) {
            // if a lift is specified and no inverse then do not do an inverse
            return;
        }
        let newVal = opt_inv? opt_inv(val as T) : val as StructType;

        let res = {...value.get()};
        for (let k in defs) {
            res[k] = newVal[k];
        }

        value.set(res);
    }, value).setName('struct.getSubset(\'' + JSON.stringify(defs) + '\')');

    return behavior as Behaviour<T>;
}

/**
 * gets struct value, but will return a result even if the behaviour is not ready, or good
 *
 * @param name the attribute name of the element to get out of the struct
 * @param value the structure to get it out of
 * @param opt_default
 * @return 
 */
export function getWithStatusIfNotGood<T>(name:string, value:StructBehaviour, opt_default?:T): Behaviour<T> {
   return value.frp().metaLiftBI(() => {
       let val = value.get();
       let res = val ? val[name] : undefined;
       if (res === undefined) {
           res = new BStatus(opt_default);
       }
       else if (!isStatus(res)) {
           res = new BStatus(res);
       }
        return res;

    }, (newVal: Status<T,T, T>) => {
        let res = {...value.get()};
        res[name] = newVal.get();
        value.set(res);
    }, value);
}
/**
 * takes a structure and adds all overrides all the fields with extensions
 * @param frp the frp engine
 * @param structB
 * @param var_extensionsB
 * @return
 */
export function extend<Type extends StructType>(frp:Frp, structB:StructBehaviour|StructType, ...var_extensionsB:StructBehaviourOrTypeList ):Behaviour<Type> {

    const calc = (...args:any[]):Type=> {
        let res = {};
        addProps(res, ...args);
        return res as Type;
    }

    const inv = (val:StructType, ...args:Behaviour<any>[])=> {
        let done:StructType = {};
        for (let i = args.length - 1; i >= 0; i--) {
            let argB = args[i];
            let oldVal = {...argB.get()};
            for (let key in val) {

                if (!done[key] && oldVal.hasOwnProperty(key)) {
                    done[key] = true;
                    oldVal[key] = val[key];
                }
            }
            argB.set(oldVal);

        }
    }
    return frp.liftBI(calc, inv, flatten(frp, structB), ...var_extensionsB.map(b => flatten(frp, b)));
}


/**
 * get all the behaviours in a struct
 * @private
 * @param struct
 * @param  path
 * @param  res
 */
function getBehavioursRec_(struct:any, path: StructBehaviourOrType[], res:BehaviourList) {
    if (path.indexOf(struct) !== -1) {
        return; // loop detected;
    }
    let newPath = [...path];
    newPath.push(struct);

    if (typeof(struct) === 'function') {
        return;
    }

    if (struct && struct[FLATTEN] ===  NO_FLATTEN) {
        return;
    }
    if (struct instanceof Behaviour) {
        res.push(struct);
        return;
    }
    if (struct instanceof Array) {
        for (let i = 0; i < struct.length; i++) {
            getBehavioursRec_(struct[i], newPath, res);
        }
    }
    else if (struct instanceof Object) {
        for (let prop in struct) {
            if (struct.hasOwnProperty(prop)) {
                getBehavioursRec_(struct[prop], newPath, res);
            }
        }
    }
}

/**
 * get all the behaviours in a struct
 * @param struct
 */
export function getBehaviours (struct:StructBehaviourOrType):BehaviourList {
    let res:BehaviourList = [];
    getBehavioursRec_(struct, [], res);
    return res;
}

/**
 * the inverse of flatten rec which sets the behaviours in the struct
 * @private
 * @param struct
 * @param {!Object}  newVal
 * @param {!Array<?>} path
 * @param {boolean=} opt_meta if true keep meta info
 */
function setFlattenRec_(struct: StructBehaviourOrType, newVal:StructType, path:any[], opt_meta?:boolean) {
    if (newVal === undefined) {
        return;
    }
    if (path.indexOf(struct) !== -1) {
        return;
    }
    let newPath = [...path];
    newPath.push(struct);


    if (struct instanceof Behaviour) {
        if (opt_meta && isStatus(newVal)) {
            struct.metaSet(newVal as Status<any,any>);
        }
        else {
            struct.set(newVal);
        }
        return;
    }

    if (getBehaviours(struct).length === 0) {
        return;
    }
    if (struct instanceof Array) {
        for (let i = 0; i < struct.length; i++) {
            setFlattenRec_(struct[i], newVal[i], newPath, opt_meta);
        }
        return;
    }
    if (struct instanceof Object) {
        for (let prop in struct) {
            if (struct.hasOwnProperty(prop)) {
                setFlattenRec_(struct[prop], newVal[prop], newPath, opt_meta);
            }
        }
        return;
    }
}

function isFunction(val:any):boolean {
    return typeof val === 'function';
}
/**
 * @param struct
 * @param path
 * @param opt_meta if true keep meta info
 */
function flattenRec_ (struct:StructBehaviourOrType, path:any[], opt_meta?:boolean):StructType {
    if (struct instanceof Behaviour) {
        if (opt_meta) {
            return struct.metaGet();
        }
        return struct.get();
    }

    if (isFunction(struct)) {
        return struct;
    }
    if (struct && isFunction((struct as any)[FLATTEN])) {
        return (struct as any)[FLATTEN](struct);
    }
    if (path.indexOf(struct) !== -1) {
        return struct; // loop detected;
    }
    let newPath = [...path];
    newPath.push(struct);

    if (getBehaviours(struct).length === 0) {
        return struct;
    }
    let res : any;
    if (struct instanceof Array) {
        res = [];
        for (let i = 0; i < struct.length; i++) {
            res.push(flattenRec_(struct[i], newPath, opt_meta));
        }
        return res;
    }
    if (struct instanceof Object) {
        res = {};
        for (let prop in struct) {
            if (struct.hasOwnProperty(prop)) {
                res[prop] = flattenRec_(struct[prop], newPath, opt_meta);
            }
        }
        return res;
    }
    return struct;
}


/**
 * takes a structure which is either a behaviour, or a
 *       structure with behaviours, and non behaviours in it
 *       and returns a behaviour with a structure in it, note this is inversable
 *       when possible
 * @param frp
 * @param structB
 * @return
 */
export function flatten (frp:Frp, structB:StructBehaviourOrType):StructBehaviour {
    if (structB instanceof Behaviour) {
        return structB;
    }
    let args:BehaviourList = [];

    getBehavioursRec_(structB, [], args);


    if (args.length === 0) {
        return frp.createConstB(structB);
    }
    return frp.liftBI(
        () => flattenRec_(structB, []),
        (val: StructType) => setFlattenRec_(structB, val, []), ...args as BehaviourList1);
}

/**
 * takes a structure which is either a behaviour, or a
 *       structure with behaviours, and non behaviours in it
 *       and returns a behaviour with a structure in it, note this is inversable
 *       when possible
 * @param frp
 * @param structB
 */
export function flattenMeta(frp:Frp, structB:StructBehaviourOrType):StructBehaviour {
    if (structB instanceof Behaviour) {
        return structB;
    }


    let args:BehaviourList = [];

    getBehavioursRec_(structB, [], args);

    if (args.length === 0) {
        return frp.createConstB(structB);
    }
    return frp.metaLiftBI(
        () => new BStatus(flattenRec_(structB, [], true)),
        (val:StructType) => setFlattenRec_(structB, val.get(), [], true),
        ...args);

}
/**
 * takes object with the fields being behaviours and converts them into a behaviour with objects in them note: fields
 * that are not behaviours will be lost
 * @param frp
 * @param struct
 * @return
 */
export function create(frp: Frp, struct:StructType) {
    // calculate function
    const calc = ():StructType => {
        let res:StructType = {};
        for (let key in struct) {
            let obj = struct[key];
            if (obj instanceof Behaviour) {
                res[key] = obj.get();
            }
            else {
                // if it is not a behaviour just return it since it means we can add constant
                // fields
                res[key] = obj;
            }

        }
        return res;
    }

    const inv = (val: StructType) => {
        for (let key in struct) {
            let obj = struct[key];
            if (obj instanceof Behaviour) {
                obj.set(val[key]);
            }
            // if not a behaviour it is not inversable
        }
    };
    let args:BehaviourList = [];

    for (let key in struct) {
        let obj = struct[key];
        if (obj instanceof Behaviour) {
            args.push(obj);
        }
    }
    Frp.assertHasOneBehaviour(args);
    return frp.liftBI(calc, inv, ...args);
}

