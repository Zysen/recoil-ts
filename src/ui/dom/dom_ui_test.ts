// Copyright 2009 The Closure Library Authors. All Rights Reserved.
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

import {
    getElement, getFrameContentDocument, isCss1CompatMode, createDom,
    createTextNode, createTable, getDomHelper, DomHelper, getRequiredElement, getRequiredElementByClass,
    getElementsByTagNameAndClass, getOwnerDocument, getElementByClass, getElementsByClass,
    getParentElement,
    getPreviousElementSibling, canHaveChildren,
    createElement,
    getAncestorByTagNameAndClass, getAncestorByClass, getAncestor, append,
    getDocumentScroll, getActiveElement,
    isFocusable,
    isFocusableTabIndex,
    findNodes,
    findNode, setProperties,
    compareNodeOrder,
    findCommonAncestor, replaceNode,
    insertChildAt,
    isNodeLike,
    isWindow,
    isElement,
    isNodeList,
    contains, appendChild, removeNode,
    getFirstElementChild,
    getLastElementChild, getNextElementSibling,
    getChildren, getNextNode,
    setFocusableTabIndex, getWindow,
    getTextContent,
    getNodeTextLength, getNodeTextOffset,
    getNodeAtOffset,
    getOuterHtml,
    getFrameContentWindow, removeChildren, setTextContent, getPreviousNode, getPixelRatio,
} from "./dom";

import {TagName} from "./tags";
import {expect} from "@jest/globals";
import {userAgent} from "./useragent";
import {NodeType} from "./nodetype";
import {StructType} from "../../frp/struct";
import {InputType} from "./inputtype";
import {Unicode} from "../../util/string";
import {PropertyReplacer} from "../../PropertyReplacer";


function createDiv(str: string): HTMLElement {
    let tree = document.createElement("div");
    tree.innerHTML = str;
    return tree;


}

/**
 * @fileoverview Shared code for dom_test.html and dom_quirks_test.html.
 */

let divForTestingScrolling: HTMLElement | null = null;
let stubs = new PropertyReplacer;

function getMyFrameDoc() {
    let myIframe = getRequiredElement('myIframe') as HTMLIFrameElement;
    return getFrameContentDocument(
        myIframe as HTMLElement) as Document;

}

beforeEach(() => {
    document.body.innerHTML = '  <div>\n' +
        '    abc <i>def</i> <s id="offsetParent1">g <b>h <i id="offsetTest1">ij</i> kl</b> mn</s> opq\n' +
        '  </div>\n' +
        '\n' +
        '\n' +
        '  <div id="testEl">\n' +
        '    <span>Test Element</span>\n' +
        '  </div>\n' +
        '\n' +
        '  <div><div><div id="testEl2"></div></div></div>\n' +
        '\n' +
        '  <!-- classbefore and classafter are for making sure that getElementsByClass\n' +
        '       works when multiple classes are specified. -->\n' +
        '  <div id="span-container">\n' +
        '    <SPAN id="span1" class="classbefore test1"></SPAN>\n' +
        '    <SPAN id="span2" class="test1"></SPAN>\n' +
        '    <SPAN id="span3" class="test2"></SPAN>\n' +
        '    <SPAN id="span4" class="test3"></SPAN>\n' +
        '    <SPAN id="span5" class="test1 classafter"></SPAN>\n' +
        '  </div>\n' +
        '\n' +
        '  <div class="mixedCaseClass"></div>\n' +
        '\n' +
        '  <p id="p1"></p>\n' +
        '\n' +
        '  <div id="styleTest1"></div>\n' +
        '  <div id="styleTest2" style="width:100px;font-weight:bold"></div>\n' +
        '  <div id="styleTest3"></div>\n' +
        '\n' +
        '  <!-- Paragraph to test element child and sibling -->\n' +
        '  <p id="p2">\n' +
        '    <!-- Comment -->\n' +
        '    a\n' +
        '    <b id="b1">c</b>\n' +
        '    d\n' +
        '    <!-- Comment -->\n' +
        '    e\n' +
        '    <b id="b2">f</b>\n' +
        '    g\n' +
        '    <!-- Comment -->\n' +
        '  </p>\n' +
        '\n' +
        '  <table id="testTable1">\n' +
        '    <tr>\n' +
        '      <td>&nbsp;\n' +
        '    </tr>\n' +
        '  </table>\n' +
        '\n' +
        '  <iframe name="frame" src="tagname_test.html"></iframe>\n' +
        '\n' +
        '  <p id="order-test"></p>\n' +
        '\n' +
        '  <div id="testAncestorDiv" class="ancestorClassA testAncestor">\n' +
        '    <p id="testAncestorP" class="ancestorClassB testAncestor">\n' +
        '      <b id="nestedElement">ancestorTest</b>\n' +
        '    </p>\n' +
        '  </div>\n' +
        '\n' +
        '  <div id="noTabIndex">Test</div>\n' +
        '  <div id="tabIndexNegative2" tabindex="-2">Test</div>\n' +
        '  <div id="tabIndexNegative1" tabindex="-1">Test</div>\n' +
        '  <div id="tabIndex0" tabindex="0">Test</div>\n' +
        '  <div id="tabIndex1" tabindex="1">Test</div>\n' +
        '  <div id="tabIndex2" tabindex="2">Test</div>\n' +
        '\n' +
        '  <form>\n' +
        '    <a href="testUrl" id="noTabIndexAnchor">Test</a>\n' +
        '    <input id="noTabIndexInput">\n' +
        '    <textarea id="noTabIndexTextArea">Test</textarea>\n' +
        '    <select id="noTabIndexSelect"><option>Test</option></select>\n' +
        '    <button id="noTabIndexButton">Test</button>\n' +
        '    <button id="negTabIndexButton" tabindex="-1">Test</button>\n' +
        '    <button id="zeroTabIndexButton" tabindex="0">Test</button>\n' +
        '    <button id="posTabIndexButton" tabindex="1">Test</button>\n' +
        '    <button id="disabledNoTabIndexButton" disabled>Test</button>\n' +
        '    <button id="disabledNegTabIndexButton" disabled tabindex="-1">Test</button>\n' +
        '    <button id="disabledZeroTabIndexButton" disabled tabindex="0">Test</button>\n' +
        '    <button id="disabledPosTabIndexButton" disabled tabindex="1">Test</button>\n' +
        '  </form>\n' +
        '\n' +
        '  <div id="toReplace">Replace Test</div>\n' +
        '\n' +
        '  <iframe id="iframe"></iframe>\n' +
        '\n' +
        '  <div id="myIframeDiv1" style="height:42px;font-size:1px;line-height:0;">hello world</div>\n' +
        '  <div id="myIframeDiv2" style="height:23px;font-size:1px;line-height:0;">hello world</div>\n' +
        '\n' +
        '  <iframe id="myIframe" style="width:400px;height:200px;"></iframe>\n' +
        '\n' +
        '  <a id=\'link\' href=\'foo.html\'>Foo</a>\n' +
        '\n' +
        '  <svg id="testSvg" width="100" height="100" viewPort="0 0 100 100" version="1.0">\n' +
        '    <g id="testG">\n' +
        '      <rect id="testRect" x="10" y="10" width="50" height="50"/>\n' +
        '    </g>\n' +
        '  </svg>\n';
    stubs = new PropertyReplacer();
    divForTestingScrolling = document.createElement(TagName.DIV);
    divForTestingScrolling.style.width = '5000px';
    divForTestingScrolling.style.height = '5000px';
    document.body.appendChild(divForTestingScrolling);
    // Setup for the iframe
    let myIframe = getRequiredElement('myIframe') as HTMLIFrameElement;
    let myIframeDoc = getFrameContentDocument(
        myIframe as HTMLElement);

    // Set up document for iframe: total height of elements in document is 65
    // If the elements are not create like below, IE will get a wrong height for
    // the document.
    myIframeDoc.open();
    // Make sure we progate the compat mode
    myIframeDoc.write(
        (isCss1CompatMode() ? '<!DOCTYPE html>' : '') +
        '<style>body{margin:0;padding:0}</style>' +
        '<div style="height:42px;font-size:1px;line-height:0;">' +
        'hello world</div>' +
        '<div style="height:23px;font-size:1px;line-height:0;">' +
        'hello world</div>');
    myIframeDoc.close();
});

