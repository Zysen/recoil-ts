import {test} from "node:test";
import {assertEquals, assertThrows} from "../test.ts";
import { Message } from "./message.ts";

test("Resolve",() =>{
    assertEquals('hello world', Message.getParamMsg('hello ', ['val']).resolve({val:'world'}).toString());
});

test("Formatter",()=> {
    assertEquals('hello 2!', Message.getParamMsg('hello ', {'val': (v:number)=> {return (v + 1) + '!';}}).resolve({val:1}).toString());
});


test("Invalid",() =>{
    assertThrows(function () {
        Message.getParamMsg('hello ', ['val','v']);
    });

    assertThrows(function () {
        Message.getParamMsg('hello ', {'val':'v'});
    });

    assertThrows(function () {
        Message.getParamMsg('hello ', {'val':function (){}, v1:function (){}});
    });
});
