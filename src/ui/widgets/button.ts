import {Widget} from "./widget";
import {WidgetScope} from "./widgetscope";
import {createDom, getCssName, removeNode} from "../dom/dom";
import {TagName} from "../dom/tags";
import {EventHelper} from "../eventhelper";
import {WidgetHelper} from "../widgethelper";
import {enable, setAll} from "../dom/classlist";
import {AttachableWidget, getGroup, Options} from "../frp/util";
import {BoolWithExplanation} from "../booleanwithexplain";
import {Behaviour, Frp} from "../../frp/frp";
import {Message} from "../message";
import {EventType} from "../dom/eventtype.ts";
import {EnabledTooltipHelper} from "../tooltiphelper.ts";
import {AttachCallbackType} from "../../frp/struct.ts";

export type ButtonAttachType = AttachCallbackType<{value:MouseEvent},{
    text:string|Message,
    enabled?: BoolWithExplanation,
    classes?: string[],
    confirmAni?: AniFunc,
    confirm?: number, // time needed for confirmation in ms
    tooltip?: Message,
}>

export type AniFunc = (container:HTMLElement, position:{x: number, y: number, height: number, width: number}, progress:number) => void;

export class ButtonWidget extends Widget implements AttachableWidget {
    private readonly button_: HTMLButtonElement;
    private readonly confirmDiv_: HTMLElement;
    private readonly helper_: WidgetHelper;
    private downTime_: null|number;
    private aniId_: any;
    private enabledB_ :Behaviour<BoolWithExplanation>|undefined;
    private classesB_:Behaviour<string[]>|undefined;
    private textB_:Behaviour<string|Message>|undefined;
    private changeHelper_:EventHelper<MouseEvent>;
    private frp_: Frp;
    private callbackB_: Behaviour<any, MouseEvent>|undefined;
    private cssBaseB_: Behaviour<string>|undefined;
    private confirmInfoB_?: Behaviour<{confirm:number, confirmAni:AniFunc}>;
    private readonly enabledHelper_: EnabledTooltipHelper;

    /**
     *
     * @param scope
     * @param longEvent will the button click take a long time, if so this will the cursor to indicate
     * that
     */
    constructor(scope:WidgetScope, longEvent?: boolean) {
        super(scope, createDom(TagName.DIV));
        this.frp_ = scope.getFrp();
        this.button_ = createDom(TagName.BUTTON, {}, "?") as HTMLButtonElement;
        // used to do spinning widget on confirm dialogs
        this.confirmDiv_ = createDom(TagName.DIV) as HTMLElement;
        this.aniId_ = null;
        this.downTime_ = null;

        // @todo this is needed otherwise disabled button don't show tooltips
        //this.component_.getElement().setAttribute('class', 'recoil-button-tooltip-padding');
        this.element_.appendChild(this.button_);
        //        this.enabledHelper_ = new recoil.ui.TooltipHelper(scope, this.button_, this.component_.getElement(), function(enabled) {});

        this.helper_ = new WidgetHelper(scope, this.button_, this, this.updateState_, {detach: ()=> this.stopAnimation_(), attach: () => {}});
        this.changeHelper_ = new EventHelper(scope, this.button_, EventType.CLICK, undefined, longEvent);
        this.enabledHelper_ = new EnabledTooltipHelper(scope, this.getElement(), this.getElement());

        EventHelper.listenAll(this.button_, [
            EventType.MOUSEUP,
            EventType.MOUSEDOWN,
            EventType.MOUSELEAVE
        ], (e:MouseEvent) => {
            if (!this.confirmInfoB_) {
                return;
            }
            scope.getFrp().accessTrans(() => {
                if (!this.confirmInfoB_|| !this.confirmInfoB_.good()) {
                    return;
                }
                if (this.confirmInfoB_.get().confirm) {
                    if (e.type === 'mousedown' && e.button === 0 && this.enabledB_?.get().val()) {
                        this.startAnimation_();
                    } else if (e.type === 'mouseleave') {
                        this.stopAnimation_();
                    }
                }

            }, ...[this.confirmInfoB_, this.enabledB_].filter(v => !!v));
        });
    }

    private startAnimation_() {
        if (!this.confirmInfoB_) {
            return;
        }
        this.downTime_ = new Date().getTime();
        let dims = this.button_.getBoundingClientRect();
        let startTime = new Date().getTime();
        let aniTime = this.confirmInfoB_?.get().confirm || 0;

        this.stopAnimation_();
        let aniFunc = this.frp_.accessTransFunc((first:boolean)=> {
            let progress = first ? 0 : Math.min(1, (new Date().getTime() - startTime) / aniTime);

            this.confirmInfoB_?.get().confirmAni(this.confirmDiv_, dims, progress);

            if (progress === 1 && this.aniId_ !== null) {
                clearInterval(this.aniId_);
                this.aniId_ = null;
            }

        }, this.confirmInfoB_);
        aniFunc(true);
        this.aniId_ = setInterval(aniFunc, 40);
        this.button_.appendChild(this.confirmDiv_);

    }

