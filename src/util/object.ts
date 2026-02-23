import Sequence from "./sequence.ts";

const FUNC_KEY = Symbol('FuncKey');
export const EQUALS = Symbol('EQUALS');

export function defaultCompare(a:any, b:any): number {
    return a > b ? 1 : a < b ? -1 : 0;
}

export function firstKey(obj:Record<string, any>):string {
    for (let key in obj) {
        return key;
    }
    return '';
}

/**
 * @template T
 * @param {T} value
 * @return {T}
 */
export function safeFreeze (value: any) {

    if (value instanceof Object) {
        if (Object.isFrozen && !Object.isFrozen(value)) {
            var result = Object.create(value);
            Object.freeze(result);
            return result;
        }
    }
    return value;

}

/**
 * @param {function(...)} func
 * @param {?} key
 * @param {?} data
 * @return {function(...)} just the function passed in for convience
 */

export function makeEqualFunc<T extends (...p:any[]) => any> (func:T, key:Symbol, data:any):T {
    (func as any)[FUNC_KEY] = {key: key, data: data};

    (func as any).equals = (that:any)=> {
        return that && isEqual(that[FUNC_KEY], (func as any)[FUNC_KEY]);
    };

    return func;

}

/**
 * calls compare on all arguments, returns the first non-zero result
 *
 */
export function compareAll(values: {x: any, y: any}[]): number | undefined{
    for (let i = 0; i < values.length; i++) {
        let  res = compare(values[i].x, values[i].y);
        if (res !== 0) {
            return res;
        }
    }
    return 0;
}


/**
 * a generic compare function that compares only the key
 * field in the object
 *
 * @param {{key}} a
 * @param {{key}} b
 * @return {number}
 */
export function compareKey(a: {key:any}, b: {key:any}):number {
    return compare(a.key, b.key) as number;
}


/**
 * a unique object that cloning or equal ensures
 * @private
 * @constructor
 */
class UniqObject_ {
    private static seq_ = new Sequence();

    private id_: bigint = UniqObject_.seq_.nextLong();

    clone() : UniqObject_ {
        return this;
    }

    equal(that: any): boolean {
        return this === that;
    }
}



export function uniq() : any {
    return new UniqObject_();
}

export  function compare3<T>(a:T[], b: T[], cmp:(x:T,b:T) => number) {
    for (let i = 0; i < a.length && i < b.length; i++) {
        let res = cmp(a[i], b[i]);
        if (res !== 0) {
            return res;
        }
    }
    return a.length - b.length;

}

/**
 *
 * A negative number, zero, or a positive number as the first
 *     argument is less than, equal to, or greater than the second,
 *     respectively.
 */
export function compare(a:any, b:any, ignore: Set<string> = new Set(), aPath:Set<any> = new Set(), bPath: Set<any> = new Set()): number {
    // check for loops
    const aIndex = setIndexOf(a,aPath);
    const bIndex = setIndexOf(b, bPath);
    if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === bIndex) {
            return 0;
        }
        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
        }
        return aIndex === -1 ? 1 : -1;
    }

    if (a === b) {
        return 0;
    }

    if (a === undefined) {
        return -1;
    }

    if (b === undefined) {
        return 1;
    }
    if (a === null) {
        return -1;
    }

    if (b === null) {
        return 1;
    }

    var res;
    if (a.compare !== undefined && a.compare instanceof Function) {
        res = a.compare(b);
        if (res !== undefined) {
            return res;
        }
    }
    if (b.compare !== undefined && b.compare instanceof Function) {
        res = b.compare(a);
        if (res !== undefined) {
            return -res;
        }
    }

    let aInfo = COMPARE_MAP.get(a.__proto__);
    let bInfo = COMPARE_MAP.get(b.__proto__);

    if (aInfo || bInfo) {
        if (aInfo && !bInfo) {
            return -1;
        }
        if (!aInfo && bInfo) {
            return 1;
        }
        if (aInfo !== bInfo) {
            return mapIndexOf(a.__proto__, COMPARE_MAP) - mapIndexOf(b.__proto__, COMPARE_MAP);
        }
        // @ts-ignore
        // aInfo cannot be undefined
        return  aInfo.compare(a, b, ignore, aPath, bPath);
    }

    // if 1 and only 1 of a and b is an array
    if ((a instanceof Array) != (b instanceof Array)) {
        if (a instanceof Array) {
            return 1;
        }
        return -1;
    }
    let newAPath = new Set([...aPath, a]);
    let newBPath = new Set([...bPath, b]);

    if (a instanceof Array) {
        return compare3(a,b, (x, y) => compare(x,y, ignore, newAPath, newBPath) as number);
    }

    if (a instanceof Object && b instanceof Object) {
        let aKeys: string[] = [];
        let bKeys: string[] = [];
        for (var k in a) {
            if (a.hasOwnProperty(k)) {
                aKeys.push(k);
            }
        }
        for (let k in b) {
            if (b.hasOwnProperty(k)) {
                bKeys.push(k);
            }
        }
        aKeys.sort();
        bKeys.sort();

        res = compare3(aKeys, bKeys, (x, y) => x.localeCompare(y));
        if (res !== 0) {
            return res;
        }
        let skiped = false;
        for (let i = 0; i < aKeys.length; i++) {
            let k = aKeys[i];
            res = compare(a[k], b[k], ignore, newAPath, newBPath);
            if (res === undefined) {
                skiped = true;
                continue;
            }
            if (res !== 0) {
                return res;
            }
        }
        return (skiped ? undefined : 0) as number;
    }
    if (a instanceof Object) {
        return -1;
    }
    if (b instanceof Object) {
        return 1;
    }
    if (typeof(a) === typeof(b)) {
        return defaultCompare(a, b);
    }

    return defaultCompare(typeof(a), typeof(b));
}

