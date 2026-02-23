import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {Tree} from './tree.ts';

describe('Tree', () => {
    it('creates a tree with children', () => {
        const child1 = new Tree('child1', 1);
        const child2 = new Tree('child2', 2);
        const root = new Tree('root', 0, [child1, child2]);

        assert.equal(root.key(), 'root');
        assert.equal(root.value(), 0);
        assert.equal(root.children().length, 2);
        assert.equal(root.children()[0].value(), 1);
    });

    it('gets value by path', () => {
        const leaf = new Tree('leaf', 42);
        const mid = new Tree('mid', 52, [leaf]);
        const root = new Tree('root', 62, [mid]);

        assert.equal(root.getValue(['mid', 'leaf']), 42);
        assert.equal(root.getValue(['nonexistent']), null);
    });

    it('sets value immutably', () => {
        const leaf = new Tree('leaf', 1);
        const root = new Tree('root', 0, [leaf]);

        const updated = root.setValue(['leaf'], 99);

        // old tree unchanged
        assert.equal(root.getValue(['leaf']), 1);

        // new tree updated
        assert.equal(updated.getValue(['leaf']), 99);
    });

    it('inserts child at position', () => {
        const root = new Tree('root', 0);
        const c1 = new Tree('a', 1);
        const c2 = new Tree('b', 2);

        const root2 = root.insertChildAt(c1);
        const root3 = root2.insertChildAt(c2, 0);

        assert.deepEqual(root3.children().map(c => c.key()), ['b', 'a']);
    });

    it('removes a child', () => {
        const c1 = new Tree('a', 1);
        const c2 = new Tree('b', 2);
        const root = new Tree('root', 0, [c1, c2]);

        const root2 = root.removeChild(c1);
        assert.deepEqual(root2.children().map(c => c.key()), ['b']);

        const root3 = root.removeChildAt(1);
        assert.deepEqual(root3.children().map(c => c.key()), ['a']);
    });

    it('testInsertChild', () => {
        const foo = new Tree("hello", "hello", []);

        const foo1 = foo.insertChildAt(new Tree("1", "1", []), 1);

        assert.equal(foo1.children()[0].value(), "1");
        assert.equal(foo.children().length, 0);

        const foo2 = foo1.insertChildAt(new Tree("2", "2", []), 1);
        assert.equal(foo2.children()[0].value(), "1");
        assert.equal(foo2.children()[1].value(), "2");
    });

    it('testRemoveChild', () => {
        const c2 = new Tree("2", "2", []);

        const foo = new Tree("k", "v", [
            new Tree("1", "1", []),
            c2,
            new Tree("3", "3", []),
        ]);

        const foo1 = foo.removeChild(c2);
        assert.equal(foo1.key(), "k");
        assert.equal(foo1.value(), "v");
        assert.equal(foo.children().length, 3);
        assert.equal(foo1.children().length, 2);
        assert.equal(foo1.children()[0].key(), "1");
        assert.equal(foo1.children()[1].key(), "3");
        assert.equal(foo1.children()[0].value(), "1");
        assert.equal(foo1.children()[1].value(), "3");
    });

    it('testRemoveChildAt', () => {
        const foo = new Tree("k", "v", [
            new Tree("1", "1", []),
            new Tree("2", "2", []),
            new Tree("3", "3", []),
        ]);

        const foo1 = foo.removeChildAt(1);
        assert.equal(foo1.key(), "k");
        assert.equal(foo1.value(), "v");
        assert.equal(foo.children().length, 3);
        assert.equal(foo1.children().length, 2);
        assert.equal(foo1.children()[0].key(), "1");
        assert.equal(foo1.children()[1].key(), "3");
        assert.equal(foo1.children()[0].value(), "1");
        assert.equal(foo1.children()[1].value(), "3");
    });

});
