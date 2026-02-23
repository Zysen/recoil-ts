import assert from "node:assert/strict";
import test from "node:test";
import {BStatus, Frp} from "./frp.ts";
import {create, extend, FLATTEN, flatten, getBehaviours, NO_FLATTEN} from "./struct.ts";

import * as struct  from "./struct.ts";

function arrayEqualsOrderIrrelevant(actual:any[], expected:any[]): void {
    assert.equal(actual.length, expected.length);

    for (let el of actual) {
        assert.notEqual(expected.indexOf(el) , -1, `actual missing element {el}`);
    }
    for (let el of expected) {
        assert.notEqual(actual.indexOf(el) , -1, `expected missing element {el}`);
    }

}
test("getSubset()", () => {
    let frp = new Frp();
    let inStruct = frp.createB({a: 1, b: 2, c: 88});

    let resB = struct.getSubset(inStruct, {a: 1, b: 2, d: 3});

    frp.tm().attach(resB);

    let res = frp.accessTrans(() => resB.get(), resB);
    assert.equal(res.a, 1);
    assert.equal(res.b, 2);
    assert.equal(res.c, undefined);
    assert.equal(res.d, 3);

    frp.tm().detach(resB);

    resB = struct.getSubset(inStruct, {a: 1, b: 2, d: 3},
        (v: any) => [v.a, v.b, v.c, v.d, v.e],
        (v: any[]) => ({a: v[0], b: v[1], c: v[2], d: v[3]}));

    frp.tm().attach(resB);

    res = frp.accessTrans(() => resB.get(), resB);

    assert.equal(res[0], 1);
    assert.equal(res[1], 2);
    assert.equal(res[2], undefined);
    assert.equal(res[3], 3);

    frp.accessTrans(() => {
        resB.set([5, 6, 7, 8]);
    }, resB)

    res = frp.accessTrans(() => inStruct.get(), inStruct);

    assert.equal(res.a, 5);
    assert.equal(res.b, 6);
    assert.equal(res.c, 88);
    assert.equal(res.d, 8);

    frp.tm().detach(resB);
});

test("getWithStatusIfNotGood()", () => {
    let frp = new Frp();

    let valB = frp.createB({a: 1, b: BStatus.notReady(), c: new BStatus(3)});
    let aB = struct.getWithStatusIfNotGood('a', valB);
    let bB = struct.getWithStatusIfNotGood('b', valB);
    let cB = struct.getWithStatusIfNotGood('c', valB);

    frp.attach(aB);
    frp.attach(bB);
    frp.attach(cB);

    frp.accessTrans(
        function () {
            assert.equal(1, aB.get());
            assert.equal(false, bB.metaGet().ready());
            assert.equal(3, cB.get());

            aB.set(11);
            bB.set(12);
            cB.set(13);

        }, aB, bB, cB);

    frp.accessTrans(function () {
        assert.equal(aB.get(), 11);
        assert.equal(bB.get(), 12);
        assert.equal(cB.get(), 13);

        cB.set(new BStatus(22));
        aB.set(23);

    }, aB, bB, cB, valB);

    frp.accessTrans(() => {
        assert.deepEqual(valB.get(), {a: 23, b: 12, c: new BStatus(22)});
    }, valB);
});

test("flatten - struct", () => {
    let frp = new Frp();
    let hB = frp.createB(77);
    let iB = frp.createB(88);
    let gB = frp.createB({h: hB})
    let bB = frp.createB({b1: 1, b2: 2});
    let dB = frp.createB({d1: 1, d2: 2});
    let fB = frp.createB({f1: 1, f2: 2});

    const fFunc = () => ({flat:1});

    let resB = flatten(frp, {
        a: 1, b: bB, c: {[FLATTEN]: NO_FLATTEN, d: dB},
        e: {f: fB}, g: gB,
        i: {[FLATTEN]: fFunc, d: iB},
    });

    frp.tm().attach(resB);
    frp.accessTrans(() => {
        let expected = {
            a:1, b: {b1:1, b2: 2}, c: {[FLATTEN]: NO_FLATTEN, d: dB},
            e: {f: {f1:1, f2:2}}, g: {h: hB},
            i: {flat: 1},
        };
        assert.deepEqual(resB.get(),expected);

        resB.set({
            a:2, b: {b1:33, b2: 33}, c: {[FLATTEN]: NO_FLATTEN, d: dB},
            e: {f: {f1:44, f2:44}}, g: {h: hB},
            i: {flat: 1},
        })
    }, resB);

    frp.accessTrans(() => {
        let expected = {
            a:1 /* this shouldn't change */, b: {b1:33, b2: 33}, c: {[FLATTEN]: NO_FLATTEN, d: dB},
            e: {f: {f1:44, f2:44}}, g: {h: hB},
            i: {flat: 1},
        };
        assert.deepEqual(resB.get(),expected);

    }, resB);


})


test("flatten - behaviour", () => {
    let frp = new Frp();
    let hB = frp.createB(77);
    let iB = frp.createB(88);
    let gB = frp.createB({h: hB})
    let bB = frp.createB({b1: 1, b2: 2});
    let dB = frp.createB({d1: 1, d2: 2});
    let fB = frp.createB({f1: 1, f2: 2});

    const fFunc = () => ({flat:1});
    let structB = frp.createB({
        a: 1, b: bB, c: {[FLATTEN]: NO_FLATTEN, d: dB},
        e: {f: fB}, g: gB,
        i: {[FLATTEN]: fFunc, d: iB},
    });

    let resB = flatten(frp, structB);

    assert.equal(resB, structB);
})

