import test from "node:test";
import assert from "assert/strict";
import {Behaviour, BStatus, Frp} from "./frp";
import {NoAccessors, NotAttached, NotInTransaction} from "../exception/exception";
import {clone} from "../util/object";

function assertFalse(a:boolean) {
    assert.equal(a, false);
}
function assertTrue(a:boolean) {
    assert.equal(a, true);
}

test("NoInverse", () => {
	let frp = new Frp();
	let tm = frp.tm();
	let b1 = frp.createB(1);
	let testee = b1.noInverseB();
	
	tm.attach(testee);
	assert.equal(1, testee.unsafeMetaGet().get());
	frp.accessTrans(function () {
		testee.set(2);
	}, testee);
	assert.equal(1, testee.unsafeMetaGet().get());

	frp.accessTrans(function () {
		b1.set(3);
	}, b1);
	assert.equal(3, testee.unsafeMetaGet().get());
});
	

test("BehaviourUp",()=> {
    let count1 = 0;
    let count2 = 0;
    function add1(a:number) {
        count1++;
        return a + 1;
    }
    function add2(a:number) {
        count2++;
        return a + 1;
    }


    let frp = new Frp();
    let tm = frp.tm();

    let b = frp.createB(2);

    assert.equal(2, b.unsafeMetaGet().get());

    let c = frp.liftB(add1, b);

    // nothing should propagate yet we need to attach it
    assertFalse(c.unsafeMetaGet().ready());


    tm.attach(c);

    assert.equal(3, c.unsafeMetaGet().get());

    assert.equal(1, count1);
    let d = frp.liftB(add2, c);

    tm.attach(d);
    assert.equal(1, count1,'no extra fire');
    assert.equal(1, count2, 'one fire');

    assert.equal(4, d.unsafeMetaGet().get());

    tm.detach(d);
    tm.detach(c);
    assert.equal(0, tm.watching());
});

test("DetachWhileInTrans", ()=> {
    let frp = new Frp();
    let tm = frp.tm();

    let b = frp.createB(2);
    let c = frp.liftBI(
        (v: number): number =>  {return v},
        function (v:number) {
            b.set(v);
            tm.detach(c)
        }, b);

    tm.attach(c);
    frp.accessTrans(function () {c.set(1)},c);
    //assertTrue(b.dirtyDown_);

    tm.attach(c);

    assert.equal(2, c.unsafeMetaGet().get());
    assert.equal(2, b.unsafeMetaGet().get());

});

test("changesE", () => {
    let frp = new Frp();
    let changesVal = null;
    let bB = frp.createB(2);
    let changesE = frp.changesE(bB);
    let changeWatcher = frp.liftB((changes: number[]): number => {
        changesVal = changes;
        return 1;
    }, changesE);

    frp.attach(changeWatcher);

    frp.accessTrans(function () {
        bB.set(1);
    }, bB);
    assert.deepEqual([1], changesVal);
    frp.accessTrans(function () {}, bB)
    assert.deepEqual([1], changesVal);
    frp.accessTrans(function () {
        bB.set(3);
        bB.set(4);
    }, bB);
    assert.deepEqual([4], changesVal);
})
test("EventLiftB",()=>{
    const frp = new Frp();
    let E = frp.createE<any>();
    let B = frp.createB(true);

    let resB = frp.liftB(function () {
        return true;
    }, E, B);
    let evFired = 0;
    let res2B = frp.liftB(function (e:boolean[]) {
        evFired += e.length;
        return true;
    }, E);

    frp.attach(resB);
    frp.attach(res2B);
    
    assertTrue(resB.unsafeMetaGet().ready());
    assert.equal(0, evFired);

    frp.accessTrans(function () {
        E.set(1);
    }, E);
    assert.equal(1, evFired);
    assert.deepEqual([], E.unsafeMetaGet().get());
});
test("CreateCallback", () => {
    const frp = new Frp();
    let aB = frp.createB<number>(1);

    let cbB = frp.createCallback(() => {
        aB.set(3);
    }, aB);

    frp.tm().attach(cbB);
    frp.accessTrans(function () {
       cbB.set("foo");
    }, cbB);

    assert.equal(3, aB.unsafeMetaGet().get());
    assert.equal(null, cbB.unsafeMetaGet().get());
});
test("AccessTransFunc", () => {
    const frp = new Frp();
    let a = frp.createB(1);
    assert.throws(() =>  a.get(), new NoAccessors());
    let count = 0;
    let func = frp.accessTransFunc((v1,v2) => {
        assert.equal(1, a.get());
        assert.equal(3, v1);
        assert.equal(4, v2);
        count++;
        return 5;
    }, a);
    assert.equal(0, count);

    let res = func(3,4);

    assert.equal(1, count);
    assert.equal(5, res);


})
class EventCallInfo {
    constructor(name?: string) {
        this.name = name;
    }
    name?:string;
    count: number = 0;
    invokes: number = 0;
    val?: number[];
    update(e: any[]) {
        this.val = e;
        this.invokes++;
        this.count += e.length
    }
}

