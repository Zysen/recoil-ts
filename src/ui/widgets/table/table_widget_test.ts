import { BooleanColumn } from "./boolean_column.ts";
import { NumberColumn } from "./number_column.ts";
import {ColumnKey} from "../../../structs/table/columnkey.ts";
import {LabelType} from "./column.ts";
import {StructType} from "../../../frp/struct.ts";
import { StringColumn } from "./string_column.ts";
import { SelectColumn } from "./select_column.ts";
import { createDom } from "../../dom/dom.ts";
import { RenderedDecorator } from "../../decorator.ts";
import { TableCellHelper } from "../../../frp/table.ts";

const typeFactories = {
    "int": (columnKey:ColumnKey<number>, name: LabelType, meta:StructType)=> {
    return new NumberColumn(columnKey, name, meta);
}, "string": function (columnKey:ColumnKey<string>, name: LabelType, meta:StructType) {
    return new StringColumn(columnKey, name, meta);
}, "boolean": function (columnKey:ColumnKey<boolean>, name: LabelType, meta:StructType) {
    return new BooleanColumn(columnKey, name, meta);
}, "select": function (columnKey:ColumnKey<number>, name: LabelType, meta:StructType) {
    return new SelectColumn(columnKey, name, meta);
}};

var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall();
asyncTestCase.stepTimeout = 5000;
var shared = {};

function waitFor(test, start) {
    start = start || new Date().getTime();
    setTimeout(function () {
        if (test()) {
            asyncTestCase.continueTesting();
        }
        else {
            if (new Date().getTime() < start + asyncTestCase.stepTimeout) {
                waitFor(test);
            }
        }
    }, 10);
}

function testDecoratorAndWidgetChange01() {
    shared = {
        container : createDom('div', {id: 'foo'}),
        scope : new recoil.ui.WidgetScope()
    };
    var frp = shared.scope.getFrp();

    var tblKeys = {
        id : new recoil.structs.table.ColumnKey("id_"),
        value : new recoil.structs.table.ColumnKey("value_")
    };

    var rawTableMeta = {
        value : { type : "string", length : 20, key : tblKeys.value},
        id : { type : "int", primary : 0, key : tblKeys.id}
    };

   var rawTable = [];

    for (var i = 4; i >= 0; i--) {
	rawTable.push({id: i, value: "row " + i});
    }
    

    var columns = new recoil.ui.widgets.TableMetaData();
    columns.add(tblKeys.id, "ID");
    columns.add(tblKeys.value, "Value");
    

    shared.tableB = frp.createB(recoil.structs.table.Table.create(typeFactories, rawTableMeta, rawTable, true));
    var tableWidget = new recoil.ui.widgets.table.TableWidget(shared.scope);

    shared.tableB.refListen(function (b) {
        console.log("referenced", b);
        asyncTestCase.continueTesting();
    });
    tableWidget.getComponent().render(shared.container);
    tableWidget.attach(shared.tableB,columns);

    assertEquals(0,frp.tm().watching());
    document.body.appendChild(shared.container);
    asyncTestCase.waitForAsync('test show table');
    
}

function findTdColor(color, func, val) {
    return function () {
        var el = func(val ? val : 'row 4');
        if (el) {
            while (el) {
                if (el.nodeName === 'TD') {
                    return el.style.background === color || goog.string.startsWith(el.style.background,color);
                }
                el = goog.dom.getParentElement(el);
            }
            return false;
        }
        return false;
    };
}
function testDecoratorAndWidgetChange02() {
    var frp = shared.scope.getFrp();

    var decorator = function () {
        return new RenderedDecorator(
            decorator,
            createDom('td', {style:'background:red'}));
    };
    frp.accessTrans(function () {
        var mtable = shared.tableB.get().unfreeze();
        mtable.addMeta({cellDecorator : decorator});
        shared.tableB.set(mtable.freeze());
    },shared.tableB);
    waitFor(findTdColor('red', findInput));
    asyncTestCase.waitForAsync('test show table');
    
};

