import assert from "node:assert/strict";
import {isEqual} from "./util/object.ts";

export function assertEquals(expected:any, y:any, opt_last?:any ) {
    if (arguments.length === 2) {
        assert.equal(y, expected);

    }
    else {
        assert.equal(y, opt_last);

    }
}
export function assertNotEquals(expected:any, y:any, opt_last?:any ) {
    if (arguments.length === 2) {
        assert.equal(y === expected, false);

    }
    else {
        assert.equal(y === opt_last, false);

    }
}

export function assertTrue(x:any):void;
export function assertTrue(x:string, y?:any):void
export function assertTrue(x:any, y?:any):void {
    if (arguments.length === 2) {
        assert.equal(y, true);
    }
    else {
        assert.equal(x, true);
    }
}
export function assertFalse(x:any):void;
export function assertFalse(x:string, y?:any):void
export function assertFalse(x:any, y?:any) {
    if (arguments.length === 2) {
        assert.equal(y, false);
    }
    else {
        assert.equal(x, false);
    }
}

export function assertNull(x:any) {
    assert.strictEqual(x, null);
}

export function assertUndefined(x:any) {
    assert.strictEqual(x, null);
}

export function assertThrows(func:() => void) {
    assert.throws(func)
}

export function assertObjectEquals(actual:any, expected:any, opt_last?:any) {
    if (arguments.length === 2) {
        assert.deepStrictEqual(actual, expected);
    }
    else {
        assert.deepStrictEqual(expected, opt_last);
    }
}

export function assertArrayEquals(actual:any[], expected:any[], opt_last?:any) {
    if (arguments.length === 2) {
        assert.deepStrictEqual(actual, expected);
    }
    else {
        assert.deepStrictEqual(expected, opt_last);
    }
}

export function assertEqualIgnoreOrder(actual:any[], expected:any[]) {
    if (actual.length !== expected.length) {
        assert.fail("sets length not equal");
    }

    const countAppears = (v: any, list:any[]) => {
        let res = 0;
        for (let item of list) {
            if (isEqual(v, item)) {
                res++;
            }
        }
        return res;
    }
    for (let a of actual) {
        let aCount = countAppears(a, actual);
        let eCount = countAppears(a, expected);
        if (aCount !== eCount) {
            assert.fail(a, `appears ${aCount} times in actual but only ${eCount} times in expected`)
        }
    }
}