test("EventDown",()=>{
    let frp = new Frp();
    let tm = frp.tm();

    function add1(opts:EventCallInfo) {
        return function (val:number[]) : number[] {
            opts.update(val)
            let res = [];
            for (let i = 0; i < val.length; i++) {
                res.push(val[i] + 1);
            }
            return res;
        };
        
    }

    function sub1(opts: EventCallInfo) {
        return function (evt:number[], x:any) {
            opts.update(evt);
            for (let i = 0; i < evt.length; i++) {
                x.set(evt[i] - 1);
            }
        };
    }

    let e = frp.createE();
    let e0Opts = {calc: new EventCallInfo(), inv : new EventCallInfo() };
    let e1Opts = {calc: new EventCallInfo("e1"), inv : new EventCallInfo() };
    let e2Opts = {calc: new EventCallInfo(), inv : new EventCallInfo() };

    let e0 = frp.liftE(add1(e0Opts.calc),  e);
    let e1 = frp.liftEI<number>(add1(e1Opts.calc), sub1(e1Opts.inv), e0);
    let e2 = frp.liftEI<number>(add1(e2Opts.calc), sub1(e2Opts.inv), e1);
    tm.attach(e2);


    assert.deepEqual(e1.unsafeMetaGet().get(),[]);
    assert.deepEqual(e2.unsafeMetaGet().get(),[]);
    assert.equal(e1Opts.calc.count,0);
    assert.equal(1, e1Opts.calc.invokes);
    assert.equal(1, e2Opts.calc.invokes);
    assert.equal(e1Opts.inv.count,0);
    assert.equal(e2Opts.calc.count,0);
    assert.equal(e2Opts.inv.count,0);


    frp.accessTrans(function() {
	    e.set(3);
	    e.set(4);
    }, e);

    assert.deepEqual([], e1.unsafeMetaGet().get());
    assert.deepEqual([], e2.unsafeMetaGet().get());
    assert.equal(e1Opts.calc.invokes,2);
    assert.equal(e1Opts.calc.count,2);
    assert.equal(e1Opts.inv.count,0);
    assert.equal(e2Opts.calc.invokes,2);
    assert.equal(e2Opts.calc.count,2);
    assert.equal(e2Opts.inv.count,0);
    assert.deepEqual([4,5], e1Opts.calc.val);
    assert.deepEqual([5,6], e2Opts.calc.val);


    frp.accessTrans(function() {
        e2.set(7 as any);
        e2.set(8 as any);
    }, e2);

    assert.deepEqual([], e1.unsafeMetaGet().get());
    assert.deepEqual([], e2.unsafeMetaGet().get());
    assert.equal(2, e1Opts.calc.count);
    assert.equal(2, e1Opts.inv.count);
    assert.equal(1, e1Opts.inv.invokes);
    assert.equal(2, e2Opts.calc.count);
    assert.equal(2, e2Opts.inv.count);
    assert.equal(1, e2Opts.inv.invokes);
    assert.deepEqual([6,7], e1Opts.inv.val);
    assert.deepEqual([7,8], e2Opts.inv.val);
    
});