/**
 * compares 2 objects
 *
 * @return {boolean}
 */
export function isEqual(a:any, b:any, ignore:Set<string> = new Set(), aPath: Set<Object> =new Set(), bPath:Set<Object> = new Set()) {
    return isEqualRec(a, b, ignore, aPath, bPath);
}


/**
 * converts value to a string dealing with loops
 */
export function toString(obj:any, opt_path: any[] = []) :string {
    const func1 = {}.toString;
    const func2 = [].toString;

    const toStringRec = function(o:any, path: any[]): string {
        let index = path.indexOf(o);
        if (index !== -1) {
            return '<loop{' + index + '}>';
        }
        if (o.toString !== undefined && o.toString !== func1 && o.toString !== func2 && o.toString instanceof Function) {
            try {
                return o.toString(path);
            }
            catch (e) {
                return '' + o;
            }
        }
        if (o instanceof Array) {
            var ares = [];
            path.push(o);
            for (var i = 0; i < o.length; i++) {
                ares.push(toStringRec(o[i], path));
            }
            path.pop();
            return '[' + ares.join(',') + ']';
        }
        if (o instanceof Object) {
            var ores = [];
            path.push(o);
            for (var k in o) {
                if (o.hasOwnProperty(k)) {
                    ores.push(k + ':' + toStringRec(o[k], path));
                }
            }

            path.pop();
            return '{' + ores.join(',') + '}';
        }
        return '' + o;
    };

    return toStringRec(obj, opt_path || []);
}

/**
 * use this for equals utility if you are a container, it will stop loops
 * @param {*} a
 * @param {*} b
 * @param {!Array<Object>} aPath
 * @param {!Array<Object>} bPath
 * @param {!Array<string>} debugPath
 * @param {!Object} ignore
 * @return {boolean}
 */
export function isContainerEqual(a: any, b: any, ignore:Set<any> = new Set(), aPath:Set<any> = new Set, bPath: Set<any> = new Set()):boolean {
    return isEqualRec(a, b, ignore, aPath, bPath);
}

function mapIndexOf(val: any, aMap:Map<any, any>)  {
    let i = -1;
    for (let [k, mVal] of aMap) {
        i++;
        if (k === val) {
            return i;
        }
    }
    return -1;
}

function setIndexOf(val: any, aSet:Set<any>)  {
    let i = -1;
	for (let v of aSet) {
	    i++;
        if (v === val) {
			return i;
		}
	}
	return -1;
}


const COMPARE_MAP: Map<any, {
    equal:(x:any, y:any, ignore: Set<any>, xPath : Set<any>, yPath: Set<any>) => boolean,
    compare: (x:any,y: any, ignore: Set<any>, xPath : Set<any>, yPath: Set<any>) => number}> = new Map();
