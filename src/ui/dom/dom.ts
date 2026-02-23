// Copyright 2006 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


/**
 * @define Whether we know at compile time that the browser is in
 * quirks mode.
 */

import {TagName, type TagTypeLookup} from "./tags.ts";
import {NodeType} from "./nodetype.ts";
import {type StructType} from "../../frp/struct.ts";
import {isArray, isObject, isString, isStringOrMessage, typeOf} from "../../util/goog.ts";
import classlist, {contains as containsClass} from "./classlist.ts";
import {userAgent} from "./useragent.ts";
import {Size} from "./size.ts";
import {Coordinate} from "./coordinate.ts";
import {canonicalizeNewlines, htmlEscape, toCamelCase, toTitleCase, Unicode} from "../../util/string.ts";
import {assert} from "../../util/goog.ts";
import {Box} from "./box.ts";
import {Rect} from "./rect.ts";
import {Behaviour} from "../../frp/frp.ts";
import {toRecord} from "../../util/object.ts";
import {Message} from "../message.ts";

/**
 * Gets the DomHelper object for the document where the element resides.
 * @param opt_element If present, gets the DomHelper for this
 *     element.
 * @return The DomHelper.
 */
export function getDomHelper(opt_element?: Node | Window | undefined | null): DomHelper {
    return opt_element ?
        new DomHelper(getOwnerDocument(opt_element)) :
        (defaultDomHelper_ ||
            (defaultDomHelper_ = new DomHelper()));
}


/**
 * Cached default DOM helper.
 * @type {!DomHelper|undefined}
 * @private
 */
let defaultDomHelper_: DomHelper | undefined;


/**
 * Gets the document object being used by the dom library.
 * @return Document object.
 */
export function getDocument(): Document {
    return document;
}


/**
 * Gets an element from the current document by element id.
 *
 * If an Element is passed in, it is returned.
 *
 * @param element Element ID or a DOM node.
 * @return The element with the given ID, or the node passed in.
 */
export function getElement(element: string | Element): Element | null {
    return getElementHelper_(document, element);
}


/**
 * Gets an element by id from the given document (if present).
 * If an element is given, it is returned.
 * @param doc
 * @param element Element ID or a DOM node.
 * @return The resulting element.
 * @private
 */
function getElementHelper_(doc: Document, element: string | Element): Element | null {
    return isString(element) ? doc.getElementById(element as string) : element as Element;
}


/**
 * Gets an element by id, asserting that the element is found.
 *
 * This is used when an element is expected to exist, and should fail with
 * an assertion error if it does not (if assertions are enabled).
 *
 * @param id Element ID.
 * @return The element with the given ID, if it exists.
 */
export function getRequiredElement(id: string | Element): Element {
    if (id instanceof Element) {
        return id;
    }
    return getRequiredElementHelper_(document, id);
}

/**
 * Returns the viewport element for a particular document
 * @param opt_node DOM node (Document is OK) to get the viewport element of.
 * @return document.documentElement or document.body.
 */
export function getClientViewportElement(opt_node?: Node): Element {
    let doc;
    if (opt_node) {
        doc = getOwnerDocument(opt_node);
    } else {
        doc = getDocument();
    }

    // In old IE versions the document.body represented the viewport
    if (userAgent.IE && !userAgent.isDocumentModeOrHigher(9) &&
        !getDomHelper(doc).isCss1CompatMode()) {
        return doc.body;
    }
    return doc.documentElement;
}

export function getComputedStyle(element: Element, property: string) {
    let doc = getOwnerDocument(element);
    if (doc.defaultView && doc.defaultView.getComputedStyle) {
        let styles = doc.defaultView.getComputedStyle(element, null) as any;
        if (styles) {
            // element.style[..] is undefined for browser specific styles
            // as 'filter'.
            return styles[property] || styles.getPropertyValue(property) || '';
        }
    }

    return '';
}

/**
 * Cross-browser pseudo get computed style. It returns the computed style where
 * available. If not available it tries the cascaded style value (IE
 * currentStyle) and in worst case the inline style value.  It shouldn't be
 * called directly, see http://wiki/Main/ComputedStyleVsCascadedStyle for
 * discussion.
 *
 * @param element Element to get style of.
 * @param style Property to get (must be camelCase, not css-style.).
 * @return Style value.
 */
function getStyle_(element: Element, style: string): string {
    return getComputedStyle(element, style) ||
        getCascadedStyle(element, style) ||
        ((element as any).style && (element as any).style[style]);
}

/**
 * Retrieves the computed value of the position CSS attribute.
 * @param element The element to get the position of.
 * @return  Position value.
 */
export function getComputedPosition(element: Element): string {
    return getStyle_(element, 'position');
}

/**
 * Gets the cascaded style value of a node, or null if the value cannot be
 * computed (only Internet Explorer can do this).
 *
 * @param element Element to get style of.
 * @param style Property to get (camel-case).
 * @return Style value.
 */
function getCascadedStyle(element: Element, style: string): string | null {
    return (element as any).currentStyle ? (element as any).currentStyle[style] : null;
}

/**
 * Returns the first parent that could affect the position of a given element.
 * @param element The element to get the offset parent for.
 * @return The first offset parent or null if one cannot be found.
 */
export function getOffsetParent(element: Element): Element | null {
    // element.offsetParent does the right thing in IE7 and below.  In other
    // browsers it only includes elements with position absolute, relative or
    // fixed, not elements with overflow set to auto or scroll.
    if (userAgent.IE && !userAgent.isDocumentModeOrHigher(8)) {
        return (element as any).offsetParent;
    }

    let doc = getOwnerDocument(element);
    let positionStyle = getStyle_(element, 'position');
    let skipStatic = positionStyle == 'fixed' || positionStyle == 'absolute';
    for (let parent = element.parentNode; parent && parent != doc;
         parent = (parent as ParentNode).parentNode) {
        // Skip shadowDOM roots.
        if (parent.nodeType == NodeType.DOCUMENT_FRAGMENT && (parent as any).host) {
            parent = (parent as any).host;
        }
        positionStyle =
            getStyle_(parent as Element, 'position');
        skipStatic = skipStatic && positionStyle == 'static' &&
            parent != doc.documentElement && parent != doc.body;
        if (!skipStatic &&
            ((parent as any).scrollWidth > (parent as any).clientWidth ||
                (parent as any).scrollHeight > (parent as any).clientHeight ||
                positionStyle == 'fixed' || positionStyle == 'absolute' ||
                positionStyle == 'relative')) {
            return parent as Element;
        }
    }
    return null;
}


/**
 * Returns a Coordinate object relative to the top-left of the HTML document.
 * Implemented as a single function to save having to do two recursive loops in
 * opera and safari just to get both coordinates.  If you just want one value do
 * use goog.style.getPageOffsetLeft() and goog.style.getPageOffsetTop(), but
 * note if you call both those methods the tree will be analysed twice.
 *
 * @param el Element to get the page offset for.
 * @return The page offset.
 */
export function getPageOffset(el: Element) {
    let doc = getOwnerDocument(el);
    // TODO(gboyer): Update the jsdoc in a way that doesn't break the universe.

    // NOTE(arv): If element is hidden (display none or disconnected or any the
    // ancestors are hidden) we get (0,0) by default but we still do the
    // accumulation of scroll position.

    // TODO(arv): Should we check if the node is disconnected and in that case
    //            return (0,0)?

    let pos = new Coordinate(0, 0);
    let viewportElement = getClientViewportElement(doc);
    if (el == viewportElement) {
        // viewport is always at 0,0 as that defined the coordinate system for this
        // function - this avoids special case checks in the code below
        return pos;
    }

    let box = getBoundingClientRect_(el);
    // Must add the scroll coordinates in to get the absolute page offset
    // of element since getBoundingClientRect returns relative coordinates to
    // the viewport.
    let scrollCoord = getDomHelper(doc).getDocumentScroll();
    pos.x = box.left + scrollCoord.x;
    pos.y = box.top + scrollCoord.y;

    return pos;
}

/**
 * Gets the client rectangle of the DOM element.
 *
 * getBoundingClientRect is part of a new CSS object model draft (with a
 * long-time presence in IE), replacing the error-prone parent offset
 * computation and the now-deprecated Gecko getBoxObjectFor.
 *
 * This utility patches common browser bugs in getBoundingClientRect. It
 * will fail if getBoundingClientRect is unsupported.
 *
 * If the element is not in the DOM, the result is undefined, and an error may
 * be thrown depending on user agent.
 *
 * @param el The element whose bounding rectangle is being queried.
 * @return A native bounding rectangle with numerical left, top,
 *     right, and bottom.  Reported by Firefox to be of object type ClientRect.
 * @private
 */
function getBoundingClientRect_(el: Element): StructType {
    let rect;
    try {
        rect = toRecord(el.getBoundingClientRect());
    } catch (e) {
        // In IE < 9, calling getBoundingClientRect on an orphan element raises an
        // "Unspecified Error". All other browsers return zeros.
        return {'left': 0, 'top': 0, 'right': 0, 'bottom': 0};
    }

    // Patch the result in IE only, so that this function can be inlined if
    // compiled for non-IE.
    if (userAgent.IE && el.ownerDocument.body) {
        // In IE, most of the time, 2 extra pixels are added to the top and left
        // due to the implicit 2-pixel inset border.  In IE6/7 quirks mode and
        // IE6 standards mode, this border can be overridden by setting the
        // document element's border to zero -- thus, we cannot rely on the
        // offset always being 2 pixels.

        // In quirks mode, the offset can be determined by querying the body's
        // clientLeft/clientTop, but in standards mode, it is found by querying
        // the document element's clientLeft/clientTop.  Since we already called
        // getBoundingClientRect we have already forced a reflow, so it is not
        // too expensive just to query them all.

        // See: http://msdn.microsoft.com/en-us/library/ms536433(VS.85).aspx
        let doc = el.ownerDocument;
        rect.left -= doc.documentElement.clientLeft + doc.body.clientLeft;
        rect.top -= doc.documentElement.clientTop + doc.body.clientTop;
    }
    return rect;
}

/**
 * Returns clientLeft (width of the left border and, if the directionality is
 * right to left, the vertical scrollbar) and clientTop as a coordinate object.
 *
 * @param el Element to get clientLeft for.
 * @return Client left and top.
 */
export function getClientLeftTop(el: Element): Coordinate {
    return new Coordinate(el.clientLeft, el.clientTop);
}

/**
 * Calculates and returns the visible rectangle for a given element. Returns a
 * box describing the visible portion of the nearest scrollable offset ancestor.
 * Coordinates are given relative to the document.
 *
 * @param element Element to get the visible rect for.
 * @return Bounding elementBox describing the visible rect or
 *     null if scrollable ancestor isn't inside the visible viewport.
 */
export function getVisibleRectForElement(element: Element): Box | null {
    let visibleRect = new Box(0, Infinity, Infinity, 0);
    let dom = getDomHelper(element);
    let body = dom.getDocument().body;
    let documentElement = dom.getDocument().documentElement;
    let scrollEl = dom.getDocumentScrollElement();

    // Determine the size of the visible rect by climbing the dom accounting for
    // all scrollable containers.
    for (let el: Element | null = element; el = getOffsetParent(el);) {
        // clientWidth is zero for inline block elements in IE.
        // on WEBKIT, body element can have clientHeight = 0 and scrollHeight > 0
        if ((!userAgent.IE || el.clientWidth != 0) &&
            (!userAgent.WEBKIT || el.clientHeight != 0 || el != body) &&
            // body may have overflow set on it, yet we still get the entire
            // viewport. In some browsers, el.offsetParent may be
            // document.documentElement, so check for that too.
            (el != body && el != documentElement &&
                getStyle_(el, 'overflow') != 'visible')) {
            let pos = getPageOffset(el);
            let client = getClientLeftTop(el);
            pos.x += client.x;
            pos.y += client.y;

            visibleRect.top = Math.max(visibleRect.top, pos.y);
            visibleRect.right = Math.min(visibleRect.right, pos.x + el.clientWidth);
            visibleRect.bottom =
                Math.min(visibleRect.bottom, pos.y + el.clientHeight);
            visibleRect.left = Math.max(visibleRect.left, pos.x);
        }
    }
    // Clip by window's viewport.
    let scrollX = scrollEl.scrollLeft, scrollY = scrollEl.scrollTop;
    visibleRect.left = Math.max(visibleRect.left, scrollX);
    visibleRect.top = Math.max(visibleRect.top, scrollY);
    let winSize = dom.getViewportSize();
    visibleRect.right = Math.min(visibleRect.right, scrollX + winSize.width);
    visibleRect.bottom = Math.min(visibleRect.bottom, scrollY + winSize.height);
    return (visibleRect.top >= 0 && visibleRect.left >= 0
    && visibleRect.bottom > visibleRect.top &&
    visibleRect.right > visibleRect.left ?
        visibleRect : null);
}

/**
 * Helper function for getRequiredElementHelper functions, both static and
 * on DomHelper.  Asserts the element with the given id exists.
 * @param doc
 * @param id
 * @return The element with the given ID, if it exists.
 * @private
 */
function getRequiredElementHelper_(doc: Document, id: string): Element {
    // To prevent users passing in Elements as is permitted in getelementElement().
    assert(typeof id === 'string');
    let element = getElementHelper_(doc, id);

    assert(element instanceof Element, 'No element found with id: ' + id);
    return element as Element;
}

