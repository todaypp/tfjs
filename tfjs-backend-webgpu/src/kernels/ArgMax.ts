/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
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

import {ArgMax, ArgMaxAttrs, ArgMaxInputs, backend_util, KernelConfig, KernelFunc, TensorInfo, util} from '@tensorflow/tfjs-core';

import {WebGPUBackend} from '../backend_webgpu';

import {ArgMinMaxProgram} from '../argminmax_webgpu';
import {transpose} from './Transpose';

export function argMax(
    args: {inputs: ArgMaxInputs, backend: WebGPUBackend, attrs: ArgMaxAttrs}):
    TensorInfo {
  const {inputs, backend, attrs} = args;
  const {x} = inputs;
  const {axis} = attrs;

  let axes = util.parseAxisParam(axis, x.shape);
  const permutedAxes = backend_util.getAxesPermutation(axes, x.shape.length);
  let $x = x;
  const intermediateTensorInfos = [];
  if (permutedAxes != null) {
    $x = transpose({inputs: {x}, backend, attrs: {perm: permutedAxes}});
    intermediateTensorInfos.push($x);
    axes = backend_util.getInnerMostAxes(axes.length, $x.shape.length);
  }

  backend_util.assertAxesAreInnerMostDims('argMax', [axes[0]], $x.shape.length);
  const program = new ArgMinMaxProgram($x.shape, axes[0], 'max');
  const uniformData = [
    {type: 'int32', data: [axes[0]]},
    {type: 'float32', data: [Number.NEGATIVE_INFINITY]}
  ];
  const out = backend.runWebGPUProgram(program, [$x], 'int32', uniformData);
  intermediateTensorInfos.forEach(t => backend.disposeData(t.dataId));
  return out;
}

export const argMaxConfig: KernelConfig = {
  kernelName: ArgMax,
  backendName: 'webgpu',
  kernelFunc: argMax as {} as KernelFunc
};