test("EventUp",()=>{
    let count1 = 0;
    let count2 = 0;
    let count3 = 0;
    let val1:number[] = [];
    let val2:any = 0;
    function add1(a:number[]) {
    	console.log('add 1', a);
	    val1 = a;
        count1+=a.length;
        let res = [];
        for (let i = 0; i < a.length; i++) {
            res.push(a[i] + 1);
        }
        return res;
    }
    function add2(a:number[]):number[] {
        val2 = a;
        count2+= a.length;
        let res = [];
        for (let i = 0; i < a.length; i++) {
            res.push(a[i] + 1);
        }
        return res;
    }

    function filterAll() {
        return [];
    }


    let frp = new Frp();
    let tm = frp.tm();

    let b = frp.createE();
    frp.accessTrans(function() {
	b.set(2);
    }, b);
    let c = frp.liftE(add1, b);
    let d = frp.liftE(add2, c);
    let filtered = frp.liftE(function ():number[] {
        count3++;
        return [];
    }, frp.liftE(filterAll, c));

    assert.deepEqual(undefined, c.unsafeMetaGet().get());
    assert.deepEqual([], val1);
    assert.equal(0, count1);

    tm.attach(c);

    assert.deepEqual([], c.unsafeMetaGet().get());
    assert.deepEqual([], val1);
    assert.equal(0, count1);

    // we might need to split this up so we wait for the update
    frp.accessTrans(function() {
	b.set(2);
    });
    assert.deepEqual([], c.unsafeMetaGet().get());
    assert.equal(1, count1);
    assert.deepEqual([2], val1);

    frp.accessTrans(function() {
	b.set(3);
	b.set(4);
    });

    assert.deepEqual([], c.unsafeMetaGet().get());
    assert.equal(3, count1);
    assert.equal(0, count2);
    assert.deepEqual([3,4], val1);

    tm.attach(d);
    tm.attach(filtered);

    frp.accessTrans(function() {
	b.set(5);
	b.set(6);
    });

    assert.deepEqual([], c.unsafeMetaGet().get());
    assert.equal(5, count1);
    assert.equal(2, count2);
    assert.equal(1, count3);
    assert.deepEqual([5,6], val1);
    assert.deepEqual([6,7], val2);

});


test("BehaviourDown",()=>{
    let count1 = 0;
    function add1(a:number) {
        count1++;
        return a + 1;
    }

    function sub1(val:number, a:Behaviour<number>) {
        a.set(val - 1);
    }

    let frp = new Frp();
    let tm = frp.tm();

    let b = frp.createB(2);

    let c = frp.liftBI(add1, sub1, b);
    tm.attach(c);
    tm.doTrans(function() {
        Frp.access(function() {
          c.set(7);
        }, c);
    });

    assert.equal(6, b.unsafeMetaGet().get());

    tm.detach(c);

});

test("SwitchBNotReady",()=>{

    let frp = new Frp();
    let tm = frp.tm();
    let src1 = frp.createMetaB(BStatus.notReady());
    
    let src2 = frp.createB(src1);

    let sw = frp.switchB(src2);

    tm.attach(sw);
    assertFalse(sw.unsafeMetaGet().ready());

    tm.detach(sw);
    assert.equal(0, tm.watching());
});

test("SwitchBRef",()=>{

    let frp = new Frp();
    let tm = frp.tm();
    let src1 = frp.createB(0);
    let data = [frp.createB(0), frp.createB(1)];

    let t2 = frp.liftB<Behaviour<number>>(function (src) {
	return data[src];
    }, src1);

    let testee1 = frp.switchB(t2);

    
    let testee2 = frp.switchB(t2);



    let outer = frp.liftB(function (x:number, y:number):number {
	    return x + y;
    }, testee1, testee2);

    tm.attach(outer);
    assert.equal(0, outer.unsafeMetaGet().get());


    frp.accessTrans(function () {
	src1.set(1);
    }, src1);

    assert.equal(2, outer.unsafeMetaGet().get());

    tm.detach(outer);

    assert.equal(tm.watching(), 0, "refcount");

});