function tearDownPage() {
    document.body.removeChild(divForTestingScrolling as Node);
}

afterEach(() => {
    //window.scrollTo(0, 0);
    stubs.reset();
});

test("GetElement", () => {
    let el = getElement('testEl');
    expect(el?.id).toBe('testEl');
});

test("GetElementDomHelper", () => {
    let domHelper = new DomHelper();
    let el = domHelper.getElement('testEl') as Element;
    expect(el.id).toBe('testEl');
});

test("GetRequiredElement", () => {
    let el = getRequiredElement('testEl');
    expect(el != null).toBe(true);
    expect(el?.id).toBe('testEl');
    expect(() => {
        getRequiredElement('does_not_exist');
    }).toThrow();
});

test("GetRequiredElementDomHelper", () => {
    let domHelper = new DomHelper();
    let el = domHelper.getRequiredElement('testEl');
    expect(el?.id).toBe('testEl');
    let container = getElement('span-container') as Element
    expect(() => {
        getRequiredElementByClass('does_not_exist', container);
    }).toThrow();
});

test("GetRequiredElementByClassDomHelper", () => {
    let domHelper = new DomHelper();
    expect(domHelper.getRequiredElementByClass('test1')).not.toBeNull();
    expect(domHelper.getRequiredElementByClass('test2')).not.toBeNull();

    let container = domHelper.getElement('span-container') as Element;
    expect(domHelper.getElementByClass('test1', container)).not.toBeNull();
    expect(() => {
        domHelper.getRequiredElementByClass('does_not_exist', container);
    });
});

test("GetElementsByTagNameAndClass", () => {
    expect(getElementsByTagNameAndClass(TagName.SPAN).length).toBe(6);
    expect(getElementsByTagNameAndClass(TagName.SPAN).length).toBe(6);
    // this is a bug in jests that means the query does not work if its upper case and
    // combined with a class
    expect(getElementsByTagNameAndClass(TagName.SPAN, 'test1').length).toBe(3);
    expect(getElementsByTagNameAndClass(TagName.SPAN, 'test2').length).toBe(1);
    expect(getElementsByTagNameAndClass(TagName.SPAN, 'test2').length).toBe(1);
    expect(getElementsByTagNameAndClass().length).toBe(document.getElementsByTagName('*').length);
    expect(getElementsByTagNameAndClass(TagName.SPAN, null, getElement('testEl')).length).toBe(1);

    // '*' as the tag name should be equivalent to all tags
    let container = getElement('span-container') as Element;
    expect(getElementsByTagNameAndClass('*', undefined, container).length).toBe(5);
    expect(getElementsByTagNameAndClass('*', 'test1', container).length).toBe(3);
    expect(getElementsByTagNameAndClass('*', 'test2', container).length).toBe(1);

    // Some version of WebKit have problems with mixed-case class names

    expect(getElementsByTagNameAndClass(undefined, 'mixedCaseClass')
        .length).toBe(1);

    // Make sure that out of bounds indices are OK
    expect(getElementsByTagNameAndClass(undefined, 'noSuchClass')[0]).toBeUndefined();

});

test("GetElementsByClass", () => {
    expect(getElementsByClass('test1').length).toBe(3);
    expect(getElementsByClass('test2').length).toBe(1);
    expect(getElementsByClass('nonexistant').length).toBe(0);

    let container = getElement('span-container') as Element;
    expect(getElementsByClass('test1', container).length).toBe(3);
});

test("GetElementByClass", () => {
    expect(getElementByClass('test1')).not.toBeNull();
    expect(getElementByClass('test2')).not.toBeNull();
    // assertNull(getElementByClass('nonexistant'));

    let container = getElement('span-container') as Element;
    expect(getElementByClass('test1', container)).not.toBeNull();
});

test("SetProperties", () => {
    let attrs = {'name': 'test3', 'title': 'A title', 'random': 'woop'};
    let el = getElement('testEl') as Element;

    let res = setProperties(el, attrs);
    expect((el as any).name).toBe('test3');
    expect((el as any).title).toBe('A title');
    expect((el as any).random).toBe('woop');
});

test("SetPropertiesDirectAttributeMap", () => {
    let attrs = {'usemap': '#myMap'};
    let el = createDom(TagName.IMG);

    setProperties(el, attrs);
    expect(el.getAttribute('usemap')).toBe('#myMap');
});

test("SetPropertiesDirectAttributeMapChecksForOwnProperties", () => {
    stubs.set(Object.prototype, 'customProp', 'sdflasdf.,m.,<>fsdflas213!@#');
    let attrs = {'usemap': '#myMap'};
    let el = createDom(TagName.IMG);

    setProperties(el, attrs);
    expect(el.getAttribute('usemap')).toBe('#myMap');
});

test("SetPropertiesAria", () => {
    let attrs = {
        'aria-hidden': 'true',
        'aria-label': 'This is a label',
        'role': 'presentation'
    };
    let el = createDom(TagName.DIV);

    setProperties(el, attrs);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('aria-label')).toBe('This is a label');
    expect(el.getAttribute('role')).toBe('presentation');
});

test("SetPropertiesData", () => {
    let attrs = {
        'data-tooltip': 'This is a tooltip',
        'data-tooltip-delay': '100'
    };
    let el = createDom(TagName.DIV);

    setProperties(el, attrs);
    expect(el.getAttribute('data-tooltip')).toBe('This is a tooltip');
    expect(el.getAttribute('data-tooltip-delay')).toBe('100');
});

test("SetTableProperties", () => {
    let attrs = {
        'style': 'padding-left: 10px;',
        'class': 'mytestclass',
        'height': '101',
        'cellpadding': '15'
    };
    let el = getElement('testTable1') as HTMLElement;

    setProperties(el, attrs);
    expect(el.style.paddingLeft).toBe('10px');
    expect('mytestclass').toBe(el.className);
    expect(el.getAttribute('height')).toBe('101');
    expect((el as any).cellPadding).toBe('15');
});

test("GetViewportSize", () => {
    // TODO: This is failing in the test runner now, fix later.
    // let dims = getViewportSize();
    // assertNotUndefined('Should be defined at least', dims.width);
    // assertNotUndefined('Should be defined at least', dims.height);
});

test("CreateDom", () => {
    let el = createDom(
        TagName.DIV, {
            style: 'border: 1px solid black; width: 50%; background-color: #EEE;',
            onclick: "alert('woo')"
        },
        createDom(
            TagName.P, {style: 'font: normal 12px arial; color: red; '},
            'Para 1'),
        createDom(
            TagName.P,
            {style: 'font: bold 18px garamond; color: blue; '}, 'Para 2'),
        createDom(
            TagName.P,
            {style: 'font: normal 24px monospace; color: green'}, 'Para 3 ',
            createDom(
                TagName.A, {name: 'link', href: 'http://bbc.co.uk'},
                'has a link'),
            ', how cool is this?')) as HTMLElement;

    expect(el.tagName).toBe(TagName.DIV);
    expect(el.style.width).toBe('50%');
    expect((el.childNodes[0] as HTMLElement).tagName).toBe(TagName.P);
    expect((el.childNodes[1] as HTMLElement).innerHTML).toBe('Para 2');
});

