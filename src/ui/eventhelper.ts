import {Behaviour} from "../frp/frp.ts";
import {WidgetScope} from "./widgets/widgetscope.ts";
import {EventType} from "./dom/eventtype.ts";
import {append, createDom, removeNode} from "./dom/dom.ts";
import {WidgetHelper} from "./widgethelper.ts";

export type Unlistener = { unlisten: () => void, listen: () => void };
export type EventCallback = EventListenerOrEventListenerObject | ((e: MouseEvent) => void) | ((e: KeyboardEvent) => void);

/**
 * a class used to help with firing events to behaviours, so you can listen to them directly
 * without having to always wrap them in access transaction
 */
export class EventHelper<Type extends Event> {
    private listener_: null | Behaviour<any>;
    private readonly types_: string[];
    private readonly capt_: boolean;
    private readonly helper_: WidgetHelper;
    private readonly element_: Element;
    private readonly func_: (this: Element, e: Event) => void;

    /**
     *
     * @param scope
     * @param element
     * @param type Event type or array of event types.
     * @param opt_capt Whether to fire in capture phase (defaults to false).
     * @param opt_long if the event may take a long time this will crate a busy cursor so that the user is informed
     */

    constructor(scope: WidgetScope, element: Element, type: EventType | EventType[] | string | string[], opt_capt?: boolean, opt_long?: boolean) {
        this.listener_ = null;
        this.types_ = (type instanceof Array ? typeof type : [type]) as string[];
        this.capt_ = !!opt_capt;
        this.helper_ = new WidgetHelper(scope, element, null, () => {
        });
        this.element_ = element;
        let cb = (e: Event): void => {
            if (this.listener_) {
                this.listener_.frp().accessTrans(() => {
                    // sometimes events fire when before it is on the screen
                    if (this.helper_.isAttached()) {
                        this.listener_?.set(e);
                    }
                }, this.listener_);
            }
        };
        this.func_ = opt_long ? EventHelper.makeLong(cb) : cb;
    }

    static readonly EL_CHANGE = 'el-change';

    /**
     * unlistens to all the existingListeners and adds newListeners to the list
     *
     * @param existingListeners
     * @param newListeners
     */
    static reregister(existingListeners: Unlistener[], ...newListeners: Unlistener[]) {
        let l = existingListeners.pop();
        while (l) {
            l.unlisten();
            l = existingListeners.pop();
        }
        for (let l of newListeners) {
            existingListeners.push(l);
        }
    }

    /**
     * unlistens to all the existingListeners, technically you can just call reregister with just
     * the first parameter but I think that is a bit confusing
     *
     * @param existingListeners
     */
    static unregister(existingListeners: Unlistener[]) {
        EventHelper.reregister(existingListeners);
    }
    /**
     * @param callback the behaviour to set with the event
     **/
    listen(callback: Behaviour<any, Type, any, any>) {
        this.helper_.attach(callback);
        if (this.listener_ === null) {
            this.listener_ = callback;
            for (let type of this.types_) {
                this.element_.addEventListener(type, this.func_, {capture: this.capt_});
            }
        } else {
            this.listener_ = callback;
        }
        this.listener_.setName('EventHelperB');
    }

    unlisten() {
        this.helper_.detach();
        if (this.listener_ !== null) {
            this.listener_ = null;
            for (let type of this.types_) {
                this.element_.removeEventListener(type, this.func_, {capture: this.capt_});
            }
        }
    }


    private static longListen_ = {busy: 0, style: createDom('style', {}, '* {cursor:  wait !important}')};

    /**
     * turn a cb into a long callback that will change the cursor into a spinning
     * cursor
     * @param {function(?)} cb
     * @return {function(?)}
     */
    static makeLong<ET extends Event>(cb: (e: ET) => void): (e: any) => void {
        return (e: any) => {
            let doit = function () {
                try {
                    cb(e);
                } finally {
                    EventHelper.longListen_.busy--;
                    if (EventHelper.longListen_.busy === 0) {
                        removeNode(EventHelper.longListen_.style);
                    }
                }

            };
            EventHelper.longListen_.busy++;
            if (EventHelper.longListen_.busy === 1) {
                append(document.head, EventHelper.longListen_.style);
                // this is odd but calculating the cursor seems to make the cursor update
                // most of the time before the timeout happens, so the user can see a spinning cursor
                // the "if (... || true)" is there because simply getting a variable is funny code
                if (window.getComputedStyle(document.body).cursor || true) {
                    setTimeout(doit, 20);

                }
            } else {
                doit();
            }
        };
    }

    /**
     * like addEventListener but return an object so that we can unlisten
     */
    static listen(el: EventTarget, type: EventType|string, callback: EventCallback, options?: boolean | AddEventListenerOptions): Unlistener {
        let listening = false;
        const listenFn = () => {
            if (!listening) {
                listening = true;
                el.addEventListener(type, callback as EventListenerOrEventListenerObject, options);
            }
        }
        listenFn();
        return {
            listen: listenFn,
            unlisten: () => {
                if (listening) {
                    listening = false;
                    el.removeEventListener(type, callback as EventListenerOrEventListenerObject, options);
                }
            }
        }
    }

    static listenAll(el: EventTarget, types: EventType[], callback: EventCallback, options?: boolean | AddEventListenerOptions): Unlistener {

        let listeners = [];
        for (let type of types) {
            listeners.push(EventHelper.listen(el, type, callback, options));
        }

        return {
            listen: () => listeners.forEach(l => l.listen()),
            unlisten: () => listeners.forEach(l => l.unlisten()),
        }

    }

}

export class EventHandler {
    private listeners_ = new Set<Unlistener>();

    listen(el: EventTarget, type: EventType, callback: EventCallback, options?: boolean | AddEventListenerOptions): void {
        this.listeners_.add(EventHelper.listen(el, type, callback, options));
    }
    listenCallback<T>(el: EventTarget, type: EventType, callback: Behaviour<any, any, any, any>, options?: boolean | AddEventListenerOptions): void {
        this.listen(el, type, (e:any)=> {
                callback.frp().accessTrans( () => callback.set(e), callback);
            }, options);
    }

    private static wrap(callback: EventCallback, test: () => boolean, scope: any): EventCallback {
        if (typeof callback === 'function') {

            return (evt: any) => {
                if (test()) {
                    (callback as any).apply(scope, evt);
                }
            }
        } else {
            return {
                handleEvent(object: Event) {
                    if (test()) {
                        callback.handleEvent(object);
                    }
                }
            }
        }
    }

    listenOnce(el: EventTarget, type: EventType|string, callback: EventCallback, options?: boolean | AddEventListenerOptions, scope?: any): void {


        let fired = false;
        let unlisten = EventHelper.listen(el, type, EventHandler.wrap(callback, () => {
            let fire = !fired;
            fired = true;
            this.listeners_.delete(unlisten);
            unlisten.unlisten();
            return fire;
        }, scope), options);
        this.listeners_.add(unlisten);
    }

    unlisten(): void {
        let listeners = [...this.listeners_];
        this.listeners_.clear();
        for (let l of listeners) {
            l.unlisten();
        }
    }

}
