import { describe, expect, it } from 'vitest';
import { acceptedKindsOf } from '../../data-catalogue/expectations.js';
import { DATA_EXPECTATIONS as CATALOGUE_VOCABULARY } from '../../data-catalogue/types.js';
import * as core from '../../index.js';
import { nodeShape } from '../shape.js';
import { DATA_EXPECTATIONS } from '../types.js';
import { ONE_NODE_PER_KIND } from './fixtures.js';

describe('nodeShape', () => {
  it('reports the binding runs of a text block, with the index of the segment carrying each', () => {
    // The index is the one in `content`, literals and page markers included: it has to point at
    // the segment a consumer can reach, not at the rank among the bindings alone.
    const node = ONE_NODE_PER_KIND.text;
    const bound = node.content[1];
    if (bound?.kind !== 'binding') {
      throw new Error('the proof text node should carry a binding segment at index 1');
    }
    const shape = nodeShape(node);

    expect(shape.readings()).toStrictEqual([
      { expression: bound.value, expectation: 'printable', at: ['content', 1, 'value'] },
    ]);
    expect(shape.binding).toBeUndefined();
    expect(shape.children).toStrictEqual([]);
  });

  it('reports nothing at all for a picture', () => {
    const shape = nodeShape(ONE_NODE_PER_KIND.image);

    expect(shape.readings()).toStrictEqual([]);
    expect(shape.binding).toBeUndefined();
    expect(shape.children).toStrictEqual([]);
  });

  it('reports one slot for a container, and reads nothing of its own', () => {
    const node = ONE_NODE_PER_KIND.container;
    const shape = nodeShape(node);

    expect(shape.readings()).toStrictEqual([]);
    expect(shape.binding).toBeUndefined();
    expect(shape.children).toStrictEqual([{ nodes: node.children, at: ['children'] }]);
  });

  it('reports the source of a loop as a reading under the list expectation, and its alias', () => {
    const node = ONE_NODE_PER_KIND.loop;
    const shape = nodeShape(node);

    expect(shape.readings()).toStrictEqual([]);
    expect(shape.binding).toStrictEqual({
      source: { expression: node.each, expectation: 'list', at: ['each'] },
      alias: 'element',
    });
    expect(shape.children).toStrictEqual([{ nodes: node.children, at: ['children'] }]);
  });

  it('requires a boolean of the guard of a condition', () => {
    const node = ONE_NODE_PER_KIND.condition;
    const shape = nodeShape(node);

    expect(shape.readings()).toStrictEqual([
      { expression: node.when, expectation: 'boolean', at: ['when'] },
    ]);
    expect(shape.binding).toBeUndefined();
    expect(shape.children).toStrictEqual([{ nodes: node.children, at: ['children'] }]);
  });

  it('reports the three sections of a table as three slots, in flow order', () => {
    const node = ONE_NODE_PER_KIND.table;
    const shape = nodeShape(node);

    expect(shape.readings()).toStrictEqual([]);
    expect(shape.binding).toBeUndefined();
    expect(shape.children).toStrictEqual([
      { nodes: node.header, at: ['header'] },
      { nodes: node.body, at: ['body'] },
      { nodes: node.footer, at: ['footer'] },
    ]);
  });

  it('reports the source of a row group like a loop, and its rows as one slot', () => {
    const node = ONE_NODE_PER_KIND.tableRowGroup;
    const shape = nodeShape(node);

    expect(shape.binding).toStrictEqual({
      source: { expression: node.each, expectation: 'list', at: ['each'] },
      alias: 'poste',
    });
    expect(shape.children).toStrictEqual([{ nodes: node.rows, at: ['rows'] }]);
  });

  it('reports one slot per grid zone, each naming its sole container', () => {
    // A zone hangs alone under `items[i].content`, so its slot is marked `single`: the analysis
    // appends no index, and the path of a reading inside a zone names the container itself.
    const node = ONE_NODE_PER_KIND.grid;
    const shape = nodeShape(node);

    expect(shape.readings()).toStrictEqual([]);
    expect(shape.binding).toBeUndefined();
    expect(shape.children).toStrictEqual([
      { nodes: [node.items[0]?.content], at: ['items', 0, 'content'], single: true },
      { nodes: [node.items[1]?.content], at: ['items', 1, 'content'], single: true },
    ]);
  });

  it('reports one slot per cell of a row, and requires a number of its contribution', () => {
    const node = ONE_NODE_PER_KIND.tableRow;
    const shape = nodeShape(node);

    expect(shape.readings()).toStrictEqual([
      { expression: node.pageReport?.value, expectation: 'number', at: ['pageReport', 'value'] },
    ]);
    expect(shape.binding).toBeUndefined();
    expect(shape.children).toStrictEqual([
      { nodes: node.cells[0]?.children, at: ['cells', 0, 'children'] },
      { nodes: node.cells[1]?.children, at: ['cells', 1, 'children'] },
    ]);
  });

  it('reports no reading for a row that declares no contribution', () => {
    const plain = ONE_NODE_PER_KIND.table.header[0];
    if (plain === undefined) {
      throw new Error('the proof table should carry a header row');
    }

    expect(nodeShape(plain).readings()).toStrictEqual([]);
  });

  it('gives every slot and every reading a non-empty path of its own', () => {
    // A slot path of zero segments would make a child collide with its own parent, and a reading
    // path of zero segments would point a diagnostic at the node instead of at the expression.
    for (const [type, node] of Object.entries(ONE_NODE_PER_KIND)) {
      const shape = nodeShape(node);
      for (const slot of shape.children) {
        expect(slot.at.length, `${type} child slot`).toBeGreaterThan(0);
      }
      for (const reading of shape.readings()) {
        expect(reading.at.length, `${type} reading`).toBeGreaterThan(0);
      }
      const { binding } = shape;
      if (binding !== undefined) {
        expect(binding.source.at.length, `${type} binding`).toBeGreaterThan(0);
      }
    }
  });

  it('gives no kind both readings and a binding, which is why the order of `nodeReads` is declared', () => {
    // The premise of that declared order: no node carries the two at once today, so no test can
    // observe which comes first. The day one does, this goes red and the rule has to be honoured.
    for (const [type, node] of Object.entries(ONE_NODE_PER_KIND)) {
      const { readings, binding } = nodeShape(node);
      expect(readings().length === 0 || binding === undefined, type).toBe(true);
    }
  });

  it('builds the readings on demand, so a structural traversal never pays for them', () => {
    // The reason `readings` is a function: `childrenOf`, `walk` and `findNodeById` want the slots
    // only, and a text node's readings cost one pass over its segments. Two calls yield equal but
    // distinct arrays, which is what says the work happens at the call and not before it.
    const shape = nodeShape(ONE_NODE_PER_KIND.text);

    expect(shape.readings()).toStrictEqual(shape.readings());
    expect(shape.readings()).not.toBe(shape.readings());
  });
});

describe('the expectation vocabulary', () => {
  it('is one value, wherever it is imported from', () => {
    // Its home is the AST, and the catalogue re-exports it. Two arrays with equal contents would
    // satisfy `toStrictEqual` and still be two vocabularies free to drift apart.
    expect(CATALOGUE_VOCABULARY).toBe(DATA_EXPECTATIONS);
    expect(core.DATA_EXPECTATIONS).toBe(DATA_EXPECTATIONS);
  });

  it('has an accepted set of natures for every entry it declares', () => {
    for (const expectation of DATA_EXPECTATIONS) {
      expect(acceptedKindsOf(expectation).length, expectation).toBeGreaterThan(0);
    }
  });
});