function testDecoratorAndWidgetChange03() {
    var frp = shared.scope.getFrp();
    // change both decorator and widget
    var decorator = function () {
        return new RenderedDecorator(
            decorator,
            createDom('td', {style:'background:green'}));
    };
    var widgetFactory = function (scope, cellB) {
        var widget = new recoil.ui.widgets.LabelWidget(scope);
        widget.attach(TableCellHelper.getValue(frp, cellB));
        return widget;
    };
    frp.accessTrans(function () {
        var mtable = shared.tableB.get().unfreeze();
        mtable.addMeta({cellDecorator : decorator});
        mtable.forEach(function (row, key) {
            row = row.unfreeze();
            mtable.forEachColumn(function (col) {
                row.addCellMeta(col,{cellWidgetFactory: widgetFactory});
            });
            mtable.setRow(key,row);
        });
        shared.tableB.set(mtable.freeze());
    },shared.tableB);
    waitFor(findTdColor('green', findVal));
    asyncTestCase.waitForAsync('test show table');
    
};

function testDecoratorAndWidgetChange04() {
    var frp = shared.scope.getFrp();
    // change just the widget

    var widgetFactory = function (scope, cellB) {
        var widget = new recoil.ui.widgets.LabelWidget(scope);
        widget.attach(TableCellHelper.getValue(frp, cellB));
        return widget;
    };
    frp.accessTrans(function () {
        var mtable = shared.tableB.get().unfreeze();
        mtable.forEach(function (row, key) {
            row = row.unfreeze();
            mtable.forEachColumn(function (col) {
                
                row.setCellMeta(col,{});
            });
            mtable.setRow(key,row);
        });
        shared.tableB.set(mtable.freeze());
    },shared.tableB);
    waitFor(findTdColor('green', findInput));
    asyncTestCase.waitForAsync('test show table');
    
}

function testDecoratorAndWidgetChange05() {
    var frp = shared.scope.getFrp();
    // change just the header widget

    var widgetFactory = function (scope, cellB) {
        var widget = new recoil.ui.widgets.LabelWidget(scope);
        widget.attach(frp.liftB(
            function (v) {
                return "x" + v.getMeta().name;
            },
             cellB));
        return widget;
    };
    frp.accessTrans(function () {
        var mtable = shared.tableB.get().unfreeze();
        mtable.addMeta({headerWidgetFactory: widgetFactory});
        shared.tableB.set(mtable.freeze());
    },shared.tableB);
    waitFor(function () {
        return findVal('xID');
    });
    asyncTestCase.waitForAsync('test show table');
    
};

function testDecoratorAndWidgetChange06() {
    var frp = shared.scope.getFrp();
    // change just the header widget and renderer

    var widgetFactory = function (scope, cellB) {
        var widget = new recoil.ui.widgets.LabelWidget(scope);
        widget.attach(frp.liftB(
            function (v) {
                return "y" + v.getMeta().name;
            },
             cellB));
        return widget;
    };
    var decorator = function () {
        return new RenderedDecorator(
            decorator,
            createDom('td', {style:'background:yellow'}));
    };
    decorator.name = 'fred';
    frp.accessTrans(function () {
        var mtable = shared.tableB.get().unfreeze();
        mtable.addMeta({headerWidgetFactory: widgetFactory});
        mtable.addMeta({headerDecorator: decorator});
        shared.tableB.set(mtable.freeze());
    },shared.tableB);
    waitFor(findTdColor('yellow', findVal, 'yID'));
    asyncTestCase.waitForAsync('test show table');
    
};


function testDecoratorAndWidgetChange07() {
    document.body.removeChild(shared.container);
    asyncTestCase.waitForAsync('test remove table');
}


