
import {Tree} from "../../structs/tree.ts";
import {ExpandInfoExpanded, TreeView} from "./treeview.ts";

function makeInfo(expand:any):ExpandInfoExpanded {
    if (Array.isArray(expand)) {
        let res = new ExpandInfoExpanded();
        for (let el of expand) {
            if (typeof (el) === 'string') {
                res[el] = {expand: true, children: new ExpandInfoExpanded()};
            }
            else if (el instanceof Object) {
                for (let key in el) {
                    if (key === 'expand') {
                        continue;
                    }
                    res[key] = {expand: el[key].expand !== false, children:makeInfo(el[key])};
                }


            }
        }
        return res;

    }
    else if (expand instanceof Object) {
        let res = new ExpandInfoExpanded();
        for (let key in expand) {
            if (key === 'expand') {
                continue;
            }
            res[key] = {expand: expand[key].expand !== false, children:makeInfo(expand[key])};
        }

        return res;
    }
    return new ExpandInfoExpanded();

}
test("test expand",  () => {
    let tree = new Tree<number>("", 1,
            [
                new Tree<number>("a", 2),
                new Tree<number>("b", 3, [
                    new Tree<number>("d", 2),
                    new Tree<number>("e", 2),
                ]),
                new Tree<number>("c", 3),
            ]
        );
    TreeView.expandPath(tree, true, ["", "b", "d"], true);
    let expanded = TreeView.expandPath(tree, true, ["", "b", "d"], true);
    expect(expanded).toStrictEqual(
        makeInfo({"": ["a", {b:["d","e"]}, "c"]})
    );
    let expanded1 = TreeView.expandPath(tree, expanded, ["", "b", "d"], false);

    // check we did not change the original
    expect(expanded).toStrictEqual(
        makeInfo({"": ["a", {b:["d","e"]}, "c"]})
    );

    expect(expanded1).toStrictEqual(
        makeInfo({"": ["a", {b:["e"]}, "c"]})
    );


    expanded = TreeView.expandPath(tree, expanded1, ["", "b", "d"], true);

    expect(expanded1).toStrictEqual(
        makeInfo({"": ["a", {b:["e"]}, "c"]})
    );

    expect(expanded).toStrictEqual(
        makeInfo({"": ["a", {b:["d","e"]}, "c"]})
    );

    expanded1 = TreeView.expandPath(tree, expanded, ["", "b"], false);

    expect(expanded).toStrictEqual(
        makeInfo({"": ["a", {b:["d","e"]}, "c"]})
    );

    expect(expanded1).toStrictEqual(
        makeInfo({"": ["a", {b: {expand: false, "d": {},"e": {}}}, "c"]})
    );

})