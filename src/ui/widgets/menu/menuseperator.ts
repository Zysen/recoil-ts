import { createDom } from "../../dom/dom";
import { TagName } from "../../dom/tags";
import { Widget } from "../widget";
import { WidgetScope } from "../widgetscope";

export class MenuSeparatorWidget extends Widget {
  
    constructor(scope: WidgetScope) {
        super(scope, createDom(TagName.HR, {class: 'recoil-menu-seperator'}));
    }

};
