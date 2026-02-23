import {
    FLATTEN,
    flatten,
    flattenMeta,
    get,
    getSubset, NO_FLATTEN,
    type StructBehaviour,
    type StructBehaviourOrType,
    type StructType
} from "../../frp/struct.ts";

import {Behaviour, Frp} from "../../frp/frp.ts";
import * as struct from "../../frp/struct.ts";
import {Messages} from "../messages.ts";
import {BoolWithExplanation} from "../booleanwithexplain.ts";
import {Message} from "../message.ts";
import {WidgetInterface} from "../widgets/widget.ts";

export interface AttachableWidget<T extends Element= Element> extends WidgetInterface<T> {
    attachStruct(val: StructBehaviourOrType):void
}

type RemainingType = { [index: string]: (string | StructType) };

type OptionToShape<T> =
    T extends string ? { [K in T]: any } :
        T extends Record<string, any> ? { [K in keyof T]?: T[K] } :
            never;

type MergeShapes<T extends any[]> =
    T extends [infer Head, ...infer Tail]
        ? OptionToShape<Head> & MergeShapes<Tail>
        : {};


function forEachParam(args:(StructType|string)[], cb:(param:string, def:StructType) => void) {
    for (let name of args) {
        for (let func of makeFunctionParams(name)) {
            for(let param of func.params) {
                cb(param, func.def[param]);
            }
        }
    }
}

const DATA = Symbol("DATA");
export const getGroup = Symbol("getGroup");
const REMAINING = Symbol("remaining");
const STRUCT = Symbol("struct");

type BondRecordType<T extends Record<string, any>> = {
    [K in keyof T]: ()=> Behaviour<T[K]>;
}
export class BoundOptionsType<Type extends Record<string, any>> {

    [index: string]: () => Behaviour<any>;
    [DATA]:{ optionsB: StructBehaviour, params: (string|StructType)[] };

    constructor(params:(string|StructType)[],optionsB: StructBehaviour) {
        this[DATA] = {optionsB,params};
    }
    /**
     * get all the fields specified fields as a struct, the main use
     * of this is to reduce amount of behaviours in the system as opposed to breaking up
     * each
     * @param fields the fields in the group
     * @param opt_lift lift function you could do this with a liftB however
     * since we are trying to reduce behaviours I have added it
     * @param  opt_inv
     * @return
     */
    [getGroup]<T>(fields:(string|(() => any))[], opt_lift?:(v:StructType) => T, opt_inv?: (v:T) => StructType): Behaviour<T> {
        let defs: StructType = {};
        const data = this[DATA];
        let revFnMap = new Map<any,string>();
        for (let k in this) {
            revFnMap.set(this[k], k);
        }
        fields = fields.map(field => revFnMap.get(field) || field);
        forEachParam(data.params, (param, def) =>{
            for (let field of fields) {
                if (param === field) {
                    defs[param] = def;
                }
            }
        });

        return getSubset(data.optionsB, defs, opt_lift, opt_inv);
    }

}

export class UnboundOptionsType {
    private readonly [STRUCT]: StructType;
    private readonly [REMAINING]: RemainingType;

    [key: string]: any;

    constructor(remaining: RemainingType, struct: StructType, setFunctions: Map<string, (...args: any[]) => UnboundOptionsType>) {
        this[REMAINING] = remaining;
        this[STRUCT] = struct;
        for (let [key, value] of setFunctions) {
            this[key] = value;
        }
    }

    struct(): StructType {
        checkRemaining(this[REMAINING]);
        return this[STRUCT];
    }

    attach(widget: AttachableWidget) {
        checkRemaining(this[REMAINING]);
        widget.attachStruct(this[STRUCT]);
    }



}



export class OptionsType<Type extends Record<string, any>> extends UnboundOptionsType {
    private readonly args: (string | StructType)[];

    constructor(remaining: RemainingType, struct: StructType,
                setFunctions: Map<string, (...args: any[]) => UnboundOptionsType>,
                args: (string | StructType)[]) {
        super(remaining, struct, setFunctions);
        this.args = args;
    }