type Nullable<T> = T | null;

export function registerCompare<T>(
    cls: any,
    compare: (x:T,y: T, ignore: Set<string>, xPath : Set<Object>, yPath: Set<Object>)=> number,
    equal: Nullable<(x:T, y:T, ignore: Set<string>, xPath : Set<Object>, yPath: Set<Object>) => boolean> = null
) {
    COMPARE_MAP.set(cls.prototype, {
        equal: equal || ((x:T, y:T, ignore: Set<any> = new Set(), xPath: Set<any> = new Set(), yPath:Set<any> = new Set()) => compare(x, y, ignore, xPath, yPath) === 0),
        compare: compare
    })
}
let nextFunctionId:bigint = 0n;
let functionIdMap = new WeakMap<any,bigint>();

function compareFunction(a:any, b:any, ignore:Set<string>, aPath:Set<Object>, bPath:Set<Object>):number {
    if (a === b) {
        return 0;
    }
    let aId = functionIdMap.get(a);
    let bId = functionIdMap.get(b);

    if (aId === undefined) {
        aId = nextFunctionId++;
        functionIdMap.set(a, aId);
    }
    if (bId === undefined) {
        bId = nextFunctionId++;
        functionIdMap.set(b, bId);
    }

    return aId === bId ? 0 : (aId < bId ? -1 : 1);


}


function compareSet(a:Set<any>, b:Set<any>, ignore:Set<string>, aPath:Set<Object>, bPath:Set<Object>):number {
    if (a.size != b.size) {
        return a.size - b.size;
    }

    let newAPath:Set<Object> = new Set([...aPath, a]);
    let newBPath:Set<Object> = new Set([...bPath, b]);

    let aList = [...a].sort((x,y) => compare(x, y, ignore, newAPath, newBPath) as number);
    let bList = [...b].sort((x,y) => compare(x, y, ignore, newAPath, newBPath) as number);

    return compare3(aList, bList, (a, b) => compare(a, b, ignore, newAPath, newBPath) as number);

}


registerCompare(Date,
    (x: Date, y: Date) => x.getTime() - y.getTime(),
    (x :Date, y: Date) => x.getTime() === y.getTime());
registerCompare(Function, compareFunction);
registerCompare(Set, compareSet);
registerCompare(Map, (a: Map<any,any>, b: Map<any,any>, ignore: Set<any>, aPath:Set<any>, bPath:Set<any>): number => {
    if (a.size != b.size) {
        return a.size - b.size;
    }
    let newAPath:Set<Object> = new Set(aPath);
    let newBPath:Set<Object> = new Set(bPath);
    newAPath.add(a);
    newBPath.add(b);

    let keySetA = new Set();
    let keySetB = new Set();

    for (const [key, aValue] of a) {
        if (!b.has(key)) {
            keySetA.add(key);
        }
    }
    for (const [key, aValue] of a) {
        if (!a.has(key)) {
            keySetB.add(key);
        }
    }
    if (keySetA.size != 0) {
        return compareSet(keySetA, keySetB, aPath, bPath, ignore);
    }

    for (const [key, aValue] of a) {
        // I think we don't need to do anything special with key because
        // we define the lookup as same value zero equality otherwize we couldn't use a map

        let bValue = b.get(key);
        let res = compare(aValue, bValue, ignore, aPath, bPath) as number;
        if (res !== 0) {
            return res;
        }
    }
    return 0;
});

