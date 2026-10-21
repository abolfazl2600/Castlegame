import * as THREE from 'three';

/**
 * Taj Mahal-inspired landmark and formal charbagh on the 25×25 gameplay grid.
 * North is negative Z: the Yamuna lies behind the riverside mausoleum.
 * This static architectural landmark is regenerated from the persisted layout
 * identity, while normal editable world cells, saves and economy remain intact.
 */
export function createTajMahalLandmark(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'taj-mahal-landmark';
  root.userData.historicLandmark = 'taj-mahal';
  const marble = new THREE.MeshStandardMaterial({ color: 0xf3efe3, roughness: 0.72 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.64 });
  const marbleShadow = new THREE.MeshStandardMaterial({ color: 0xcac9bf, roughness: 0.86 });
  const inlay = new THREE.MeshStandardMaterial({ color: 0x777d77, roughness: 0.89 });
  const sandstone = new THREE.MeshStandardMaterial({ color: 0x994f3e, roughness: 0.93 });
  const brickDetail = new THREE.MeshStandardMaterial({ color: 0xd18d65, roughness: 0.95 });
  const darkArch = new THREE.MeshStandardMaterial({ color: 0x293331, roughness: 0.92, side: THREE.DoubleSide });
  const water = new THREE.MeshStandardMaterial({ color: 0x4aafc2, metalness: 0.15, roughness: 0.28 });
  const poolEdge = new THREE.MeshStandardMaterial({ color: 0xc8bdaa, roughness: 0.85 });
  const paving = new THREE.MeshStandardMaterial({ color: 0xd2c7b0, roughness: 0.94 });
  const grass = new THREE.MeshStandardMaterial({ color: 0x659653, roughness: 1 });
  const garden = new THREE.MeshStandardMaterial({ color: 0x78aa54, roughness: 1 });
  const hedge = new THREE.MeshStandardMaterial({ color: 0x326849, roughness: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb99650, metalness: 0.35, roughness: 0.5 });
  const BASE = 2.33;

  const box = (x: number, z: number, w: number, d: number, bottom: number, h: number, material: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, bottom + h * 0.5, z);
    mesh.castShadow = h > 0.3;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const cylinder = (x: number, z: number, top: number, bottom: number, h: number, y: number, material: THREE.Material, sides = 16): void => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, h, sides), material);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  };
  const dome = (x: number, z: number, r: number, bottom: number, material: THREE.Material): void => {
    // Lathe profile with broad onion shoulders, narrowing neck and pointed crown.
    const outline = [
      [0, 0], [.56, 0], [.83, .12], [1, .38], [1.03, .65],
      [.94, .92], [.73, 1.18], [.44, 1.43], [.16, 1.53], [0, 1.56],
    ].map(([radius, height]) => new THREE.Vector2(radius * r, height * r));
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(outline, 22), material);
    mesh.position.set(x, bottom, z);
    mesh.castShadow = true;
    root.add(mesh);
    cylinder(x, z, r * .075, r * .075, r * .32, bottom + r * 1.55, gold, 10);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(r * .13, r * .38, 10), gold);
    spire.position.set(x, bottom + r * 1.9, z);
    root.add(spire);
  };
  const arch = (x: number, z: number, width: number, height: number, bottom: number, rotation = 0, material: THREE.Material = darkArch): void => {
    // Pointed Mughal-style ogee silhouette as a shallow facade inset.
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, height * .66);
    shape.quadraticCurveTo(width * .48, height * .82, 0, height);
    shape.quadraticCurveTo(-width * .48, height * .82, -width / 2, height * .66);
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), material);
    mesh.position.set(x, bottom, z);
    mesh.rotation.y = rotation;
    root.add(mesh);
  };
  const pavilion = (x: number, z: number, size: number, y: number, material: THREE.Material): void => {
    box(x, z, size * 1.25, size * 1.25, y, .3, material);
    for (const dx of [-.42, .42]) for (const dz of [-.42, .42]) {
      cylinder(x + dx * size, z + dz * size, size * .1, size * .1, size * 1.6, y + .3, material, 9);
    }
    box(x, z, size * 1.3, size * 1.3, y + size * 1.9, .27, material);
    dome(x, z, size * .62, y + size * 2.16, material);
  };

  // Northern riverfront enclosure, southern entrance and quadrilateral garden.
  box(0, -37.2, 84, 1.2, BASE, 2.5, sandstone);
  for (const x of [-43, 43]) box(x, 1, 1.6, 78, BASE, 2.4, sandstone);
  for (const x of [-25, -15, 15, 25]) {
    box(x, -37.2, 1.1, 1.8, BASE + 2.3, .7, brickDetail);
  }
  box(-29, 38.8, 28, 1.9, BASE, 3.3, sandstone);
  box(29, 38.8, 28, 1.9, BASE, 3.3, sandstone);

  // Four garden quadrants with geometrically regular raised paths and hedges.
  for (const x of [-18, 18]) for (const z of [2, 23]) {
    box(x, z, 33, 17, BASE + .02, .13, grass);
    box(x, z, 29, 14, BASE + .16, .035, garden);
    for (const s of [-1, 1]) {
      box(x + s * 15.7, z, .55, 15.8, BASE + .19, .65, hedge);
      box(x, z + s * 7.45, 31.7, .55, BASE + .19, .65, hedge);
    }
  }
  box(0, 12, 4.5, 54, BASE + .12, .16, paving);
  box(0, 12, 77, 3.3, BASE + .12, .16, paving);
  for (const x of [-35.9, 35.9]) box(x, 12, 2.2, 52, BASE + .11, .14, paving);
  for (const z of [-9, 33]) box(0, z, 75, 1.8, BASE + .1, .13, paving);

  // Shallow central reflecting pools set into the marble-lined promenade.
  box(0, 13, 2.65, 27, BASE + .29, .19, poolEdge);
  box(0, 13, 2.15, 26.35, BASE + .49, .06, water);
  box(0, -4.8, 2.65, 6, BASE + .29, .19, poolEdge);
  box(0, -4.8, 2.15, 5.4, BASE + .49, .06, water);
  box(0, 12, 8, 7, BASE + .26, .24, poolEdge);
  box(0, 12, 7, 6, BASE + .5, .07, water);
  for (const z of [0, 5, 19, 26]) {
    cylinder(0, z, .23, .23, .25, BASE + .48, marble, 12);
  }

  // Trimmed cypress avenues retain the bilateral symmetry of the charbagh.
  for (const z of [-2, 4, 19, 27]) for (const x of [-31, -24, -12, 12, 24, 31]) {
    cylinder(x, z, .21, .27, 1.45, BASE + .28, sandstone, 7);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(.91, 4.25, 9), hedge);
    crown.position.set(x, BASE + 3.6, z);
    crown.castShadow = true;
    root.add(crown);
  }

  // Southern red-sandstone gateway with central high pishtaq.
  box(0, 38.2, 15.3, 5, BASE, 11.5, sandstone);
  box(0, 40.76, 7.6, .16, BASE + 1.5, 8.6, brickDetail);
  arch(0, 40.9, 6.2, 8.3, BASE + 1.45);
  for (const x of [-5.7, 5.7]) {
    box(x, 40.8, 1.2, .25, BASE + 2, 7, brickDetail);
    pavilion(x, 38.2, 1.15, BASE + 11.5, sandstone);
  }
  box(0, 38.2, 16.6, 5.5, BASE + 11.4, .65, brickDetail);

  // Mosque to the west, architecturally mirrored jawab to the east.
  for (const side of [-1, 1]) {
    const x = side * 31;
    box(x, -25.4, 17, 11.5, BASE + .2, .9, paving);
    box(x, -25.4, 15.5, 9, BASE + 1.1, 6.5, sandstone);
    box(x, -25.4, 16.2, 9.7, BASE + 7.6, .5, brickDetail);
    for (const dx of [-5, 0, 5]) {
      arch(x + dx, -20.43, 3.45, 5.5, BASE + 1.7);
      dome(x + dx, -25.4, dx === 0 ? 2.3 : 1.5, BASE + 8.1, marble);
    }
    for (const dx of [-7.3, 7.3]) pavilion(x + dx, -25.4, .85, BASE + 7.8, sandstone);
  }

  // Raised riverside marble plinth.
  box(0, -24.9, 33.5, 29.5, BASE, 1.75, marbleShadow);
  box(0, -24.9, 33.8, 29.8, BASE + 1.76, .45, marble);
  for (const z of [-39.5, -10.2]) box(0, z, 34, .32, BASE + 2.21, .22, white);
  for (const x of [-16.8, 16.8]) box(x, -24.9, .3, 29.8, BASE + 2.21, .22, white);

  // Core tomb: octagonal reading from corner bevels and four lofty arch facades.
  const y = BASE + 2.2;
  box(0, -25, 16.6, 16.6, y, 12.1, marble);
  for (const x of [-7.7, 7.7]) for (const z of [-32.7, -17.3]) {
    cylinder(x, z, 1.5, 1.5, 11.7, y + .1, white, 8);
  }
  box(0, -25, 17.3, 17.3, y + 11.9, .72, marbleShadow);
  box(0, -25, 14.6, 14.6, y + 12.65, 1.2, white);
  cylinder(0, -25, 6.15, 6.15, 1.1, y + 13.8, marble, 24);
  dome(0, -25, 5.3, y + 14.75, white);

  // Four main pishtaqs and paired narrower niches on all sides.
  for (const rot of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
    const dx = Math.sin(rot), dz = Math.cos(rot);
    const px = dx * 8.36, pz = -25 + dz * 8.36;
    arch(px, pz, 6.8, 10.3, y + .7, rot, marbleShadow);
    arch(px + dx * .08, pz + dz * .08, 5.8, 9.25, y + .8, rot, darkArch);
    for (const offset of [-5.4, 5.4]) {
      // Tangent to the wall plane, rather than world-X only.
      const tx = Math.cos(rot) * offset;
      const tz = -Math.sin(rot) * offset;
      arch(px + tx + dx * .12, pz + tz + dz * .12, 2.4, 6.4, y + 1.55, rot, inlay);
    }
  }
  for (const x of [-6.65, 6.65]) for (const z of [-31.6, -18.4]) {
    pavilion(x, z, 1.7, y + 12.6, marble);
  }

  // Four free-standing minarets: stacked tapering shafts, three balconies,
  // glazed door slits and small chhatri-like marble caps.
  for (const x of [-13, 13]) for (const z of [-36.7, -13.3]) {
    cylinder(x, z, 1.6, 1.82, 1.2, BASE + 2.16, marbleShadow);
    let minaretY = BASE + 3.36;
    for (let tier = 0; tier < 3; tier++) {
      const rad = 1.18 - tier * .095;
      cylinder(x, z, rad * .87, rad, 5.6, minaretY, white, 16);
      minaretY += 5.6;
      cylinder(x, z, rad * 1.32, rad * 1.32, .44, minaretY, marbleShadow, 16);
      minaretY += .44;
      for (const sign of [-1, 1]) {
        box(x + sign * rad * .88, z, .12, .29, minaretY - 4.25, 1.2, inlay);
      }
    }
    cylinder(x, z, .8, .85, 1.6, minaretY, white, 12);
    dome(x, z, 1.05, minaretY + 1.6, white);
  }

  root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.frustumCulled = true;
  });
  return root;
}