test("SwitchBDown",()=>{

    let frp = new Frp();
    let tm = frp.tm();
    let src1 = frp.createB(1);
    let src2 = frp.createB(2);

    function make1Or2(val:boolean):Behaviour<number> {
        if (val) {
            return src1;
        } else {
            return src2;
        }
    }

    let c = frp.createB(true);
    (c as any).name = 'C';

    let d = frp.liftB(make1Or2, c);
    (d as any).name = 'd';

    let switchTest = frp.switchB(d);
    (switchTest as any).name = 'switchTest';

    tm.attach(switchTest);

    assert.equal(1, switchTest.unsafeMetaGet().get());

    Frp.access(function() {
      tm.doTrans(function() {
          switchTest.set(11);
      });
    }, switchTest);

    assert.equal(11, src1.unsafeMetaGet().get());

    tm.doTrans(function() {
        c.set(false);
    });

    assert.equal(2, switchTest.unsafeMetaGet().get());

    tm.detach(switchTest);
    assert.equal(0, tm.watching());
});
test("Const",()=>{
    let frp = new Frp();
    let tm = frp.tm();
    let count = 0;

    let one = frp.createConstB(1);
    let two = frp.liftB<number>((a) => {return a + 1;}, one);
    let three = frp.liftB((a)=> {count++;return a + 1;},two);
    assert.equal(0, count, 'zero fire');


    tm.attach(three);
    assert.equal(1, count, 'one fire');

      tm.doTrans(function() {
        Frp.access(function() {
          two.set(3);
        }, two);
    });
    Frp.access(function() {
        assert.equal(3, three.get(),'value right');
    }, three);
    assert.equal(1, count, 'one fire again');
    tm.detach(three);

});

test("NoSetOutsideTransaction",()=>{


    let frp = new Frp();
    let tm = frp.tm();

    let one = frp.createB(1);

    one.set(2);

    let two = frp.liftB(function(a) {return a + 1;}, one);

    try {
      two.set(3);
         assert.fail('expected exception');
    } catch (e) {
        assertTrue(e instanceof NotAttached);
    }

    tm.attach(two);
    try {
      two.set(3);
         assert.fail('expected exception');
    } catch (e) {
        assertTrue(e instanceof NoAccessors);
    }

    Frp.access(function() {
        try {
          two.set(3);
             assert.fail('expected exception');
        } catch (e) {
            assertTrue(e instanceof NotInTransaction);
        }
    }, two);

    Frp.access(function() {
      tm.doTrans(function() {
          two.set(3);
        });
    }, two);
});

test("SetDownOnUpAddRef ",()=>{

    

    let frp = new Frp();
    let tm = frp.tm();

    let aBB:Behaviour<Behaviour<number>> = frp.createNotReadyB();
    let bB:Behaviour<number> = frp.createNotReadyB();

   
    bB.refListen(function () {
        frp.accessTrans(function () {
            bB.set(1);
        }, bB);
    });
    aBB.refListen(function () {
        frp.accessTrans(function () {
            aBB.set(bB);
        }, aBB);
    });
         
    
    let outB = frp.switchB(aBB);
    

    tm.attach(outB);
    assert.equal(1, outB.unsafeMetaGet().get());

});

test("LiftBOnlyGood",()=>{

    let frp = new Frp();

    function testNotCall() {
        assert.fail('should not be called');
    }
    let a = frp.createMetaB(BStatus.notReady());
    let d = frp.liftB(testNotCall, a);
    frp.attach(d);
    frp.detach(d);
});

test("SwitchBOutsideBehaviour",()=>{
    
    let frp = new Frp();
    let tm = frp.tm();
    
    let a = frp.createB(frp.liftB(
        function(z) {return z + ".";},frp.createB("hello")));
    let b = frp.switchB(a);
    let c = frp.liftB(function (v) { return v;}, b);
    frp.attach(c);
    frp.attach(c);
    assert.equal("hello.",c.unsafeMetaGet().get());
    frp.detach(c);
    frp.detach(c);
    assert.equal(0, tm.watching());

});

