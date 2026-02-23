import {WidgetScope} from "../widgets/widgetscope.ts";
import {Behaviour} from "../../frp/frp.ts";

export interface Action {
    createCallback(scope:WidgetScope):Behaviour<any>;
}