function isEqualRec(a: any, b: any, ignore: Set<string>, aPath:Set<Object>, bPath:Set<Object>) {
		// check for loops
    const aLoop = aPath.has(a);
    const bLoop = bPath.has(b);

	if (aLoop != bLoop) {
		return false;
    }
	if (aLoop) {
        return setIndexOf(a, aPath) == setIndexOf(b, bPath);
    }
	if (a === b) {
		return true;
	}

	if (a === undefined || b === undefined || a === null || b === null) {
		return false;
    }

    if (a[EQUALS] instanceof Function) {
        return a[EQUALS](b, ignore, aPath, bPath);
    }
    if (b[EQUALS] instanceof Function) {
        return b[EQUALS](a, ignore, bPath, aPath);
    }

    if (a.equals instanceof Function) {
        return a.equals(b, ignore, aPath, bPath);
    }


    if (b.equals instanceof Function) {
        return b.equals(a, ignore, bPath, aPath);
    }

    if (a instanceof Function || b instanceof Function) {
        return false;
    }
    if ((a instanceof Array) != (b instanceof Array)) {
        return false;
    }

    if (typeof (a) == 'number' && typeof(b) == 'number') {
        return (isNaN(a) && isNaN(b)) || a === b;
    }

    let aInfo = COMPARE_MAP.get(a.__proto__);
    let bInfo = COMPARE_MAP.get(b.__proto__);

    if (aInfo || bInfo) {

        // not strictly necessary but the compiler complains
        if (aInfo && bInfo) {
            return aInfo === bInfo && aInfo.equal(a, b, ignore, aPath, bPath);
        }
        return false
    }


	if (a instanceof Array || b instanceof Array) {
        if (!(a instanceof Array) || !(b instanceof Array) || a.length !== b.length ) {
            return false;
        }

        let newAPath:Set<Object> = new Set(aPath);
        let newBPath:Set<Object> = new Set(bPath);
        newAPath.add(a);
        newBPath.add(b);

        for (let i = 0; i < a.length; i++) {
            if (!isEqualRec(a[i], b[i], ignore, newAPath, newBPath)) {
                return false;
            }
        }
        return true;
    }

    if (a instanceof Object && b instanceof Object) {
        if (b instanceof Object) {
            let newAPath:Set<Object> = new Set(aPath);
            let newBPath:Set<Object> = new Set(bPath);

            newAPath.add(a);
            newBPath.add(b);

            for (let k in a) {
                if (ignore.has(k)) {
                    continue;
                }
                if (!(k in b) || !isEqualRec(a[k], b[k], ignore, newAPath, newBPath)) {
                    return false;
                }
            }

            for (let k in b) {
                if (ignore.has(k)) {
                    continue;
                }
                if (!(k in a)) {
                    return false;
                }
            }
            return true;
        }
    }
    return false;
}


/**
 * @param {!Object} source
 * @param {...!Object} var_args
 */
export function addProps(src:{ [index: string]:any}, ...args : { [index: string]:any} []) {

    for (let arg of args) {
        for (let prop in arg) {
            if (arg.hasOwnProperty(prop)) {
                src[prop] = arg[prop];
            }
        }
    }
}

/**
 * @param {Object} obj
 * @return {Object}
 */

export function removeUndefined(obj: { [index: string]:any}) {
    for (let k in obj) {
        if (obj[k] === undefined) {
            delete obj[k];
        }
    }
    return obj;
}

export function getByParts(obj:{ [index: string]:any}, parts: string[]) : any {
    let cur = obj;
    for (var i = 1; i < arguments.length; i++) {
        if (!(cur instanceof Object)) {
            return undefined;
        }
        cur = cur[arguments[i]];
    }
    return cur;
}

export function toRecord(obj: Record<string, any>):Record<string, any> {
    let res:Record<string, any> = {};
    for (let k in obj) {
        // note this can't check has own property
        res[k] = obj[k];
    }
    return res;
}

export function clone<T>(obj:T, opt_used : WeakMap<any,any> = new WeakMap()) :T {
    return cloneRec_(obj, opt_used);
}
/**
 * @template T
 * @private
 * @param {T} obj the object to clone
 * @param {!WeakMap} used
 * @return {T}
 */
function cloneRec_<T>(obj:any, used: WeakMap<any,any> = new WeakMap()): T {

    if (obj && typeof obj == 'object') {
        var me = used.get(obj);
        if (me) {
            return me;
        }
        if (obj.clone instanceof Function) {
            return obj.clone(used);
        }

        var clone = obj instanceof Array ? [] : Object.create(Object.getPrototypeOf(obj));

        used.set(obj, clone);
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                clone[key] = cloneRec_(obj[key], used);
            }
        }

        return clone;
    }

    return obj;
}

/**
 * make an object a constant, this means clone and equal only compare pointers
 * @template T
 * @param {!T} obj
 * @return {!T}
 */
export function constant(obj:any) {
    obj.clone = function() {
        return obj;
    };
    obj.equals = function(that:any) {
        return obj === that;
    };

    return obj;
}
