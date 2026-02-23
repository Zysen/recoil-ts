import {Behaviour, BStatus, Frp, Status} from "./frp.ts";
import {isEqual} from "../util/object.ts";

export const Action = {
    FLUSH: Symbol("FLUSH"),
    CLEAR: Symbol("CLEAR"),
};


/**
 * creates a behaviour whos changes are stored in changeB until a flushB is sent, at which
 * point valueB gets set and changeB gets put to not Ready
 *
 * @template T
 * @param {!recoil.frp.Frp} frp
 * @param {!recoil.frp.Behaviour<T>} valueB
 * @param {!recoil.frp.Behaviour<T>} changeB
 * @param {!recoil.frp.Behaviour<recoil.frp.ChangeManager.Action>} flushE
 * @return {!recoil.frp.Behaviour<T>}
 */
export function create<T>(frp:Frp, valueB:Behaviour<T>, changeB:Behaviour<T>, flushE:Behaviour<any, any, Symbol[]>):Behaviour<any> {
    return frp.metaLiftBI(
        (value, change, flush)=> {
            for (var i = 0; i < flush.get().length; i++) {
                if (changeB.metaGet().ready()) {
                    if (flush.get()[i] === Action.FLUSH) {
                        valueB.set(changeB.get());
                        changeB.metaSet(BStatus.notReady());
                    }
                    else if (flush.get()[i] === Action.CLEAR) {
                        changeB.metaSet(BStatus.notReady());
                    }
                }
            }
            if (changeB.metaGet().ready()) {
                return change;
            }
            return valueB.metaGet();
        },
        (newValue:Status<T,any>, valueB:Behaviour<T>, changeB:Behaviour<T>) => {
            if (isEqual(newValue, valueB.metaGet())) {
                changeB.metaSet(BStatus.notReady());
            }
            else {
                changeB.metaSet(newValue);
            }
        }, valueB, changeB, flushE);
}