/**
 * Looks up elements by both tag and class name, using browser native functions
 * ({@code querySelectorAll}, {@code getElementsByTagName} or
 * {@code getElementsByClassName}) where possible. This function
 * is a useful, if limited, way of collecting a list of DOM elements
 * with certain characteristics.  {@code query} offers a
 * more powerful and general solution which allows matching on CSS3
 * selector expressions, but at increased cost in code size. If all you
 * need is particular tags belonging to a single class, this function
 * is fast and sleek.
 *
 * Note that tag names are case sensitive in the SVG namespace, and this
 * function converts opt_tag to uppercase for comparisons. For queries in the
 * SVG namespace you should use querySelector or querySelectorAll instead.
 * https://bugzilla.mozilla.org/show_bug.cgi?id=963870
 * https://bugs.webkit.org/show_bug.cgi?id=83438
 *
 * @see {query}
 *
 * @param opt_tag Element tag name.
 * @param opt_class Optional class name.
 * @param opt_el Optional element to look in.
 * @return list of elements (only a length
 */
export function getElementsByTagNameAndClass(opt_tag?: string, opt_class?: string | null, opt_el?: Document | Element | null): Element[] {
    return getElementsByTagNameAndClass_(
        document, opt_tag, opt_class, opt_el);
}

function toArray<T>(arrayLike: any): T[] {
    let res: T[] = [];
    if (arrayLike) {
        for (let i = 0; i < arrayLike.length; i++) {
            res.push(arrayLike[i]);
        }
    }
    return res;
}

/**
 * Returns a static, array-like list of the elements with the provided
 * className.
 * @see {query}
 * @param className the name of the class to look for.
 * @param opt_el element to look in.
 * @return The items found with the class name provided.
 */
export function getElementsByClass(className: string, opt_el?: Document | Element): Element[] {
    let parent = opt_el || document;
    if (canUseQuerySelector_(parent)) {
        return toArray(parent.querySelectorAll('.' + className));
    }
    return getElementsByTagNameAndClass_(
        document, '*', className, opt_el);
}


/**
 * Returns the first element with the provided className.
 * @see {query}
 * @param className the name of the class to look for.
 * @param opt_el Optional element to look in.
 * @return The first item with the class name provided.
 */
export function getElementByClass(className: string, opt_el?: Document | Element): Element | null {
    let parent = opt_el || document;
    let retVal;
    if (parent.getElementsByClassName) {
        retVal = parent.getElementsByClassName(className)[0];
    } else if (canUseQuerySelector_(parent)) {
        retVal = parent.querySelector('.' + className);
    } else {
        retVal = getElementsByTagNameAndClass_(
            document, '*', className, opt_el)[0];
    }
    return retVal || null;
}


/**
 * Ensures an element with the given className exists, and then returns the
 * first element with the provided className.
 * @see {query}
 * @param className the name of the class to look for.
 * @param opt_root Optional element or document to look
 *     in.
 * @return The first item with the class name provided.
 * @throws Thrown if no element is found.
 */
export function getRequiredElementByClass(className: string, opt_root?: Element | Document): Element {
    let retValue = getElementByClass(className, opt_root);
    assert(
        retValue, 'No element found with className: ' + className);
    return retValue as Element;
}


/**
 * Prefer the standardized (http://www.w3.org/TR/selectors-api/), native and
 * fast W3C Selectors API.
 * @param parent The parent document object.
 * @return whether or not we can use parent.querySelector* APIs.
 * @private
 */
function canUseQuerySelector_(parent: Document | Element): boolean {
    return !!((parent as any).querySelectorAll && parent.querySelector);
}


/**
 * Helper for {@code getElementsByTagNameAndClass}.
 * @param doc The document to get the elements in.
 * @param opt_tag Element tag name.
 * @param opt_class Optional class name.
 * @param opt_el Optional element to look in.
 * @return list of elements
 */
function getElementsByTagNameAndClass_(
    doc: Document, opt_tag?: string | null, opt_class?: string | null, opt_el?: Document | Element | null): Element[] {
    let parent = opt_el || doc;
    let tagName = (opt_tag && opt_tag != '*') ? opt_tag.toLowerCase() : '';

    if (canUseQuerySelector_(parent) && (tagName || opt_class)) {
        let query = tagName + (opt_class ? '.' + opt_class : '');
        return toArray(parent.querySelectorAll(query));
    }

    // Use the native getElementsByClassName if available, under the assumption
    // that even when the tag name is specified, there will be fewer elements to
    // filter through when going by class than by tag name
    if (opt_class && parent.getElementsByClassName) {
        let els = parent.getElementsByClassName(opt_class);

        if (tagName) {
            return toArray<HTMLElement>(els).filter((el: HTMLElement) => tagName == el.nodeName);
        } else {
            return toArray(els);
        }
    }

    let els = parent.getElementsByTagName(tagName || '*');

    if (opt_class) {
        return toArray<HTMLElement>(els).filter((el: HTMLElement) => containsClass(el, opt_class));
    } else {
        return toArray(els);
    }
}

/**
 * Sets multiple properties on a node.
 * @param element DOM node to set properties on.
 * @param properties Hash of property:value pairs.
 */
export function setProperties(element: Element, properties: StructType) {
    for (let key in properties) {
        let val = properties[key];
        if (key == 'style') {
            if (val instanceof Object) {
                setStyle(element as HTMLElement, val);
            } else {
                (element as any).style.cssText = val;
            }
        } else if (key == 'class') {
            element.className = val;
        } else if (key == 'for') {
            (element as any).htmlFor = val;
        } else if (DIRECT_ATTRIBUTE_MAP_.hasOwnProperty(key)) {
            element.setAttribute(DIRECT_ATTRIBUTE_MAP_[key], val);
        } else if (
            key.startsWith('aria-') ||
            key.startsWith('data-')) {
            element.setAttribute(key, val);
        } else {
            (element as any)[key] = val;
        }
    }
}


/**
 * Map of attributes that should be set using
 * element.setAttribute(key, val) instead of element[key] = val.  Used
 * by setProperties.
 *
 */
const DIRECT_ATTRIBUTE_MAP_: StructType = {
    'cellpadding': 'cellPadding',
    'cellspacing': 'cellSpacing',
    'colspan': 'colSpan',
    'frameborder': 'frameBorder',
    'height': 'height',
    'maxlength': 'maxLength',
    'nonce': 'nonce',
    'role': 'role',
    'rowspan': 'rowSpan',
    'type': 'type',
    'usemap': 'useMap',
    'valign': 'vAlign',
    'width': 'width'
};


/**
 * Gets the page scroll distance as a coordinate object.
 *
 * @param opt_window Optional window element to test.
 * @return Object with values 'x' and 'y'.
 * @deprecated Use {@link getDocumentScroll} instead.
 */
export function getPageScroll(opt_window?: Window): Coordinate {
    return getDomHelper(opt_window).getDocumentScroll();
}


/**
 * Gets the document scroll distance as a coordinate object.
 *
 * @return Object with values 'x' and 'y'.
 */
export function getDocumentScroll() {
    return getDocumentScroll_(document);
}


/**
 * Helper for {@code getDocumentScroll}.
 *
 * @param doc The document to get the scroll for.
 * @return Object with values 'x' and 'y'.
 * @private
 */
function getDocumentScroll_(doc: Document): Coordinate {
    let el = getDocumentScrollElement_(doc);
    let win = getWindow_(doc);
    if (userAgent.IE && userAgent.isVersionOrHigher('10') &&
        win.pageYOffset != el.scrollTop) {
        // The keyboard on IE10 touch devices shifts the page using the pageYOffset
        // without modifying scrollTop. For this case, we want the body scroll
        // offsets.
        return new Coordinate(el.scrollLeft, el.scrollTop);
    }
    return new Coordinate(
        win.pageXOffset || el.scrollLeft, win.pageYOffset || el.scrollTop);
}

/**
 * Gets the document scroll element.
 * @return Scrolling element.
 */
export function getDocumentScrollElement(): Element {
    return getDocumentScrollElement_(document);
}


/**
 * Helper for {@code getDocumentScrollElement}.
 * @param doc The document to get the scroll element for.
 * @return  Scrolling element.
 * @private
 */
function getDocumentScrollElement_(doc: Document): Element {
    // Old WebKit needs body.scrollLeft in both quirks mode and strict mode. We
    // also default to the documentElement if the document does not have a body
    // (e.g. a SVG document).
    // Uses http://dev.w3.org/csswg/cssom-view/#dom-document-scrollingelement to
    // avoid trying to guess about browser behavior from the UA string.
    if (doc.scrollingElement) {
        return doc.scrollingElement;
    }
    if (!userAgent.WEBKIT && isCss1CompatMode_(doc)) {
        return doc.documentElement;
    }
    return doc.body || doc.documentElement;
}


/**
 * Gets the window object associated with the given document.
 *
 * @param opt_doc  Document object to get window for.
 * @return The window associated with the given document.
 */
export function getWindow(opt_doc?: Document): Window {
    // TODO(arv): This should not take an argument.
    return opt_doc ? getWindow_(opt_doc) : window;
}


/**
 * Helper for {@code getWindow}.
 *
 * @param doc  Document object to get window for.
 * @return The window associated with the given document.
 * @private
 */
function getWindow_(doc: Document): Window {
    return (doc as any).parentWindow || doc.defaultView;
}


/**
 * Returns a dom node with a set of attributes.  This function accepts varargs
 * for subsequent nodes to be added.  Subsequent nodes will be added to the
 * first node as childNodes.
 *
 * So:
 * <code>createDom('div', null, createDom('p'), createDom('p'));</code>
 * would return a div with two child paragraphs
 *
 * @param tagName Tag to create.
 * @param opt_attributes If object, then a map
 *     of name-value pairs for attributes. If a string, then this is the
 *     className of the new element. If an array, the elements will be joined
 *     together as the className of the new element.
 * @param var_args Further DOM nodes or
 *     strings for text nodes. If one of the var_args is an array or NodeList,
 *     its elements will be added as childNodes instead.
 * @return Reference to a DOM node.
 */
export function createDom<T extends string>(tagName: T, opt_attributes?: (Object | string[] | string | null), ...var_args: (Object | string | any[] | null | NodeList | Message)[]): TagTypeLookup<T> {
    return createDom_(document, ...[tagName, opt_attributes, ...var_args]) as any;
}

/**
 * sets the property of el to value, if val is null removes it
 * @param el
 * @param prop
 * @param v
 */
export function setAtrribute(el: Element, prop: string, v: any) {
    if (v == null) {
        if (el.hasAttribute(prop)) {
            el.removeAttribute(prop);
        }
    } else {
        if (el.getAttribute(prop) !== v) {
            el.setAttribute(prop, v);
        }
    }
}

/**
 * Helper for {@code createDom}.
 * @param doc The document to create the DOM in.
 * @param args Argument object passed from the callers. See {@code createDom} for details.
 * @return Reference to a DOM node.
 * @private
 */
function createDom_(doc: Document, ...args: any[]): Element {
    let tagName = args[0];
    let attributes = args[1];

    // Internet Explorer is dumb:
    // name: https://msdn.microsoft.com/en-us/library/ms534184(v=vs.85).aspx
    // type: https://msdn.microsoft.com/en-us/library/ms534700(v=vs.85).aspx
    // Also does not allow setting of 'type' attribute on 'input' or 'button'.
    if (!userAgent.CAN_ADD_NAME_OR_TYPE_ATTRIBUTES && attributes &&
        (attributes.name || attributes.type)) {
        let tagNameArr = ['<', tagName];
        if (attributes.name) {
            tagNameArr.push(' name="', htmlEscape(attributes.name), '"');
        }
        if (attributes.type) {
            tagNameArr.push(' type="', htmlEscape(attributes.type), '"');

            // Clone attributes map to remove 'type' without mutating the input.
            let clone = {...attributes};

            // JSCompiler can't see how goog.object.extend added this property,
            // because it was essentially added by reflection.
            // So it needs to be quoted.
            delete (clone as any)['type'];

            attributes = clone;
        }
        tagNameArr.push('>');
        tagName = tagNameArr.join('');
    }

    let element = doc.createElement(tagName);

    if (attributes) {
        if (isString(attributes)) {
            element.className = attributes;
        } else if (isArray(attributes)) {
            element.className = attributes.join(' ');
        } else {
            setProperties(element, attributes);
        }
    }

    if (args.length > 2) {
        append_(doc, element, args, 2);
    }

    return element;
}


/**
 * Appends a node with text or other nodes.
 * @param doc The document to create new nodes in.
 * @param parent The node to append nodes to.
 * @param args The values to add. See {@code append}.
 * @param startIndex The index of the array to start from.
 */
function append_(doc: Document, parent: Node, args: Appendable[], startIndex: number) {
    function childHandler(child: Appendable) {
        // TODO(user): More coercion, ala MochiKit?
        if (child) {
            parent.appendChild(
                (isStringOrMessage(child) ? doc.createTextNode(String(child)) : child) as unknown as Node);
        }
    }

    for (let i = startIndex; i < args.length; i++) {
        let arg = args[i];
        // TODO(attila): Fix isArrayLike to return false for a text node.


        if (isArrayLike(arg) && !isNodeLike(arg)) {
            // If the argument is a node list, not a real array, use a clone,
            // because forEach can't be used to mutate a NodeList.
            for (let p of toArray<any>(arg)) {
                childHandler(p);
            }
        } else {
            childHandler(arg);
        }
    }
}

/**
 * Returns true if the object looks like an array. To qualify as array like
 * the value needs to be either a NodeList or an object with a Number length
 * property. As a special case, a function value is not array like, because its
 * length property is fixed to correspond to the number of expected arguments.
 * @param val Variable to test.
 * @return Whether variable is an array.
 */
