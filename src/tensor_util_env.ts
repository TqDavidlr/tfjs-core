/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import {ENV} from './environment';
import {Tensor} from './tensor';
import {DataType, TensorLike, TypedArray} from './types';
import {assert, flatten, inferDtype, isTypedArray, toTypedArray} from './util';

export function inferShape(val: TensorLike): number[] {
  let firstElem: typeof val = val;

  if (isTypedArray(val)) {
    return [(val as TypedArray).length];
  }
  if (!Array.isArray(val)) {
    return [];  // Scalar.
  }
  const shape: number[] = [];

  while (firstElem instanceof Array) {
    shape.push(firstElem.length);
    firstElem = firstElem[0];
  }
  if (val instanceof Array && ENV.get('TENSORLIKE_CHECK_SHAPE_CONSISTENCY')) {
    deepAssertShapeConsistency(val, shape, []);
  }

  return shape;
}

function deepAssertShapeConsistency(
    val: TensorLike, shape: number[], indices: number[]) {
  indices = indices || [];
  if (!(val instanceof Array)) {
    assert(
        shape.length === 0,
        () => `Element arr[${indices.join('][')}] is a primitive, ` +
            `but should be an array of ${shape[0]} elements`);
    return;
  }
  assert(
      shape.length > 0,
      () => `Element arr[${indices.join('][')}] should be a primitive, ` +
          `but is an array of ${val.length} elements`);
  assert(
      val.length === shape[0],
      () => `Element arr[${indices.join('][')}] should have ${shape[0]} ` +
          `elements, but has ${val.length} elements`);
  const subShape = shape.slice(1);
  for (let i = 0; i < val.length; ++i) {
    deepAssertShapeConsistency(val[i], subShape, indices.concat(i));
  }
}

function assertDtype(
    expectedDtype: DataType|'numeric', actualDType: DataType, argName: string,
    functionName: string) {
  if (expectedDtype == null) {
    return;
  }
  if (expectedDtype !== 'numeric' && expectedDtype !== actualDType ||
      expectedDtype === 'numeric' && actualDType === 'string') {
    throw new Error(
        `Argument '${argName}' passed to '${functionName}' must ` +
        `be ${expectedDtype} tensor, but got ${actualDType} tensor`);
  }
}

export function convertToTensor<T extends Tensor>(
    x: T|TensorLike, argName: string, functionName: string,
    parseAsDtype: DataType|'numeric' = 'numeric'): T {
  if (x instanceof Tensor) {
    assertDtype(parseAsDtype, x.dtype, argName, functionName);
    return x;
  }
  let inferredDtype = inferDtype(x);
  // If the user expects a bool/int/float, use that info to update the
  // inferredDtype when it is not a string.
  if (inferredDtype !== 'string' &&
      ['bool', 'int32', 'float32'].indexOf(parseAsDtype) >= 0) {
    inferredDtype = parseAsDtype as DataType;
  }
  assertDtype(parseAsDtype, inferredDtype, argName, functionName);

  if (!isTypedArray(x) && !Array.isArray(x) && typeof x !== 'number' &&
      typeof x !== 'boolean' && typeof x !== 'string') {
    throw new Error(
        `Argument '${argName}' passed to '${functionName}' must be a ` +
        `Tensor or TensorLike, but got '${x.constructor.name}'`);
  }
  const inferredShape = inferShape(x);
  if (!isTypedArray(x) && !Array.isArray(x)) {
    x = [x] as number[];
  }
  const values = inferredDtype !== 'string' ?
      toTypedArray(x, inferredDtype as DataType, ENV.get('DEBUG')) :
      flatten(x) as string[];
  return Tensor.make(inferredShape, {values}, inferredDtype);
}

export function convertToTensorArray<T extends Tensor>(
    arg: Array<T|TensorLike>, argName: string, functionName: string): T[] {
  if (!Array.isArray(arg)) {
    throw new Error(
        `Argument ${argName} passed to ${functionName} must be a ` +
        '`Tensor[]` or `TensorLike[]`');
  }
  const tensors = arg as T[];
  return tensors.map(
      (t, i) => convertToTensor(t, `${argName}[${i}]`, functionName));
}