test("CreateDomNoChildren", () => {
    let el;

    // Test unspecified children.
    el = createDom(TagName.DIV);
    expect(el.firstChild).toBeNull();

    // Test null children.
    el = createDom(TagName.DIV, null, null);
    expect(el.firstChild).toBeNull();

    // Test empty array of children.
    el = createDom(TagName.DIV, null, []);
    expect(el.firstChild).toBeNull();
});

test("CreateDomAcceptsArray", () => {
    let items = [
        createDom(TagName.LI, {}, 'Item 1'),
        createDom(TagName.LI, {}, 'Item 2')
    ];
    let ul = createDom(TagName.UL, {}, items);
    expect(ul.childNodes.length).toBe(2);
    expect((ul.firstChild as HTMLElement).tagName).toBe(TagName.LI);
    expect((ul.childNodes[0] as HTMLElement).innerHTML).toBe('Item 1');
    expect((ul.childNodes[1] as HTMLElement).innerHTML).toBe('Item 2');
});

test("CreateDomStringArg", () => {
    let el: Element;

    // Test string arg.
    el = createDom(TagName.DIV, null, 'Hello') as Element;
    expect((el.firstChild as Element).nodeType).toBe(NodeType.TEXT);
    expect((el.firstChild as Element).nodeValue).toBe('Hello');

    // Test text node arg.
    el = createDom(
        TagName.DIV, null, createTextNode('World'));
    expect((el.firstChild as Element).nodeType).toBe(NodeType.TEXT);
    expect((el.firstChild as Element).nodeValue).toBe('World');
});

test("CreateDomNodeListArg", () => {
    let el: Element;
    let emptyElem = createDom(TagName.DIV);
    let simpleElem =
        createDom(TagName.DIV, null, 'Hello, world!');
    let complexElem = createDom(
        TagName.DIV, null, 'Hello, ',
        createDom(TagName.B, null, 'world'),
        createTextNode('!'));

    // Test empty node list.
    el = createDom(TagName.DIV, null, emptyElem.childNodes);
    expect(emptyElem.firstChild).toBeNull();
    expect(el.firstChild).toBeNull();

    // Test simple node list.
    el = createDom(TagName.DIV, null, simpleElem.childNodes);
    expect(simpleElem.firstChild).toBeNull();
    expect(el.firstChild?.nodeValue).toBe('Hello, world!');

    // Test complex node list.
    el = createDom(TagName.DIV, null, complexElem.childNodes);
    expect(complexElem.firstChild).toBeNull();
    expect(el.childNodes.length).toBe(3);
    expect(el.childNodes[0].nodeValue).toBe('Hello, ');
    expect((el.childNodes[1] as Element).tagName).toBe(TagName.B);
    expect(el.childNodes[2].nodeValue).toBe('!');
});

test("CreateDomWithTypeAttribute", () => {
    let el = createDom(
        TagName.BUTTON,
        {'type': InputType.RESET, 'id': 'cool-button'}, 'Cool button');
    expect(el).not.toBeNull();
    expect((el as HTMLButtonElement).type as InputType.RESET);
    expect(el.id).toBe('cool-button');
});

test("CreateDomWithClassList", () => {
    let el = createDom(TagName.DIV, ['foo', 'bar']);
    expect(el.className).toBe('foo bar');
});

test("Contains", () => {
    expect(contains(document.documentElement, document.body)).toBe(true);
    expect(contains(document, document.body)).toBe(true);

    let d = createDom(TagName.P, null, 'A paragraph');
    let t = d.firstChild;
    expect(contains(d, d)).toBe(true);
    expect(contains(t, t)).toBe(true);
    expect(contains(d, t)).toBe(true);
    expect(contains(t, d)).toBe(false);
    expect(contains(document, d)).toBe(false);
    appendChild(document.body, d);
    expect(contains(document, d)).toBe(true);
    removeNode(d);
});

test("CreateDomWithClassName", () => {
    let el = createDom(TagName.DIV, 'cls');
    expect(el.firstChild).toBeNull();
    expect(el.tagName).toBe(TagName.DIV);
    expect(el.className).toBe('cls');

    el = createDom(TagName.DIV, '');
    expect(el.className).toBe('');
});

test("CompareNodeOrder", () => {
    let b1 = getElement('b1') as Element;
    let b2 = getElement('b2') as Element;
    let p2 = getElement('p2') as Element;

    expect(compareNodeOrder(b1, b1)).toBe(0);

    expect(compareNodeOrder(p2, b1)).toBeLessThan(0);
    expect(compareNodeOrder(b1, p2)).toBeGreaterThan(0);

    expect(compareNodeOrder(b1, b1.firstChild as Node)).toBeLessThan(0);
    expect(compareNodeOrder(b1.firstChild as Node, b1)).toBeGreaterThan(0);

    expect(compareNodeOrder(b1, b2)).toBeLessThan(0);
    expect(compareNodeOrder(b2, b1)).toBeGreaterThan(0);

    expect(compareNodeOrder(b1.nextSibling as Node, b1)).toBeGreaterThan(0);
    expect(compareNodeOrder(b1, b1.nextSibling as Node)).toBeLessThan(0);

    expect(compareNodeOrder(b1.firstChild as Node, b2)).toBeLessThan(0);
    expect(compareNodeOrder(b2, b1.firstChild as Node)).toBeGreaterThan(0);

    expect(compareNodeOrder(b1.nextSibling as Node, b1.firstChild as Node)).toBeGreaterThan(0);
    expect(compareNodeOrder(b1.firstChild as Node, b1.nextSibling as Node)).toBeLessThan(0);

    expect(compareNodeOrder(b1.previousSibling as Node, b1.nextSibling as Node)).toBeLessThan(0);
    expect(compareNodeOrder(b1.nextSibling as Node, b1.previousSibling as Node)).toBeGreaterThan(0);

    expect(compareNodeOrder(b1.firstChild as Node, b1.parentNode as Node)).toBeGreaterThan(0);
    expect(compareNodeOrder(b1.parentNode as Node, b1.firstChild as Node)).toBeLessThan(0);

    expect(compareNodeOrder(b1.firstChild as Node, b1.parentNode as Node)).toBeGreaterThan(0);
    expect(compareNodeOrder(b1.parentNode as Node, b1.firstChild as Node)).toBeLessThan(0);

    expect(compareNodeOrder(b1.firstChild as Node, b2.firstChild as Node)).toBeLessThan(0);
    expect(compareNodeOrder(b2.firstChild as Node, b1.firstChild as Node)).toBeGreaterThan(0);

    expect(compareNodeOrder(getElement('testEl2') as Element, getElement('testEl') as Element)).toBeGreaterThan(0);
    expect(compareNodeOrder(getElement('testEl') as Element, getElement('testEl2') as Element)).toBeLessThan(0);

    let p = getElement('order-test') as Element;
    let text1 = document.createTextNode('1');
    p.appendChild(text1);
    let text2 = document.createTextNode('1');
    p.appendChild(text2);

    expect(compareNodeOrder(text1, text1)).toBe(0);
    expect(compareNodeOrder(text1, text2)).toBeLessThan(0);
    expect(compareNodeOrder(text2, text1)).toBeGreaterThan(0);
    expect(compareNodeOrder(text1, getElement('b1') as Element)).toBeGreaterThan(0);
    expect(compareNodeOrder(document, b1)).toBeLessThan(0);
    expect(compareNodeOrder(b1, document)).toBeGreaterThan(0);
});

