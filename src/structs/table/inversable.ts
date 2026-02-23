/**
 * Input is the input type it is a struct that defines the inputs
 * T is the result type
 * Output is the type of objects to set
 */
import {Behaviour, BehaviourList1, Frp} from "../../frp/frp";
import {StructType} from "../../frp/struct";

type LimitedRecord<T extends Record<string, any>> = {
    [K in keyof T]: T[K];
}

type RecordWithBehaviour <T extends Record<string, any>> = {
    [K in keyof T]: T[K]|Behaviour<T[K]>;
}



export interface Inversable<T, Input extends Record<any, any>> {
    calculate(params: Input): T;
    inverse(val: T, sources: Input): Partial<Input>;
}
/**
 * create a behaviour from an inversable
 * @template T, Output, Input
 * @param {!recoil.frp.Frp} frp
 * @param {!recoil.frp.Inversable} inversable
 * @param {Input} params
 * @return {T}
 */

export function create<T, Input extends LimitedRecord<Input>>(frp:Frp, inversable:Inversable<T, Input>, params:RecordWithBehaviour<Input>): Behaviour<T> {
    let paramStruct:{[index:string]:Behaviour<any>} = {};
    for (let k in params) {
        if (params.hasOwnProperty(k)) {
            paramStruct[k] = frp.toBehaviour(params[k]);
        }
    }

    const resolveStruct =  () :Input => {
        let res:StructType = {};
        for (var k in paramStruct) {
            if (paramStruct.hasOwnProperty(k)) {
                res[k] = paramStruct[k].get();
            }
        }
        return res as Input;
    }

    let funcParams:Behaviour<any>[] = [];

    for (let k in params) {
        if (paramStruct.hasOwnProperty(k)) {
            funcParams.push(paramStruct[k]);
        }
    }
    return frp.liftBI<T>(() => inversable.calculate(resolveStruct()), (val:T)=> {
        let res = inversable.inverse(val, resolveStruct());
        for (let k in res) {
            paramStruct[k].set(res[k]);
        }
    }, ...(funcParams as BehaviourList1));
}




