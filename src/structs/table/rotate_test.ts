import test from "node:test";
import {Rotate} from "./rotate.ts";
import {MutableTable, MutableTableRow} from "./table.ts";
import { ColumnKey } from "./columnkey.ts";
import {assertEquals, assertObjectEquals} from "../../test.ts";
import {TableMetaData} from "../../ui/widgets/table/meta_data.ts";
import {TableWidget} from "../../ui/widgets/table/table_widget.ts";

const COL_A = new ColumnKey("a");
const COL_B = new ColumnKey("b");
const COL_C = new ColumnKey("c");
const COL_D = new ColumnKey("d");
const COL_E = new ColumnKey("e");

test("Rotate", ()=> {
    let tbl = new MutableTable([COL_A], [COL_B,COL_C, COL_D]);


    tbl.setMeta({tableMeta:true});

    tbl.setColumnMeta(COL_A, {meta:"a"});
    tbl.setColumnMeta(COL_B, {meta:"b"});
    tbl.setColumnMeta(COL_C, {meta:"c"});
    tbl.setColumnMeta(COL_D, {meta:"d"});

    [1,2,3,4].forEach(function (val) {
        let row = new MutableTableRow();
        row.set(COL_A, "a" + val);
        row.setCellMeta(COL_A, {cell : "a" + val});
        row.set(COL_B, "b" + val);
        row.setCellMeta(COL_B, {cell : "b" + val});
        row.set(COL_C, "c" + val);
        row.setCellMeta(COL_C, {cell : "c" + val});
        row.set(COL_D, "d" + val);
        row.setCellMeta(COL_D, {cell : "d" + val});
        tbl.addRow(row);
    });

    let meta = new TableMetaData();
    meta.add(COL_A, "A");
    meta.add(COL_B, "B");
    meta.add(COL_C, "C");

    let testee = new Rotate(true, {defaultHeaderWidgetFactory:null, defaultHeaderDecorator: null});
    let applyTable = meta.applyMeta(tbl.freeze());
    let table = testee.calculate({table : applyTable});

    assertEquals(2, table.size()); // lose the non placed columns and the first column, that is the header
    assertObjectEquals({tableMeta: true}, table.getMeta());
    
    let expected = [
        {val: "b", col : COL_B},{val:"c", col: COL_C}];
   
    let r = 0;
    for (let {row, key: pk} of table) {
        let c = 0;
        let expectedRow = expected[r];
        for (let {key: col} of table.placedColumns()) {
            if (c === 0) {
                assertEquals("name col name " + r, "", table.getColumnMeta(col).name);
                assertEquals("name col type " + r, "string", table.getCell(pk,col)!.getMeta().type);
                assertEquals("name col factor " + r, TableWidget.defaultHeaderWidgetFactory
                             , table.getCell(pk,col)!.getMeta().cellWidgetFactory);
                
                assertEquals("name col " + r, expectedRow.val.toUpperCase(), row.get(col));
            }
            else {
                assertEquals("data col name " + r, "a" + c, table.getColumnMeta(col).name);
                assertEquals("data col " + r + "," + c, expectedRow.val + c, row.get(col));
                let expectedMeta = {...applyTable.getColumnMeta(expectedRow.col)};
                expectedMeta.cell = expectedRow.val + c;
                assertObjectEquals("cellmeta col " + r + "," + c, expectedMeta, row.getCell(col)!.getMeta());

            }
            c++;
        }
        assertEquals(5, c); // all rows + 1 for name
        r++;
    }

    // check column names

    // check meta data of headers
    // change the values of the table

    let mtable = table.unfreeze();
    for (let {row, key:pk} of table) {
        for (let {key:col} of table.placedColumns()) {
            mtable.set(pk, col, row.get(col) + "new");
        }
    }

    let orig = testee.inverse(mtable.freeze(),{table : applyTable}).table;

    [1,2,3,4].forEach(function (val) {
        assertEquals("a" + val, orig.get(["a" + val],COL_A));
        assertEquals("b" + val + "new", orig.get(["a" + val],COL_B));
        assertEquals("c" + val + "new", orig.get(["a" + val],COL_C));
        assertEquals("d" + val, orig.get(["a" + val],COL_D));
    });


});



