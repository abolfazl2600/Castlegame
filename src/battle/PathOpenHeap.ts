/** A stable binary min-heap for A* frontier entries.
 * Equal priorities preserve the original insertion order.
 */
export interface PathHeapEntry<T> {
  key: string;
  node: T;
  priority: number;
  order: number;
}

export class PathOpenHeap<T> {
  private readonly heap: PathHeapEntry<T>[] = [];

  get size(): number {
    return this.heap.length;
  }

  push(entry: PathHeapEntry<T>): void {
    const heap = this.heap;
    heap.push(entry);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.less(entry, heap[parent])) break;
      heap[index] = heap[parent];
      index = parent;
    }
    heap[index] = entry;
  }

  pop(): PathHeapEntry<T> | undefined {
    const heap = this.heap;
    if (heap.length === 0) return undefined;
    const first = heap[0];
    const tail = heap.pop()!;
    if (heap.length === 0) return first;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= heap.length) break;
      const right = left + 1;
      const child = right < heap.length && this.less(heap[right], heap[left])
        ? right
        : left;
      if (!this.less(heap[child], tail)) break;
      heap[index] = heap[child];
      index = child;
    }
    heap[index] = tail;
    return first;
  }

  private less(a: PathHeapEntry<T>, b: PathHeapEntry<T>): boolean {
    return a.priority < b.priority ||
      (a.priority === b.priority && a.order < b.order);
  }
}
