import {Widget} from "./widget.ts";
import {WidgetScope} from "./widgetscope.ts";
import {InputWidget} from "./input.ts";
import {createDom, setElementShown} from "../dom/dom.ts";
import {TagName} from "../dom/tags.ts";
import {WidgetHelper} from "../widgethelper.ts";
import {Behaviour} from "../../frp/frp.ts";
import {enable} from "../dom/classlist.ts";
import {EventHelper} from "../eventhelper.ts";
import {EventType} from "../dom/eventtype.ts";
import {getOptionsGroup, Options} from "../frp/util.ts";
import {BoolWithExplanation} from "../booleanwithexplain.ts";
import {AttachType, extend} from "../../frp/struct.ts";

export class PasswordWidget extends Widget {
    private readonly passwordInput_: InputWidget;
    private readonly showIcon_: HTMLElement;
    private readonly hideIcon_: HTMLElement;
    private readonly show_: HTMLDivElement;
    private readonly showB_: Behaviour<boolean>;
    private readonly helper_: WidgetHelper;
    private readonly autocomplete_: boolean;
    private configB_?: Behaviour<{ enabled: BoolWithExplanation; show: boolean, editable:boolean}>;

    /**
     *
     * @param scope
     * @param opt_autocomplete is needed here instead of behaviour that sets it because the browser might autocomplete
     * we have a chance to change it
     */
    constructor(scope: WidgetScope, opt_autocomplete = true) {
        super(scope, createDom('div', 'recoil-password'));

        let frp = scope.getFrp();
        this.autocomplete_ = opt_autocomplete;
        this.showIcon_ = createDom(TagName.I, 'fas fa-eye');
        this.hideIcon_ = createDom(TagName.I, 'fas fa-eye-slash');
        this.show_ = createDom(
            'div', {class: 'recoil-password-show'},
            this.showIcon_, this.hideIcon_
        );

        this.passwordInput_ = new InputWidget(scope);
        this.getElement().appendChild(this.passwordInput_.getElement());
        this.getElement().appendChild(this.show_);
        this.setPasswordVisible(false);
        if (opt_autocomplete) {
            this.passwordInput_.setType('password');
        } else {
            this.passwordInput_.getInput().addEventListener("copy", evt => {
                evt.preventDefault();
            }, false);
            // you can't trust browsers not to autocomplete passwords, but sometimes it is necessary not to, for example
            // user management screens where you are setting someone else's password
            // to handle this just use an ordinary text field and change the font so its dots

        }
        this.showB_ = scope.getFrp().createB(false);
        this.helper_ = new WidgetHelper(scope, this.getElement(), this, () => {
            let hasShow = this.helper_.isGood() && this.configB_!.get().show && this.configB_!.get().editable;
            let show = this.helper_.isGood() && this.showB_.get();
            setElementShown(this.showIcon_, hasShow && show);
            setElementShown(this.hideIcon_, hasShow && !show);
            this.setPasswordVisible(show);
        });

        EventHelper.listen(this.show_, EventType.CLICK, frp.accessTransFunc(() => {
            this.showB_.set(!this.showB_.get());
        }, this.showB_));

    }

    setPasswordVisible(visible: boolean) {
        if (this.autocomplete_) {
            this.passwordInput_.setType(visible ? 'input' : 'password');
        } else {
            // todo stop copy from this field if its hidden
            enable(this.passwordInput_.getInput(), "recoil-password-hide", !visible);
        }
    }
    static options = Options('value', {
        show:true, enabled:BoolWithExplanation.TRUE, editable:true,
    })
    attachStruct(data:AttachType<{ value: string,
        show?:boolean,
        immediate?:boolean,
        enabled?:BoolWithExplanation }>) {
        let frp = this.scope_.getFrp();
        let bound = PasswordWidget.options.bind(frp, data);
        // change the password to blank if the field is not editable otherwise the input widget will display it
        let valueB = bound.value();
        let editableB = bound.editable();
        let safeValueB = frp.liftBI(
            (val: string, editable) => editable ? val : "*********",
            (val: string) => valueB.set(val), valueB, editableB);

        this.passwordInput_.attachStruct(extend(frp, data, {value: safeValueB}));
        this.configB_ = getOptionsGroup<{
            enabled:BoolWithExplanation,
            show:boolean,
            editable:boolean}>(bound, [bound.enabled, bound.show, bound.editable]);

        this.helper_.attach(this.showB_, this.configB_);
    }
}