function testDecoratorAndWidgetChange08() {
    var frp = shared.scope.getFrp();
    assertEquals(0,frp.tm().watching());
    shared = {};
}
function testOrderChange01() {
    shared = {
        container : createDom('div', {id: 'foo'}),
        scope : new recoil.ui.WidgetScope()
    };
    var frp = shared.scope.getFrp();

    var tblKeys = {
        id : new recoil.structs.table.ColumnKey("id_"),
        value : new recoil.structs.table.ColumnKey("value_")
    };

    var rawTableMeta = {
        value : { type : "string", length : 20, key : tblKeys.value},
        id : { type : "int", primary : 0, key : tblKeys.id}
    };

   var rawTable = [];

    for (var i = 4; i >= 0; i--) {
	rawTable.push({id: i, value: "row " + i});
    }
    

    var columns = new recoil.ui.widgets.TableMetaData();
    columns.add(tblKeys.id, "ID");
    columns.add(tblKeys.value, "Value");
    

    shared.tableB = frp.createB(recoil.structs.table.Table.create(typeFactories, rawTableMeta, rawTable, true));
    var tableWidget = new recoil.ui.widgets.table.TableWidget(shared.scope);

    shared.tableB.refListen(function (b) {
        console.log("referenced", b);
        asyncTestCase.continueTesting();
    });
    tableWidget.getComponent().render(shared.container);
    tableWidget.attach(shared.tableB,columns);

    assertEquals(0,frp.tm().watching());
    document.body.appendChild(shared.container);

    asyncTestCase.waitForAsync('test show table');
}

function findInput(val) {
    return goog.dom.findNode(shared.container, function (n) {
         
        return n.nodeName === 'INPUT' && n.value === val  && n.type === 'text';
    }) ;
}


function findVal(val) {
    return goog.dom.findNode(shared.container, function (n) {
        return n.nodeName === '#text' && n.nodeValue === val;
    }) ;
}

function getAncestor (node, type) {
    var parent = goog.dom.getParentElement(node);

    while (parent.nodeName !== type) {
        parent = goog.dom.getParentElement(parent);
    }
    return parent;
}
function testOrderChange02() {
    var frp = shared.scope.getFrp();
    var watching = frp.tm().watching();
    assertNotEquals(0,watching); 
    
    shared.input = findInput('row 1');

    var row0 = findInput('row 0');
    assertNotUndefined(shared.input);

    var  tr1 = getAncestor(shared.input,'TR');
    var  tr0 = getAncestor(row0,'TR');

    assertTrue("init order correct",goog.dom.getNextElementSibling(tr1) === tr0);
    

    frp.accessTrans(function () {
        var tbl = shared.tableB.get().unfreeze();
        var row = tbl.getRow([1]).unfreeze();
        row.setPos(10);
        tbl.removeRow([1]);
        tbl.addRow(row);
        shared.tableB.set(tbl.freeze());
    },shared.tableB);
    
    assertTrue(findInput('row 0') === row0);
    assertTrue(findInput('row 1') === shared.input);
    assertTrue("final order correct",goog.dom.getNextElementSibling(tr0) === tr1);

    // no more behaviours should be added or removed
    assertEquals(watching,frp.tm().watching()); 

    document.body.removeChild(shared.container);
    asyncTestCase.waitForAsync('test remove table');
}


function testOrderChange03() {
    var frp = shared.scope.getFrp();
    assertEquals(0,frp.tm().watching());
    shared = {};
}