function isArrayLike(val: any): boolean {
    let type = typeOf(val);
    // We do not use goog.isObject here in order to exclude function values.
    return type == 'array' || type == 'object' && typeof val.length == 'number';
}

/**
 * Creates a new element.
 * @param name Tag name.
 * @return The new element.
 */
export function createElement(name: string): HTMLElement {
    return document.createElement(name);
}


/**
 * Creates a new text node.
 * @param content Content.
 * @return The new text node.
 */
export function createTextNode(content: string | number): Text {
    return document.createTextNode(String(content));
}


/**
 * Create a table.
 * @param rows The number of rows in the table.  Must be >= 1.
 * @param columns The number of columns in the table.  Must be >= 1.
 * @param opt_fillWithNbsp If true, fills table entries with
 *     {@code Unicode.NBSP} characters.
 * @return The created table.
 */
export function createTable(rows: number, columns: number, opt_fillWithNbsp?: boolean): HTMLElement {
    // TODO(user): Return HTMLTableElement, also in prototype function.
    // Callers need to be updated to e.g. not assign numbers to table.cellSpacing.
    return createTable_(document, rows, columns, !!opt_fillWithNbsp);
}


/**
 * Create a table.
 * @param doc Document object to use to create the table.
 * @param rows The number of rows in the table.  Must be >= 1.
 * @param columns The number of columns in the table.  Must be >= 1.
 * @param fillWithNbsp If true, fills table entries with
 *     {@code goog.string.Unicode.NBSP} characters.
 * @return The created table.
 * @private
 */