    bind(frp: Frp, val:StructBehaviourOrType):BoundOptionsType<Type> {
        let optionsB = flatten(frp, val);
        optionsB.setName('bindOptionsB');
        let res = new BoundOptionsType(this.args, optionsB);

        forEachParam(this.args, (param, def)=> {
            res[param] = ()=> {
                return get(param, optionsB, def);
            };
        });
        return res;
    };

    /**
     * will just return behaviour will all the values
     */
    bindAll(frp: Frp, val: StructBehaviourOrType): Behaviour<StructType> {
        let optionsB = flatten(frp, val);
        return frp.liftBI((v) => {
            v = {...v};
            for (let name of this.args) {
                for (let func of makeFunctionParams(name)) {
                    for (let param of func.params) {
                        if (!v.hasOwnProperty(param)) {
                            v[param] = func.def[param];
                        }
                    }
                }
            }
            return v;
        }, (v: StructType) => {
            optionsB.set(v);
        }, optionsB);
    }

    bindWithStatusIfNotGood(frp: Frp, val: StructBehaviourOrType): BoundOptionsType<StructType> {
        let optionsB = flattenMeta(frp, val);
        let res=  new BoundOptionsType(this.args, optionsB);
        for (let name of this.args) {

            for (let func of makeFunctionParams(name)) {
                for (let param of func.params) {
                    res[param] = ()=> {
                        return struct.getWithStatusIfNotGood(param, optionsB, func.def[param]);
                    }
                }
            }

        }
        return res;
    };

}

function checkRemaining(remaining: any) {
    for (let name in remaining) {
        let r = remaining[name];
        if (!(r instanceof Object)) {
            throw Error('missing argument');
        }
    }

}

function mkSetFunc(inStruct: StructType, inRemaining: RemainingType, name:any, params:string[]): ((...args: any[]) => UnboundOptionsType) {
    return (...var_vals: any[]): UnboundOptionsType => {
        let struct = {...inStruct};
        let remaining = {...inRemaining};

        delete remaining[name];

        if (name instanceof Object) {
            for (let n in name) {
                struct[n] = var_vals;
            }
        } else {
            if (var_vals.length !== params.length) {
                throw 'Invalid number of arguments';
            }
            for (let i = 0; i < var_vals.length; i++) {
                struct[params[i]] = var_vals[i];
            }
        }
        let getFunctions = new Map<string, (...args: any[]) => UnboundOptionsType>();

        for (let name1 in remaining) {
            makeFunctionParams(remaining[name1]).forEach(function (func) {
                getFunctions.set(func.name, mkSetFunc(struct, remaining, func.name, func.params));
            });
        }
        return new UnboundOptionsType(remaining, struct, getFunctions);
    };
}

/**
 * This is a utility that creates an object that will do some checking on structs
 * passed to widgets in the widgets create a constant like so:
 *
 * var options = recoil.frp.Util.Options('a', {b : 'def1', c: 'def'}, 'x(a,b)');
 *
 * when using it to create the structure do the following
 * var struct = options.a(1).x(2,4).b('fish');
 *
 * the values passed can be normal values or behaviours.
 *
 * then either do
 *
 * struct.attach(widget) or struct.attachStruct(struct.struct()) to attach the data
 *
 * in the widget to access the values do the following
 *
 * var bound = options.bind(struct);
 *
 * the to access the behaviours, that will have defaults populated do:
 *
 * var valB = bound.a(); to access a
 *
 * the following describes the format the var_options parameter, their can be any number of them
 * and as long as the names don't clash it should work
 *
 * all identifiers should be valid javascript identifies for ease of use
 *
 * there are 3 types of values that var_options can have:
 *
 * 1. simple string e.g. 'value', this means the user must specify the item as no default is provided
 * 2. function e.g. 'render(button, menu)' this requires the user of the widget to provide all the parameters
 *             this is useful when groups of parameters must be specified together.
 *             The values can be accessed inside the widget in this example by bound.render_button and bound.render_menu
 * 3. An object, this provides a mechanism for specifying defaults, the keys can be like 1 and 2 and the default values are
 *               the values, you can either specify multiple keys in 1 object or multiple object parameters.
 *               To specify defaults of functions (type 2) the default should be an object with fields matching the parameters
 *
 * @param  options
 * @return this has dynamic fields based on the parameters, and struct, attach, and bind function
 *
 */