test("SwitchBWithError",()=>{
    
    let frp = new Frp();
    let tm = frp.tm();
    
    let errorBB = frp.createB(
        frp.metaLiftB(function() {
            return BStatus.errors(['hi']);
        }, frp.createConstB(1)));
    let b = frp.switchB(errorBB);

    frp.attach(b);
    assert.deepEqual(['hi'],b.unsafeMetaGet().errors());
    frp.detach(b);

    assert.equal(0, tm.watching());


});

test("SwitchBUp",()=>{

    let frp = new Frp();
    let tm = frp.tm();

    function make1Or2(val:boolean):Behaviour<number> {
        if (val) {
            return frp.createB(1);
        } else {
            let two = frp.createB(1);
            return frp.liftB(function(a) {return a + 1;}, two);
        }
    }

    let c = frp.createB(true);
    (c as any).name = 'C';

    let d = frp.liftB(make1Or2, c);
    (d as any).name = 'd';

    let switchTest = frp.switchB(d);
    (switchTest as any).name = 'switchTest';

    tm.attach(switchTest);

    assert.equal(1, switchTest.unsafeMetaGet().get());

    tm.doTrans(function() {
        c.set(false);
    });

    assert.equal(2, switchTest.unsafeMetaGet().get());

    tm.detach(switchTest);
    assert.equal(0, tm.watching());
});

    
test("AttachDetach",()=>{

    let frp = new Frp();
    let tm = frp.tm();

    let one = frp.createB(1);
    let two = frp.liftB(function(a) {return a + 1;},one);

    one.set(2);

    tm.attach(two);
    try {
      one.set(3);
      assert.fail('expected exception');
    }
    catch (e) {
        assertTrue(e instanceof NotInTransaction);
   }
    tm.detach(two);
    one.set(1);
});

test("Observer ",()=>{
    let frp = new Frp();
    let tm = frp.tm();

    let oneB = frp.createConstB(1);
    let twoB = frp.liftBI<number>(function (v) {return v;}, function (v:number) {oneB.set(v)}, oneB);

    let val;
    let obB = frp.observeB( ((v:BStatus<number>):BStatus<number> => {
        val = v.get();
        return new BStatus<number>(1);
    }) as any, twoB);

    
    tm.attach(obB);
        
    assert.equal(1, val);
    frp.accessTrans(function () {
        val = 2;
        twoB.set(2);
    }, twoB);
    assert.equal(1, val);
});

test("DependancyRemoved",()=>{
    let frp = new Frp();
    let tm = frp.tm();
    let count = 0;
    let one = frp.createB(1);
    let two = frp.liftB((a)=> {count++;return a + 1;},one);
    let three = frp.liftB((a)=> {return a + 1;},two);
    let four = frp.liftB(function(a) {return a + 1;},three);

    tm.attach(four);
    tm.attach(two);
    assert.equal(4, four.unsafeMetaGet().get());
    tm.detach(four);
    frp.accessTrans(function() {
        one.set(2);
    }, one);
    
});

test("SwitchBRefCount",()=>{

    let frp = new Frp();
    let tm = frp.tm();
    
    let a = frp.createB(0);
    let b = frp.liftB(function (x) { return x + 1;}, a);

    let c = frp.createB(1);
    let d = frp.liftB(function (x) { return x + 1;}, c);

    let selector1 = frp.createB(b);
    let testee = frp.switchB(selector1);

    tm.attach(testee);
    tm.attach(testee);

    assert.equal(1, testee.unsafeMetaGet().get(),"val1");
    assert.equal(1, a.getRefs(tm), "count a - 1");
    assert.equal(1, b.getRefs(tm), "count b - 1");
    assertFalse(c.hasRefs());
    assertFalse(d.hasRefs());


    frp.accessTrans(function () {
        selector1.set(d);
    }, selector1);

    assert.equal(2, testee.unsafeMetaGet().get());

    assert.equal(c.getRefs(tm), 1, "c refs");
    assert.equal(d.getRefs(tm), 1);
    assertFalse(a.hasRefs());
    assertFalse(b.hasRefs());

    tm.detach(testee);
    tm.detach(testee);

    assertFalse(c.hasRefs());
    assertFalse(d.hasRefs());
    assertFalse(testee.hasRefs());

});
/**
 * this tests if the behaviours returned in a switch b
 * are created after the switchb and not inside the actual 
 * liftB of the behaviour in the switch b
 */
