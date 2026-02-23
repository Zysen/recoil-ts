
import {WidgetScope} from "./widgetscope.ts";
import {getGroup, StandardOptions} from "../frp/util.ts";
import {WidgetHelper} from "../widgethelper.ts";
import {Widget} from "./widget.ts";
import {createDom, isElement, setStyle, setTextContent} from "../dom/dom.ts";
import classlist from "../dom/classlist.ts";
import {Behaviour} from "../../frp/frp.ts";
import {Message} from "../message.ts";
import {AttachType} from "../../frp/struct.ts";
import {BoolWithExplanation} from "../booleanwithexplain.ts";

export class ProgressWidget extends Widget {
    private text_: HTMLDivElement;
    private helper_:WidgetHelper;
    private thumb_:HTMLDivElement;
    private configB_?: Behaviour<{
        text:string|Message|Element,
        max:number,
        value:number,
    }>;

    constructor(scope: WidgetScope) {
        let text =  createDom('div', {class: 'recoil-progress-bar-text'});
        let thumb = createDom('div', {class: 'recoil-progress-bar-thumb'});

        super(scope,createDom(
            'div', {class: 'recoil-progress-bar'},
            thumb,
            text));
        this.text_ = text;
        this.thumb_ = thumb;
        this.helper_ = new WidgetHelper(scope, this.getElement(), this, this.updateState_);
    }
    
    private updateState_(helper:WidgetHelper) {
        if (helper.isGood() && this.configB_) {
            let max = this.configB_.get().max;
            let curVal = this.configB_.get().value;
            let percent = Math.min(Math.round(curVal * 100 / max), curVal < max ? 99.9 : 100);
            setStyle(this.thumb_, {width: percent + '%'});

//            this.progress_.setMaximum(max);
//            this.progress_.setValue(curVal);
            let val = this.configB_.get().text;

            classlist.enable(this.getElement() as HTMLElement, 'recoil-progress-bar-done', curVal >= max);

            if (isElement(val)) {
                setTextContent(this.text_, '' /*this.textB_.get().innerText*/);
                this.text_.appendChild(val);
            } else {
                setTextContent(this.text_, String(val));
            }
        } else {
            classlist.enable(this.getElement() as HTMLElement, 'progress-bar-done', false);
            setTextContent(this.text_, '');
            //setStyle(this.thumb_, {width: 0});
        }
    }

    /**
     * attachable behaviours for widget
     */
    static options = StandardOptions(
        'max', 'value', {
            text: ''
        });

    /**
     *
     * @param {!Object| !recoil.frp.Behaviour<Object>} options
     */
    attachStruct(options:AttachType<
        { value:number, max: number, text?:string, enabled?: BoolWithExplanation }>) {
        let frp = this.helper_.getFrp();
        let bound = ProgressWidget.options.bind(frp, options);
        this.configB_ = bound[getGroup]([bound.max, bound.value, bound.text, bound.enabled]);
        this.helper_.attach(this.configB_);
    }
}

