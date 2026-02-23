import {DomObserver} from "./domobserver.ts";
import {Behaviour, BehaviourList, BStatus, ErrorType, Frp} from "../frp/frp.ts";
import {WidgetScope} from "./widgets/widgetscope.ts";
import * as classlist from "./dom/classlist.ts";
import {append, createTextNode, removeChildren} from "./dom/dom.ts";
import {Messages as messages} from "./messages.ts";

export class WidgetHelper {

    private readonly observer_: DomObserver;
    private readonly frp_: Frp;
    private readonly element_: Element;
    private behaviours_: BehaviourList = [];
    private attachedBehaviour_: Behaviour<any> | null = null;
    private isAttached_: boolean = false;
    private debug_: string | null;
    private readonly listenFunc_: (exists: boolean) => void;
    private callback_: () => BStatus<null>;
    private cleanupCallbacks_: {detach:(() => void), attach: (() => void)}[] = [];
    private obj_:any;


    constructor(widgetScope: WidgetScope,
                element: Element, obj: any,
                callback:(this:any, helper:WidgetHelper,...behavioiurs:BehaviourList)=>void,
                cleanup?:{
                    detach:  (() => void),
                    attach: (() => void)
                }) {
        this.observer_ = widgetScope.getObserver();
        this.frp_ = widgetScope.getFrp();
        this.element_ = element;
        this.cleanupCallbacks_ = cleanup ? [cleanup] : [];
        this.obj_ = obj;




        this.debug_ = null;
        if (!(callback instanceof Function)) {
            throw new Error('callback not a function');
        }
        this.listenFunc_ = (visible: boolean): void => {
            if (this.debug_) {
                console.log('VISIBLE', this.debug_, visible);
            }
            if (!this.attachedBehaviour_) {
                return;
            }
            if (visible != this.isAttached_) {
                if (visible) {
                    this.doAttachCallbacks_();
                    this.frp_.attach(this.attachedBehaviour_);
                } else {
                    this.doDetachCallbacks_();
                    this.frp_.detach(this.attachedBehaviour_);
                }
            }
        };

        this.callback_ = () => {
            if (this.element_ !== null) {
                try {
                    callback.apply(obj, [this, ...this.behaviours_]);
                } catch (e) {
                    console.error(e);
                }
            }
            return new BStatus(null);
        };
    }
    getFrp(): Frp {
        return this.frp_;
    }

    addDetachCallback(cb: {attach: () => void, detach: () => void}) {
        this.cleanupCallbacks_.push(cb);
    }

    private doAttachCallbacks_() {
        if (!this.isAttached_) {
            this.isAttached_ = true;
            for (let {attach: callback} of this.cleanupCallbacks_) {
                callback.apply(this.obj_, []);
            }
        }
    }
    private doDetachCallbacks_() {
        if (this.isAttached_) {
            this.isAttached_ = false;
            for (let {detach: callback} of this.cleanupCallbacks_) {
                callback.apply(this.obj_, []);
            }
        }
    }
    get behaviours() {
        return this.behaviours_;
    }
    /**
     * updates the classes on an elemnt it will remove all old classes that are in cur classes but not
     * in classesB
     * @param element the element to update the class list for
     * @param classesB the behaviour that stores the classes in
     * @param curClasses
     * @return the new classes
     */
    static updateClasses(element: Element, classesB: Behaviour<string[]>|undefined, opt_curClasses?: string[]): string[] {
        let newClasses = classesB && classesB.metaGet().good() ? classesB.get() : [];
        let curClasses  = opt_curClasses == undefined ? classlist.get(element) : opt_curClasses;
        return WidgetHelper.updateClassesNoBehaviour(newClasses, curClasses, element);
    }

    static updateClassesNoBehaviour(newClasses: string[], curClasses: string[], element: Element) {
        for (let cls of newClasses) {
            if (curClasses.indexOf(cls) === -1) {
                classlist.add(element, cls);
            }
        }
        for (let cls of curClasses) {
            if (newClasses.indexOf(cls) === -1) {
                classlist.remove(element, cls);
            }
        }

        return newClasses;
    }