test("OutOfOrderSwitchB",()=>{


    let frp = new Frp();
    let tm = frp.tm();
    let map :{[index:number] : Behaviour<string>}  = {0: frp.createB("a")};
    let chooserB =  frp.createB(0);
    let selectorB = frp.liftB<Behaviour<string>>(function (v): Behaviour<string> {
        return map[v];
    },chooserB);

    
    let swB = frp.switchB(selectorB);

    tm.attach(swB);


    assert.equal("a", swB.unsafeMetaGet().get());
    
    map[1]= frp.createB("b");
    frp.accessTrans(function() {
        chooserB.set(1);
    }, chooserB);
        

    assert.equal("b", swB.unsafeMetaGet().get());


    
    frp.accessTrans(function() {
        map[1].set("bb");
    }, chooserB);

    assert.equal("bb", swB.unsafeMetaGet().get());


     
});

test("SetDownOnUp ",()=>{

    let frp = new Frp();
    let tm = frp.tm();

    let oneB = frp.createB(1);
    let twoB = frp.createB(2);

    let count = 0;
    
    let threeB = frp.liftB(function() {count++; twoB.set(oneB.get()); return oneB.get();},oneB, twoB);

    tm.attach(threeB);

    assert.equal(1, twoB.unsafeMetaGet().get());
    assert.equal(2, count);

});


test("SetDownOnUpNoCalc ",()=>{

    let frp = new Frp();
    let tm = frp.tm();

    let oneB = frp.createB(1);
    let twoB =  frp.createB(2);
    let nullB = frp.liftBI<null,number>(
        function():any {return null;},
        function (v) {twoB.set(v);},
        twoB);

    let count = 0;
    
    let threeB = frp.liftB(function() {count++; nullB.set(oneB.get()); return oneB.get();},oneB, nullB);

    tm.attach(threeB);

    assert.equal(1, twoB.unsafeMetaGet().get());
    assert.equal(1, count);

});

test("OnUpDirtyDown ",()=>{
    let frp = new Frp();
    let tm = frp.tm();

    let doNothing = function (v:number) {return v;};
    let doNothingInv = function (v:number,b:Behaviour<number>) {b.set(v);};
    let doNothingInvNull = function (v:null,b:Behaviour<null>) {b.set(v);};

    let count = 0;
    let count1 = 0;
    let zeroB = frp.createB(1);
    let oneB = frp.liftBI(
         (v)=> {
            count1++;
            return v;
        }, doNothingInv, zeroB);

    let twoB =  frp.liftBI(doNothing, doNothingInv, oneB);
    let threeB =  frp.liftBI(doNothing, doNothingInv, twoB);
    let fourB:Behaviour<null> =  frp.liftBI<null>( () => {
        frp.accessTrans(function () {
            oneB.set(2);
        }, oneB);
        return null;
    },doNothingInvNull as any, threeB);
                        
    let lastB = frp.liftB(function () {
        count++;
        return 2;
    }, fourB).setName("last");
                          
    tm.attach(lastB);

    
//    assert.equal(1,Frp.DirectionC);
    assert.equal(1,count);
    assert.equal(2,count1);
    assert.equal(2,lastB.unsafeMetaGet().get());

    frp.accessTrans(function () {
        fourB.set(3 as any);
    }, fourB);

    assert.equal(1,count);
    assert.equal(4,count1);

});

