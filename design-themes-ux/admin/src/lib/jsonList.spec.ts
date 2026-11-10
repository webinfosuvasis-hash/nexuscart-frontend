import { describe, it, expect } from 'vitest';
import { parseJsonList } from './jsonList';

describe('parseJsonList', () => {
  it.each([
    [['a', 'b'], ['a', 'b']],
    ['["cotton","summer"]', ['cotton', 'summer']],
    ['["https://cdn/a.jpg"]', ['https://cdn/a.jpg']],
    ['cotton, summer', ['cotton', 'summer']],
    ['[]', []],
    ['', []],
    [null, []],
    [undefined, []],
    ['{"not":"a list"}', ['{"not":"a list"}']],
  ])('%p → %p', (input, expected) => {
    expect(parseJsonList(input)).toEqual(expected);
  });
});
