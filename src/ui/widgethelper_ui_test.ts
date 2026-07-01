import {WidgetHelper} from "./widgethelper";
import {createDom, removeNode} from "./dom/dom";
import {WidgetScope} from "./widgets/widgetscope";
import {Behaviour, BStatus, Frp} from "../frp/frp";
import {expect} from "@jest/globals";
import {DomObserver} from "./domobserver";
import {makeListenerWaiter} from "../util/test";



test("attach before added to dom", async() => {
    let frp = new Frp();
    let element = createDom("div");
    let scope = new WidgetScope(frp);
    let me = {};
    let good = false;
    let updateCount = 0;
    let detachCount = 0;
    let inputB = frp.createNotReadyB<number>();
    let testee:WidgetHelper;
    let errors:any;

    const update = makeListenerWaiter(function(this:any, helper:WidgetHelper, b1:Behaviour<number>) {
        expect(helper).toBe(testee);
        expect(this).toBe(me);
        expect(b1).toBe(inputB);
        good = helper.isGood();
        updateCount++;
        errors = helper.errors()
    });
    const detach = makeListenerWaiter(function() {
        detachCount++;
    });

    testee = new WidgetHelper(scope, element, me, update.listener, {detach : detach.listener, attach: () => undefined});

    expect(updateCount).toBe(0);
    expect(detachCount).toBe(0);

    testee.attach(inputB);

    // no attach because not in dom yet
    expect(updateCount).toBe(0);
    expect(detachCount).toBe(0);

    let waiter = update.wait();
    document.body.append(element)
    await waiter;

    expect(updateCount).toBe(1);
    expect(good).toBe(false);
    expect(detachCount).toBe(0);
    expect(errors).toStrictEqual([]);

    waiter = update.wait();
    frp.accessTrans(() => {
        inputB.metaSet(BStatus.errors(["test"]))
    }, inputB)
    await waiter;

    expect(updateCount).toBe(2);
    expect(good).toBe(false);
    expect(detachCount).toBe(0);
    expect(errors).toStrictEqual(["test"]);

    waiter = update.wait();
    frp.accessTrans(() => {
        inputB.set(9);
    }, inputB)
    await waiter;

    expect(updateCount).toBe(3);
    expect(good).toBe(true);
    expect(detachCount).toBe(0);
    expect(errors).toStrictEqual([]);

    waiter = detach.wait();
    removeNode(element)
    await waiter;

    expect(updateCount).toBe(3);
    expect(good).toBe(true);
    expect(detachCount).toBe(1);
    expect(errors).toStrictEqual([]);

});


test("attach after added to dom", async() => {
    let frp = new Frp();
    let element = createDom("div");
    document.body.append(element)
    let scope = new WidgetScope(frp);
    let me = {};
    let good = false;
    let updateCount = 0;
    let detachCount = 0;
    let inputB = frp.createNotReadyB<number>();
    let testee:WidgetHelper;
    let errors:any;

    const update = makeListenerWaiter(function(this:any, helper:WidgetHelper, b1:Behaviour<number>) {
        expect(helper).toBe(testee);
        expect(this).toBe(me);
        expect(b1).toBe(inputB);
        good = helper.isGood();
        updateCount++;
        errors = helper.errors()
    });
    const detach = makeListenerWaiter(function() {
        detachCount++;
    });

    testee = new WidgetHelper(scope, element, me, update.listener,  {detach : detach.listener, attach: () => undefined});

    expect(updateCount).toBe(0);
    expect(detachCount).toBe(0);

    let waiter = update.wait();
    testee.attach(inputB);
    await waiter;

    expect(updateCount).toBe(1);
    expect(good).toBe(false);
    expect(detachCount).toBe(0);
    expect(errors).toStrictEqual([]);

    waiter = update.wait();
    frp.accessTrans(() => {
        inputB.metaSet(BStatus.errors(["test"]))
    }, inputB)
    await waiter;

    expect(updateCount).toBe(2);
    expect(good).toBe(false);
    expect(detachCount).toBe(0);
    expect(errors).toStrictEqual(["test"]);

    waiter = update.wait();
    frp.accessTrans(() => {
        inputB.set(9);
    }, inputB)
    await waiter;

    expect(updateCount).toBe(3);
    expect(good).toBe(true);
    expect(detachCount).toBe(0);
    expect(errors).toStrictEqual([]);

    waiter = detach.wait();
    removeNode(element)
    await waiter;

    expect(updateCount).toBe(3);
    expect(good).toBe(true);
    expect(detachCount).toBe(1);
    expect(errors).toStrictEqual([]);

});

test("test reattach", async() => {
    let frp = new Frp();
    let element = createDom("div");
    document.body.append(element)
    let scope = new WidgetScope(frp);
    let me = {};
    let good = false;
    let updateCount = 0;
    let input1B = frp.createB(4);
    let input2B = frp.createB(5);
    let input:Behaviour<number>|null = null;
    let testee:WidgetHelper;

    const update = makeListenerWaiter(function(this:any, helper:WidgetHelper, b1:Behaviour<number>) {
        expect(helper).toBe(testee);
        good = helper.isGood();
        input = b1;
        updateCount++;
    });

    testee = new WidgetHelper(scope, element, me, update.listener);
    expect(updateCount).toBe(0);

    let waiter = update.wait();
    testee.attach(input1B);
    await waiter;

    expect(updateCount).toBe(1);
    expect(input).toBe(input1B);
    expect(good).toBe(true);

    expect(input1B.hasRefs()).toBe(true);
    expect(input2B.hasRefs()).toBe(false);

    waiter = update.wait();
    testee.attach(input2B);
    expect(input1B.hasRefs()).toBe(false);
    expect(input2B.hasRefs()).toBe(true);
    await waiter;

    expect(updateCount).toBe(2);
    expect(input).toBe(input2B);
    expect(good).toBe(true);

    testee.attach(); // detaches since no behaviours

    expect(updateCount).toBe(2);
    expect(good).toBe(true);

    removeNode(element)

});

test("change always fires", async() => {
    let frp = new Frp();
    let element = createDom("div");
    document.body.append(element);
    let scope = new WidgetScope(frp);
    let me = {};
    let good = false;
    let updateCount = 0;
    let inputB = frp.createB(4);
    let calcB = frp.liftB<number>(v => v, inputB);
    let testee:WidgetHelper;

    const update = makeListenerWaiter(function(this:any, helper:WidgetHelper, b1:Behaviour<number>) {
        expect(helper).toBe(testee);
        good = helper.isGood();
        updateCount++;
    });

    testee = new WidgetHelper(scope, element, me, update.listener);
    expect(updateCount).toBe(0);

    let waiter = update.wait();
    testee.attach(calcB);
    await waiter;

    expect(updateCount).toBe(1);
    expect(good).toBe(true);

    waiter = update.wait();
    frp.accessTrans(() => {
        calcB.set(1);
    }, calcB)
    await waiter;

    expect(updateCount).toBe(2);
    expect(good).toBe(true);

    removeNode(element)

});