test("FindCommonAncestor", () => {
    let b1 = getElement('b1') as Element;
    let b2 = getElement('b2') as Element;
    let p1 = getElement('p1') as Element;
    let p2 = getElement('p2') as Element;
    let testEl2 = getElement('testEl2') as Element;

    expect(findCommonAncestor()).toBeNull();
    expect(findCommonAncestor(b1)).toBe(b1);
    expect(findCommonAncestor(b1, b1)).toBe(b1);
    expect(findCommonAncestor(b1, b2)).toBe(p2);
    expect(findCommonAncestor(p1, b2)).toBe(document.body);
    expect(findCommonAncestor(testEl2, b1, b2, p1, p2)).toBe(document.body);

    let outOfDoc = document.createElement(TagName.DIV);
    expect(findCommonAncestor(outOfDoc, b1)).toBeNull();
});

test("RemoveNode", () => {
    let b = document.createElement(TagName.B);
    let el = getRequiredElement('p1');
    el.appendChild(b);
    removeNode(b);
    expect(el.lastChild != b).toBe(true);
});

test("ReplaceNode", () => {
    let n = getRequiredElement('toReplace');
    let previousSibling = n.previousSibling as Element;
    let goodNode =
        createDom(TagName.DIV, {'id': 'goodReplaceNode'});
    replaceNode(goodNode, n);

    expect(goodNode).toBe(previousSibling.nextSibling);
    expect(getElement('toReplace')).toBeNull();

    let badNode =
        createDom(TagName.DIV, {'id': 'badReplaceNode'});
    replaceNode(badNode, n);
    expect(getElement('badReplaceNode')).toBeNull();
});

test("AppendChildAt", () => {
    let parent = getElement('p2') as Element;
    let origNumChildren = parent.childNodes.length;

    let child1 = document.createElement(TagName.DIV);
    insertChildAt(parent, child1, origNumChildren);
    expect(parent.childNodes.length).toBe(origNumChildren + 1);

    let child2 = document.createElement(TagName.DIV);
    insertChildAt(parent, child2, origNumChildren + 42);
    expect(parent.childNodes.length).toBe(origNumChildren + 2);

    let child3 = document.createElement(TagName.DIV);
    insertChildAt(parent, child3, 0);
    expect(parent.childNodes.length).toBe(origNumChildren + 3);

    let child4 = document.createElement(TagName.DIV);
    insertChildAt(parent, child3, 2);
    expect(parent.childNodes.length).toBe(origNumChildren + 3);

    parent.removeChild(child1);
    parent.removeChild(child2);
    parent.removeChild(child3);

    let emptyParentNotInDocument = document.createElement(TagName.DIV);
    insertChildAt(emptyParentNotInDocument, child1, 0);
    expect(emptyParentNotInDocument.childNodes.length).toBe(1);
});

test("IsNodeLike", () => {
    expect(isNodeLike(document)).toBe(true);
    expect(isNodeLike(document.body)).toBe(true);
    expect(isNodeLike(document.createTextNode(''))).toBe(true);

    expect(isNodeLike(null)).toBe(false);
    expect(isNodeLike('abcd')).toBe(false);

    expect(isNodeLike({nodeType: 1})).toBe(true);
});

test("IsElement", () => {
    expect(isElement(document)).toBe(false);
    expect(isElement(document.body)).toBe(true);
    expect(isElement(document.createTextNode(''))).toBe(false);
    expect(isElement(document.createElement(TagName.A))).toBe(true);

    expect(isElement(null)).toBe(false);
    expect(isElement('abcd')).toBe(false);

    expect(isElement({nodeType: 1})).toBe(true);
    expect(isElement({someProperty: 'somevalue'})).toBe(false);
});

test("IsWindow", () => {

    let frame = window.frames['frame' as any];
    let otherWindow = window.open('', 'blank');
    let nullVar = null;
    let notDefined = undefined;

    try {
        // Use try/finally to ensure that we clean up the window we open, even if an
        // assertion fails or something else goes wrong.
        expect(isWindow(frame)).toBe(true);
        if (otherWindow) {
            expect(isWindow(otherWindow)).toBe(true);
        }
        expect(isWindow(nullVar)).toBe(false);
        expect(isWindow(notDefined)).toBe(false);
    } finally {
        if (otherWindow) {
            otherWindow.close();
        }
    }
});

test("GetOwnerDocument", () => {
    expect(document).toBe(getOwnerDocument(getElement('p1') as Element));
    expect(document).toBe(getOwnerDocument(document.body));
    expect(document).toBe(getOwnerDocument(document.documentElement));
});

// Tests the breakages resulting in rollback cl/64715474
test("GetOwnerDocumentNonNodeInput", () => {
    // We should fail on null.
    expect(getOwnerDocument(window)).toBe(document);
});

test("GetFirstElementChild", () => {
    let p2 = getElement('p2') as Element;
    let b1 = getFirstElementChild(p2) as Element;
    expect(b1).not.toBeNull();
    expect(b1.id).toBe('b1');

    let c = getFirstElementChild(b1);
    expect(c).toBeNull();

    // Test with an undefined firstElementChild attribute.
    let b2 = getElement('b2');
    let mockP2 = {
        childNodes: [b1, b2],
        firstChild: b1,
        firstElementChild: undefined
    };

    b1 = getFirstElementChild(mockP2 as any) as Element;
    expect(b1).not.toBeNull();
    expect(b1.id).toBe('b1');
});

test("GetLastElementChild", () => {
    let p2 = getElement('p2') as Element;
    let b2 = getLastElementChild(p2) as Element;
    expect(b2).not.toBeNull();
    expect(b2.id).toBe('b2');

    let c = getLastElementChild(b2);
    expect(c).toBeNull();

    // Test with an undefined lastElementChild attribute.
    let b1 = getElement('b1') as Element;
    let mockP2 = {
        childNodes: [b1, b2],
        lastChild: b2,
        lastElementChild: undefined
    };

    b2 = getLastElementChild(mockP2 as any) as Element;
    expect(b2).not.toBeNull();
    expect(b2.id).toBe('b2');
});

test("GetNextElementSibling", () => {
    let b1 = getElement('b1') as Element;
    let b2 = getNextElementSibling(b1) as Element;
    expect(b1).not.toBeNull();
    expect(b2.id).toBe('b2');

    let c = getNextElementSibling(b2) as Element;
    expect(c).toBeNull();

    // Test with an undefined nextElementSibling attribute.
    let mockB1 = {nextSibling: b2, nextElementSibling: undefined};

    b2 = getNextElementSibling(mockB1 as unknown as Node) as Element;
    expect(b1).not.toBeNull();
    expect(b2.id).toBe('b2');
});

test("GetPreviousElementSibling", () => {
    let b2 = getElement('b2') as Element;
    let b1 = getPreviousElementSibling(b2) as Element;
    expect(b1).not.toBeNull();
    expect(b1.id).toBe('b1');

    let c = getPreviousElementSibling(b1);
    expect(c).toBeNull();

    // Test with an undefined previousElementSibling attribute.
    let mockB2 = {previousSibling: b1, previousElementSibling: undefined};

    b1 = getPreviousElementSibling(mockB2 as unknown as Element) as Element;
    expect(b1).not.toBeNull();
    expect(b1.id).toBe('b1');
});

