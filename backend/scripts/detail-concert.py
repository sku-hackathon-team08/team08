"""Rebuild the base layout and enrich it using Blender's meter-scale Z-up scene.

Run: blender --background --python backend/scripts/detail-concert.py
"""

import json
import math
import runpy
from pathlib import Path

# These modules are supplied by Blender when this script runs.
import bpy  # pyrefly: ignore[missing-import]
from mathutils import Vector  # pyrefly: ignore[missing-import]

ROOT = Path(__file__).resolve().parents[1]
runpy.run_path(str(ROOT / "scripts/build-concert.py"))
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT / "demo/assets/concert.glb"))
bpy.context.scene.unit_settings.system = "METRIC"
bpy.context.scene.unit_settings.scale_length = 1
bpy.context.preferences.filepaths.save_version = 0
added = []


def material(name, color, metallic=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = (*color, 1)
    node.inputs["Metallic"].default_value = metallic
    node.inputs["Roughness"].default_value = 0.38
    node.inputs["Emission Color"].default_value = (*color, 1)
    node.inputs["Emission Strength"].default_value = emission
    return mat


metal = material("Detail • brushed aluminum", (0.52, 0.61, 0.68), 0.8)
dark = material("Detail • charcoal equipment", (0.022, 0.03, 0.045), 0.3)
mint = material("Detail • mint LED", (0.15, 0.95, 0.7), emission=1.3)
coral = material("Detail • coral LED", (0.95, 0.16, 0.35), emission=1.1)
grass = material("Reference grass", (0.12, 0.26, 0.09))
rubber = material("Cable protection", (0.045, 0.049, 0.055))
amber = material("Safety markings", (0.95, 0.62, 0.08))
white = material("Detail • lettering", (0.94, 0.98, 1), emission=0.2)


def mesh_object(name, vertices, faces, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    added.append(obj)
    return obj


def box(name, location, dimensions, mat, bevel=0):
    x, y, z = (d / 2 for d in dimensions)
    vertices = [
        (-x, -y, -z),
        (x, -y, -z),
        (x, y, -z),
        (-x, y, -z),
        (-x, -y, z),
        (x, -y, z),
        (x, y, z),
        (-x, y, z),
    ]
    faces = [
        (0, 3, 2, 1),
        (4, 5, 6, 7),
        (0, 1, 5, 4),
        (1, 2, 6, 5),
        (2, 3, 7, 6),
        (3, 0, 4, 7),
    ]
    obj = mesh_object(name, vertices, faces, mat)
    obj.location = location
    if bevel:
        mod = obj.modifiers.new("Machined edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        # Applied once in a batch before joining, without per-part dependency updates.
    return obj


def rod(name, start, end, radius=0.035):
    start, end = Vector(start), Vector(end)
    direction = (end - start).normalized()
    helper = Vector((0, 0, 1)) if abs(direction.z) < 0.9 else Vector((1, 0, 0))
    u = direction.cross(helper).normalized() * radius
    v = direction.cross(u).normalized() * radius
    vertices = [
        tuple(p + u * math.cos(i * math.tau / 8) + v * math.sin(i * math.tau / 8))
        for p in [start, end]
        for i in range(8)
    ]
    faces = [tuple(reversed(range(8))), tuple(range(8, 16))]
    faces += [(i, (i + 1) % 8, (i + 1) % 8 + 8, i + 8) for i in range(8)]
    mesh_object(name, vertices, faces, metal)


def label(text, location, size, mat, vertical=False):
    curve = bpy.data.curves.new("Sign " + text, "FONT")
    curve.body = text
    curve.align_x = "CENTER"
    curve.size = size
    curve.extrude = 0.008
    obj = bpy.data.objects.new("Sign " + text, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    if vertical:
        obj.rotation_euler.x = math.pi / 2
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for other in bpy.context.selected_objects:
        if other != obj:
            other.select_set(False)
    bpy.ops.object.convert(target="MESH")
    added.append(bpy.context.object)


# Individual LED modules form a restrained equalizer graphic on the existing wall.
for col in range(28):
    for row in range(10):
        mat = mint if row < 3 + 5 * (0.5 + 0.5 * math.sin(col * 0.47)) else dark
        box(
            "LED module",
            (-10.1 + col * 0.75, 48.70, 3.1 + row * 0.77),
            (0.70, 0.08, 0.71),
            mat,
        )
label("FIELD / LIVE", (0, 48.59, 10.6), 1.2, white, True)
for x in [-18, 18]:
    for row in range(12):
        box(
            "Side LED stripe",
            (x, 43.28, 2.2 + row * 0.63),
            (5.1, 0.06, 0.15),
            coral if row % 3 else mint,
        )
# Four-sided cylindrical lattice around each existing structural column.
for x in [-15, 15]:
    for y in [38.5, 49.5]:
        for dx in [-0.34, 0.34]:
            for dy in [-0.34, 0.34]:
                rod("Truss chord", (x + dx, y + dy, 0), (x + dx, y + dy, 14), 0.045)
        for z in range(14):
            for side in [-0.34, 0.34]:
                rod(
                    "Truss lattice",
                    (x - 0.34, y + side, z),
                    (x + 0.34, y + side, z + 1),
                )
                rod(
                    "Truss lattice",
                    (x + side, y - 0.34, z),
                    (x + side, y + 0.34, z + 1),
                )
# Speaker grilles, lifting straps and stage-front footlights.
for x in [-13.68, 13.68]:
    for z in range(3, 9):
        for dz in [-0.25, 0, 0.25]:
            box("Speaker grille", (x, 36.385, z + dz), (0.96, 0.035, 0.025), metal)
for x in range(-14, 15, 2):
    box("Footlight housing", (x, 38.05, 2.2), (0.48, 0.32, 0.28), dark, 0.04)
    box("Footlight lens", (x, 37.875, 2.24), (0.34, 0.025, 0.12), mint)
for x in [-3, -1, 1, 3]:
    for dx in range(7):
        box(
            "Console fader",
            (x - 0.55 + dx * 0.17, -35.5, 2.575),
            (0.035, 0.38, 0.015),
            metal,
        )
    for dy in range(3):
        box(
            "Console indicator",
            (x - 0.42 + dy * 0.4, -35.15, 2.58),
            (0.11, 0.08, 0.02),
            mint,
        )
for x in [-24, 24]:
    box("Cabin front glazing", (x, -45.515, 1.7), (3.8, 0.025, 1.1), dark)
    label("INFO" if x < 0 else "MEDICAL", (x, -45.56, 2.2), 0.47, white, True)
    for dx in [-1.6, 0, 1.6]:
        box("Cabin window mullion", (x + dx, -45.55, 1.7), (0.055, 0.03, 1.1), metal)
for key, x, y in [("A", -16.5, 6), ("B", 16.5, 6), ("C", -16.5, -25), ("D", 16.5, -25)]:
    label("FLOOR " + key, (x, y, 0.13), 1.25, white)
label("CONTROL", (0, -38.5, 5.22), 1.05, dark)
# Ground reference follows Seoul Facilities Corporation's 117 x 78 m grass field.
# Stage placement remains a fictional event layout; this is not an engineering design.
box("Grass reference 78 x 117 m", (0, 0, -0.23), (78, 117, 0.10), grass)
# Visible edges of the field protection are now symmetric within the official grass area.
for x in [-36.45, 36.45]:
    box("Protection edge ramp", (x, 0, -0.04), (0.12, 111, 0.08), rubber)
for y in [-55.45, 55.45]:
    box("Protection edge ramp", (0, y, -0.04), (73, 0.12, 0.08), rubber)


# Open modular stage substructure. Tube diameter follows Layher's published 48.3 mm;
# 2 m bays and the 2 m performance level are this demo's chosen dimensions.
def support_grid(name, xs, ys):
    for x in xs:
        for y in ys:
            box(name + " sole board", (x, y, 0.04), (0.36, 0.36, 0.08), dark)
            box(name + " base plate", (x, y, 0.095), (0.20, 0.20, 0.03), metal)
            rod(name + " screw jack", (x, y, 0.11), (x, y, 0.4), 0.019)
            rod(name + " standard 48.3mm", (x, y, 0.32), (x, y, 1.84), 0.02415)
            for z in [0.5, 1, 1.5]:
                box(name + " node", (x, y, z), (0.09, 0.09, 0.018), metal)
    for y in ys:
        for x0, x1 in zip(xs, xs[1:]):
            for z in [0.42, 1.55]:
                rod(name + " ledger", (x0, y, z), (x1, y, z), 0.02415)
            box(
                name + " deck bearer",
                ((x0 + x1) / 2, y, 1.76),
                (x1 - x0, 0.08, 0.16),
                metal,
            )
            if y in [ys[0], ys[-1]]:
                rod(name + " diagonal", (x0, y, 0.42), (x1, y, 1.55), 0.02415)
                rod(name + " diagonal", (x1, y, 0.42), (x0, y, 1.55), 0.02415)
    for x in xs:
        for y0, y1 in zip(ys, ys[1:]):
            for z in [0.42, 1.55]:
                rod(name + " cross ledger", (x, y0, z), (x, y1, z), 0.02415)
            box(
                name + " cross bearer",
                (x, (y0 + y1) / 2, 1.76),
                (0.08, y1 - y0, 0.16),
                metal,
            )
            if x in [xs[0], xs[-1]]:
                rod(name + " side diagonal", (x, y0, 0.42), (x, y1, 1.55), 0.02415)
    # Flush panel joints make the deck's modular scale legible from above.
    for x in xs:
        box(
            name + " panel joint",
            (x, (ys[0] + ys[-1]) / 2, 2.003),
            (0.014, ys[-1] - ys[0], 0.006),
            metal,
        )
    for y in ys:
        box(
            name + " panel joint",
            ((xs[0] + xs[-1]) / 2, y, 2.003),
            (xs[-1] - xs[0], 0.014, 0.006),
            metal,
        )


support_grid("Main stage", list(range(-16, 17, 2)), list(range(38, 51, 2)))
support_grid("Runway", [-2.4, 0, 2.4], list(range(2, 39, 2)))
# Side access now reaches the stage instead of terminating in front of it.
for x in [-17, 17]:
    box("Stair landing", (x, 38.25, 1.92), (2, 1.8, 0.16), dark)
    for side in [-0.92, 0.92]:
        rod("Stair handrail", (x + side, 34, 1.2), (x + side, 37.36, 3.05), 0.035)
        for step in [0, 3, 7]:
            y = 34 + step * 0.42
            z = (step + 1) * 0.25
            rod("Stair rail upright", (x + side, y, z), (x + side, y, z + 1.05), 0.025)
    for step in range(8):
        box(
            "Stair nosing",
            (x, 33.81 + step * 0.42, (step + 1) * 0.25 + 0.006),
            (1.95, 0.055, 0.012),
            amber,
        )
# Cases on casters, distribution racks and low-profile cable paths in the service area.
for x in [-12, -9, 9, 12]:
    box("Flight case", (x, 52.5, 0.65), (1.5, 0.85, 1), dark, 0.035)
    for z in [0.22, 1.10]:
        box("Case edge", (x, 52.5, z), (1.55, 0.89, 0.04), metal)
    for dx in [-0.57, 0.57]:
        for dy in [-0.28, 0.28]:
            box("Case caster", (x + dx, 52.5 + dy, 0.12), (0.11, 0.11, 0.16), rubber)
        box("Recessed handle", (x + dx, 52.055, 0.7), (0.22, 0.03, 0.12), metal)
for x in [-6, 6]:
    box("Power rack", (x, 52.4, 0.85), (0.7, 0.8, 1.7), dark, 0.025)
    for z in [0.5, 0.8, 1.1, 1.4]:
        box("Rack drawer", (x, 51.985, z), (0.60, 0.04, 0.19), metal)
box("Rear cable ramp", (0, 51.4, 0.045), (30, 0.35, 0.09), rubber)
for x in range(-14, 15, 2):
    box("Cable ramp marker", (x, 51.4, 0.094), (0.25, 0.34, 0.008), amber)
# Ground protection panel seams and discrete lane edge stripes.
for x in range(-35, 36, 2):
    box("Ground panel seam", (x, 0, 0.004), (0.012, 110, 0.006), dark)
for y in range(-54, 55, 2):
    box("Ground panel seam", (0, y, 0.004), (72, 0.012, 0.006), dark)
for x in [-3.5, 3.5, -29.5, 29.5]:
    for y in range(-29, 29, 4):
        box("Lane edge dash", (x, y, 0.11), (0.10, 1.8, 0.012), white)

# Evaluate edge bevels in one pass before material batching.
bpy.ops.object.select_all(action="DESELECT")
bevelled = [obj for obj in added if obj.modifiers]
for obj in bevelled:
    obj.select_set(True)
if bevelled:
    bpy.context.view_layer.objects.active = bevelled[0]
    bpy.ops.object.convert(target="MESH")
# Join only added detail by material, retaining small draw-call counts.
groups = [
    [o for o in added if o.data.materials[0] == mat]
    for mat in [metal, dark, mint, coral, white, grass, rubber, amber]
]
for group in groups:
    bpy.ops.object.select_all(action="DESELECT")
    if group:
        for obj in group:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.join()
        group[0].name = group[0].data.materials[0].name
bpy.ops.object.select_all(action="SELECT")
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "demo/concert.blend"))
bpy.ops.export_scene.gltf(
    filepath=str(ROOT / "demo/assets/concert.glb"),
    export_format="GLB",
    export_yup=True,
    export_extras=True,
)
seed_path = ROOT / "demo/assets/seoul-worldcup.json"
seed = json.loads(seed_path.read_text())
seed["dataVersion"] += "-blender-05"
seed["model"]["nodeCount"] = len(bpy.context.scene.objects)
seed["model"]["componentCount"] += len(added)
seed_path.write_text(json.dumps(seed, ensure_ascii=False, indent=2) + "\n")
print("DETAIL_COMPLETE", seed["model"])