test("testNoHeaderRotate", ()=> {
    let tbl = new MutableTable([COL_A], [COL_B,COL_C, COL_D]);

    tbl.setMeta({tableMeta:true});

    tbl.setColumnMeta(COL_A, {meta:"a"});
    tbl.setColumnMeta(COL_B, {meta:"b"});
    tbl.setColumnMeta(COL_C, {meta:"c"});
    tbl.setColumnMeta(COL_D, {meta:"d"});

    [1,2,3,4].forEach(function (val) {
        let row = new MutableTableRow();
        row.set(COL_A, "a" + val);
        row.setCellMeta(COL_A, {cell : "a" + val});
        row.set(COL_B, "b" + val);
        row.setCellMeta(COL_B, {cell : "b" + val});
        row.set(COL_C, "c" + val);
        row.setCellMeta(COL_C, {cell : "c" + val});
        row.set(COL_D, "d" + val);
        row.setCellMeta(COL_D, {cell : "d" + val});
        tbl.addRow(row);
    });

    let meta = new TableMetaData();
    meta.add(COL_A, "A");
    meta.add(COL_B, "B");
    meta.add(COL_C, "C");

    let testee = new Rotate(false, {defaultHeaderWidgetFactory:null, defaultHeaderDecorator: null});
    let applyTable = meta.applyMeta(tbl.freeze());
    let table = testee.calculate({table : applyTable});

    assertEquals(3, table.size()); // lose the non placed columns and the first column, that is the header
    assertObjectEquals({tableMeta: true, headerRowDecorator: Rotate.emptyDecorator}, table.getMeta());
    
    let expected = [
        {val: "a", col: COL_A},{val: "b", col : COL_B},{val:"c", col: COL_C}];
   
    let r = 0;
    for (let {row, key:pk} of table) {
        let c = 0;
        let expectedRow = expected[r];
        for (let {key:col} of table.placedColumns()) {
            if (c === 0) {
                assertEquals("name col name " + r, "", table.getColumnMeta(col).name);
                assertEquals("name col type " + r, "string", table.getCell(pk,col)!.getMeta().type);
                assertEquals("name col " + r, expectedRow.val.toUpperCase(), row.get(col));
                assertEquals("name col factor " + r, TableWidget.defaultHeaderWidgetFactory
                             , table.getCell(pk,col)!.getMeta().cellWidgetFactory);

            }
            else {
                assertEquals("data col name " + r, "a" + c, table.getColumnMeta(col).name);
                assertEquals("data col " + r + "," + c, expectedRow.val + c, row.get(col));
                let expectedMeta = {...applyTable.getColumnMeta(expectedRow.col)};
                expectedMeta.cell = expectedRow.val + c;
                assertObjectEquals("cellmeta col " + r + "," + c, expectedMeta, row.getCell(col)!.getMeta());

            }
            c++;
        }
        assertEquals(5, c); // all rows + 1 for name
        r++;
    }

    // check column names

    // check meta data of headers
    // change the values of the table

    let mtable = table.unfreeze();
    for (let {row, key:pk} of table) {
        for (let {key:col} of table.placedColumns()) {
            mtable.set(pk, col, row.get(col) + "new");
        }
    }

    let orig = testee.inverse(mtable.freeze(),{table : applyTable}).table;

    [1,2,3,4].forEach(function (val) {
        let key = 'a' + val + 'new';
        assertEquals("a" + val + 'new', orig.get([key],COL_A));
        assertEquals("b" + val + 'new', orig.get([key],COL_B));
        assertEquals("c" + val + 'new', orig.get([key],COL_C));
        assertEquals("d" + val, orig.get([key],COL_D));
    });

    
});