    private stopAnimation_() {
        let me = this;
        if (me.aniId_ !== null) {
            clearInterval(me.aniId_);
            me.aniId_ = null;
        }
        if (me.confirmDiv_) {
            removeNode(me.confirmDiv_);
        }
    }

    static defaultConfirmAni(container:HTMLElement, position:{x: number, y: number, height: number, width: number}, progress:number) {

        let width = 50;
        let height = 50;
        let dims = position;
        let top = Math.floor(dims.y - (width / 2) + dims.height / 2);
        let left = Math.floor(dims.x - (width / 2) + dims.width / 2);
        let redW = width * progress / 2;

        container.setAttribute('style',
            'top:' + top + 'px;'
            + 'left:' + left + 'px;'
            + 'width:' + width + 'px;'
            + 'height:' + height + 'px;');
        enable(container, 'recoil-button-confirm', true);

//    container.style.background = ' radial-gradient(#9ab568 0%, #9ab568 ' + redW + 'px,' + ' transparent ' + redW + 'px, transparent 49px)';
        let startColor = 'rgb(56 165 255)';
        let endColor = 'rgb(169 216 255)';

        container.style.background = ' radial-gradient(' +
            startColor + ' 0%, ' + startColor + ' ' + Math.max(0, redW - 6) + 'px, ' +
            endColor + ' ' + Math.max(0, redW - 1) + 'px, ' +
            'transparent ' + redW + 'px, transparent ' + (width / 2) + 'px)';

//    container.style.background = ' radial-gradient(green 0%, transparent ' + redW + 'px, green 49px)';

    }

    attachStruct(value: ButtonAttachType) {

        let frp = this.helper_.getFrp();
        let bound = ButtonWidget.options.bind(frp, value);

        this.cssBaseB_ = bound.cssBase();
        const enabledB =  bound.enabled()  as Behaviour<BoolWithExplanation>;
        const editableB =  bound.editable() as Behaviour<boolean>;
        const callbackB = bound.value();
        this.confirmInfoB_ = bound[getGroup](['confirm', 'confirmAni']);

        this.enabledB_ = BoolWithExplanation.and(
            frp,
            BoolWithExplanation.createTrueB(frp.createB(true), bound.tooltip()),
            BoolWithExplanation.createB(editableB), enabledB);

        this.callbackB_ = frp.liftBI((v:MouseEvent) => {
            return v;
        }, (v)=> {
            this.stopAnimation_();
            if (this.enabledB_?.good() && this.enabledB_.get().val()) {
                if (!this.confirmInfoB_?.good() || !this.confirmInfoB_.get().confirm || (this.downTime_ && (new Date().getTime() - this.downTime_) > this.confirmInfoB_.get().confirm)) {
                    callbackB.set(v);
                }
            }
            this.downTime_ = null;

        }, callbackB, this.enabledB_, this.confirmInfoB_);

        this.classesB_ = frp.liftB((cls:string[], enabled:BoolWithExplanation): string[]=> {
            let res = [];
            if (!enabled.val()) {
                res.push('recoil-button-disabled');
            }
            res = res.concat(cls);
            return res;
        }, bound.classes() as Behaviour<string[]>, this.enabledB_);

        this.textB_ = bound.text();
        this.helper_.attach(this.textB_ as Behaviour<string|Message>, this.callbackB_, this.enabledB_, this.classesB_, this.confirmInfoB_, this.cssBaseB_);
        this.enabledHelper_.attach(this.enabledB_, this.helper_);
        this.changeHelper_.listen(this.callbackB_);
    }
    static options = Options('value', 'text', {
        cssBase: 'recoil-',
        enabled: BoolWithExplanation.TRUE,
        editable: true,
        classes: [],
        tooltip: null,
        confirm: 0,
        confirmAni: ButtonWidget.defaultConfirmAni
    });

    updateState_ () {
        if (this.button_ &&this.textB_) {
            if (this.textB_.good()) {
                let text = this.textB_.get();
                if (text instanceof Message) {
                    text = text.toString();
                }
                this.button_.innerText = text;

            }
            let classes = [getCssName(this.cssBaseB_, 'button-tooltip-padding')].concat(this.classesB_?.good() ? this.classesB_.get() : []);
            if (!this.helper_.isGood()) {
                classes.push(getCssName(this.cssBaseB_, 'button-disabled'));
            }
            setAll(this.element_, classes);
        }
    }
}