test("getBehaviours", () => {
    let frp = new Frp();

    let hB = frp.createB(77);
    let iB = frp.createB(88);
    let gB = frp.createB({h: hB})
    let bB = frp.createB({b1: 1, b2: 2});
    let dB = frp.createB({d1: 1, d2: 2});
    let fB = frp.createB({f1: 1, f2: 2});

    const fFunc = () => ({flat:1});

    let behaviours = getBehaviours({
        a: 1, b: bB, c: {[FLATTEN]: NO_FLATTEN, d: dB},
        e: {f: fB}, g: gB,
        i: {[FLATTEN]: fFunc, d: iB},
    });

    arrayEqualsOrderIrrelevant(behaviours, [bB, fB, gB, iB]);
})

test("create()", () => {
    let frp = new Frp();
    let bB = frp.createB(7);
    let struct = {a: 1, b: bB};
    let testeeB = create(frp, struct);

    frp.tm().attach(testeeB);
    frp.accessTrans(() => {
        assert.deepEqual(testeeB.get(), {a:1, b: 7});
        testeeB.set({a:3, b: 4});
    }, testeeB)

    frp.accessTrans(() => {
        assert.deepEqual(testeeB.get(), {a:1, b: 4});
        assert.equal(bB.get(), 4);
        assert.deepEqual(struct, {a:1, b: bB});
    }, testeeB, bB)

});

test("extend()", () => {
    let frp = new Frp();
    let bB = frp.createB("b");
    let b1B = frp.createB("b1");
    let cB = frp.createB("c");
    let struct1 = {a: 1, b: bB};
    let struct2 = {b: b1B, c: cB};
    let testeeB = extend(frp, struct1, struct2);
    frp.tm().attach(testeeB);

    frp.accessTrans(() => {
        assert.deepEqual(testeeB.get(), {a:1, b: "b1", c: "c"});
        testeeB.set({a:2, b:"b.set", c:"c.set"});
    }, testeeB)

    frp.accessTrans(() => {
        assert.deepEqual(testeeB.get(), {a:1, b:"b.set", c:"c.set"});
        assert.equal(bB.get(), "b");
        assert.equal(b1B.get(), "b.set");
        assert.equal(cB.get(), "c.set");

        assert.deepEqual(struct1, {a:1, b: bB});
        assert.deepEqual(struct2, {b:b1B, c: cB});

    }, testeeB, cB, bB, b1B)

})
test("flattenMeta()", () => {
    let frp = new Frp();
    let aB = frp.createB('a');
    let bB = frp.createNotReadyB();
    let daB = frp.createB('da');
    let dbB = frp.createNotReadyB();
    let listA = frp.createB('listA');
    let listB = frp.createNotReadyB();

    let valB = struct.flattenMeta(frp, {a: aB, b: bB, c: 'c', d: {a: daB, b: dbB, c: 'dc'}, list: [1, listA, listB]});

    function bs(v: any) {
        return new BStatus(v);
    }

    frp.attach(valB);

    frp.accessTrans(function () {
        assert.equal(valB.good(), true);
        let nr = BStatus.notReady();
        assert.deepEqual({
            a: new BStatus('a'),
            b: nr, c: 'c', d: {
                a: new BStatus('da'), b: nr, c: 'dc'
            }, list: [1, new BStatus('listA'), nr]
        }, valB.get());

        valB.set({
            a: 'a1',
            b: 'b1', c: 'c1', d: {
                a: 'da1', b: 'db1', c: 'dc'
            }, list: [1, 'listA1', 'listB1']
        });

    }, valB);

    frp.accessTrans(function () {
        assert.equal('a1', aB.get());
        assert.equal('b1', bB.get());
        assert.equal('da1', daB.get());
        assert.equal('db1', dbB.get());

        assert.equal('listA1', listA.get());
        assert.equal('listB1', listB.get());

        assert.deepEqual({
            a: new BStatus('a1'),
            b: bs('b1'), c: 'c', d: {
                a: bs('da1'), b: bs('db1'), c: 'dc'
            }, list: [1, bs('listA1'), bs('listB1')]
        }, valB.get());

        valB.set({
            a: bs('a2'),
            b: 'b1', c: 'c1', d: {
                a: bs('da2'), b: 'db1', c: 'dc'
            }, list: [1, 'listA1', 'listB1']
        });
    }, aB, bB, daB, dbB, listA, listB, valB);


    frp.accessTrans(function () {
        assert.equal('a2', aB.get());
        assert.equal('b1', bB.get());
        assert.equal('da2', daB.get());
        assert.equal('db1', dbB.get());

        assert.equal('listA1', listA.get());
        assert.equal('listB1', listB.get());

        assert.deepEqual({
            a: new BStatus('a2'),
            b: bs('b1'), c: 'c', d: {
                a: bs('da2'), b: bs('db1'), c: 'dc'
            }, list: [1, bs('listA1'), bs('listB1')]
        }, valB.get());

    }, aB, bB, daB, dbB, listA, listB, valB);
});