function testColumnChange01() {
    shared = {
        container : createDom('div', {id: 'foo'}),
        scope : new recoil.ui.WidgetScope()
    };
    var frp = shared.scope.getFrp();

    shared.tblKeys = {
        id : new recoil.structs.table.ColumnKey("id_"),
        v1 : new recoil.structs.table.ColumnKey("value1_"),
        v2 : new recoil.structs.table.ColumnKey("value2_"),
        v3 : new recoil.structs.table.ColumnKey("value3_"),
        v4 : new recoil.structs.table.ColumnKey("value4_"),
        v5 : new recoil.structs.table.ColumnKey("value5_")
    };
    var tblKeys = shared.tblKeys;
    
    var rawTableMeta = {
        v1 : { type : "string", length : 20, key : tblKeys.v1},
        v2 : { type : "string", length : 20, key : tblKeys.v2},
        v3 : { type : "string", length : 20, key : tblKeys.v3},
        v4 : { type : "string", length : 20, key : tblKeys.v4},
        v5 : { type : "string", length : 20, key : tblKeys.v5},
        id : { type : "int", primary : 0, key : tblKeys.id}
    };

   var rawTable = [];

    for (var i = 4; i >= 0; i--) {
	rawTable.push({id: i, v1: "c1 " + i, v2:"c2 " + i,v3:"c3 " + i, v4:"c4 " + i, v5:"c5 " + i});
    }
    
    var columns = new recoil.ui.widgets.TableMetaData();
    columns.add(tblKeys.id, "ID");
    columns.add(tblKeys.v1, "V1");
    columns.add(tblKeys.v2, "V2");
    columns.add(tblKeys.v3, "V3");
    columns.add(tblKeys.v4, "V4");
    

    shared.tableB = frp.createB(recoil.structs.table.Table.create(typeFactories, rawTableMeta, rawTable, true));
    var tableWidget = new recoil.ui.widgets.table.TableWidget(shared.scope);

    shared.columnsB = frp.createB(columns);
    shared.tableB.refListen(function (b) {
        asyncTestCase.continueTesting();
    });
    tableWidget.getComponent().render(shared.container);
    tableWidget.attach(shared.tableB,shared.columnsB);

    assertEquals(0,frp.tm().watching());
    document.body.appendChild(shared.container);

    asyncTestCase.waitForAsync('test show table');
}

function testColumnChange02() {
    var frp = shared.scope.getFrp();
    var watching = frp.tm().watching();
    assertNotEquals(0,watching); 

    shared.id = findVal('ID');
    shared.v1 = findVal('V1');
    shared.v2 = findVal('V2');
    shared.v3 = findVal('V3');
    shared.v4 = findVal('V4');

    assertNotUndefined(shared.id);
    assertNotUndefined(shared.v1);
    assertNotUndefined(shared.v2);
    assertNotUndefined(shared.v3);
    assertNotUndefined(shared.v4);

    var  id = getAncestor(shared.id,'TH');
    var  v1 = getAncestor(shared.v1,'TH');
    var  v2 = getAncestor(shared.v2,'TH');
    var  v3 = getAncestor(shared.v3,'TH');
    var  v4 = getAncestor(shared.v4,'TH');


    assertTrue("init order correct 1",goog.dom.getNextElementSibling(id) === v1);
    assertTrue("init order correct 2",goog.dom.getNextElementSibling(v1) === v2);
    assertTrue("init order correct 3",goog.dom.getNextElementSibling(v2) === v3);
    assertTrue("init order correct 4",goog.dom.getNextElementSibling(v3) === v4);
    

    // swaping v1 and v3
    frp.accessTrans(function () {
        var columns = new recoil.ui.widgets.TableMetaData();
        columns.add(shared.tblKeys.id, "ID");
        columns.add(shared.tblKeys.v1, "V1");
        columns.add(shared.tblKeys.v3, "V3");
        columns.add(shared.tblKeys.v4, "V4");
        columns.add(shared.tblKeys.v2, "V2");
        shared.columnsB.set(columns);

    },shared.columnsB);

    assertEquals(shared.id , findVal('ID'));
    assertEquals(shared.v1 , findVal('V1'));
    assertEquals(shared.v2 , findVal('V2'));
    assertEquals(shared.v3 , findVal('V3'));
    assertEquals(shared.v4 , findVal('V4'));

    assertEquals(id,getAncestor(shared.id,'TH'));
    assertEquals(v1,getAncestor(shared.v1,'TH'));
    assertEquals(v2,getAncestor(shared.v2,'TH'));
    assertEquals(v3,getAncestor(shared.v3,'TH'));
    assertEquals(v4,getAncestor(shared.v4,'TH'));

    
    assertTrue("move order correct 1",goog.dom.getNextElementSibling(id) === v1);
    assertTrue("move order correct 2",goog.dom.getNextElementSibling(v1) === v3);
    assertTrue("move order correct 3",goog.dom.getNextElementSibling(v3) === v4);
    assertTrue("move order correct 4",goog.dom.getNextElementSibling(v4) === v2);

    // no more behaviours should be added or removed
    assertEquals(watching,frp.tm().watching()); 

    // remove v4
    frp.accessTrans(function () {
        var columns = new recoil.ui.widgets.TableMetaData();
        columns.add(shared.tblKeys.id, "ID");
        columns.add(shared.tblKeys.v1, "V1");
        columns.add(shared.tblKeys.v3, "V3");
        columns.add(shared.tblKeys.v2, "V2");
        shared.columnsB.set(columns);

    },shared.columnsB);
    
    assertEquals(shared.id , findVal('ID'));
    assertEquals(shared.v1 , findVal('V1'));
    assertEquals(shared.v2 , findVal('V2'));
    assertEquals(shared.v3 , findVal('V3'));
    assertUndefined(findVal('V4'));
    
    assertEquals(id,getAncestor(shared.id,'TH'));
    assertEquals(v1,getAncestor(shared.v1,'TH'));
    assertEquals(v2,getAncestor(shared.v2,'TH'));
    assertEquals(v3,getAncestor(shared.v3,'TH'));
    
    assertTrue("remove order correct 1",goog.dom.getNextElementSibling(id) === v1);
    assertTrue("remove order correct 2",goog.dom.getNextElementSibling(v1) === v3);
    assertTrue("remove order correct 3",goog.dom.getNextElementSibling(v3) === v2);

    // add v5
    frp.accessTrans(function () {
        var columns = new recoil.ui.widgets.TableMetaData();
        columns.add(shared.tblKeys.id, "ID");
        columns.add(shared.tblKeys.v1, "V1");
        columns.add(shared.tblKeys.v3, "V3");
        columns.add(shared.tblKeys.v5, "V5");
        columns.add(shared.tblKeys.v2, "V2");
        shared.columnsB.set(columns);

    },shared.columnsB);

    waitFor(function () {
        return findVal('V5');
    });
    shared.th = {
        id : id,
        v1 : v1,
        v2 : v2,
        v3 : v3
    };
    asyncTestCase.waitForAsync('check column added');
}

