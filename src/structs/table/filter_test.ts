import {ColumnKey} from "./columnkey.ts";
import test from "node:test";
import {MutableTable, MutableTableRow, TableRow} from "./table.ts";
import {assertEquals, assertObjectEquals} from "../../test.ts";
import {Filter} from "./filter.ts";

const COL_A = new ColumnKey("a");
const COL_B = new ColumnKey<number>("b");
const COL_C = new ColumnKey("c");
const COL_D = new ColumnKey("d");
const COL_E = new ColumnKey("e");

function odd(row: TableRow) {
    return row.get(COL_B) as number % 2 == 1;
}
test("Replace", ()=> {
    let tbl = new MutableTable([COL_A], [COL_B, COL_C]);

    tbl.setMeta({left:true});
    tbl.setColumnMeta(COL_B, {left:true});
    [1,2,3,4].forEach(function (val) {
        let row = new MutableTableRow();
        row.set(COL_A, val);
        row.set(COL_B, val);
        row.set(COL_C, val);
        tbl.addRow(row);
    });

    let testee = new Filter();
    
    let expected = [1,3];
    let i = 0;
    let table = testee.calculate({table : tbl.freeze(), filter : odd});

    assertObjectEquals({left: true}, table.getMeta());
    assertObjectEquals({left: true}, table.getColumnMeta(COL_B));
    assertEquals(expected.length, table.size());

    for (let {row} of table) {
        assertEquals(expected[i], row.get(COL_A));
        assertEquals(expected[i], row.get(COL_B));
        assertEquals(expected[i], row.get(COL_C));
        i++;
    }

    let mtable = table.unfreeze();
    mtable.set([1], COL_C, 8);

    let orig = testee.inverse(mtable.freeze(),{table : tbl.freeze(), filter: odd});

    expected = [1,2,3,4];
    i = 0;
    assertEquals(expected.length, orig.table.size());
    for (let {row} of orig.table) {
        assertEquals(expected[i], row.get(COL_A));
        assertEquals(expected[i], row.get(COL_B));
        assertEquals(i == 0 ? 8 : expected[i], row.get(COL_C));
        i++;
    }
});

test("Delete", ()=> {
    let tbl = new MutableTable([COL_A], [COL_B, COL_C]);

    [1,2,3,4].forEach(function (val) {
        let row = new MutableTableRow();
        row.set(COL_A, val);
        row.set(COL_B, val);
        row.set(COL_C, val);
        tbl.addRow(row);
    });

    let testee = new Filter();
    
    let expected = [1,3];
    let i = 0;
    let table = testee.calculate({table : tbl.freeze(), filter : odd});

    assertEquals(expected.length, table.size());

    for (let {row} of table) {
        assertEquals(expected[i], row.get(COL_A));
        assertEquals(expected[i], row.get(COL_B));
        assertEquals(expected[i], row.get(COL_C));
        i++;
    }

    let mtable = table.unfreeze();
    mtable.removeRow([3]);

    let orig = testee.inverse(mtable.freeze(),{table : tbl.freeze(), filter: odd});

    expected = [1,2,4];
    i = 0;
    assertEquals(expected.length, orig.table.size());
    for (let {row}  of orig.table){
        assertEquals(expected[i], row.get(COL_A));
        assertEquals(expected[i], row.get(COL_B));
        assertEquals(expected[i], row.get(COL_C));
        i++;
    }
    
});

test("Insert", ()=> {
    let tbl = new MutableTable([COL_A], [COL_B, COL_C]);

    [1,2,3,4].forEach(function (val) {
        let row = new MutableTableRow();
        row.set(COL_A, val);
        row.set(COL_B, val);
        row.set(COL_C, val);
        tbl.addRow(row);
    });

    let testee = new Filter();
    
    let expected = [1,3];
    let i = 0;
    let table = testee.calculate({table : tbl.freeze(), filter : odd});

    assertEquals(expected.length, table.size());

    for (let {row} of table) {
        assertEquals(expected[i], row.get(COL_A));
        assertEquals(expected[i], row.get(COL_B));
        assertEquals(expected[i], row.get(COL_C));
        i++;
    }

    let mtable = table.unfreeze();

    let row = new MutableTableRow();
    row.set(COL_A, 5);
    row.set(COL_B, 5);
    row.set(COL_C, 5);
    mtable.addRow(row);


    let orig = testee.inverse(mtable.freeze(),{table : tbl.freeze(), filter: odd});

    expected = [1,2,3,4,5];
    i = 0;
    assertEquals(expected.length, orig.table.size());
    for (let {row} of orig.table) {
        assertEquals(expected[i], row.get(COL_A));
        assertEquals(expected[i], row.get(COL_B));
        assertEquals(expected[i], row.get(COL_C));
        i++;
    }
    
});