test("GetChildren", () => {
    let p2 = getElement('p2') as Element;
    let children = getChildren(p2);
    expect(children).not.toBeNull();
    expect(children.length).toBe(2);

    let b1 = getRequiredElement('b1');
    let b2 = getRequiredElement('b2');
    expect(children[0]).toEqual(b1);
    expect(children[1]).toEqual(b2);

    let noChildren = getChildren(b1);
    expect(noChildren).not.toBeNull();
    expect(noChildren.length).toBe(0);

    // Test with an undefined children attribute.
    let mockP2 = {childNodes: [b1, b2], children: undefined};

    children = getChildren(mockP2 as unknown as Element);
    expect(children).not.toBeNull();
    expect(children.length).toBe(2);

    expect(children[0]).toEqual(b1);
    expect(children[1]).toEqual(b2);

});
test("GetNextNode", () => {
    let tree = document.createElement("div");
    tree.innerHTML = '<p>Some text</p>' +
        '<blockquote>Some <i>special</i> <b>text</b></blockquote>' +
        '<address><!-- comment -->Foo</address>'

    expect(getNextNode(null)).toBeNull();

    let node: Node | null = tree;
    let next = function () {
        return node = getNextNode(node);
    };

    expect((next() as Element).tagName).toBe(TagName.P);
    expect(next()?.nodeValue).toBe('Some text');
    expect((next() as Element).tagName).toBe(TagName.BLOCKQUOTE);
    expect(next()?.nodeValue).toBe('Some ');
    expect((next() as Element).tagName).toBe(TagName.I);
    expect(next()?.nodeValue).toBe('special');
    expect(next()?.nodeValue).toBe(' ');
    expect((next() as Element).tagName).toBe(TagName.B);
    expect(next()?.nodeValue).toBe('text');
    expect((next() as Element).tagName).toBe(TagName.ADDRESS);
    expect(next()?.nodeType).toBe(NodeType.COMMENT);
    expect(next()?.nodeValue).toBe('Foo');

    expect(next()).toBeNull();
});

test("GetPreviousNode", () => {
    let tree = createTestDom(
        '<p>Some text</p>' +
        '<blockquote>Some <i>special</i> <b>text</b></blockquote>' +
        '<address><!-- comment -->Foo</address>');

    expect(getPreviousNode(null)).toBeNull();

    let node = ((tree.lastChild as Element).lastChild) as Node | null;
    let previous = function () {
        return node = getPreviousNode(node);
    };

    expect((previous() as Node).nodeType).toBe(NodeType.COMMENT);
    expect((previous() as Element).tagName).toBe(TagName.ADDRESS);
    expect((previous() as Comment).nodeValue).toBe('text');
    expect((previous() as Element).tagName).toBe(TagName.B);
    expect((previous() as Node).nodeValue).toBe(' ');
    expect((previous() as Node).nodeValue).toBe('special');
    expect((previous() as Element).tagName).toBe(TagName.I);
    expect((previous() as Node).nodeValue).toBe('Some ');
    expect((previous() as Element).tagName).toBe(TagName.BLOCKQUOTE);
    expect((previous() as Node).nodeValue).toBe('Some text');
    expect((previous() as Element).tagName).toBe(TagName.P);
    expect((previous() as Element).tagName).toBe(TagName.DIV);

    if (!userAgent.IE) {
        // Internet Explorer maintains a parentNode for Elements after they are
        // removed from the hierarchy. Everyone else agrees on a null parentNode.
        expect(previous()).toBeNull();
    }
});

test("SetTextContent", () => {
    let p1 = getRequiredElement('p1');
    let s = 'hello world';
    setTextContent(p1, s);
    expect(p1.childNodes.length).toBe(1);
    expect((p1.firstChild as any).data).toBe(s);
    expect(p1.innerHTML).toBe(s);

    s = 'four elefants < five ants';
    let sHtml = 'four elefants &lt; five ants';
    setTextContent(p1, s);
    expect(p1.childNodes.length).toBe(1);
    expect((p1.firstChild as any).data).toBe(s);
    expect(p1.innerHTML).toBe(sHtml);

    // ensure that we remove existing children
    p1.innerHTML = 'a<b>b</b>c';
    s = 'hello world';
    setTextContent(p1, s);
    expect(p1.childNodes.length).toBe(1);
    expect((p1.firstChild as any).data).toBe(s);

    // same but start with an element
    p1.innerHTML = '<b>a</b>b<i>c</i>';
    s = 'hello world';
    setTextContent(p1, s);
    expect(p1.childNodes.length).toBe(1);
    expect((p1.firstChild as any).data).toBe(s);

    // Text/CharacterData
    setTextContent(p1, 'before');
    s = 'after';
    setTextContent(p1.firstChild as Element, s);
    expect(p1.childNodes.length).toBe(1);
    expect((p1.firstChild as any).data).toBe(s);

    // DocumentFragment
    let df = document.createDocumentFragment();
    s = 'hello world';
    setTextContent(df, s);
    expect(df.childNodes.length).toBe(1);
    expect((df.firstChild as any).data).toBe(s);

    // clean up
    removeChildren(p1);
});

test("FindNode", () => {
    let expected: Element = document.body;
    let result = findNode(document, function (n: Node): boolean {
        return n.nodeType == NodeType.ELEMENT &&
            (n as Element).tagName == TagName.BODY;
    });
    expect(result).toBe(expected);

    expected = document.getElementsByTagName(TagName.P)[0];
    result = findNode(document, function (n) {
        return n.nodeType == NodeType.ELEMENT &&
            (n as Element).tagName == TagName.P;
    });
    expect(result).toBe(expected);

    result = findNode(document, function (n) {
        return false;
    });
    expect(result).toBeUndefined();
});

test("FindNodes", () => {
    let expected = document.getElementsByTagName(TagName.P);
    let result = findNodes(document, function (n: Node) {
        return n.nodeType == NodeType.ELEMENT &&
            (n as Element).tagName == TagName.P;
    });
    expect(result.length).toBe(expected.length);
    expect(result[0]).toBe(expected[0]);
    expect(result[1]).toBe(expected[1]);

    expect(findNodes(document, function (n) {
        return false;
    }).length).toBe(0);
});

function createTestDom(txt: string) {
    let dom = createDom(TagName.DIV);
    dom.innerHTML = txt;
    return dom;
}

test("IsFocusableTabIndex", () => {
    expect(isFocusableTabIndex(getElement('noTabIndex') as Element)).toBe(false);
    expect(isFocusableTabIndex(getElement('tabIndexNegative2') as Element)).toBe(false);
    expect(isFocusableTabIndex(getElement('tabIndexNegative1') as Element)).toBe(false);

    // WebKit on Mac doesn't support focusable DIVs until version 526 and later.
    if (!userAgent.WEBKIT || !userAgent.MAC ||
        userAgent.isVersionOrHigher('526')) {
        expect(isFocusableTabIndex(getElement('tabIndex0') as Element)).toBe(true);
        expect(isFocusableTabIndex(getElement('tabIndex1') as Element)).toBe(true);
        expect(isFocusableTabIndex(getElement('tabIndex2') as Element)).toBe(true);
    }
});

test("SetFocusableTabIndex", () => {
    // WebKit on Mac doesn't support focusable DIVs until version 526 and later.
    if (!userAgent.WEBKIT || !userAgent.MAC ||
        userAgent.isVersionOrHigher('526')) {
        // Test enabling focusable tab index.
        setFocusableTabIndex(getElement('noTabIndex') as Element, true);
        expect(isFocusableTabIndex(getElement('noTabIndex') as Element)).toBe(true);

        // Test disabling focusable tab index that was added programmatically.
        setFocusableTabIndex(getElement('noTabIndex') as Element, false);
        expect(isFocusableTabIndex(getElement('noTabIndex') as Element)).toBe(false);

        // Test disabling focusable tab index that was specified in markup.
        setFocusableTabIndex(getElement('tabIndex0') as Element, false);
        expect(isFocusableTabIndex(getElement('tabIndex0') as Element)).toBe(false);

        // Test re-enabling focusable tab index.
        setFocusableTabIndex(getRequiredElement('tabIndex0'), true);
        expect(isFocusableTabIndex(getElement('tabIndex0') as Element)).toBe(true);
    }
});

