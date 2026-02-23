import {Action} from "./action.ts";
import {WidgetScope} from "../widgets/widgetscope.ts";
import {Behaviour} from "../../frp/frp.ts";

/**
 *
 * @param {string} name
 * @param {recoil.frp.Behaviour} selectorB
 * @param {function(recoil.ui.WidgetScope)} factory
 */
export class ScreenAction<Type> implements Action {
    private factory_:(scope: WidgetScope) => any;
    private name_:string;
    private selectorB_:Behaviour<Type>
    constructor(name:string, selectorB: Behaviour<Type>, factory: (scope: WidgetScope) => Type) {
        this.name_ = name;
        this.selectorB_ = selectorB;
        this.factory_ = factory;
    }

    createCallback(scope: WidgetScope): Behaviour<null, Type> {
        return scope.getFrp().createCallback(() =>{
            this.selectorB_.set(this.factory_(scope));
        }, this.selectorB_);
    }
}