export function Options<T extends (string | Record<string, any>)[]>(...options: (string | StructType)[]) : OptionsType<MergeShapes<T>> {
    let remaining: RemainingType = {};
    let getFunctions = new Map<string, (...args: any[]) => UnboundOptionsType>();


    let setFunctions = new Map<string, any>();
    for (let option of options) {
        for (let func of makeFunctionParams(option)) {
            remaining[func.name] = option;
        }
    }
    // this has to be in a different loop because we need to make a clone
    // of remaining, if we do it first the clone will not be correct

    for (let option of options) {
        for (let func of makeFunctionParams(option)) {
            setFunctions.set(func.name, mkSetFunc({}, remaining, func.name, func.params));
        }
    }

    return new OptionsType({}, remaining, setFunctions, options);
}


/**
 * @see recoil.frp.Util.Options
 * like the frp util option but puts in some standard options by default
 *
 * the following are the current opptions that are added,editable
 *   enabled recoil.ui.BoolWithExplanation the reason this is a boolwith explanation, is that I want the user to be reminded to think
 *     about providing the users a reason as to why something is disabled
 *   tooltip recoil.ui.message type the reason this is a message and not a string, is because I want to force, the user to use a message
 *     for language portablity
 *
 *
 * @param {...(string|!Object)} var_options
 * @return {!recoil.frp.Util.OptionsType} this has dynamic fields based on the parameters, and struct, attach, and bind function
 *
 */
export function StandardOptions<T extends (string | Record<string, any>)[]>(...options: T):OptionsType<MergeShapes<T & {
    editable:boolean,
    tooltip: string| Message,
    enabled: BoolWithExplanation,
}>> {
    let args = [{
        editable: true,
        tooltip: Messages.BLANK,
        enabled: BoolWithExplanation.TRUE
    }];
    return Options(...[...args, ...options]);
}

export function getStandardOptionsGroup<T, BoundT extends (string | Record<string, any>)[] = any[]>(bound: BoundOptionsType<BoundT>, fields:(string|(() => any))[], opt_lift?:(v:StructType) => T, opt_inv?: (v:T) => StructType):Behaviour<T & {
    enabled:BoolWithExplanation, editable: boolean, tooltip:Message|string}> {
  return bound[getGroup](fields.concat([bound.enabled, bound.tooltip, bound.editable]), opt_lift, opt_inv) as any;
}

export function getOptionsGroup<T, BoundT extends (string | Record<string, any>)[] = any[]>(bound: BoundOptionsType<BoundT>, fields:(string|(() => any))[], opt_lift?:(v:StructType) => T, opt_inv?: (v:T) => StructType):Behaviour<T> {
    return bound[getGroup](fields, opt_lift, opt_inv) as any;
}
export type StandardOptionsType = {
    editable?: boolean;
    tooltip?: Message,
    enabled?: BoolWithExplanation;
}

export type StandardOptionsBoundType = {
    editable: boolean;
    tooltip: Message,
    enabled: BoolWithExplanation;
}

type ParamInfo = { name: string, params: string[], def: StructType };

/**
 * @param name
 * @param opt_defVal
 * @return
 */
function makeFunctionParams(name: StructType | string, opt_defVal?: any): ParamInfo[] {
    if (name instanceof Object) {
        let objRes = [];
        for (let n in name) {
            for (let p of makeFunctionParams(n, name[n])) {
                objRes.push(p);
            }
        }
        return objRes;
    }


    let defMap: StructType = {};
    name = name.trim();

    let startIndex = name.indexOf('(');
    if (startIndex !== -1 || name.endsWith(')')) {

        let prefix = name.substring(0, startIndex).trim();
        let params = name.substring(startIndex + 1, name.length - 1);
        let paramArr = params.split(',');
        let res = [];
        for (let p of paramArr) {
            p = p.trim();
            res.push(prefix + '_' + p);
            if (opt_defVal) {
                if (!opt_defVal.hasOwnProperty(p)) {
                    throw 'you must specify ' + p;
                }
                defMap[prefix + '_' + p] = opt_defVal[p];
            }
        }
        return [{name: prefix, params: res, def: defMap}];
    } else {
        if (opt_defVal !== undefined) {
            defMap[name] = opt_defVal;
        }
        return [{name: name, params: [name], def: defMap}];
    }
}
