import test from "node:test";
import {BStatus, Frp} from "./frp.ts";
import {assertEquals, assertFalse, assertTrue} from "../test.ts";
import {Action, create} from "./change_manager.ts";

let gValueB;
test("ChangeManager", ()=> {
    let frp = new Frp();
    let tm = frp.tm();

    let changeB = frp.createMetaB(BStatus.notReady());
    let valueB = frp.createMetaB(BStatus.notReady());
    let applyE = frp.createE<Symbol>();
    let testeeB = create(frp, valueB, changeB, applyE);
    gValueB = valueB;
    tm.attach(testeeB);

    assertTrue(!testeeB.unsafeMetaGet().ready());

    frp.accessTrans(function () {
        valueB.set(3);
    }, valueB);
    assertTrue(testeeB.unsafeMetaGet().ready());    
    assertEquals(3, testeeB.unsafeMetaGet().get());    
    
    frp.accessTrans(function () {
        testeeB.set(4);
    }, testeeB);

    
    assertTrue(testeeB.unsafeMetaGet().ready());    
    assertEquals(3, valueB.unsafeMetaGet().get());    
    assertEquals(4, changeB.unsafeMetaGet().get());    
    assertEquals(4, testeeB.unsafeMetaGet().get());    


    frp.accessTrans(function () {
        testeeB.set(3);
    }, testeeB);

    
    assertTrue(testeeB.unsafeMetaGet().ready());    
    assertEquals(3, valueB.unsafeMetaGet().get());    
    assertFalse(changeB.unsafeMetaGet().ready());    
    assertEquals(3, testeeB.unsafeMetaGet().get());    


    frp.accessTrans(function () {
        testeeB.set(7);
    }, testeeB);

    
    assertTrue(testeeB.unsafeMetaGet().ready());    
    assertEquals(3, valueB.unsafeMetaGet().get());    
    assertEquals(7, changeB.unsafeMetaGet().get());    
    assertEquals(7, testeeB.unsafeMetaGet().get());    


    frp.accessTrans(function () {
        applyE.set(Action.FLUSH);
    }, applyE);

    assertTrue(testeeB.unsafeMetaGet().ready());
    assertEquals(7, testeeB.unsafeMetaGet().get());    
    assertEquals(7, valueB.unsafeMetaGet().get());    
    assertFalse(changeB.unsafeMetaGet().ready());    

});