function testColumnChange03() {
    shared.v5 = findVal('V5');
    assertEquals(shared.id , findVal('ID'));
    assertEquals(shared.v1 , findVal('V1'));
    assertEquals(shared.v2 , findVal('V2'));
    assertEquals(shared.v3 , findVal('V3'));

    assertEquals(shared.th.id,getAncestor(shared.id,'TH'));
    assertEquals(shared.th.v1,getAncestor(shared.v1,'TH'));
    assertEquals(shared.th.v2,getAncestor(shared.v2,'TH'));
    assertEquals(shared.th.v3,getAncestor(shared.v3,'TH'));
    var v5 = getAncestor(shared.v5,'TH');

    assertTrue("add order correct 1",goog.dom.getNextElementSibling(shared.th.id) === shared.th.v1);
    assertTrue("add order correct 2",goog.dom.getNextElementSibling(shared.th.v1) === shared.th.v3);
    assertTrue("add order correct 3",goog.dom.getNextElementSibling(shared.th.v3) === v5);
    assertTrue("add order correct 3",goog.dom.getNextElementSibling(v5) === shared.th.v2);
    
    document.body.removeChild(shared.container);
    asyncTestCase.waitForAsync('test remove table');
}


function testColumnChange04() {
    var frp = shared.scope.getFrp();
    assertEquals(0,frp.tm().watching());
    shared = {};
}

function testGetSelectedBeforeAttach() {
    var scope = new recoil.ui.WidgetScope();    
    var frp = scope.getFrp();
    var tableWidget = new recoil.ui.widgets.table.TableWidget(scope);

    tableWidget.createSelected();
    
};
