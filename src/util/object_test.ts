import assert from 'assert/strict';
import test from 'node:test';


import {isEqual, toString, compare, clone, makeEqualFunc} from './object.ts'

test("func equal", () => {
    let f1 = () => {
    };
    let f2 = () => {
    };
    let f3 = () => {
    };
    let f4 = () => {
    };
    assert.equal(isEqual(f1, f2), false);
    let id = Symbol();
    let id2 = Symbol();
    makeEqualFunc(f1, id, 1);
    makeEqualFunc(f2, id, 1);
    makeEqualFunc(f3, id, 2);
    makeEqualFunc(f4, id2, 1);
    assert.equal(isEqual(f1, f2), true);
    assert.equal(isEqual(f2, f1), true);
    assert.equal(isEqual(f1, f3), false);
    assert.equal(isEqual(f3, f1), false);
    assert.equal(isEqual(f1, f4), false);
    assert.equal(isEqual(f4, f1), false);

});
test("test equal", () => {
    const overrideEquals = {
        equals: function () {
            return true;
        }
    };

    class Override {
        equals() {
            return true;
        }
    }

    const loopTestA: any = {
        v: 'a',
        some: {}
    };
    let loopTestB: any = {
        v: 'a',
        some: {}
    };

    loopTestA.some.me = loopTestA;
    loopTestB.some.me = loopTestB;
    assert.equal(isEqual(loopTestA, loopTestB), true, 'loop eq');

    loopTestB.some.me = loopTestA;
    assert.equal(isEqual(loopTestA, loopTestB), false, 'loop neq');

    assert.equal(isEqual(overrideEquals, [1, 2, 3]), true, 'override left');
    assert.equal(isEqual(new Override(), [1, 2, 3]), true, 'override left');
    assert.equal(isEqual([1, 2, 3], overrideEquals), true, 'override right');
    assert.equal(isEqual([1, 2, 3], [1, 2, 3]), true, 'array eq');
    assert.equal(isEqual([1, 2, 3], [1, 2, 4]), false);
    assert.equal(isEqual([1, 2, 3], [1, 2, 3, 4]), false);
    assert.equal(isEqual([1, 2, 3, 4], [1, 2, 3]), false);
    assert.equal(isEqual([1, 2, 3], [1, 2, 3]), true);
    assert.equal(isEqual(1, 1), true);

    assert.equal(isEqual({
        foo: 'a'
    }, {
        foo: 'a'
    }), true);
    assert.equal(isEqual({foo: 'a'}, {
        foo: 'a',
        b1: 'a'
    }), false);
    assert.equal(isEqual({foo: 'b'}, {
        foo: 'a'
    }), false);
    assert.equal(isEqual(3, 2), false);
    assert.equal(isEqual(undefined, 2), false);
    assert.equal(isEqual(2, undefined), false);

    assert.equal(isEqual(null, 2), false);
    assert.equal(isEqual(2, null), false);

    assert.equal(isEqual(1n, 1n), true);
    assert.equal(isEqual(2n, 1n), false);
    var a = 1;
    assert.equal(isEqual(function () {
        return a;
    }, function () {
        return 2;
    }), false);

    var func = function () {
    };
    assert.equal(isEqual(func, func), true);

    var funcA: any = function () {
    };
    var funcB = function () {
    };
    var funcC = function () {
    };

    funcA.equals = function (other: any) {

        return other === funcA || other === funcB;
    };
    assert.equal(isEqual(funcA, funcB), true);
    assert.equal(isEqual(funcA, funcC), false);
});

test("to string", () => {
    let obj: { [index: string]: any } = {};
    obj.toString = function () {
        return 'foo';
    };
    let l1: { [index: string]: any } = {};
    let l2: { [index: string]: any } = {a: l1};
    l1.a = l2;
    assert.equal('{a:b}', toString({a: 'b'}));
    assert.equal('[{a:b},{b:c}]', toString([{a: 'b'}, {b: 'c'}]));
    assert.equal('[foo]', toString([obj]));
    assert.equal('[{a:{a:<loop{1}>}}]', toString([l1]));
});