test("BehaviourClone ",()=>{
    let frp = new Frp();
    let b = frp.createB(null);
    assertTrue(b === clone(b));
});
test("OnUpDirtyDown1 ",()=>{
    let frp = new Frp();
    let tm = frp.tm();

    let doNothing = function (v:number) {return v;};
    let doNothingInv = function (v:number,b:Behaviour<number>) {b.set(v);};

    let count = 0;
    let count1 = 0;
    let count2 = 0;
    let zeroB = frp.createB(1);
    let zero1B = frp.createB(1);

    let oneB = frp.liftBI(
        function (): any {
            count1++;
            return null;
        },
        doNothingInv, zeroB);

    (oneB as any).name = 'one';



    let twoB =  frp.liftBI(doNothing, doNothingInv, oneB);
    let threeB =  frp.liftBI(doNothing, doNothingInv, twoB);
    let fourB =  frp.liftBI(function ():any {
        frp.accessTrans(function () {
            oneB.set(2 as any);
        }, oneB);
        return null;
    },doNothingInv, threeB);

    let one1B = frp.liftBI(
        function (v):any {
            count2++;
            if (v) {
                throw "invalid value for 1";
            }
            return null;
        },
        doNothingInv, oneB, zero1B);
                        
    let lastB = frp.liftB(function () {
        count++;
        return 2;
    }, fourB);
                          
    tm.attach(lastB);
    tm.attach(one1B);

    
//    assert.equal(1,Frp.DirectionC);
    assert.equal(1,count);
    assert.equal(1,count2);
    assert.equal(2,count1);
    assert.equal(2,lastB.unsafeMetaGet().get());

    frp.accessTrans(function () {
        fourB.set(3 as any);
        zero1B.set(2);
    }, fourB);

    assert.equal(1,count);
    assert.equal(4,count1);

});

test("SameBehaviour",()=>{
//    assertTrue("not implemented yet", false);
});


test("BreakPoint",()=>{

    let frp = new Frp();
    let tm = frp.tm();

    let l1B = frp.createB(1);
    let l2B = frp.liftBI<number>(
        function (v):number {
            return v + 1;
        }, function (v) {
            l1B.set(v - 1);
        }, l1B);
    tm.attach(l2B);

    assert.equal(2, l2B.unsafeMetaGet().get());

    frp.setDebugger({/*
        breakpoint: function (node) {
        },*/
        preVisit: function (node) {
            return node !== l2B;
        },
        postVisit: function () {
        }
    });
    frp.accessTrans(function () {
        l1B.set(3);
    },l1B); 
    assert.equal(3, l1B.unsafeMetaGet().get());
    assert.equal(2, l2B.unsafeMetaGet().get());

    frp.resume();

    assert.equal(3, l1B.unsafeMetaGet().get());
    assert.equal(4, l2B.unsafeMetaGet().get());
    
});

test("Acess",()=>{
    let frp = new Frp();

    let tm = frp.tm();
    let brk = true;
    let l1B = frp.createB(1);
    let l2B = frp.liftBI<number>(
        function (v:number):number {
            return v + 1;
        }, function (v) {
            l1B.set(v - 1);
        }, l1B);
    tm.attach(l2B);

    assert.equal(2, l2B.unsafeMetaGet().get());

    frp.setDebugger({
        preVisit: function () {
            return !brk;
        },
        postVisit: function () {
        }
    });
    frp.accessTrans(function () {
        l1B.set(3);
    },l1B);

    frp.accessTrans(function () {
        l2B.set(10);
    },l2B);

    brk = false;
    frp.resume();


    assert.equal(10, l2B.unsafeMetaGet().get());
});

test("Continue",()=>{
    let frp = new Frp();

    let tm = frp.tm();

    let l1B = frp.createB(1);
    let plus1 = function (v:number) {return v + 1};
    let l2B = frp.liftBI(
        plus1, function (v) {
            l1B.set(v - 1);
        }, l1B);
    let l3B = frp.liftB(plus1, l2B);
    let l4B = frp.liftB(plus1, l3B);
    tm.attach(l4B);

    assert.equal(4, l4B.unsafeMetaGet().get());

    let cont = false;
    frp.setDebugger({
        preVisit: function (node) {
            return node !== l2B || cont;
        },
        postVisit: ()=> {}
    });
    frp.accessTrans(function () {
        l1B.set(3);
    },l1B);

    cont = true;
    frp.resume();


    assert.equal(6, l4B.unsafeMetaGet().get());



});