test("IsFocusable", () => {
    // Test all types of form elements with no tab index specified are focusable.
    expect(isFocusable(getElement('noTabIndexAnchor') as Element)).toBe(true);
    expect(isFocusable(getElement('noTabIndexInput') as Element)).toBe(true);
    expect(isFocusable(getElement('noTabIndexTextArea') as Element)).toBe(true);
    expect(isFocusable(getElement('noTabIndexSelect') as Element)).toBe(true);
    expect(isFocusable(getElement('noTabIndexButton') as Element)).toBe(true);

    // Test form element with negative tab index is not focusable.
    expect(isFocusable(getElement('negTabIndexButton') as Element)).toBe(false);

    // Test form element with zero tab index is focusable.
    expect(isFocusable(getElement('zeroTabIndexButton') as Element)).toBe(true);

    // Test form element with positive tab index is focusable.
    expect(isFocusable(getElement('posTabIndexButton') as Element)).toBe(true);

    // Test disabled form element with no tab index is not focusable.
    expect(isFocusable(getElement('disabledNoTabIndexButton') as Element)).toBe(false);

    // Test disabled form element with negative tab index is not focusable.
    expect(isFocusable(getElement('disabledNegTabIndexButton') as Element)).toBe(false);

    // Test disabled form element with zero tab index is not focusable.
    expect(isFocusable(getElement('disabledZeroTabIndexButton') as Element)).toBeFalsy();

    // Test disabled form element with positive tab index is not focusable.
    expect(isFocusable(getElement('disabledPosTabIndexButton') as Element)).toBe(false);

    // Test non-form types should return same value as isFocusableTabIndex()
    expect(isFocusableTabIndex(getElement('noTabIndex') as Element)).toBe(
        isFocusable(getElement('noTabIndex') as Element));
    expect(isFocusableTabIndex(getElement('tabIndexNegative2') as Element)).toBe(isFocusable(getElement('tabIndexNegative2') as Element));
    expect(isFocusableTabIndex(getElement('tabIndexNegative1') as Element))
        .toBe(isFocusable(getElement('tabIndexNegative1') as Element));

    // Make sure IE doesn't throw for detached elements. IE can't measure detached
    // elements, and calling getBoundingClientRect() will throw Unspecified Error.
    isFocusable(createDom('button'));
});

test("GetTextContent", () => {
    function t(inp: string, out: string) {
        expect(getTextContent(createTestDom(inp)).replace(/ /g, '_'))
            .toBe(out.replace(/ /g, '_'));
    }

    t('abcde', 'abcde');
    t('a<b>bcd</b>efgh', 'abcdefgh');
    t('a<script type="text/javascript">let a=1;</script>h',
        'ah');
    t('<html><head><style type="text/css">p{margin:100%;padding:5px}\n.class{background-color:red;}</style></head><body><h1>Hello</h1>\n<p>One two three</p>\n<table><tr><td>a<td>b</table><script>let a = \'foo\';</script></body></html>',
        'HelloOne two threeab');
    t('abc<br>def', 'abc\ndef');
    t('abc<br>\ndef', 'abc\ndef');
    t('abc<br>\n\ndef', 'abc\ndef');
    t('abc<br><br>\ndef', 'abc\n\ndef');
    t(' <b>abcde  </b>   ', 'abcde ');
    t(' <b>abcde    </b> hi  ', 'abcde hi ');
    t(' \n<b>abcde  </b>   ', 'abcde ');
    t(' \n<b>abcde  </b>   \n\n\n', 'abcde ');
    t('<p>abcde</p>\nfg', 'abcdefg');
    t('\n <div>  <b>abcde  </b>   ', 'abcde ');
    t(' \n&shy;<b>abcde &shy; </b>   \n\n\n&shy;', 'abcde ');
    t(' \n&shy;\n\n&shy;\na   ', 'a ');
    t(' \n<wbr></wbr><b>abcde <wbr/> </b>   \n\n\n<wbr></wbr>', 'abcde ');
    t('a&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;b',
        userAgent.CAN_USE_INNER_TEXT ? 'a     b' :
            'a\xA0\xA0\xA0\xA0\xA0b');
});

test("GetNodeTextLength", () => {
    expect(getNodeTextLength(createTestDom('abcdef'))).toBe(6);
    expect(getNodeTextLength(createTestDom('a<b>bcd</b>efgh'))).toBe(8);
    expect(getNodeTextLength(
        createTestDom(
            'a<script type="text/javascript">let a = 1234;</script>h'))).toBe(2);
    expect(getNodeTextLength(
        createTestDom('a<br>\n<!-- some comments -->\nfo'))).toBe(4)
    expect(getNodeTextLength(
        createTestDom(
            '<html><head><style type="text/css">' +
            'p{margin:100%;padding:5px}\n.class{background-color:red;}</style>' +
            '</head><body><h1>Hello</h1><p>One two three</p><table><tr><td>a<td>b' +
            '</table><' +
            'script>let a = \'foo\';</scrip' +
            't></body></html>'))).toBe(20);
    expect(getNodeTextLength(createTestDom('a<b>bcd</b><br />efghi'))).toBe(10);
});

test("GetNodeTextOffset", () => {
    expect(getNodeTextOffset(getRequiredElement('offsetTest1'), getRequiredElement('offsetParent1'))).toBe(4);
    expect(getNodeTextOffset(getRequiredElement('offsetTest1'))).toBe(12);
});

test("GetNodeAtOffset", () => {
    let html = '<div id=a>123<b id=b>45</b><span id=c>67<b id=d>89<i id=e>01' +
        '</i>23<i id=f>45</i>67</b>890<i id=g>123</i><b id=h>456</b>' +
        '</span></div><div id=i>7890<i id=j>123</i></div>';
    let node = document.createElement(TagName.DIV);
    node.innerHTML = html;
    let rv: StructType = {};

    getNodeAtOffset(node, 2, rv);
    expect(rv.node.nodeValue).toBe('123');
    expect(rv.node.parentNode.id).toBe('a');
    expect(rv.remainder).toBe(1);

    getNodeAtOffset(node, 3, rv);
    expect(rv.node.nodeValue).toBe('123');
    expect(rv.node.parentNode.id).toBe('a');
    expect(rv.remainder).toBe(2);

    getNodeAtOffset(node, 5, rv);
    expect(rv.node.nodeValue).toBe('45');
    expect(rv.node.parentNode.id).toBe('b');
    expect(rv.remainder).toBe(1);

    getNodeAtOffset(node, 6, rv);
    expect(rv.node.nodeValue).toBe('67');
    expect(rv.node.parentNode.id).toBe('c');
    expect(rv.remainder).toBe(0);

    getNodeAtOffset(node, 23, rv);
    expect(rv.node.nodeValue).toBe('123');
    expect(rv.node.parentNode.id).toBe('g');
    expect(rv.remainder).toBe(2);

    getNodeAtOffset(node, 30, rv);
    expect(rv.node.nodeValue).toBe('7890');
    expect(rv.node.parentNode.id).toBe('i');
    expect(rv.remainder).toBe(3);
});