function semetricCompare(a: any, b: any, expected: number) {

    if (expected !== 0) {
        let dir = expected < 0 ? 1 : -1;
        assert.equal(dir * compare(a, b) < 0, true);
        assert.equal(dir * compare(b, a) > 0, true);

    } else {
        assert.equal(compare(a, b), 0);
        assert.equal(compare(b, a), 0);
    }
}

test("compare", () => {
    assert.equal(compare('a', 'a'), 0);
    semetricCompare('a', 'b', -1);

    var res = compare('1', 1);
    assert.notEqual(res, 0);
    assert.notEqual(compare(1, '1'), 0);
    assert.notEqual(compare(1, '1') > 0, res > 0);

    assert.equal(compare([1, 2, 3], [1, 2, 3]), 0);
    semetricCompare([1, 2, 3], [1, 2, 3, 4], -1);

    let f1 = () => true;
    let f2 = () => false;
    res = compare(f1, f2);
    assert.equal(res != 0, true);
    assert.equal(compare(f2, f1) == -res, true);
    assert.equal(compare(f1, f1) == 0, true);
    assert.equal(compare(f2, f2) == 0, true);
    assert.equal(compare(1, 1), 0);
    semetricCompare(1, 2, -1);

    assert.equal(compare({
        foo: 'a'
    }, {
        foo: 'a'
    }), 0);

    semetricCompare({
        foo: 'b'
    }, {
        foo: 'a'
    }, 1);


    let loopTestA: { [index: string]: any } = {
        v: 'a',
        some: {}
    };
    let loopTestB: { [index: string]: any } = {
        v: 'a',
        some: {}
    };

    loopTestA.some.me = loopTestA;
    loopTestB.some.me = loopTestB;

    assert.equal(compare(loopTestA, loopTestB), 0);

    loopTestB.some.me = loopTestA;
    semetricCompare(loopTestA, loopTestB, -1);
    //comparing different types
    semetricCompare({a: 1, b: 1}, {a: 'x', b: 1}, -1);


});

test("clone", () => {
    class O1 {
        private a_: any;

        constructor(a: any) {
            this.a_ = a;
        }

        getA() {
            return this.a_;
        }

        setA(a: any) {
            this.a_ = a;
        }
    }


    let x: any = new O1(1);
    let arr = [1, 2, 3];

    let cloneX: any = clone(x);
    let cloneArr = clone(arr);

    assert.equal(x instanceof O1, true, "instance x");
    assert.equal(cloneX instanceof O1, true, "instance clone");

    assert.equal(cloneX.getA(), 1, "attrib");
    x.setA(3);
    assert.equal(x.getA(), 3, "attrib x changed");
    assert.equal(cloneX.getA(), 1, "attrib clone changed");

    assert.deepEqual(arr, cloneArr, "array equals");

    let a: any = {n: 'a', x: null, y: undefined};
    let b = {n: 'b', v: a};
    a.v = b;
    //test a loop
    cloneX = clone(a);

    cloneX.f = 1;
    assert.equal(cloneX.v.v.f, 1, "set");
    assert.equal(cloneX.x === null, true, "null check");
    assert.equal(cloneX.hasOwnProperty('y'), true, "undefined exists check");
    assert.equal(cloneX.y === undefined, true, "undefined check");
    assert.equal(cloneX.v.v === cloneX, true, "loop 1");
    assert.equal(cloneX.v === cloneX.v.v.v, true, "loop 2");
    assert.equal(cloneX !== a, true, "loop diff");

    // this test I expect to fail don't know how to get round it yet

    let src = (function () {
        var a = 1;
        return {
            setA: function (v: any) {
                a = v;
            },
            getA: function () {
                return a;
            }
        };
    })();

    cloneX = clone(src);

    assert.deepEqual(cloneX, src);
    assert.equal(1, src.getA(), "good get src");
    cloneX.setA(2);
    assert.equal(cloneX.getA(), 2, "good get clone");
//    assertEquals("bad get src", 1, src.getA());


    // test reference to same object
    x = {};
    var y = {a: x, b: x};

    cloneX = clone(y);

    assert.deepEqual(y, cloneX);

    assert.deepEqual({}, cloneX.a);
    assert.deepEqual({}, cloneX.b);

    assert.equal(cloneX.a === cloneX.b, true);
    assert.equal(cloneX.a !== y.a, true);
});