    static updateClassesOption<T extends {classes:string[]}> (element: HTMLElement, optionsB: Behaviour<T>|undefined, curClasses: string[]): string[] {
        let newClasses = optionsB && optionsB.metaGet().good() && optionsB.get().classes || [];
        return WidgetHelper.updateClassesNoBehaviour(newClasses, curClasses, element);
    }

    /**
     * @param debug the tag to print when debugging
     */
    debug(debug: string) {
        this.debug_ = debug;
    }

    /**
     * @return {boolean}
     */

    isAttached() {
        return this.isAttached_;
    }

    /**
     * @param node at text node that will contain the message
     */
    setMessage(node:Element) {
        removeChildren(node);
        classlist.removeAll(node, ['recoil-error', 'recoil-info']);
        if (!this.isGood()) {
            let errors = this.errors();
            if (errors.length > 0) {
                append(node, createTextNode(messages.join(errors).toString()));
                classlist.add(node, 'recoil-error');
            } else {
                classlist.add(node, 'recoil-notready');
                append(node, createTextNode(messages.NOT_READY.toString()));
            }
        }
    };

    /**
     * removes all children
     */
    clearContainer() {
        removeChildren(this.element_);
    }

    /**
     * @return {boolean} is the value good
     */
    isGood(): boolean {
        for (let b of this.behaviours_) {
            if (!b.hasRefs()) {
                return false;
            }
            if (b.metaGet() !== null && !b.metaGet().good()) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return {!Array<*>} an array of errors
     */
    errors(): ErrorType[] {
        let result = [];


        for (let key = 0; key < this.behaviours_.length; key++) {
            let b = this.behaviours_[key];


            if (!b.hasRefs()) {
                continue;
            }

            let meta = b.metaGet();

            if (meta !== null) {
                let errors = meta.errors();

                for (let i = 0; i < errors.length; i++) {
                    let error = errors[i];
                    if (result.indexOf(error) === -1) {
                        result.push(error);
                    }
                }
            }
        }

        return result;
    }


    /**
     * force the change to fire
     */
    forceUpdate(): void {
        // if there are no behaviours then no need to fire since they don't change
        if (this.behaviours_.length !== 0) {
            Frp.access(this.callback_, ...this.behaviours_);
        }
    }

    /**
     * like frp access trans but will do attached behaviours and only if they are good
     * @param {function():?} cb
     * @param {?=} opt_def
     * @return {?}
     */
    accessTrans<T>(cb: () => T, opt_def?: T): T | undefined {
        if (!this.isAttached_) {
            return opt_def;
        }
        return this.frp_.accessTrans<T | undefined>((): T | undefined => {
            if (this.isGood()) {
                return cb();

            } else {
                return opt_def;
            }

        }, ...this.behaviours_);
    }

    /**
     * starts listen these behaviours and stops listening to any other behaviours it used to listen too
     *
     * @param var_behaviour
     *
     */
    attach(...var_behaviour: BehaviourList) {

        let newBehaviours = [];
        let same = var_behaviour.length === this.behaviours_.length;
        for (let i = 0; i < var_behaviour.length; i++) {
            newBehaviours.push(var_behaviour[i]);
            same = same && var_behaviour[i] === this.behaviours_[i];
        }
        if (same) {
            return;
        }

        let hadBehaviour = this.behaviours_.length !== 0;
        if (hadBehaviour) {
            if (this.isAttached_) {
                if (this.attachedBehaviour_) {
                    this.frp_.detach(this.attachedBehaviour_);
                }
                this.doDetachCallbacks_();
            }
        }

        this.behaviours_ = newBehaviours;
        if (this.behaviours_.length === 0) {
            this.attachedBehaviour_ = null;
        } else {
            this.attachedBehaviour_ = this.frp_.observeB(this.callback_, ...this.behaviours_).setName('AttachedB in helper');
        }

        if (hadBehaviour) {
            if (this.isAttached_ && this.attachedBehaviour_) {
                this.frp_.attach(this.attachedBehaviour_);
            }
            else if (this.behaviours_.length === 0) {
                this.observer_.unlisten(this.element_, this.listenFunc_);
            }
        } else {
            this.doDetachCallbacks_();
            if (this.behaviours_.length > 0) {
                this.observer_.listen(this.element_, this.listenFunc_);
            }
        }
    }

    detach() {
       this.attach();
    }
}