// IE inserts line breaks and capitalizes nodenames.
function assertEqualsCaseAndLeadingWhitespaceInsensitive(value1: string, value2: string) {
    value1 = value1.replace(/^\s+|\s+$/g, '').toLowerCase();
    value2 = value2.replace(/^\s+|\s+$/g, '').toLowerCase();
    expect(value2).toBe(value1);
}

test("GetOuterHtml", () => {
    let contents = '<b>foo</b>';
    let node = document.createElement(TagName.DIV);
    node.setAttribute('foo', 'bar');
    node.innerHTML = contents;
    assertEqualsCaseAndLeadingWhitespaceInsensitive(
        getOuterHtml(node), '<div foo="bar">' + contents + '</div>');

    let imgNode = document.createElement(TagName.IMG);
    imgNode.setAttribute('foo', 'bar');
    assertEqualsCaseAndLeadingWhitespaceInsensitive(
        getOuterHtml(imgNode), '<img foo="bar">');
});

test("GetWindowFrame", () => {
    let frameWindow = window.frames['frame' as any];
    let frameDocument = frameWindow.document;
    let frameDomHelper = new DomHelper(frameDocument);

    // Cannot use assertEquals since IE fails on ===
    expect(frameWindow == frameDomHelper.getWindow()).toBe(true);
});

test("GetWindow", () => {
    let domHelper = new DomHelper();
    // Cannot use assertEquals since IE fails on ===
    expect(window == domHelper.getWindow()).toBe(true);
});

test("GetWindowStatic", () => {
    // Cannot use assertEquals since IE fails on ===
    expect(window == getWindow()).toBe(true);
});

test("IsNodeList", () => {
    let elem = document.getElementById('p2') as Element;
    let text = document.getElementById('b2')?.firstChild as Node;

    expect(isNodeList(elem.childNodes)).toBe(true);
    expect(isNodeList(text)).toBe(false);
    expect(isNodeList([elem.firstChild, elem.lastChild])).toBe(false);
});

test("GetFrameContentDocument", () => {
    let iframe = document.getElementsByTagName(TagName.IFRAME)[0] as HTMLIFrameElement;
    let name = iframe.name;
    let iframeDoc = getFrameContentDocument(iframe);
    expect(iframeDoc).toBe(window.frames[name as any].document);
});

test("GetFrameContentWindow", () => {
    let iframe = document.getElementsByTagName(TagName.IFRAME)[0] as HTMLIFrameElement;
    let name = iframe.name;
    let iframeWin = getFrameContentWindow(iframe);
    expect(iframeWin).toBe(window.frames[name as any]);
});

test("GetFrameContentWindowNotInitialized", () => {
    let iframe = createDom(TagName.IFRAME);
    expect(getFrameContentWindow(iframe)).toBeNull();
});

test("CanHaveChildren", () => {
    let EMPTY_ELEMENTS = new Set<string>(
        [TagName.APPLET, TagName.AREA, TagName.BASE,
            TagName.BR, TagName.COL, TagName.COMMAND,
            TagName.EMBED, TagName.FRAME, TagName.HR,
            TagName.IMG, TagName.INPUT, TagName.IFRAME,
            TagName.ISINDEX, TagName.KEYGEN, TagName.LINK,
            TagName.NOFRAMES, TagName.NOSCRIPT,
            TagName.META, TagName.OBJECT, TagName.PARAM,
            TagName.SCRIPT, TagName.SOURCE, TagName.STYLE,
            TagName.TRACK, TagName.WBR]);

    // IE opens a dialog warning about using Java content if an EMBED is created.
    let IE_ILLEGAL_ELEMENTS = new Set<string>([TagName.EMBED]);

    for (let tag in TagName) {
        if (userAgent.IE && IE_ILLEGAL_ELEMENTS.has(tag)) {
            continue;
        }

        let expected = !EMPTY_ELEMENTS.has(tag);
        let node = createElement(tag);
        expect(canHaveChildren(node)).toBe(expected);

        // Make sure we can _actually_ add a child if we identify the node as
        // allowing children.
        if (canHaveChildren(node)) {
            node.appendChild(createDom(TagName.DIV, null, 'foo'));
        }
    }
});

test("GetAncestorNoMatch", () => {
    let elem = getElement('nestedElement') as Element;
    expect(getAncestor(elem, function () {
        return false;
    })).toBeNull();
});

test("GetAncestorMatchSelf", () => {
    let elem = getElement('nestedElement') as Element;
    let matched = getAncestor(elem, function () {
        return true;
    }, true);
    expect(matched).toBe(elem);
});

test("GetAncestorNoMatchSelf", () => {
    let elem = getElement('nestedElement') as Element;
    let matched = getAncestor(elem, function () {
        return true;
    });
    expect(matched).toBe(elem.parentNode);
});

test("GetAncestorWithMaxSearchStepsMatchSelf", () => {
    let elem = getElement('nestedElement') as Element;
    let matched =
        getAncestor(elem, function () {
            return true;
        }, true, 2);
    expect(matched).toBe(elem);
});

test("GetAncestorWithMaxSearchStepsMatch", () => {
    let elem = getElement('nestedElement') as Element;
    let searchEl = elem.parentNode?.parentNode;
    let matched = getAncestor(
        elem, (el: Node) => {
            return el == searchEl;
        }, false, 1);
    expect(matched).toBe(searchEl);
});

test("GetAncestorWithMaxSearchStepsNoMatch", () => {
    let elem = getElement('nestedElement') as Element;
    let searchEl = elem.parentNode?.parentNode;
    let matched = getAncestor(
        elem, (el: Node) => {
            return el == searchEl;
        }, false, 0);
    expect(matched).toBeNull();
});

test("GetAncestorByTagWithMaxSearchStepsNoMatch", () => {
    let elem = getElement('nestedElement') as Element;
    let searchEl = elem.parentNode?.parentNode;
    let matched = getAncestorByTagNameAndClass(
        elem, TagName.DIV, /* class */ undefined, 0);
    expect(matched).toBeNull();
});

test("GetAncestorByTagNameNoMatch", () => {
    let elem = getRequiredElement('nestedElement');
    expect(getAncestorByTagNameAndClass(elem, TagName.IMG)).toBeNull();
});

test("GetAncestorByTagNameOnly", () => {
    let elem = getRequiredElement('nestedElement');
    let expected = getRequiredElement('testAncestorDiv');
    expect(
        getAncestorByTagNameAndClass(elem, TagName.DIV)).toBe(expected);
    expect(getAncestorByTagNameAndClass(elem, 'div')).toBe(expected);
});

test("GetAncestorByClassWithMaxSearchStepsNoMatch", () => {
    let elem = getElement('nestedElement') as Element;
    let searchEl = elem.parentNode?.parentNode;
    let matched = getAncestorByClass(elem, 'testAncestor', 0);
    expect(matched).toBeNull();
});

test("GetAncestorByClassNameNoMatch", () => {
    let elem = getElement('nestedElement') as Element;
    expect(getAncestorByClass(elem, 'bogusClassName')).toBeNull();
});

test("GetAncestorByClassName", () => {
    let elem = getElement('nestedElement') as Element;
    let expected = getRequiredElement('testAncestorP');
    expect(getAncestorByClass(elem, 'testAncestor')).toBe(expected);
});

test("GetAncestorByTagNameAndClass", () => {
    let elem = getElement('nestedElement') as Element;
    let expected = getRequiredElement('testAncestorDiv');
    expect(getAncestorByTagNameAndClass(elem, TagName.DIV, 'testAncestor')).toBe(expected);
    expect(getAncestorByTagNameAndClass(elem)).toBeNull();
});

