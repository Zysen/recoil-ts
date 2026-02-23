import {Behaviour} from "./frp.ts";
import {Tree} from "../structs/tree.ts";
import {BehaviourOrType} from "./struct.ts";

/**
 * @template T
 * @param {!recoil.frp.Behaviour<!recoil.structs.Tree<T>>} treeB
 * @param {!Array<string>|!recoil.frp.Behaviour<!Array<string>>} path
 * @return {!recoil.frp.Behaviour<T>}
 */
export function getValueB<Type>(treeB:Behaviour<Tree<Type>>, path:BehaviourOrType<string[]>):Behaviour<Type|null> {
    const frp = treeB.frp();
    const pathB = frp.toBehaviour(path);
    return frp.liftBI(
        function(tree:Tree<Type>, path:string[]):Type|null {
            return tree.getValue(path);
        },
        function(val:Type) {
            treeB.set(treeB.get().setValue(pathB.get(), val));
        }, treeB, pathB);
}
