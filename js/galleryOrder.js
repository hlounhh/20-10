// Row-major order within each viewport page; additional pages extend right.
// With 3 columns and 2 rows:
//  0  1  2 | 6  7  8
//  3  4  5 | 9 10 11
export function gridSlot(index, rows, columns) {
    if (!Number.isInteger(index) || index < 0 ||
        !Number.isInteger(rows) || rows < 1 ||
        !Number.isInteger(columns) || columns < 1) {
        throw new RangeError('Invalid gallery grid coordinates');
    }
    const pageSize = rows * columns;
    const page = Math.floor(index / pageSize);
    const offset = index % pageSize;
    return { column: page * columns + offset % columns, row: Math.floor(offset / columns) };
}
export function gridColumnForIndex(index, rows, columns) {
    return gridSlot(index, rows, columns).column;
}
export function firstIndexInColumn(column, rows, columns) {
    if (column < 0 || rows < 1 || columns < 1) return 0;
    return Math.floor(column / columns) * rows * columns + column % columns;
}