function createTable_(doc: Document, rows: number, columns: number, fillWithNbsp: boolean): HTMLElement {
    let table = doc.createElement(TagName.TABLE);
    let tbody = table.appendChild(doc.createElement(TagName.TBODY));
    for (let i = 0; i < rows; i++) {
        let tr = doc.createElement(TagName.TR);
        for (let j = 0; j < columns; j++) {
            let td = doc.createElement(TagName.TD);
            // IE <= 9 will create a text node if we set text content to the empty
            // string, so we avoid doing it unless necessary. This ensures that the
            // same DOM tree is returned on all browsers.
            if (fillWithNbsp) {
                setTextContent(td, Unicode.NBSP);
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    return table;
}

/**
 * Helper for {@code safeHtmlToNode_}.
 * @param doc The document.
 * @param tempDiv The input node.
 * @return The resulting node.
 * @private
 */
function childrenToNode_(doc: Document, tempDiv: Node): Node {
    let tempDivEl = tempDiv as unknown as Element;
    if (tempDivEl.childNodes.length == 1) {
        return tempDivEl.removeChild(tempDivEl.firstChild as ChildNode) as unknown as Node;
    } else {
        let fragment = doc.createDocumentFragment();
        while (tempDivEl.firstChild) {
            fragment.appendChild(tempDivEl.firstChild);
        }
        return fragment as unknown as Node;
    }
}


/**
 * Returns true if the browser is in "CSS1-compatible" (standards-compliant)
 * mode, false otherwise.
 * @return True if in CSS1-compatible mode.
 */
export function isCss1CompatMode(): boolean {
    return isCss1CompatMode_(document);
}


/**
 * Returns true if the browser is in "CSS1-compatible" (standards-compliant)
 * mode, false otherwise.
 * @param doc The document to check.
 * @return True if in CSS1-compatible mode.
 * @private
 */
function isCss1CompatMode_(doc: Document): boolean {
    return doc.compatMode == 'CSS1Compat';
}

/**
 * Determines if the given node can contain children, intended to be used for
 * HTML generation.
 *
 * IE natively supports node.canHaveChildren but has inconsistent behavior.
 * Prior to IE8 the base tag allows children and in IE9 all nodes return true
 * for canHaveChildren.
 *
 * In practice all non-IE browsers allow you to add children to any node, but
 * the behavior is inconsistent:
 *
 * <pre>
 *   let a = document.createElement(TagName.BR);
 *   a.appendChild(document.createTextNode('foo'));
 *   a.appendChild(document.createTextNode('bar'));
 *   console.log(a.childNodes.length);  // 2
 *   console.log(a.innerHTML);  // Chrome: "", IE9: "foobar", FF3.5: "foobar"
 * </pre>
 *
 * For more information, see:
 * http://dev.w3.org/html5/markup/syntax.html#syntax-elements
 *
 * TODO(user): Rename shouldAllowChildren() ?
 *
 * @param node The node to check.
 * @return Whether the node can contain children.
 */
export function canHaveChildren(node: Node): boolean {
    if ((node as unknown as Element).nodeType != NodeType.ELEMENT) {
        return false;
    }
    switch ((node as unknown as Element).tagName) {
        case TagName.APPLET:
        case TagName.AREA:
        case TagName.BASE:
        case TagName.BR:
        case TagName.COL:
        case TagName.COMMAND:
        case TagName.EMBED:
        case TagName.FRAME:
        case TagName.HR:
        case TagName.IMG:
        case TagName.INPUT:
        case TagName.IFRAME:
        case TagName.ISINDEX:
        case TagName.KEYGEN:
        case TagName.LINK:
        case TagName.NOFRAMES:
        case TagName.NOSCRIPT:
        case TagName.META:
        case TagName.OBJECT:
        case TagName.PARAM:
        case TagName.SCRIPT:
        case TagName.SOURCE:
        case TagName.STYLE:
        case TagName.TRACK:
        case TagName.WBR:
            return false;
    }
    return true;
}


/**
 * Appends a child to a node.
 * @param parent Parent.
 * @param child Child.
 */
export function appendChild(parent: Node, child: Node) {
    (parent as unknown as Element).appendChild<Node>(child);
}


/**
 * Appends a node with text or other nodes.
 * @param parent The node to append nodes to.
 * @param var_args The things to append to the node.
 *     If this is a Node it is appended as is.
 *     If this is a string then a text node is appended.
 *     If this is an array like object then fields 0 to length - 1 are appended.
 */
export function append(parent: Node, ...var_args: Appendable[]) {
    append_(getOwnerDocument(parent), parent, var_args, 0);
}


/**
 * Removes all the child nodes on a DOM node.
 * @param node Node to remove children from.
 */
export function removeChildren(node: Node) {
    // Note: Iterations over live collections can be slow, this is the fastest
    // we could find. The double parenthesis are used to prevent JsCompiler and
    // strict warnings.
    let child;
    while ((child = node.firstChild)) {
        node.removeChild(child);
    }
}


/**
 * Inserts a new node before an existing reference node (i.e. as the previous
 * sibling). If the reference node has no parent, then does nothing.
 * @param newNode Node to insert.
 * @param refNode Reference node to insert before.
 */
export function insertSiblingBefore(newNode: Node, refNode: Node|null) {
    if ((refNode as any).parentNode) {
        (refNode as any).parentNode?.insertBefore(newNode, refNode);
    }
}


/**
 * Inserts a new node after an existing reference node (i.e. as the next
 * sibling). If the reference node has no parent, then does nothing.
 * @param newNode Node to insert.
 * @param refNode Reference node to insert after.
 */
export function insertSiblingAfter(newNode: Node, refNode: Node) {
    if ((refNode as any).parentNode) {
        (refNode as any).parentNode.insertBefore(newNode, (refNode as any).nextSibling);
    }
}


/**
 * Insert a child at a given index. If index is larger than the number of child
 * nodes that the parent currently has, the node is inserted as the last child
 * node.
 * @param parent The element into which to insert the child.
 * @param child The element to insert.
 * @param index The index at which to insert the new child node. Must
 *     not be negative.
 */
export function insertChildAt(parent: Element, child: Node, index: number) {
    // Note that if the second argument is null, insertBefore
    // will append the child at the end of the list of children.
    parent.insertBefore(child as any, parent.childNodes[index] || null);
}


/**
 * Removes a node from its parent.
 * @param node The node to remove.
 * @return The node removed if removed; else, null.
 */
export function removeNode(node: Node | Element|null): Node | null {

    return node && (node as Element).parentNode ? ((node as Element).parentNode as Element).removeChild(node as Node) as Node : null;
}
;


/**
 * Replaces a node in the DOM tree. Will do nothing if {@code oldNode} has no
 * parent.
 * @param newNode Node to insert.
 * @param oldNode Node to replace.
 */
export function replaceNode(newNode: Node, oldNode: Node) {
    let parent = oldNode.parentNode;
    if (parent) {
        parent.replaceChild(newNode, oldNode);
    }
}


/**
 * Returns an array containing just the element children of the given element.
 * @param element The element whose element children we want.
 * @return An array or array-like list
 *     of just the element children of the given element.
 */
export function getChildren(element: Element): Element[] {
    // We check if the children attribute is supported for child elements
    // since IE8 misuses the attribute by also including comments.
    if (userAgent.CAN_USE_CHILDREN_ATTRIBUTE &&
        element.children != undefined) {
        return toArray(element.children);
    }
    // Fall back to manually filtering the element's child nodes.
    return toArray<Element>(element.childNodes).filter((node: ChildNode): boolean => {
        return node.nodeType == NodeType.ELEMENT;
    });
}


/**
 * Returns the first child node that is an element.
 * @param node The node to get the first child element of.
 * @return The first child node of {@code node} that is an element.
 */
export function getFirstElementChild(node: Node): Element | null {
    if ((node as any).firstElementChild != undefined) {
        return ((node as any).firstElementChild) as Element;
    }
    return getNextElementNode_(node.firstChild as Node, true);
}


/**
 * Returns the last child node that is an element.
 * @param node The node to get the last child element of.
 * @return The last child node of {@code node} that is an element.
 */
export function getLastElementChild(node: Node): Element | null {
    if ((node as any).lastElementChild != undefined) {
        return (node as any).lastElementChild as Element;
    }
    return getNextElementNode_(node.lastChild as Node, false);
}


/**
 * Returns the first next sibling that is an element.
 * @param node The node to get the next sibling element of.
 * @return The next sibling of {@code node} that is an element.
 */
export function getNextElementSibling(node: Node): Element | null {
    if ((node as any).nextElementSibling) {
        return (node as Element).nextElementSibling as Element;
    }
    return getNextElementNode_(node.nextSibling, true);
}


/**
 * Returns the first previous sibling that is an element.
 * @param node The node to get the previous sibling element of.
 * @return The first previous sibling of {@code node} that is
 *     an element.
 */
export function getPreviousElementSibling(node: Node | Element): Element | null {
    if ((node as Element).previousElementSibling != undefined) {
        return (node as Element).previousElementSibling;
    }
    return getNextElementNode_(node.previousSibling, false);
}


/**
 * Returns the first node that is an element in the specified direction,
 * starting with {@code node}.
 * @param node The node to get the next element from.
 * @param forward Whether to look forwards or backwards.
 * @return  The first element.
 * @private
 */
function getNextElementNode_(node: Node | null, forward: boolean): Element | null {
    while (node && node.nodeType != NodeType.ELEMENT) {
        node = (forward ? node.nextSibling : node.previousSibling) as ChildNode;
    }

    return node as Element | null;
}


/**
 * Returns the next node in source order from the given node.
 * @param node The node.
 * @return The next node in the DOM tree, or null if this was the last
 *     node.
 */
export function getNextNode(node: Node | null): Node | null {
    if (!node) {
        return null;
    }
    let nodeEl = node as Element;

    if (nodeEl.firstChild) {
        return nodeEl.firstChild;
    }

    while (nodeEl && !nodeEl.nextSibling) {
        nodeEl = nodeEl.parentNode as Element;
    }

    return nodeEl ? nodeEl.nextSibling : null;
}


/**
 * Returns the previous node in source order from the given node.
 * @param node The node.
 * @return The previous node in the DOM tree, or null if this was the
 *     first node.
 */
export function getPreviousNode(node: Node | null): Node | null {
    if (!node) {
        return null;
    }

    if (!node.previousSibling) {
        return node.parentNode;
    }

    node = node.previousSibling;
    while (node && node.lastChild) {
        node = node.lastChild;
    }

    return node;
}


/**
 * Whether the object looks like a DOM node.
 * @param obj The object being tested for node likeness.
 * @return Whether the object looks like a DOM node.
 */
export function isNodeLike(obj: any): boolean {
    return isObject(obj) && obj.nodeType > 0;
}


/**
 * Whether the object looks like an Element.
 * @param obj The object being tested for Element likeness.
 * @return Whether the object looks like an Element.
 */
export function isElement(obj: unknown): obj is Element {
    return isObject(obj) && obj.nodeType == NodeType.ELEMENT;
}


/**
 * Returns true if the specified value is a Window object. This includes the
 * global window for HTML pages, and iframe windows.
 * @param obj Variable to test.
 * @return Whether the variable is a window.
 */
export function isWindow(obj: any): boolean {
    return isObject(obj) && obj['window'] == obj;
}


/**
 * Returns an element's parent, if it's an Element.
 * @param element The DOM element.
 * @return The parent, or null if not an Element.
 */
export function getParentElement(element: Element): Element | null {
    let parent;
    if (userAgent.CAN_USE_PARENT_ELEMENT_PROPERTY) {
        let isIe9 = userAgent.IE && userAgent.isVersionOrHigher('9') &&
            !userAgent.isVersionOrHigher('10');
        // SVG elements in IE9 can't use the parentElement property.
        // goog.global['SVGElement'] is not defined in IE9 quirks mode.
        if (!(isIe9 && window['SVGElement'] &&
            element instanceof window['SVGElement'])) {
            parent = element.parentElement;
            if (parent) {
                return parent;
            }
        }
    }
    parent = element.parentNode;
    return isElement(parent) ? parent as Element : null;
}


/**
 * Whether a node contains another node.
 * @param parent The node that should contain the other node.
 * @param descendant The node to test presence of.
 * @return Whether the parent node contains the descendent node.
 */
export function contains(parent: Node | null | undefined, descendant: Node | EventTarget | null | undefined): boolean {
    if (!parent || !descendant) {
        return false;
    }
    // We use browser specific methods for this if available since it is faster
    // that way.

    // IE DOM
    if (parent.contains && 'nodeType' in descendant && descendant.nodeType == NodeType.ELEMENT) {
        return parent == descendant || parent.contains(descendant);
    }

    // W3C DOM Level 3
    if (typeof parent.compareDocumentPosition != 'undefined') {
        return parent == descendant ||
            Boolean(parent.compareDocumentPosition(descendant as Node) & 16);
    }

    // W3C DOM Level 1
    while (descendant && parent != descendant) {
        descendant = (descendant as any).parentNode;
    }
    return descendant == parent;
}


/**
 * Compares the document order of two nodes, returning 0 if they are the same
 * node, a negative number if node1 is before node2, and a positive number if
 * node2 is before node1.  Note that we compare the order the tags appear in the
 * document so in the tree <b><i>text</i></b> the B node is considered to be
 * before the I node.
 *
 * @param node1 The first node to compare.
 * @param node2 The second node to compare.
 * @return 0 if the nodes are the same node, a negative number if node1
 *     is before node2, and a positive number if node2 is before node1.
 */
export function compareNodeOrder(node1: Node, node2: Node): number {
    // Fall out quickly for equality.
    if (node1 == node2) {
        return 0;
    }

    // Use compareDocumentPosition where available
    if ((node1 as any).compareDocumentPosition) {
        // 4 is the bitmask for FOLLOWS.
        return node1.compareDocumentPosition(node2) & 2 ? 1 : -1;
    }

    // Special case for document nodes on IE 7 and 8.
    if (userAgent.IE && !userAgent.isDocumentModeOrHigher(9)) {
        if (node1.nodeType == NodeType.DOCUMENT) {
            return -1;
        }
        if (node2.nodeType == NodeType.DOCUMENT) {
            return 1;
        }
    }

    // Process in IE using sourceIndex - we check to see if the first node has
    // a source index or if its parent has one.
    if ('sourceIndex' in node1 ||
        (node1.parentNode && 'sourceIndex' in node1.parentNode)) {
        let isElement1 = node1.nodeType == NodeType.ELEMENT;
        let isElement2 = node2.nodeType == NodeType.ELEMENT;

        if (isElement1 && isElement2) {
            return (node1 as any).sourceIndex - (node2 as any).sourceIndex;
        } else {
            let parent1 = node1.parentNode;
            let parent2 = node2.parentNode;

            if (parent1 == parent2) {
                return compareSiblingOrder_(node1, node2);
            }

            if (!isElement1 && contains(parent1, node2)) {
                return -1 * compareParentsDescendantNodeIe_(node1, node2);
            }


            if (!isElement2 && contains(parent2, node1)) {
                return compareParentsDescendantNodeIe_(node2, node1);
            }

            return (isElement1 ? (node1 as any).sourceIndex : (parent1 as any).sourceIndex) -
                (isElement2 ? (node2 as any).sourceIndex : (parent2 as any).sourceIndex);
        }
    }

    // For Safari, we compare ranges.
    let doc = getOwnerDocument(node1);

    let range1, range2;
    range1 = doc.createRange();
    range1.selectNode(node1);
    range1.collapse(true);

    range2 = doc.createRange();
    range2.selectNode(node2);
    range2.collapse(true);

    return range1.compareBoundaryPoints(
        window['Range'].START_TO_END, range2);
}


/**
 * Utility function to compare the position of two nodes, when
 * {@code textNode}'s parent is an ancestor of {@code node}.  If this entry
 * condition is not met, this function will attempt to reference a null object.
 * @param textNode The textNode to compare.
 * @param node The node to compare.
 * @return -1 if node is before textNode, +1 otherwise.
 * @private
 */
function compareParentsDescendantNodeIe_(textNode: Node, node: Node): number {
    let parent = textNode.parentNode;
    if (parent == node) {
        // If textNode is a child of node, then node comes first.
        return -1;
    }
    let sibling: Node | null = node;
    while (sibling && sibling.parentNode != parent) {
        sibling = sibling.parentNode;
    }
    return compareSiblingOrder_(sibling, textNode);
}


/**
 * Utility function to compare the position of two nodes known to be non-equal
 * siblings.
 * @param node1 The first node to compare.
 * @param node2 The second node to compare.
 * @return -1 if node1 is before node2, +1 otherwise.
 * @private
 */
function compareSiblingOrder_(node1: Node | null, node2: Node): 1 | -1 {
    let s: Node | null = node2;
    while (s && (s = s.previousSibling)) {
        if (s == node1) {
            // We just found node1 before node2.
            return -1;
        }
    }

    // Since we didn't find it, node1 must be after node2.
    return 1;
}


/**
 * Find the deepest common ancestor of the given nodes.
 * @param var_args The nodes to find a common ancestor of.
 * @return The common ancestor of the nodes, or null if there is none.
 *     null will only be returned if two or more of the nodes are from different
 *     documents.
 */
export function findCommonAncestor(...var_args: Node[]): Node | null {
    let i, count = var_args.length;
    if (!count) {
        return null;
    } else if (count == 1) {
        return var_args[0];
    }

    let paths = [];
    let minLength = Infinity;
    for (i = 0; i < count; i++) {
        // Compute the list of ancestors.
        let ancestors = [];
        let node: Node | null = var_args[i];
        while (node) {
            ancestors.unshift(node);
            node = node.parentNode;
        }

        // Save the list for comparison.
        paths.push(ancestors);
        minLength = Math.min(minLength, ancestors.length);
    }
    let output = null;
    for (i = 0; i < minLength; i++) {
        let first = paths[0][i];
        for (let j = 1; j < count; j++) {
            if (first != paths[j][i]) {
                return output;
            }
        }
        output = first;
    }
    return output;
}


/**
 * Returns the owner document for a node.
 * @param node The node to get the document for.
 * @return The document owning the node.
 */
export function getOwnerDocument(node: Node | Window): Document {
    // TODO(nnaze): Update param signature to be non-nullable.
    console.assert(node, 'Node cannot be null or undefined.');
    return (node as any).nodeType == NodeType.DOCUMENT ? node as Document : (node as any).ownerDocument ||
        (node as any).document;
}


/**
 * Cross-browser function for getting the document element of a frame or iframe.
 * @param frame Frame element.
 * @return {!Document} The frame content document.
 */
export function getFrameContentDocument(frame: Element): Document {
    return (frame as any).contentDocument ||
        (frame as any).contentWindow.document;
}


/**
 * Cross-browser function for getting the window of a frame or iframe.
 * @param frame Frame element.
 * @return {Window} The window associated with the given frame, or null if none
 *     exists.
 */
export function getFrameContentWindow(frame: Element): Window | null {
    try {
        return (frame as any).contentWindow ||
            ((frame as any).contentDocument ? getWindow((frame as any).contentDocument) :
                null);
    } catch (e) {
        // NOTE(user): In IE8, checking the contentWindow or contentDocument
        // properties will throw a "Unspecified Error" exception if the iframe is
        // not inserted in the DOM. If we get this we can be sure that no window
        // exists, so return null.
    }
    return null;
}


/**
 * Sets the text content of a node, with cross-browser support.
 * @param {Node} node The node to change the text content of.
 * @param {string|number} text The value that should replace the node's content.
 */
export function setTextContent(node: Node, text: string | number) {
    console.assert(
        node != null,
        'setTextContent expects a non-null value for node');
    let nodeEl = node as Element
    if ('textContent' in node) {
        nodeEl.textContent = typeof text === 'number' ? String(text) : text;
    } else if (nodeEl.nodeType == NodeType.TEXT) {
        (nodeEl as any).data = text;
    } else if (
        nodeEl.firstChild && nodeEl.firstChild.nodeType == NodeType.TEXT) {
        // If the first child is a text node we just change its data and remove the
        // rest of the children.
        while (nodeEl.lastChild != nodeEl.firstChild) {
            nodeEl.removeChild(nodeEl.lastChild as Node);
        }
        (nodeEl.firstChild as any).data = text;
    } else {
        removeChildren(node);
        let doc = getOwnerDocument(node);
        nodeEl.appendChild(doc.createTextNode(String(text)));
    }
}


/**
 * Gets the outerHTML of a node, which islike innerHTML, except that it
 * actually contains the HTML of the node itself.
 * @param element The element to get the HTML of.
 * @return The outerHTML of the given element.
 */
export function getOuterHtml(element: Element): string {
    console.assert(
        element !== null,
        'getOuterHtml expects a non-null value for element');
    // IE, Opera and WebKit all have outerHTML.
    if ('outerHTML' in element) {
        return element.outerHTML;
    } else {
        let doc = getOwnerDocument(element);
        let div = doc.createElement(TagName.DIV);
        div.appendChild((element as Element).cloneNode(true));
        return div.innerHTML;
    }
}


/**
 * Finds the first descendant node that matches the filter function, using
 * a depth first search. This function offers the most general purpose way
 * of finding a matching element. You may also wish to consider
 * {@code query} which can express many matching criteria using
 * CSS selector expressions. These expressions often result in a more
 * compact representation of the desired result.
 * @see query
 *
 * @param {Node} root The root of the tree to search.
 * @param {function(Node) : boolean} p The filter function.
 * @return {Node|undefined} The found node or undefined if none is found.
 */
export function findNode(root: Node, p: (v: Node) => boolean): Node | undefined {
    let rv: Node[] = [];
    let found = findNodes_(root, p, rv, true);
    return found ? rv[0] : undefined;
}


/**
 * Finds all the descendant nodes that match the filter function, using a
 * a depth first search. This function offers the most general-purpose way
 * of finding a set of matching elements. You may also wish to consider
 * {@code query} which can express many matching criteria using
 * CSS selector expressions. These expressions often result in a more
 * compact representation of the desired result.

 * @param root The root of the tree to search.
 * @param p The filter function.
 * @return The found nodes or an empty array if none are found.
 */
export function findNodes(root: Node, p: (node: Node) => boolean): Node[] {
    let rv: Node[] = [];
    findNodes_(root, p, rv, false);
    return rv;
}


/**
 * Finds the first or all the descendant nodes that match the filter function,
 * using a depth first search.
 * @param root The root of the tree to search.
 * @param p The filter function.
 * @param rv The found nodes are added to this array.
 * @param findOne If true we exit after the first found node.
 * @return Whether the search is complete or not. True in case findOne
 *     is true and the node is found. False otherwise.
 * @private
 */
function findNodes_(root: Node, p: (v: Node) => boolean, rv: Node[], findOne: boolean): boolean {
    if (root != null) {
        let child = root.firstChild;
        while (child) {
            if (p(child)) {
                rv.push(child);
                if (findOne) {
                    return true;
                }
            }
            if (findNodes_(child, p, rv, findOne)) {
                return true;
            }
            child = child.nextSibling;
        }
    }
    return false;
}


/**
 * Map of tags whose content to ignore when calculating text length.
 * @private {!Object<string, number>}
 * @const
 */
const TAGS_TO_IGNORE_ = {
    'SCRIPT': 1,
    'STYLE': 1,
    'HEAD': 1,
    'IFRAME': 1,
    'OBJECT': 1
};


/**
 * Map of tags which have predefined values with regard to whitespace.
 * @private {!Object<string, string>}
 * @const
 */
const PREDEFINED_TAG_VALUES_: StructType = {
    'IMG': ' ',
    'BR': '\n'
};


/**
 * Returns true if the element has a tab index that allows it to receive
 * keyboard focus (tabIndex >= 0), false otherwise.  Note that some elements
 * natively support keyboard focus, even if they have no tab index.
 * @param element Element to check.
 * @return Whether the element has a tab index that allows keyboard
 *     focus.
 */
export function isFocusableTabIndex(element: Element): boolean {
    return hasSpecifiedTabIndex_(element) &&
        isTabIndexFocusable_(element);
}


/**
 * Enables or disables keyboard focus support on the element via its tab index.
 * Only elements for which {@link isFocusableTabIndex} returns true
 * (or elements that natively support keyboard focus, like form elements) can
 * receive keyboard focus.  See http://go/tabindex for more info.
 * @param element Element whose tab index is to be changed.
 * @param enable Whether to set or remove a tab index on the element
 *     that supports keyboard focus.
 */
export function setFocusableTabIndex(element: Element, enable: boolean) {
    if (enable) {
        (element as any).tabIndex = 0;
    } else {
        // Set tabIndex to -1 first, then remove it. This is a workaround for
        // Safari (confirmed in version 4 on Windows). When removing the attribute
        // without setting it to -1 first, the element remains keyboard focusable
        // despite not having a tabIndex attribute anymore.
        (element as any).tabIndex = -1;
        element.removeAttribute('tabIndex');  // Must be camelCase!
    }
}


/**
 * Returns true if the element can be focused, i.e. it has a tab index that
 * allows it to receive keyboard focus (tabIndex >= 0), or it is an element
 * that natively supports keyboard focus.
 * @param element Element to check.
 * @return Whether the element allows keyboard focus.
 */
export function isFocusable(element: Element): boolean {
    let focusable;
    // Some elements can have unspecified tab index and still receive focus.
    if (nativelySupportsFocus_(element)) {
        // Make sure the element is not disabled ...
        focusable = !(element as any).disabled &&
            // ... and if a tab index is specified, it allows focus.
            (!hasSpecifiedTabIndex_(element) ||
                isTabIndexFocusable_(element));
    } else {
        focusable = isFocusableTabIndex(element);
    }

    // IE requires elements to be visible in order to focus them.
    return focusable && userAgent.IE ?
        hasNonZeroBoundingRect_(element as HTMLElement) :
        focusable;
}


/**
 * Returns true if the element has a specified tab index.
 * @param element Element to check.
 * @return Whether the element has a specified tab index.
 * @private
 */
function hasSpecifiedTabIndex_(element: Element): boolean {
    // IE returns 0 for an unset tabIndex, so we must use getAttributeNode(),
    // which returns an object with a 'specified' property if tabIndex is
    // specified.  This works on other browsers, too.
    let attrNode = element.getAttributeNode('tabindex');  // Must be lowercase!
    return attrNode != null && attrNode.specified;
}


/**
 * Returns true if the element's tab index allows the element to be focused.
 * @param element Element to check.
 * @return Whether the element's tab index allows focus.
 * @private
 */
function isTabIndexFocusable_(element: Element): boolean {
    let index = (element as HTMLElement).tabIndex;
    // NOTE: IE9 puts tabIndex in 16-bit int, e.g. -2 is 65534.
    return typeof index === 'number' && index >= 0 && index < 32768;
}


/**
 * Returns true if the element is focusable even when tabIndex is not set.
 * @param element Element to check.
 * @return Whether the element natively supports focus.
 * @private
 */
function nativelySupportsFocus_(element: Element): boolean {
    return element.tagName == TagName.A ||
        element.tagName == TagName.INPUT ||
        element.tagName == TagName.TEXTAREA ||
        element.tagName == TagName.SELECT ||
        element.tagName == TagName.BUTTON;
}


/**
 * Returns true if the element has a bounding rectangle that would be visible
 * (i.e. its width and height are greater than zero).
 * @param element Element to check.
 * @return Whether the element has a non-zero bounding rectangle.
 * @private
 */
function hasNonZeroBoundingRect_(element: HTMLElement): boolean {
    let rect;
    if (typeOf(element['getBoundingClientRect']) != 'function' ||
        // In IE, getBoundingClientRect throws on detached nodes.
        (userAgent.IE && element.parentElement == null)) {
        rect = {'height': element.offsetHeight, 'width': element.offsetWidth};
    } else {
        rect = element.getBoundingClientRect();
    }
    return rect != null && rect.height > 0 && rect.width > 0;
}


/**
 * Returns the text content of the current node, without markup and invisible
 * symbols. New lines are stripped and whitespace is collapsed,
 * such that each character would be visible.
 *
 * In browsers that support it, innerText is used.  Other browsers attempt to
 * simulate it via node traversal.  Line breaks are canonicalized in IE.
 *
 * @param node The node from which we are getting content.
 * @return The text content.
 */
export function getTextContent(node: Node): string {
    let textContent;
    // Note(arv): IE9, Opera, and Safari 3 support innerText but they include
    // text nodes in script tags. So we revert to use a user agent test here.
    if (userAgent.CAN_USE_INNER_TEXT && node !== null &&
        ('innerText' in node)) {
        textContent = canonicalizeNewlines(node.innerText as string);
        // Unfortunately .innerText() returns text with &shy; symbols
        // We need to filter it out and then remove duplicate whitespaces
    } else {
        let buf: string[] = [];
        getTextContent_(node, buf, true);
        textContent = buf.join('');
    }

    // Strip &shy; entities. goog.format.insertWordBreaks inserts them in Opera.
    textContent = textContent.replace(/ \xAD /g, ' ').replace(/\xAD/g, '');
    // Strip &#8203; entities. goog.format.insertWordBreaks inserts them in IE8.
    textContent = textContent.replace(/\u200B/g, '');

    // Skip this replacement on old browsers with working innerText, which
    // automatically turns &nbsp; into ' ' and / +/ into ' ' when reading
    // innerText.
    if (!userAgent.CAN_USE_INNER_TEXT) {
        textContent = textContent.replace(/ +/g, ' ');
    }
    if (textContent != ' ') {
        textContent = textContent.replace(/^\s*/, '');
    }

    return textContent;
}


/**
 * Returns the text content of the current node, without markup.
 *
 * Unlike {@code getTextContent} this method does not collapse whitespaces
 * or normalize lines breaks.
 *
 * @param node The node from which we are getting content.
 * @return The raw text content.
 */
export function getRawTextContent(node: Node): string {
    let buf: string[] = [];
    getTextContent_(node, buf, false);

    return buf.join('');
}


/**
 * Recursive support function for text content retrieval.
 *
 * @param node The node from which we are getting content.
 * @param buf string buffer.
 * @param normalizeWhitespace Whether to normalize whitespace.
 * @private
 */
function getTextContent_(node: Node, buf: string[], normalizeWhitespace: boolean) {
    const nodeEl = (node as unknown as Element);
    if (nodeEl.nodeName in TAGS_TO_IGNORE_) {
        // ignore certain tags
    } else if (nodeEl.nodeType == NodeType.TEXT) {
        if (normalizeWhitespace) {
            buf.push(String(nodeEl.nodeValue).replace(/(\r\n|\r|\n)/g, ''));
        } else {
            buf.push(nodeEl.nodeValue as string);
        }
    } else if (nodeEl.nodeName in PREDEFINED_TAG_VALUES_) {
        buf.push(PREDEFINED_TAG_VALUES_[nodeEl.nodeName] as string);
    } else {
        let child = nodeEl.firstChild;
        while (child) {
            getTextContent_(child as unknown as Node, buf, normalizeWhitespace);
            child = child.nextSibling;
        }
    }
}


/**
 * Returns the text length of the text contained in a node, without markup. This
 * is equivalent to the selection length if the node was selected, or the number
 * of cursor movements to traverse the node. Images & BRs take one space.  New
 * lines are ignored.
 *
 * @param node The node whose text content length is being calculated.
 * @return The length of {@code node}'s text content.
 */
export function getNodeTextLength(node: Node): number {
    return getTextContent(node).length;
}


/**
 * Returns the text offset of a node relative to one of its ancestors. The text
 * length is the same as the length calculated by getNodeTextLength.
 *
 * @param node The node whose offset is being calculated.
 * @param opt_offsetParent The node relative to which the offset will
 *     be calculated. Defaults to the node's owner document's body.
 * @return The text offset.
 */
export function getNodeTextOffset(node: Node, opt_offsetParent?: Node): number {
    let root = opt_offsetParent || getOwnerDocument(node).body;
    let buf = [];
    while (node && node != root) {
        let cur: Node | null = node;
        while (cur = ((cur as unknown as Element).previousSibling) as unknown as Node) {
            buf.unshift(getTextContent(cur));
        }
        node = ((node as unknown as Element).parentNode as unknown as Node);
    }
    // Trim left to deal with FF cases when there might be line breaks and empty
    // nodes at the front of the text
    return buf.join('').trimStart().replace(/ +/g, ' ').length;
}


/**
 * Returns the node at a given offset in a parent node.  If an object is
 * provided for the optional third parameter, the node and the remainder of the
 * offset will stored as properties of this object.
 * @param parent The parent node.
 * @param offset The offset into the parent node.
 * @param opt_result Object to be used to store the return value. The
 *     return value will be stored in the form {node: Node, remainder: number}
 *     if this object is provided.
 * @return The node at the given offset.
 */
export function getNodeAtOffset(parent: Node, offset: number, opt_result?: {
    node?: Node | null,
    remainder?: number
}): Node {
    let stack: Element[] = [parent as unknown as Element], pos = 0;
    let cur: Element | null = null;
    while (stack.length > 0 && pos < offset) {
        cur = stack.pop() as Element;
        if (cur.nodeName in TAGS_TO_IGNORE_) {
            // ignore certain tags
        } else if (cur.nodeType == NodeType.TEXT) {
            let text = (cur.nodeValue as string).replace(/(\r\n|\r|\n)/g, '').replace(/ +/g, ' ');
            pos += text.length;
        } else if (cur.nodeName in PREDEFINED_TAG_VALUES_) {
            pos += PREDEFINED_TAG_VALUES_[cur.nodeName].length;
        } else {
            for (let i = cur.childNodes.length - 1; i >= 0; i--) {
                stack.push(cur.childNodes[i] as unknown as Element);
            }
        }
    }
    if (opt_result) {
        opt_result.remainder = cur && cur.nodeValue ? cur.nodeValue.length + offset - pos - 1 : 0;
        opt_result.node = cur as unknown as Node;
    }

    return cur as unknown as Node;
}


/**
 * Returns true if the object is a {@code NodeList}.  To qualify as a NodeList,
 * the object must have a numeric length property and an item function (which
 * has type 'string' on IE for some reason).
 * @param val Object to test.
 * @return Whether the object is a NodeList.
 */
export function isNodeList(val: any): boolean {
    // TODO(attila): Now the isNodeList is part of goog.dom we can use
    // goog.userAgent to make this simpler.
    // A NodeList must have a length property of type 'number' on all platforms.
    if (val && typeof val.length == 'number') {
        // A NodeList is an object everywhere except Safari, where it's a function.
        if (isObject(val)) {
            // A NodeList must have an item function (on non-IE platforms) or an item
            // property of type 'string' (on IE).
            return typeof val.item == 'function' || typeof val.item == 'string';
        } else if (typeOf(val) == 'function') {
            // On Safari, a NodeList is a function with an item property that is also
            // a function.
            return typeof val.item == 'function';
        }
    }

    // Not a NodeList.
    return false;
}


/**
 * Walks up the DOM hierarchy returning the first ancestor that has the passed
 * tag name and/or class name. If the passed element matches the specified
 * criteria, the element itself is returned.
 * @param element The DOM node to start with.
 * @param opt_tag The tag name to match (or
 *     null/undefined to match only based on class name).
 * @param opt_class The class name to match (or null/undefined to
 *     match only based on tag name).
 * @param opt_maxSearchSteps Maximum number of levels to search up the
 *     dom.
 * @return The first ancestor that matches the passed criteria, or
 *     null if no match is found.
 */
export function getAncestorByTagNameAndClass(
    element: Node, opt_tag?: string | TagName, opt_class?: string, opt_maxSearchSteps?: number): Element | null {
    if (!opt_tag && !opt_class) {
        return null;
    }
    let tagName = opt_tag ? opt_tag.toUpperCase() : null;
    return (getAncestor(element, (node: Node): boolean => {
        return (!tagName || (node as any).nodeName == tagName) &&
            (!opt_class ||
                typeof ((node as any).className) == "string" && classlist.contains(node as unknown as HTMLElement, opt_class))

    }, true, opt_maxSearchSteps)) as unknown as Element;
}


/**
 * Walks up the DOM hierarchy returning the first ancestor that has the passed
 * class name. If the passed element matches the specified criteria, the
 * element itself is returned.
 * @param element The DOM node to start with.
 * @param className The class name to match.
 * @param opt_maxSearchSteps Maximum number of levels to search up the
 *     dom.
 * @return The first ancestor that matches the passed criteria, or
 *     null if none match.
 */
export function getAncestorByClass(element: Node, className: string, opt_maxSearchSteps?: number): Element | null {
    return getAncestorByTagNameAndClass(
        element, undefined, className, opt_maxSearchSteps);
}


/**
 * Walks up the DOM hierarchy returning the first ancestor that passes the
 * matcher function.
 * @param element The DOM node to start with.
 * @param matcher A function that returns true if the
 *     passed node matches the desired criteria.
 * @param opt_includeNode If true, the node itself is included in
 *     the search (the first call to the matcher will pass startElement as
 *     the node to test).
 * @param opt_maxSearchSteps Maximum number of levels to search up the
 *     dom.
 * @return DOM node that matched the matcher, or null if there was
 *     no match.
 */
export function getAncestor(
    element: Node, matcher: (v: Node) => boolean, opt_includeNode?: boolean, opt_maxSearchSteps?: number): Node | null {
    if (!opt_includeNode) {
        element = (element as any).parentNode;
    }
    let steps = 0;
    while (element &&
    (opt_maxSearchSteps == null || steps <= opt_maxSearchSteps)) {
        console.assert((element as any).name != 'parentNode');
        if (matcher(element)) {
            return element;
        }
        element = (element as any).parentNode;
        steps++;
    }
    // Reached the root of the DOM without a match
    return null;
}


/**
 * Determines the active element in the given document.
 * @param doc The document to look in.
 * @return The active element.
 */
export function getActiveElement(doc: Document | null): Element | null {
    try {
        return doc && doc.activeElement;
    } catch (e) {
        // NOTE(nicksantos): Sometimes, evaluating document.activeElement in IE
        // throws an exception. I'm not 100% sure why, but I suspect it chokes
        // on document.activeElement if the activeElement has been recently
        // removed from the DOM by a JS operation.
        //
        // We assume that an exception here simply means
        // "there is no active element."
    }

    return null;
}


/**
 * Gives the current devicePixelRatio.
 *
 * By default, this is the value of window.devicePixelRatio (which should be
 * preferred if present).
 *
 * If window.devicePixelRatio is not present, the ratio is calculated with
 * window.matchMedia, if present. Otherwise, gives 1.0.
 *
 * Some browsers (including Chrome) consider the browser zoom level in the pixel
 * ratio, so the value may change across multiple calls.
 *
 * @return The number of actual pixels per virtual pixel.
 */
export function getPixelRatio(opt_window?: any) {
    let win = opt_window ? opt_window : getWindow();
    if (win.devicePixelRatio != undefined) {
        return win.devicePixelRatio;
    } else if ((win as any).matchMedia) {
        return matchesPixelRatio_(.75, win) ||
            matchesPixelRatio_(1.5, win) || matchesPixelRatio_(2, win) ||
            matchesPixelRatio_(3, win) || 1;
    }
    return 1;
}


/**
 * Calculates a mediaQuery to check if the current device supports the
 * given actual to virtual pixel ratio.
 * @param pixelRatio The ratio of actual pixels to virtual pixels.
 * @param opt_win
 * @return pixelRatio if applicable, otherwise 0.
 *
 */
function matchesPixelRatio_(pixelRatio: number, opt_win?: Window): number {
    let win = opt_win || getWindow();
    let query =
        ('(-webkit-min-device-pixel-ratio: ' + pixelRatio + '),' +
            '(min--moz-device-pixel-ratio: ' + pixelRatio + '),' +
            '(min-resolution: ' + pixelRatio + 'dppx)');
    return win.matchMedia(query).matches ? pixelRatio : 0;
}


/**
 * Create an instance of a DOM helper with a new document object.
 * @param opt_document Document object to associate with this
 *     DOM helper.
 * @constructor
 */
export class DomHelper {
    private document_: Document;

    constructor(opt_document?: Document) {
        this.document_ = opt_document || document
    }

    /**
     * Gets the dom helper object for the document where the element resides.
     * @param opt_node If present, gets the DomHelper for this node.
     * @return The DomHelper.
     */
    getDomHelper(node?: Node): DomHelper {
        return getDomHelper(node);
    }

    /**
     * Sets the document object.
     * @param document Document object.
     */
    setDocument(document: Document) {
        this.document_ = document;
    }

    /**
     * Gets the dimensions of the viewport.
     * @param opt_window Optional window element to test. Defaults to
     *     the window of the Dom Helper.
     * @return Object with values 'width' and 'height'.
     */
    getViewportSize(opt_window?: Window): Size {
        // TODO(arv): This should not take an argument. That breaks the rule of a
        // a DomHelper representing a single frame/window/document.
        return getViewportSize(opt_window || this.getWindow());
    }

    /**
     * Gets the document object being used by the dom library.
     * @return Document object.
     */
    getDocument(): Document {
        return this.document_;
    }


    /**
     * Alias for {@code getElementById}. If a DOM node is passed in then we just
     * return that.
     * @param element Element ID or a DOM node.
     * @return The element with the given ID, or the node passed in.
     */
    getElement(element: string | Element): Element | null {
        return getElementHelper_(this.document_, element);
    }


    /**
     * Gets an element by id, asserting that the element is found.
     *
     * This is used when an element is expected to exist, and should fail with
     * an assertion error if it does not (if assertions are enabled).
     *
     * @param id Element ID.
     * @return The element with the given ID, if it exists.
     */
    getRequiredElement(id: string): Element {
        return getRequiredElementHelper_(this.document_, id);
    }

    /**
     * Looks up elements by both tag and class name, using browser native functions
     * ({@code querySelectorAll}, or
     * {@code getElementsByClassName}) where possible. The returned array is a live
     * NodeList or a static list depending on the code path taken.
     *
     * @see query
     *
     * @param opt_tag Element tag name or * for all tags.
     * @param opt_class Optional class name.
     * @param opt_el Optional element to look in.
     * @return Array-like list of elements (only a length
     *     property and numerical indices are guaranteed to exist).
     */
    getElementsByTagNameAndClass(
        opt_tag?: string, opt_class?: string, opt_el?: Document | Element): Element[] {
        return getElementsByTagNameAndClass_(
            this.document_, opt_tag, opt_class, opt_el);
    }


    /**
     * Returns an array of all the elements with the provided className.
     * @see {query}
     * @param className the name of the class to look for.
     * @param opt_el Optional element to look in.
     * @return The items found with the class name provided.
     */
    getElementsByClass(className: string, opt_el?: Document | Element): Element[] {
        let doc = opt_el || this.document_;
        return getElementsByClass(className, doc);
    }


    /**
     * Returns the first element we find matching the provided class name.
     * @see {query}
     * @param className the name of the class to look for.
     * @param opt_el Optional element to look in.
     * @return The first item found with the class name provided.
     */
    getElementByClass(className: string, opt_el?: Document | Element) {
        let doc = opt_el || this.document_;
        return getElementByClass(className, doc);
    }


    /**
     * Ensures an element with the given className exists, and then returns the
     * first element with the provided className.
     * @see {query}
     * @param className the name of the class to look for.
     * @param opt_root Optional element or document to look
     *     in.
     * @return The first item found with the class name provided.
     * @throws Thrown if no element is found.
     */
    getRequiredElementByClass(
        className: string, opt_root?: Element | Document): Element {
        let root = opt_root || this.document_;
        return getRequiredElementByClass(className, root);
    }


    /**
     * Sets a number of properties on a node.
     * @param element DOM node to set properties on.
     * @param properties Hash of property:value pairs.
     */
    setProperties(element: Element, properties: StructType) {
        setProperties(element, properties);
    }

    /**
     * Appends a child to a node.
     * @param parent Parent.
     * @param child Child.
     */
    appendChild(parent: Node, child: Node) {
        appendChild(parent, child);
    }


    /**
     * Appends a node with text or other nodes.
     * @param parent The node to append nodes to.
     * @param var_args The things to append to the node.
     *     If this is a Node it is appended as is.
     *     If this is a string then a text node is appended.
     *     If this is an array like object then fields 0 to length - 1 are appended.
     */
    append(parent: Node, ...var_args: Appendable[]) {
        append(parent, ...var_args);
    }


    /**
     * Determines if the given node can contain children, intended to be used for
     * HTML generation.
     *
     * @param node The node to check.
     * @return Whether the node can contain children.
     */
    canHaveChildren(node: Node): boolean {
        return canHaveChildren(node);
    }


    /**
     * Removes all the child nodes on a DOM node.
     * @param node Node to remove children from.
     */
    removeChildren(node: Node) {
        removeChildren(node);
    }


    /**
     * Inserts a new node before an existing reference node (i.e., as the previous
     * sibling). If the reference node has no parent, then does nothing.
     * @param newNode Node to insert.
     * @param refNode Reference node to insert before.
     */
    insertSiblingBefore(newNode: Node, refNode: Node) {
        insertSiblingBefore(newNode, refNode);
    }


    /**
     * Inserts a new node after an existing reference node (i.e., as the next
     * sibling). If the reference node has no parent, then does nothing.
     * @param newNode Node to insert.
     * @param refNode Reference node to insert after.
     */
    insertSiblingAfter(newNode: Node, refNode: Node) {
        insertSiblingAfter(newNode, refNode);
    }


    /**
     * Insert a child at a given index. If index is larger than the number of child
     * nodes that the parent currently has, the node is inserted as the last child
     * node.
     * @param parent The element into which to insert the child.
     * @param child The element to insert.
     * @param index The index at which to insert the new child node. Must
     *     not be negative.
     */
    insertChildAt(parent: Element, child: Node, index: number) {
        insertChildAt(parent, child, index);
    }


    /**
     * Removes a node from its parent.
     * @param node The node to remove.
     * @return The node removed if removed; else, null.
     */
    removeNode(node: Node): Node | null {
        return removeNode(node);
    }


    /**
     * Replaces a node in the DOM tree. Will do nothing if {@code oldNode} has no
     * parent.
     * @param newNode Node to insert.
     * @param oldNode Node to replace.
     */
    replaceNode(newNode: Node, oldNode: Node) {
        replaceNode(newNode, oldNode);
    }

    /**
     * Returns an array containing just the element children of the given element.
     * @param element The element whose element children we want.
     * @return An array or array-like list
     *     of just the element children of the given element.
     */
    getChildren(element: Element): Element[] | NodeList {
        return getChildren(element);
    }


    /**
     * Returns the first child node that is an element.
     * @param node The node to get the first child element of.
     * @return The first child node of {@code node} that is an element.
     */
    getFirstElementChild(node: Node): Element | null {
        return getFirstElementChild(node);
    }


    /**
     * Returns the last child node that is an element.
     * @param node The node to get the last child element of.
     * @return that is an element.
     */
    getLastElementChild(node: Node): Element | null {
        return getLastElementChild(node);
    }


    /**
     * Returns the first next sibling that is an element.
     * @param node The node to get the next sibling element of.
     * @return The next sibling of {@code node} that is an element.
     */
    getNextElementSibling(node: Node): Element | null {
        return getNextElementSibling(node);
    }

    /**
     * Returns the first previous sibling that is an element.
     * @param node The node to get the previous sibling element of.
     * @return The first previous sibling of {@code node} that is
     *     an element.
     */
    getPreviousElementSibling(node: Node): Element | null {
        return getPreviousElementSibling(node);
    }


    /**
     * Returns the next node in source order from the given node.
     * @param node The node.
     * @return The next node in the DOM tree, or null if this was the last
     *     node.
     */
    getNextNode(node: Node | null): Node | null {
        return getNextNode(node);
    }


    /**
     * Returns the previous node in source order from the given node.
     * @param node The node.
     * @return The previous node in the DOM tree, or null if this was the
     *     first node.
     */
    getPreviousNode(node: Node | null): Node | null {
        return getPreviousNode(node);
    }


    /**
     * Whether the object looks like a DOM node.
     * @param obj The object being tested for node likeness.
     * @return Whether the object looks like a DOM node.
     */
    isNodeLike(obj: any): boolean {
        return isNodeLike(obj);
    }


    /**
     * Whether the object looks like an Element.
     * @param obj The object being tested for Element likeness.
     * @return Whether the object looks like an Element.
     */
    isElement(obj: any): boolean {
        return isElement(obj);
    }


    /**
     * Returns true if the specified value is a Window object. This includes the
     * global window for HTML pages, and iframe windows.
     * @param obj Variable to test.
     * @return Whether the variable is a window.
     */
    isWindow(obj: any): boolean {
        return isWindow(obj);
    }


    /**
     * Returns an element's parent, if it's an Element.
     * @param element The DOM element.
     * @return The parent, or null if not an Element.
     */
    getParentElement = getParentElement


    /**
     * Whether a node contains another node.
     * @param parent The node that should contain the other node.
     * @param descendant The node to test presence of.
     * @return Whether the parent node contains the descendent node.
     */
    contains = contains;


    /**
     * Compares the document order of two nodes, returning 0 if they are the same
     * node, a negative number if node1 is before node2, and a positive number if
     * node2 is before node1.  Note that we compare the order the tags appear in the
     * document so in the tree <b><i>text</i></b> the B node is considered to be
     * before the I node.
     *
     * @param node1 The first node to compare.
     * @param node2 The second node to compare.
     * @return 0 if the nodes are the same node, a negative number if node1
     *     is before node2, and a positive number if node2 is before node1.
     */
    compareNodeOrder = compareNodeOrder;


    /**
     * Find the deepest common ancestor of the given nodes.
     * @param var_args The nodes to find a common ancestor of.
     * @return The common ancestor of the nodes, or null if there is none.
     *     null will only be returned if two or more of the nodes are from different
     *     documents.
     */
    findCommonAncestor = findCommonAncestor;


    /**
     * Returns the owner document for a node.
     * @param node The node to get the document for.
     * @return The document owning the node.
     */
    getOwnerDocument = getOwnerDocument;


    /**
     * Cross browser function for getting the document element of an iframe.
     * @param iframe Iframe element.
     * @return The frame content document.
     */
    getFrameContentDocument = getFrameContentDocument;

    /**
     * Cross browser function for getting the window of a frame or iframe.
     * @param frame Frame element.
     * @return The window associated with the given frame.
     */
    getFrameContentWindow(frame: Element): Window | null {
        return getFrameContentWindow(frame);
    }


    /**
     * Sets the text content of a node, with cross-browser support.
     * @param node The node to change the text content of.
     * @param text The value that should replace the node's content.
     */
    setTextContent(node: Node, text: string | number) {
        setTextContent(node, text)
    }

    /**
     * Gets the outerHTML of a node, which islike innerHTML, except that it
     * actually contains the HTML of the node itself.
     * @param element The element to get the HTML of.
     * @return The outerHTML of the given element.
     */
    getOuterHtml(element: Element): string {
        return getOuterHtml(element);
    }


    /**
     * Finds the first descendant node that matches the filter function. This does
     * a depth first search.
     * @param root The root of the tree to search.
     * @param p The filter function.
     * @return The found node or undefined if none is found.
     */
    findNode(root: Node, p: (n: Node) => boolean): Node | undefined {
        return findNode(root, p);
    }


    /**
     * Finds all the descendant nodes that matches the filter function. This does a
     * depth first search.
     * @param root The root of the tree to search.
     * @param p The filter function.
     * @return The found nodes or an empty array if none are found.
     */
    findNodes(root: Node, p: (node: Node) => boolean): Node[] {
        return findNodes(root, p);
    }


    /**
     * Returns true if the element has a tab index that allows it to receive
     * keyboard focus (tabIndex >= 0), false otherwise.  Note that some elements
     * natively support keyboard focus, even if they have no tab index.
     * @param element Element to check.
     * @return Whether the element has a tab index that allows keyboard
     *     focus.
     */
    isFocusableTabIndex(element: Element): boolean {
        return isFocusableTabIndex(element);
    }


    /**
     * Enables or disables keyboard focus support on the element via its tab index.
     * Only elements for which {@link isFocusableTabIndex} returns true
     * (or elements that natively support keyboard focus, like form elements) can
     * receive keyboard focus.  See http://go/tabindex for more info.
     * @param element Element whose tab index is to be changed.
     * @param enable Whether to set or remove a tab index on the element
     *     that supports keyboard focus.
     */
    setFocusableTabIndex = setFocusableTabIndex;


    /**
     * Returns true if the element can be focused, i.e. it has a tab index that
     * allows it to receive keyboard focus (tabIndex >= 0), or it is an element
     * that natively supports keyboard focus.
     * @param element Element to check.
     * @return Whether the element allows keyboard focus.
     */
    isFocusable(element: Element): boolean {
        return isFocusable(element);
    }


    /**
     * Returns the text contents of the current node, without markup. New lines are
     * stripped and whitespace is collapsed, such that each character would be
     * visible.
     *
     * In browsers that support it, innerText is used.  Other browsers attempt to
     * simulate it via node traversal.  Line breaks are canonicalized in IE.
     *
     * @param node The node from which we are getting content.
     * @return The text content.
     */
    getTextContent = getTextContent;


    /**
     * Returns the text length of the text contained in a node, without markup. This
     * is equivalent to the selection length if the node was selected, or the number
     * of cursor movements to traverse the node. Images & BRs take one space.  New
     * lines are ignored.
     *
     * @param node The node whose text content length is being calculated.
     * @return The length of {@code node}'s text content.
     */
    getNodeTextLength(node: Node): number {
        return getNodeTextLength(node);
    }


    /**
     * Returns the text offset of a node relative to one of its ancestors. The text
     * length is the same as the length calculated by
     * {@code getNodeTextLength}.
     *
     * @param node The node whose offset is being calculated.
     * @param opt_offsetParent Defaults to the node's owner document's body.
     * @return The text offset.
     */
    getNodeTextOffset(node: Node, opt_offsetParent?: Node): number {
        return getNodeTextOffset(node, opt_offsetParent);
    }


    /**
     * Returns the node at a given offset in a parent node.  If an object is
     * provided for the optional third parameter, the node and the remainder of the
     * offset will stored as properties of this object.
     * @param parent The parent node.
     * @param offset The offset into the parent node.
     * @param opt_result Object to be used to store the return value. The
     *     return value will be stored in the form {node: Node, remainder: number}
     *     if this object is provided.
     * @return The node at the given offset.
     */
    getNodeAtOffset(parent: Node, offset: number, opt_result: StructType): Node {
        return getNodeAtOffset(parent, offset, opt_result);
    }


    /**
     * Returns true if the object is a {@code NodeList}.  To qualify as a NodeList,
     * the object must have a numeric length property and an item function (which
     * has type 'string' on IE for some reason).
     * @param val Object to test.
     * @return Whether the object is a NodeList.
     */
    isNodeList(val: StructType): boolean {
        return isNodeList(val);
    }


    /**
     * Walks up the DOM hierarchy returning the first ancestor that has the passed
     * tag name and/or class name. If the passed element matches the specified
     * criteria, the element itself is returned.
     * @param element The DOM node to start with.
     * @param opt_tag The tag name to match (or
     *     null/undefined to match only based on class name).
     * @param opt_class The class name to match (or null/undefined to
     *     match only based on tag name).
     * @param opt_maxSearchSteps Maximum number of levels to search up the
     *     dom.
     * @return The first ancestor that matches the passed criteria, or
     *     null if no match is found.
     */
    getAncestorByTagNameAndClass = getAncestorByTagNameAndClass;


    /**
     * Walks up the DOM hierarchy returning the first ancestor that has the passed
     * class name. If the passed element matches the specified criteria, the
     * element itself is returned.
     * @param element The DOM node to start with.
     * @param class The class name to match.
     * @param opt_maxSearchSteps Maximum number of levels to search up the
     *     dom.
     * @return The first ancestor that matches the passed criteria, or
     *     null if none match.
     */
    getAncestorByClass = getAncestorByClass;


    /**
     * Walks up the DOM hierarchy returning the first ancestor that passes the
     * matcher function.
     * @param element The DOM node to start with.
     * @param matcher A function that returns true if the
     *     passed node matches the desired criteria.
     * @param opt_includeNode If true, the node itself is included in
     *     the search (the first call to the matcher will pass startElement as
     *     the node to test).
     * @param opt_maxSearchSteps Maximum number of levels to search up the
     *     dom.
     * @return DOM node that matched the matcher, or null if there was
     *     no match.
     */
    getAncestor = getAncestor;

    /**
     * Returns a dom node with a set of attributes.  This function accepts varargs
     * for subsequent nodes to be added.  Subsequent nodes will be added to the
     * first node as childNodes.
     *
     * So:
     * <code>createDom('div', null, createDom('p'), createDom('p'));</code>
     * would return a div with two child paragraphs
     *
     * An easy way to move all child nodes of an existing element to a new parent
     * element is:
     * <code>createDom('div', null, oldElement.childNodes);</code>
     * which will remove all child nodes from the old element and add them as
     * child nodes of the new DIV.
     *
     * @param  tagName Tag to create.
     * @param opt_attributes If object, then a map of name-value
     *     pairs for attributes. If a string, then this is the className of the new
     *     element.
     * @param var_args Further DOM nodes or
     *     strings for text nodes. If one of the var_args is an array or
     *     NodeList, its elements will be added as childNodes instead.
     * @return Reference to a DOM node.
     */
    createDom<T extends string>(
        tagName: T, opt_attributes?: StructType | string, ...var_args: Appendable[]): TagTypeLookup<T> {
        return createDom_(this.document_, tagName, opt_attributes, ...var_args);
    }


    /**
     * Creates a new element.
     * @param name Tag name.
     * @return The new element.
     */
    createElement(name: string): Element {
        return this.document_.createElement(name);
    }


    /**
     * Creates a new text node.
     * @param content Content.
     * @return The new text node.
     */
    createTextNode(content: number | string): Text {
        return this.document_.createTextNode(String(content));
    }


    /**
     * Create a table.
     * @param rows The number of rows in the table.  Must be >= 1.
     * @param columns The number of columns in the table.  Must be >= 1.
     * @param opt_fillWithNbsp If true, fills table entries with
     *     characters.
     * @return The created table.
     */
    createTable(
        rows: number, columns: number, opt_fillWithNbsp?: boolean,): HTMLElement {
        return createTable_(
            this.document_, rows, columns, !!opt_fillWithNbsp);
    }

    /**
     * Returns true if the browser is in "CSS1-compatible" (standards-compliant)
     * mode, false otherwise.
     * @return True if in CSS1-compatible mode.
     */
    isCss1CompatMode(): boolean {
        return isCss1CompatMode_(this.document_);
    }


    /**
     * Gets the window object associated with the document.
     * @return The window associated with the given document.
     */
    getWindow(): Window {
        return getWindow_(this.document_);
    }


    /**
     * Gets the document scroll element.
     * @return Scrolling element.
     */
    getDocumentScrollElement(): Element {
        return getDocumentScrollElement_(this.document_);
    }

    /**
     * Gets the document scroll distance as a coordinate object.
     * @return Object with properties 'x' and 'y'.
     */
    getDocumentScroll() {
        return getDocumentScroll_(this.document_);
    }


    /**
     * Determines the active element in the given document.
     * @param opt_doc The document to look in.
     * @return The active element.
     */
    getActiveElement(opt_doc?: Document) {
        return getActiveElement(opt_doc || this.document_);
    }


}


/**
 * Typedef for use with createDom and append.
 */
type Appendable = StructType | string | any[] | NodeList | Message;


/**
 * Gets the dimensions of the viewport.
 *
 * Gecko Standards mode:
 * docEl.clientWidth  Width of viewport excluding scrollbar.
 * win.innerWidth     Width of viewport including scrollbar.
 * body.clientWidth   Width of body element.
 *
 * docEl.clientHeight Height of viewport excluding scrollbar.
 * win.innerHeight    Height of viewport including scrollbar.
 * body.clientHeight  Height of document.
 *
 * Gecko Backwards compatible mode:
 * docEl.clientWidth  Width of viewport excluding scrollbar.
 * win.innerWidth     Width of viewport including scrollbar.
 * body.clientWidth   Width of viewport excluding scrollbar.
 *
 * docEl.clientHeight Height of document.
 * win.innerHeight    Height of viewport including scrollbar.
 * body.clientHeight  Height of viewport excluding scrollbar.
 *
 * IE6/7 Standards mode:
 * docEl.clientWidth  Width of viewport excluding scrollbar.
 * win.innerWidth     Undefined.
 * body.clientWidth   Width of body element.
 *
 * docEl.clientHeight Height of viewport excluding scrollbar.
 * win.innerHeight    Undefined.
 * body.clientHeight  Height of document element.
 *
 * IE5 + IE6/7 Backwards compatible mode:
 * docEl.clientWidth  0.
 * win.innerWidth     Undefined.
 * body.clientWidth   Width of viewport excluding scrollbar.
 *
 * docEl.clientHeight 0.
 * win.innerHeight    Undefined.
 * body.clientHeight  Height of viewport excluding scrollbar.
 *
 * Opera 9 Standards and backwards compatible mode:
 * docEl.clientWidth  Width of viewport excluding scrollbar.
 * win.innerWidth     Width of viewport including scrollbar.
 * body.clientWidth   Width of viewport excluding scrollbar.
 *
 * docEl.clientHeight Height of document.
 * win.innerHeight    Height of viewport including scrollbar.
 * body.clientHeight  Height of viewport excluding scrollbar.
 *
 * WebKit:
 * Safari 2
 * docEl.clientHeight Same as scrollHeight.
 * docEl.clientWidth  Same as innerWidth.
 * win.innerWidth     Width of viewport excluding scrollbar.
 * win.innerHeight    Height of the viewport including scrollbar.
 * frame.innerHeight  Height of the viewport exluding scrollbar.
 *
 * Safari 3 (tested in 522)
 *
 * docEl.clientWidth  Width of viewport excluding scrollbar.
 * docEl.clientHeight Height of viewport excluding scrollbar in strict mode.
 * body.clientHeight  Height of viewport excluding scrollbar in quirks mode.
 *
 * @param opt_window Optional window element to test.
 * @return Object with values 'width' and 'height'.
 */
export function getViewportSize(opt_window?: Window): Size {
    // TODO(arv): This should not take an argument
    return getViewportSize_(opt_window || window);
}


/**
 * Helper for {@code getViewportSize}.
 * @param win The window to get the view port size for.
 * @return Object with values 'width' and 'height'.
 * @private
 */
function getViewportSize_(win: Window): Size {
    let doc = win.document;
    let el = isCss1CompatMode_(doc) ? doc.documentElement : doc.body;
    return new Size(el.clientWidth, el.clientHeight);
}


/**
 * Sets the top/left values of an element.  If no unit is specified in the
 * argument then it will add px. The second argument is required if the first
 * argument is a string or number and is ignored if the first argument
 * is a coordinate.
 * @param el Element to move.
 * @param arg1 Left position or coordinate.
 * @param opt_arg2 Top position.
 */
export function setPosition(el: Element, arg1: string | number | Coordinate, opt_arg2?: string | number) {
    let x, y;

    if (arg1 instanceof Coordinate) {
        x = arg1.x;
        y = arg1.y;
    } else {
        x = arg1;
        y = opt_arg2;
    }

    (el as HTMLElement).style.left = getPixelStyleValue_(
        x, false);
    (el as HTMLElement).style.top = getPixelStyleValue_(
        y as string | number, false);
}


/**
 * Helper function to create a string to be set into a pixel-value style
 * property of an element. Can round to the nearest integer value.
 *
 * @param value The style value to be used. If a number,
 *     'px' will be appended, otherwise the value will be applied directly.
 * @param round Whether to round the nearest integer (if property
 *     is a number).
 * @return The string value for the property.
 */
function getPixelStyleValue_(value: string | number, round: boolean): string {
    if (typeof value == 'number') {
        value = (round ? Math.round(value) : value) + 'px';
    }

    return value;
}

/**
 * Gets the height and width of an element, even if its display is none.
 *
 * Specifically, this returns the height and width of the border box,
 * irrespective of the box model in effect.
 *
 * Note that this function does not take CSS transforms into account. Please see
 * {@code goog.style.getTransformedSize}.
 * @param element Element to get size of.
 * @return Object with width/height properties.
 */
export function getSize(element: Element): Size {
    return evaluateWithTemporaryDisplay_(
        getSizeWithDisplay_, element);
}


/**
 * Call {@code fn} on {@code element} such that {@code element}'s dimensions are
 * accurate when it's passed to {@code fn}.
 * @param fn Function to call with {@code element} as
 *     an argument after temporarily changing {@code element}'s display such
 *     that its dimensions are accurate.
 * @param element Element (which may have display none) to use as
 *     argument to {@code fn}.
 * @return Value returned by calling {@code fn} with {@code element}.
 * @template T
 * @private
 */
function evaluateWithTemporaryDisplay_<T>(fn: (el: Element) => T, element: Element): T {
    if (getStyle_(element, 'display') != 'none') {
        return fn(element);
    }

    let style = (element as HTMLElement).style;
    let originalDisplay = style.display;
    let originalVisibility = style.visibility;
    let originalPosition = style.position;

    style.visibility = 'hidden';
    style.position = 'absolute';
    style.display = 'inline';

    let retVal = fn(element);

    style.display = originalDisplay;
    style.position = originalPosition;
    style.visibility = originalVisibility;

    return retVal;
}


/**
 * Gets the height and width of an element when the display is not none.
 * @param element Element to get size of.
 * @return Object with width/height properties.
 */
function getSizeWithDisplay_(element: Element): Size {
    let offsetWidth = (element as HTMLElement).offsetWidth;
    let offsetHeight = (element as HTMLElement).offsetHeight;
    let webkitOffsetsZero =
        userAgent.WEBKIT && !offsetWidth && !offsetHeight;
    if ((offsetWidth == undefined || webkitOffsetsZero) &&
        element.getBoundingClientRect !== undefined) {
        // Fall back to calling getBoundingClientRect when offsetWidth or
        // offsetHeight are not defined, or when they are zero in WebKit browsers.
        // This makes sure that we return for the correct size for SVG elements, but
        // will still return 0 on Webkit prior to 534.8, see
        // http://trac.webkit.org/changeset/67252.
        let clientRect = getBoundingClientRect_(element);
        return new Size(
            clientRect.right - clientRect.left, clientRect.bottom - clientRect.top);
    }
    return new Size(offsetWidth, offsetHeight);
}

/**
 * Returns a bounding rectangle for a given element in page space.
 * @param element Element to get bounds of. Must not be display none.
 * @return Bounding rectangle for the element.
 */
export function getBounds(element: Element): Rect {
    let o = getPageOffset(element);
    let s = getSize(element);
    return new Rect(o.x, o.y, s.width, s.height);
}

/**
 * Returns true if the element is using right to left (rtl) direction.
 * @param el  The element to test.
 * @return True for right to left, false for left to right.
 */
export function isRightToLeft(el: Element): boolean {
    return 'rtl' == getStyle_(el, 'direction');
}

/**
 * Sets the border box size of an element. This is potentially expensive in IE
 * if the document is CSS1Compat mode
 * @param element  The element to set the size on.
 * @param size  The new size.
 */
export function setBorderBoxSize(element: Element, size: Size) {
    setBorderBoxSize_(element, size, 'border-box');
}

function setBorderBoxSize_(element: Element, size: Size, boxSizing: string) {
    let style = (element as HTMLElement).style;
    if (userAgent.GECKO) {
        (style as any).MozBoxSizing = boxSizing;
    } else if (userAgent.WEBKIT) {
        (style as any).WebkitBoxSizing = boxSizing;
    } else {
        // Includes IE8 and Opera 9.50+
        style.boxSizing = boxSizing;
    }

    // Setting this to a negative value will throw an exception on IE
    // (and doesn't do anything different than setting it to 0).
    style.width = Math.max(size.width, 0) + 'px';
    style.height = Math.max(size.height, 0) + 'px';
}

/**
 * Translates the specified rect relative to origBase page, for newBase page.
 * If origBase and newBase are the same, this function does nothing.
 *
 * @param rect The source rectangle relative to origBase page,
 *     and it will have the translated result.
 * @param origBase The DomHelper for the input rectangle.
 * @param newBase The DomHelper for the resultant
 *     coordinate.  This must be a DOM for an ancestor frame of origBase
 *     or the same as origBase.
 */
export function translateRectForAnotherFrame(rect: Rect, origBase: DomHelper, newBase: DomHelper) {
    if (origBase.getDocument() != newBase.getDocument()) {
        let body = origBase.getDocument().body;
        let pos = getFramedPageOffset(body, newBase.getWindow());

        // Adjust Body's margin.
        pos = Coordinate.difference(pos, getPageOffset(body));

        if (userAgent.IE && !userAgent.isDocumentModeOrHigher(9) &&
            !origBase.isCss1CompatMode()) {
            pos = Coordinate.difference(pos, origBase.getDocumentScroll());
        }

        rect.left += pos.x;
        rect.top += pos.y;
    }
}

/**
 * Returns a Coordinate object relative to the top-left of an HTML document
 * in an ancestor frame of this element. Used for measuring the position of
 * an element inside a frame relative to a containing frame.
 *
 * @param el Element to get the page offset for.
 * @param relativeWin The window to measure relative to. If relativeWin
 *     is not in the ancestor frame chain of the element, we measure relative to
 *     the top-most window.
 * @return The page offset.
 */
export function getFramedPageOffset(el: Element, relativeWin: Window): Coordinate {
    let position = new Coordinate(0, 0);

    // Iterate up the ancestor frame chain, keeping track of the current window
    // and the current element in that window.
    let currentWin = getWindow(getOwnerDocument(el));

    // MS Edge throws when accessing "parent" if el's containing iframe has been
    // deleted.
    if (!canAccessProperty(currentWin, 'parent')) {
        return position;
    }

    let currentEl: Element | null = el;
    do {
        // if we're at the top window, we want to get the page offset.
        // if we're at an inner frame, we only want to get the window position
        // so that we can determine the actual page offset in the context of
        // the outer window.
        let offset = currentWin == relativeWin ?
            getPageOffset(currentEl) :
            getClientPositionForElement_(currentEl);

        position.x += offset.x;
        position.y += offset.y;
    } while (currentWin && currentWin != relativeWin &&
    currentWin != currentWin.parent &&
    (currentEl = currentWin.frameElement) &&
    (currentWin = currentWin.parent));

    return position;
}

function canAccessProperty(obj: any, prop: string): boolean {
    try {
        let val = obj[prop];
        return !!val || true;
    } catch (e) {
    }
    return false;
}

/**
 * Returns the position of the event or the element's border box relative to
 * the client viewport.
 * @param el Element whose position to get.
 * @return The position.
 * @private
 */
function getClientPositionForElement_(el: Element): Coordinate {
    let box = getBoundingClientRect_(el);
    return new Coordinate(box.left, box.top);
}

/**
 * Returns the normalized scrollLeft position for a scrolled element.
 * @param element The scrolled element.
 * @return The number of pixels the element is scrolled. 0 indicates
 *     that the element is not scrolled at all (which, in general, is the
 *     left-most position in ltr and the right-most position in rtl).
 */
export function getScrollLeft(element: Element) {
    let isRtl = isRightToLeft(element);
    if (isRtl && userAgent.GECKO) {
        // ScrollLeft starts at 0 and then goes negative as the element is scrolled
        // towards the left.
        return -element.scrollLeft;
    } else if (
        isRtl &&
        !(userAgent.EDGE_OR_IE && userAgent.isVersionOrHigher('8'))) {
        // ScrollLeft starts at the maximum positive value and decreases towards
        // 0 as the element is scrolled towards the left. However, for overflow
        // visible, there is no scrollLeft and the value always stays correctly at 0
        let overflowX = getComputedOverflowX(element);
        if (overflowX == 'visible') {
            return element.scrollLeft;
        } else {
            return element.scrollWidth - element.clientWidth - element.scrollLeft;
        }
    }
    // ScrollLeft behavior is identical in rtl and ltr, it starts at 0 and
    // increases as the element is scrolled away from the start.
    return element.scrollLeft;
}

/**
 * Retrieves the computed value of the overflow-x CSS attribute.
 * @param element The element to get the overflow-x of.
 * @return The computed string value of the overflow-x attribute.
 */
export function getComputedOverflowX(element: Element): string {
    return getStyle_(element, 'overflowX');
}

/**
 * Shows or hides an element from the page. Hiding the element is done by
 * setting the display property to "none", removing the element from the
 * rendering hierarchy so it takes up no space. To show the element, the default
 * inherited display property is restored (defined either in stylesheets or by
 * the browser's default style rules).
 *
 * Caveat 1: if the inherited display property for the element is set to "none"
 * by the stylesheets, that is the property that will be restored by a call to
 * setElementShown(), effectively toggling the display between "none" and
 * "none".
 *
 * Caveat 2: if the element display style is set inline (by setting either
 * element.style.display or a style attribute in the HTML), a call to
 * setElementShown will clear that setting and defer to the inherited style in
 * the stylesheet.
 * @param el Element to show or hide.
 * @param isShown True to render the element in its default style,
 *     false to disable rendering the element.
 */

export function setElementShown(el: HTMLElement, isShown: boolean) {
    el.style.display = isShown ? '' : 'none';
}


/**
 * Calculates the viewport coordinates relative to the page/document
 * containing the node. The viewport may be the browser viewport for
 * non-iframe document, or the iframe container for iframe'd document.
 * @param doc The document to use as the reference point.
 * @return The page offset of the viewport.
 */
export function getViewportPageOffset(doc: Document): Coordinate {
    let body = doc.body;
    let documentElement = doc.documentElement;
    let scrollLeft = body.scrollLeft || documentElement.scrollLeft;
    let scrollTop = body.scrollTop || documentElement.scrollTop;
    return new Coordinate(scrollLeft, scrollTop);
}

export function getCssName(base: string | undefined | Behaviour<string>, name: string) {
    if (base == undefined) {
        return 'recoil-' + base;
    }
    if (typeof base === 'string') {
        return base + name;
    }
    return base.good() ? base.get() + name : 'recoil-' + name;
}

let styleNameCache_: Record<string, string> = {};

/**
 * Returns the JS vendor prefix used in CSS properties. Different vendors
 * use different methods of changing the case of the property names.
 *
 * @return {?string} The JS vendor prefix or null if there is none.
 */
export function getVendorJsPrefix() {
    if (userAgent.WEBKIT) {
        return 'Webkit';
    } else if (userAgent.GECKO) {
        return 'Moz';
    } else if (userAgent.IE) {
        return 'ms';
    } else if (userAgent.OPERA) {
        return 'O';
    }

    return null;
};

/**
 * Returns the style property name in camel-case. If it does not exist and a
 * vendor-specific version of the property does exist, then return the vendor-
 * specific property name instead.
 * @param element The element to change.
 * @param style Style name.
 * @return Vendor-specific style.
 */
function getVendorJsStyleName_(element: HTMLElement, style: string): string {
    let propertyName = styleNameCache_[style];
    if (!propertyName) {
        let camelStyle = toCamelCase(style);
        propertyName = camelStyle;

        if (element.style[camelStyle as any] === undefined) {
            let prefixedStyle = getVendorJsPrefix() +
                toTitleCase(camelStyle);

            if (element.style[prefixedStyle as any] !== undefined) {
                propertyName = prefixedStyle;
            }
        }
        styleNameCache_[style] = propertyName;
    }

    return propertyName;
}

function setStyle_(element: HTMLElement, value: string | null | boolean | undefined, style: string) {
    let propertyName = getVendorJsStyleName_(element, style);

    if (propertyName) {
        element.style[propertyName as any] = value as any;
    }
}

/**
 * Sets a style value on an element.
 *
 * This function is not indended to patch issues in the browser's style
 * handling, but to allow easy programmatic access to setting dash-separated
 * style properties.  An example is setting a batch of properties from a data
 * object without overwriting old styles.  When possible, use native APIs:
 * elem.style.propertyKey = 'value' or (if obliterating old styles is fine)
 * elem.style.cssText = 'property1: value1; property2: value2'.
 *
 * @param element The element to change.
 * @param style If a string, a style name. If an object, a hash
 *     of style names to style values.
 * @param opt_value If style was a string, then this
 *     should be the value.
 */
export function setStyle(element: HTMLElement, style: StructType): void;
export function setStyle(element: HTMLElement, style: string, opt_value: string | number | boolean): void;
export function setStyle(element: HTMLElement, style: StructType | string, opt_value?: string | number | boolean): void {
    if (typeof style === "string") {
        setStyle_(element, opt_value as string | null | boolean, style);
    } else {
        for (let key in style) {
            setStyle_(element, style[key], key);
        }

    }
}

/**
 * Sets the width/height values of an element.  If an argument is numeric,
 * or a goog.math.Size is passed, it is assumed to be pixels and will add
 * 'px' after converting it to an integer in string form. (This just sets the
 * CSS width and height properties so it might set content-box or border-box
 * size depending on the box model the browser is using.)
 *
 * @param element Element to set the size of.
 * @param w Width of the element, or a
 *     size object.
 * @param  opt_h Height of the element. Required if w is not a
 *     size object.
 */
export function setSize(element: HTMLElement, w: Size): void;
export function setSize(element: HTMLElement, w: string | number, opt_h: string | number): void;
export function setSize(element: HTMLElement, w: string | number | Size, opt_h?: string | number): void {
    let h;
    if (w instanceof Size) {
        h = w.height;
        w = w.width;
    } else {
        if (opt_h == undefined) {
            throw Error('missing height argument');
        }
        h = opt_h;
    }

    setWidth(element, /** @type {string|number} */ (w));
    setHeight(element, h);
}

/**
 * Set the height of an element.  Sets the element's style property.
 * @param element Element to set the height of.
 * @param height The height value to set.  If a number, 'px'
 *     will be appended, otherwise the value will be applied directly.
 */
export function setHeight(element: HTMLElement, height: string | number) {
    element.style.height = getPixelStyleValue_(height, true);
}


/**
 * Set the width of an element.  Sets the element's style property.
 * @param element Element to set the width of.
 * @param width The width value to set.  If a number, 'px'
 *     will be appended, otherwise the value will be applied directly.
 */
export function setWidth(element: HTMLElement, width: string | number) {
    element.style.width = getPixelStyleValue_(width, true);
}