test("CreateTable", () => {
    let table = createTable(2, 3, true);
    expect(table.getElementsByTagName(TagName.TR).length).toBe(2);
    expect(table.getElementsByTagName(TagName.TR)[0].childNodes.length).toBe(3);
    expect(table.getElementsByTagName(TagName.TD).length).toBe(6);
    expect((table.getElementsByTagName(TagName.TD)[0].firstChild as Node).nodeValue).toBe(Unicode.NBSP);

    table = createTable(2, 3, false);
    expect(table.getElementsByTagName(TagName.TR).length).toBe(2);
    expect(table.getElementsByTagName(TagName.TR)[0].childNodes.length).toBe(3);
    expect(table.getElementsByTagName(TagName.TD).length).toBe(6);
    expect(table.getElementsByTagName(TagName.TD)[0].childNodes.length).toBe(0);
});

test("Append", () => {
    let div = document.createElement(TagName.DIV);
    let b = document.createElement(TagName.B);
    let c = document.createTextNode('c');
    append(div, 'a', b, c);
    assertEqualsCaseAndLeadingWhitespaceInsensitive('a<b></b>c', div.innerHTML);
});

test("Append2", () => {
    let myIframeDoc = getMyFrameDoc();
    let div = myIframeDoc.createElement(TagName.DIV);
    let b = myIframeDoc.createElement(TagName.B);
    let c = myIframeDoc.createTextNode('c');
    append(div, 'a', b, c);
    assertEqualsCaseAndLeadingWhitespaceInsensitive('a<b></b>c', div.innerHTML);
});

test("Append3", () => {
    let div = document.createElement(TagName.DIV);
    let b = document.createElement(TagName.B);
    let c = document.createTextNode('c');
    append(div, ['a', b, c]);
    assertEqualsCaseAndLeadingWhitespaceInsensitive('a<b></b>c', div.innerHTML);
});

test("Append4", () => {
    let div = document.createElement(TagName.DIV);
    let div2 = document.createElement(TagName.DIV);
    div2.innerHTML = 'a<b></b>c';
    append(div, div2.childNodes);
    assertEqualsCaseAndLeadingWhitespaceInsensitive('a<b></b>c', div.innerHTML);
    expect(div2.hasChildNodes()).toBeFalsy();
});

test("GetDocumentScrollOfFixedViewport", () => {
    // iOS and perhaps other environments don't actually support scrolling.
    // Instead, you view the document's fixed layout through a screen viewport.
    // We need getDocumentScroll to handle this case though.
    // In case of IE10 though, we do want to use scrollLeft/scrollTop
    // because the rest of the positioning is done off the scrolled away origin.
    let fakeDocumentScrollElement = {scrollLeft: 0, scrollTop: 0};
    let fakeDocument = {
        defaultView: {pageXOffset: 100, pageYOffset: 100},
        documentElement: fakeDocumentScrollElement,
        body: fakeDocumentScrollElement
    };
    let dh = getDomHelper(document);
    dh.setDocument(fakeDocument as any);
    if (userAgent.IE && userAgent.isVersionOrHigher(10)) {
        expect(dh.getDocumentScroll().x).toBe(0);
        expect(dh.getDocumentScroll().y).toBe(0);
    } else {
        expect(dh.getDocumentScroll().x).toBe(100);
        expect(dh.getDocumentScroll().y).toBe(100);
    }
});

test("GetDocumentScrollFromDocumentWithoutABody", () => {
    // Some documents, like SVG docs, do not have a body element. The document
    // element should be used when computing the document scroll for these
    // documents.
    let fakeDocument = {
        defaultView: {pageXOffset: 0, pageYOffset: 0},
        documentElement: {scrollLeft: 0, scrollTop: 0}
    } as Document;

    let dh = new DomHelper(fakeDocument);
    expect(dh.getDocumentScrollElement()).toBe(fakeDocument.documentElement);
    expect(dh.getDocumentScroll().x).toBe(0);
    expect(dh.getDocumentScroll().y).toBe(0);
    // OK if this does not throw.
});

test("DefaultToScrollingElement", () => {
    let fakeDocument: any = {documentElement: {}, body: {}};
    let dh = new DomHelper(fakeDocument);

    // When scrollingElement isn't supported or is null (no element causes
    // scrolling), then behavior is UA-dependent for maximum compatibility.
    expect(dh.getDocumentScrollElement() == fakeDocument.body ||
        dh.getDocumentScrollElement() == fakeDocument.documentElement).toBe(true);
    fakeDocument.scrollingElement = null;
    expect(dh.getDocumentScrollElement() == fakeDocument.body ||
        dh.getDocumentScrollElement() == fakeDocument.documentElement).toBe(true);

    // But when scrollingElement is set, we use it directly.
    fakeDocument.scrollingElement = fakeDocument.documentElement;
    expect(dh.getDocumentScrollElement()).toBe(fakeDocument.documentElement);
    fakeDocument.scrollingElement = fakeDocument.body;
    expect(dh.getDocumentScrollElement()).toBe(fakeDocument.body);
});

test("ActiveElementIE", () => {
    if (!userAgent.IE) {
        return;
    }

    let link = getElement('link') as HTMLElement;
    link.focus();

    expect(getActiveElement(document)?.tagName).toBe(link?.tagName);
    expect(getActiveElement(document)).toBe(link);
});

test("ParentElement", () => {
    let testEl = getRequiredElement('testEl');
    let bodyEl = getParentElement(testEl) as Element;
    expect(bodyEl).not.toBeNull();
    let htmlEl = getParentElement(bodyEl) as Element;
    expect(htmlEl).not.toBeNull();
    let documentNotAnElement = getParentElement(htmlEl);
    expect(documentNotAnElement).toBeNull();

    let tree = createTestDom(
        '<p>Some text</p>' +
        '<blockquote>Some <i>special</i> <b>text</b></blockquote>' +
        '<address><!-- comment -->Foo</address>');
    expect(getParentElement(tree)).toBeNull();
    let pEl = getNextNode(tree) as Element;
    let fragmentRootEl = getParentElement(pEl);
    expect(fragmentRootEl).toBe(tree);

    let detachedEl = createDom(TagName.DIV);
    let detachedHasNoParent = getParentElement(detachedEl);
    expect(detachedHasNoParent).toBeNull();

    // svg is not supported in IE8 and below or in IE9 quirks mode
    let supported = !userAgent.IE ||
        userAgent.isDocumentModeOrHigher(10) ||
        (isCss1CompatMode() && userAgent.isDocumentModeOrHigher(9));
    if (!supported) {
        return;
    }

    let svg = getRequiredElement('testSvg');
    expect(svg).not.toBeNull();
    let rect = getRequiredElement('testRect');
    expect(rect).not.toBeNull();
    let g = getRequiredElement('testG');
    expect(g).not.toBeNull();

    if (userAgent.IE && userAgent.isVersionOrHigher('9')) {
        // test to make sure IE9 is returning undefined for .parentElement
        expect(g.parentElement).toBeUndefined();
        expect(rect.parentElement).toBeUndefined();
        expect(svg.parentElement).toBeUndefined();
    }
    let shouldBeG = getParentElement(rect);
    expect(shouldBeG).toBe(g);
    let shouldBeSvg = getParentElement(g);
    expect(shouldBeSvg).toBe(svg);
    let shouldBeBody = getParentElement(svg);
    expect(shouldBeBody).toBe(bodyEl);
});


test("DevicePixelRatio", () => {
    expect(1.5).toBe(getPixelRatio({
        matchMedia: function (query: any) {
            return {matches: query.indexOf('1.5') >= 0};
        }
    }));
    expect(2).toBe(getPixelRatio({devicePixelRatio: 2.0}));
    expect(1).toBe(getPixelRatio({}));
});
