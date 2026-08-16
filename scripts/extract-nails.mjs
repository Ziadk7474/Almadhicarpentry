// One-off build script: extracts just the nails sub-mesh from the sourced
// Sketchfab wooden-pallet GLB (which combines the entire pallet's wood into
// one mesh and all nails into a second mesh — see assets/inspiration/woodenpallet.glb)
// and writes a small, optimized, nails-only GLB for use in the hero animation.
// The wood mesh is discarded entirely: the hero rebuilds boards/bars/blocks as
// plain procedural box geometry, so there is no use for the heavy 4x 2048px
// PBR texture set attached to the wood material.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('assets/inspiration/woodenpallet.glb');

const root = doc.getRoot();

// Keep only the nails mesh (name "Object_1" per inspection). Delete every
// other mesh's node references so prune() can drop the wood mesh, its
// material and its four 2048px textures entirely.
for (const mesh of root.listMeshes()) {
  if (mesh.getName() !== 'Object_1') {
    mesh.dispose();
  }
}

await doc.transform(
  prune(),
  dedup(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.25, error: 0.01 }),
  textureCompress({ targetFormat: 'webp', resize: [512, 512] }),
);

await io.write('assets/pallet-nails.glb', doc);
console.log('wrote assets/pallet-nails.glb');
