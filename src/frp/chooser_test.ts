import test from "node:test";
import { Frp } from "./frp.ts";
import {Chooser} from "./chooser.ts";
import {assertEquals, assertFalse, assertThrows} from "../test.ts";


test("Up", () =>{

    let frp = new Frp();

    let selectB = frp.createB(1);

    let testee = new Chooser(selectB);

    
    testee.option(3, "hello");
    testee.option(4, "world");

    let valB = testee.bind();

    assertThrows(function () {
        testee.option(5, "wrong");
    });

        assertThrows(function () {
        testee.bind();
    });

    frp.attach(valB);

    assertFalse(valB.unsafeMetaGet().ready());

    frp.accessTrans(function () {
        selectB.set(3);
    }, selectB);

    assertEquals("hello",valB.unsafeMetaGet().get());

    frp.accessTrans(function () {
        selectB.set(4);
    }, selectB);
    assertEquals("world",valB.unsafeMetaGet().get());

});




test("UpShortCircuit", () =>{

    let frp = new Frp();

    let selectB = frp.createB(1);


    let helloCount = 0;
    let worldCount = 0;
    let byeCount = 0;
    let helloB = frp.liftB(function (v) {
        helloCount++;
        return v;
    }, frp.createB("hello"));

    let byeB = frp.liftB(function (v) {
        byeCount++;
        return v;
    }, frp.createB("bye"));

    
    let worldB = frp.liftB(function (v) {
        worldCount++;
        return v;
    }, frp.createB("world"));


    let testee = new Chooser(selectB, byeB);

    testee.option(3, helloB);
    testee.option(4, worldB);

    let valB = testee.bind();
    
    frp.attach(valB);

    assertEquals(0, helloCount);
    assertEquals(1, byeCount);
    assertEquals(0, worldCount);
    assertEquals("bye",valB.unsafeMetaGet().get());

    frp.accessTrans(function () {
        selectB.set(3);
    }, selectB);

    assertEquals(1, helloCount);
    assertEquals(0, worldCount);
    assertEquals(1, byeCount);
    assertEquals("hello",valB.unsafeMetaGet().get());

    
    frp.accessTrans(function () {
        selectB.set(4);
    }, selectB);
    assertEquals(1, helloCount);
    assertEquals(1, worldCount);
    assertEquals(1, byeCount);
    assertEquals("world",valB.unsafeMetaGet().get());

});


test("Down", () => {

    let frp = new Frp();

    let selectB = frp.createB(1);



    let helloB = frp.createB("hello");
    let byeB = frp.createB("bye");

    
    let worldB = frp.createB("world");


    let testee = new Chooser(selectB, byeB);

    testee.option(3, helloB);
    testee.option(4, worldB);

    let valB = testee.bind();
    
    frp.attach(valB);

    assertEquals("bye",valB.unsafeMetaGet().get());
    frp.accessTrans(function () {
        valB.set("bye - set");
    }, valB);

    assertEquals("bye - set",valB.unsafeMetaGet().get());
    assertEquals("hello",helloB.unsafeMetaGet().get());
    assertEquals("world",worldB.unsafeMetaGet().get());
    assertEquals("bye - set",byeB.unsafeMetaGet().get());
    
   
    
    frp.accessTrans(function () {
        selectB.set(3);
    }, selectB);


    assertEquals("hello",valB.unsafeMetaGet().get());
    assertEquals("hello",helloB.unsafeMetaGet().get());
    assertEquals("world",worldB.unsafeMetaGet().get());
    assertEquals("bye - set",byeB.unsafeMetaGet().get());


    frp.accessTrans(function () {
        valB.set("hello - set");
    }, valB);

    assertEquals("hello - set",valB.unsafeMetaGet().get());
    assertEquals("hello - set",helloB.unsafeMetaGet().get());
    assertEquals("world",worldB.unsafeMetaGet().get());
    assertEquals("bye - set",byeB.unsafeMetaGet().get());


   
    
    frp.accessTrans(function () {
        selectB.set(4);
    }, selectB);


    assertEquals("world",valB.unsafeMetaGet().get());
    assertEquals("hello - set",helloB.unsafeMetaGet().get());
    assertEquals("world",worldB.unsafeMetaGet().get());
    assertEquals("bye - set",byeB.unsafeMetaGet().get());
    
    frp.accessTrans(function () {
        valB.set("world - set");
    }, valB);

    assertEquals("world - set",valB.unsafeMetaGet().get());
    assertEquals("hello - set",helloB.unsafeMetaGet().get());
    assertEquals("world - set",worldB.unsafeMetaGet().get());
    assertEquals("bye - set",byeB.unsafeMetaGet().get());

});
