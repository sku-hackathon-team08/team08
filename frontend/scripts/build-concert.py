"""Build a meter-scale GLB and WGS84 overlays from one provisional concert layout.

Local coordinates are east/north/up. glTF stores east/up/south (Y-up).
WGS84 positions use the same ENU basis as Cesium's model placement.
"""
from pathlib import Path
import csv
import io
import json
import math
import struct
import uuid

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/demo'
layout = json.loads((ROOT / 'demo/concert-layout.json').read_text())
anchor = layout['anchor']
lon, lat = map(math.radians, [anchor['lng'], anchor['lat']])
a, e2 = 6378137.0, 6.69437999014e-3
n = a / math.sqrt(1 - e2 * math.sin(lat) ** 2)
origin = [n * math.cos(lat) * math.cos(lon), n * math.cos(lat) * math.sin(lon), n * (1-e2) * math.sin(lat)]
heading = math.radians(anchor['headingDegrees'])

def coordinate(east, north, up=0):
    east, north = east*math.cos(heading)+north*math.sin(heading), -east*math.sin(heading)+north*math.cos(heading)
    x = origin[0]-math.sin(lon)*east-math.sin(lat)*math.cos(lon)*north+math.cos(lat)*math.cos(lon)*up
    y = origin[1]+math.cos(lon)*east-math.sin(lat)*math.sin(lon)*north+math.cos(lat)*math.sin(lon)*up
    z = origin[2]+math.cos(lat)*north+math.sin(lat)*up
    p = math.hypot(x,y)
    phi = math.atan2(z,p*(1-e2))
    for _ in range(8):
        nn = a / math.sqrt(1-e2*math.sin(phi)**2)
        phi = math.atan2(z+e2*nn*math.sin(phi),p)
    return [round(math.degrees(math.atan2(y,x)), 9), round(math.degrees(phi), 9)]

def uid(key):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'team08/seoul-concert/'+key))

zones=[]
for z in layout['zones']:
    x1,y1,x2,y2=z['boundsMeters']
    ring=[coordinate(x1,y1),coordinate(x2,y1),coordinate(x2,y2),coordinate(x1,y2),coordinate(x1,y1)]
    zones.append(dict(id=uid(z['key']),key=z['key'],name=z['name'],color=z['color'],areaSquareMeters=(x2-x1)*(y2-y1),geometry=dict(type='Polygon',coordinates=[ring])))
gates=[]
for g in layout['gates']:
    lng,lt=coordinate(*g['positionMeters'])
    gates.append(dict(id=uid(g['key']),name=g['name'],position=dict(lng=lng,lat=lt),zoneId=uid(g['zoneKey']) if g['zoneKey'] else None))

# Components are authored in ENU meters, then batched by material for fast rendering.
materials=[];nodes=[]
def material(name,color,emissive=False):
    c=[int(color[i:i+2],16)/255 for i in (1,3,5)]
    m=dict(name=name,pbrMetallicRoughness=dict(baseColorFactor=c+[1],metallicFactor=0.15,roughnessFactor=0.75),doubleSided=True)
    if emissive:m['emissiveFactor']=[v*.7 for v in c]
    idx=len(materials);materials.append(m)
    return idx
steel=material('Dark steel','#263747');silver=material('Truss','#abb9c1');deck=material('Stage deck','#253142')
screen=material('LED mint','#6befcb',True);pink=material('LED coral','#ed91b4',True);white=material('Canopy','#e7e6dd');black=material('Speaker','#131a20')
floor=material('Protective floor','#465461');aisle=material('Walkways','#a3b0b4');gold=material('Safety yellow','#ebc573')
zone_mats={z['key']:material(z['name'],z['color']) for z in layout['zones']}

def box(name,x,y,z,w,d,h,mat,angle=0):
    nodes.append(dict(name=name,mesh=mat,center=[x,y,z],size=[w,d,h],angle=angle))

def beam(name,start,end,width,mat):
    # A prism along an arbitrary ENU direction, used for diagonal truss bracing.
    nodes.append(dict(name=name,mesh=mat,start=start,end=end,width=width))

# A single raised protective floor avoids the imagery's sloping terrain obscuring low geometry.
box('Field protection',0,4,-.14,73,111,.28,floor)
box('Central circulation',0,0,.025,7,63,.05,aisle)
box('Cross aisle',0,1,.03,67,7,.06,aisle)
for x in [-32,32]:box('Perimeter circulation',x,0,.03,5,69,.06,aisle)
for zone in layout['zones']:
    x1,y1,x2,y2=zone['boundsMeters']
    box('Section surface '+zone['key'],(x1+x2)/2,(y1+y2)/2,.04,x2-x1,y2-y1,.08,zone_mats[zone['key']])
# Explicit seat rows in a fictional seated concert layout; these are visual markers, not capacity certification.
seat_count=0
for zone in layout['zones'][:4]:
    x1,y1,x2,y2=zone['boundsMeters']
    y=y1+1.5
    while y<y2-1:
        for bank in [(x1+1,x1+10),(x2-10,x2-1)]:
            x=bank[0]
            while x<bank[1]:
                box('Seat cushion',x,y,.49,.48,.46,.13,zone_mats[zone['key']])
                box('Seat back',x,y-.22,.82,.48,.1,.52,zone_mats[zone['key']])
                box('Seat support',x,y,.25,.09,.28,.5,steel)
                seat_count+=1;x+=.78
        y+=1.25

# Main stage, thrust, roof frame and LED wall. Dimensions in meters.
box('Main stage',0,44,1,32,12,2,deck)
box('Thrust',0,33,1,5,10,2,deck)
box('Central LED',0,49,7,21,.5,9,screen)
for x in [-18,18]:
    box('Side screen frame',x,44,6,6,1,10,black)
    box('Side LED',x,43.4,6,5.5,.15,8.5,pink)
    for y in [38.5,49.5]:box('Roof column',x*.83,y,7,.5,.5,14,silver)
    for z in [3,4,5,6,7,8]:box('Line array',x*.76,37,z,1.1,1.2,.85,black)
for y in [38.5,49.5]:
    for z in [13,14]:box('Roof crossbeam',0,y,z,31,.35,.35,silver)
    for x in range(-15,16,3):box('Truss brace',x,y,13.5,.2,.35,1,silver)
for x in [-15,15]:box('Roof sidebeam',x,44,13.5,.45,12,.5,silver)
box('Stage canopy',0,44,14.2,32,12,.18,black)
for x in range(-12,13,3):box('Light fixture',x,38.2,12.5,.6,.5,.45,pink if x%2 else screen)
# FOH control cabin and two small operations canopies.
box('FOH deck',0,-37,0.5,10,7,1,deck)
box('FOH desk',0,-35.5,1.7,8,1,1.4,black)
for x in [-4.5,4.5]:
    for y in [-40,-34]:box('FOH post',x,y,2.5,.18,.18,5,silver)
box('FOH canopy',0,-37,5.1,10,7,.2,white)
for x in [-24,24]:
    box('Operations cabin',x,-43,1.3,5,5,2.6,white)
    box('Operations roof',x,-43,2.8,5.5,5.5,.25,screen)
# Low crowd barriers follow the exact zone rectangle edges.
for z in layout['zones'][:4]:
    x1,y1,x2,y2=z['boundsMeters']
    for y in [y1,y2]:
        box('Audience rail', (x1+x2)/2,y,1.05,x2-x1,.12,.12,silver)
        for i in range(int((x2-x1)/3)+1):box('Rail post',x1+i*3,y,.55,.1,.1,1.1,silver)
    # Leave a six-meter opening on the outer side of each zone.
    inner=x2 if x2<0 else x1
    box('Central aisle rail',inner,(y1+y2)/2,1.05,.12,y2-y1,.12,silver)
    outer=x1 if x2<0 else x2
    for y in [y1+(y2-y1-6)/4,y2-(y2-y1-6)/4]:box('Outer rail',outer,y,1.05,.12,(y2-y1-6)/2,.12,silver)
for g in layout['gates']:
    x,y=g['positionMeters']
    for dy in [-2.5,2.5]:box('Entry frame post',x,y+dy,2,.3,.3,4,silver)
    box('Entry header',x,y,4,.4,5.3,.45,screen)

# Extra stage access, fly towers, catwalk trim, monitor wedges and loading cases.
for x in [-17,17]:
    for step in range(8):box('Stage stair',x,34+step*.42,(step+1)*.125,2,.42,(step+1)*.25,silver)
for x in [-2.5,2.5]:box('Runway edge light',x,33,2.05,.08,10,.08,screen)
for x in range(-12,13,4):
    box('Stage monitor',x,39,2.35,1.1,.65,.65,black)
    box('Backline case',x,47,2.55,1.4,.8,1.1,steel)
for y in [38.5,49.5]:
    for x in range(-15,15,3):
        beam('Roof diagonal',[x,y,13],[x+3,y,14],.1,silver)
        beam('Roof diagonal',[x,y,14],[x+3,y,13],.1,silver)
for x in [-15,15]:
    for y in [38.5,49.5]:
        for z in range(0,12,2):beam('Tower diagonal',[x-.22,y,z],[x+.22,y,z+2],.08,silver)
# Delay speaker and follow-spot towers outside the audience blocks.
for x in [-33,33]:
    for y in [-22,22]:
        box('Tower ballast',x,y,.3,2.2,2.2,.6,steel)
        for dx in [-.55,.55]:
            for dy in [-.55,.55]:box('Delay tower leg',x+dx,y+dy,5,.12,.12,10,silver)
        for z in range(1,10,2):
            beam('Delay bracing',[x-.55,y-.55,z],[x+.55,y-.55,z+2],.08,silver)
            beam('Delay bracing',[x+.55,y+.55,z],[x-.55,y+.55,z+2],.08,silver)
        box('Follow spot platform',x,y,9,2,2,.18,steel)
        box('Follow spot',x,y,9.5,.6,1,.55,black)
        for z in [6,7,8]:box('Delay speaker',x,y+.8,z,.8,.6,.7,black)
# FOH mixing desks, monitor screens, rear service lane, check-in desks and queues.
for x in [-3,-1,1,3]:
    box('Mixing console',x,-35.5,2.48,1.4,.8,.15,steel)
    box('Console screen',x,-35.2,2.85,1,.12,.55,screen)
box('Rear service aisle',0,-46,.05,70,3,.1,aisle)
for x in [-24,24]:
    for dx in [-1,1]:box('Operations desk',x+dx,-45.5,.85,1.5,.7,1.5,steel)
    for dy in [-1,0,1]:box('Queue rail',x,-49+dy*1.4,1.1,8,.12,.12,silver)
    box('Service wayfinding',x,-42,4.2,3,.2,.65,screen)
# Simple direction arrows made of strips on the circulation lanes.
for x in [-32,0,32]:
    for y in [-27,-12,12,25]:
        box('Aisle arrow stem',x,y,.09,.14,1.4,.035,white)
        for sign in [-1,1]:box('Aisle arrow head',x+sign*.24,y+.5,.09,.12,.7,.035,white,sign*-.75)

# Bake components into one indexed mesh per material instead of thousands of draw calls.
faces=[((1,0,0),[(.5,-.5,-.5),(.5,.5,-.5),(.5,.5,.5),(.5,-.5,.5)]),
       ((-1,0,0),[(-.5,-.5,.5),(-.5,.5,.5),(-.5,.5,-.5),(-.5,-.5,-.5)]),
       ((0,1,0),[(-.5,.5,-.5),(-.5,.5,.5),(.5,.5,.5),(.5,.5,-.5)]),
       ((0,-1,0),[(-.5,-.5,.5),(-.5,-.5,-.5),(.5,-.5,-.5),(.5,-.5,.5)]),
       ((0,0,1),[(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5),(-.5,-.5,.5)]),
       ((0,0,-1),[(-.5,-.5,-.5),(-.5,.5,-.5),(.5,.5,-.5),(.5,-.5,-.5)])]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def unit(a):
    n=math.sqrt(sum(v*v for v in a));return [v/n for v in a]
def axes(part):
    if 'start' in part:
        a,b=part['start'],part['end'];delta=[b[i]-a[i] for i in range(3)]
        zz=unit(delta);xx=unit(cross([0,1,0] if abs(zz[2])>.9 else [0,0,1],zz));yy=cross(zz,xx)
        return [(a[i]+b[i])/2 for i in range(3)],[part['width'],part['width'],math.sqrt(sum(v*v for v in delta))],[xx,yy,zz]
    c,t=math.cos(part['angle']),math.sin(part['angle'])
    return part['center'],part['size'],[[c,t,0],[-t,c,0],[0,0,1]]
buffer=bytearray();views=[];accessors=[];meshes=[];render_nodes=[]
def accessor(values,fmt,typ,target,minimum=None,maximum=None):
    while len(buffer)%4:buffer.append(0)
    raw=struct.pack('<'+str(len(values))+fmt,*values);idx=len(views)
    views.append(dict(buffer=0,byteOffset=len(buffer),byteLength=len(raw),target=target));buffer.extend(raw)
    entry=dict(bufferView=idx,componentType=5126 if fmt=='f' else 5125,count=len(values)//(3 if typ=='VEC3' else 1),type=typ)
    if minimum is not None:entry.update(min=minimum,max=maximum)
    accessors.append(entry);return len(accessors)-1
for mat in range(len(materials)):
    pos=[];normal=[];indices=[]
    for part in [v for v in nodes if v['mesh']==mat]:
        center,size,basis=axes(part)
        for face_normal,vertices in faces:
            offset=len(pos)//3
            nn=[sum(basis[j][i]*face_normal[j] for j in range(3)) for i in range(3)]
            for v in vertices:
                q=[center[i]+sum(basis[j][i]*v[j]*size[j] for j in range(3)) for i in range(3)]
                pos.extend([q[0],q[2],-q[1]]);normal.extend([nn[0],nn[2],-nn[1]])
            indices.extend(offset+i for i in [0,1,2,0,2,3])
    if not pos:continue
    pa=accessor(pos,'f','VEC3',34962,[min(pos[i::3]) for i in range(3)],[max(pos[i::3]) for i in range(3)])
    na=accessor(normal,'f','VEC3',34962);ia=accessor(indices,'I','SCALAR',34963)
    render_nodes.append(dict(name=materials[mat]['name'],mesh=len(meshes)))
    meshes.append(dict(primitives=[dict(attributes=dict(POSITION=pa,NORMAL=na),indices=ia,material=mat)]))
model=dict(asset=dict(version='2.0',generator='team08 concert builder'),scene=0,scenes=[dict(nodes=list(range(len(render_nodes))))],nodes=render_nodes,meshes=meshes,materials=materials,
 buffers=[dict(byteLength=len(buffer))],bufferViews=views,accessors=accessors,
 extras=dict(componentCount=len(nodes),seatMarkers=seat_count,layoutVersion=layout['dataVersion']))
j=json.dumps(model,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
payload=bytes(buffer);payload+=b'\0'*((-len(payload))%4)
glb=struct.pack('<4sII',b'glTF',2,12+8+len(j)+8+len(payload))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(payload),b'BIN\0')+payload
OUT.mkdir(exist_ok=True,parents=True);(OUT/'concert.glb').write_bytes(glb)
data=dict(eventId=uid('event'),name=layout['name'],status=layout['status'],dataVersion=layout['dataVersion'],center={k:anchor[k] for k in ['lng','lat']},zones=zones,gates=gates,
 model=dict(uri='/demo/concert.glb',position={k:anchor[k] for k in ['lng','lat']},headingDegrees=anchor['headingDegrees'],metersPerUnit=1,heightPolicy='FLAT_DEMO_PLANE_ABOVE_RENDERED_FOOTPRINT',nodeCount=len(render_nodes),componentCount=len(nodes),seatMarkers=seat_count))
(OUT/'seoul-worldcup.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
features=[dict(type='Feature',id=z['id'],properties={k:v for k,v in z.items() if k!='geometry'},geometry=z['geometry']) for z in zones]
features += [dict(type='Feature',id=g['id'],properties=dict(name=g['name'],kind='GATE',zoneId=g['zoneId']),geometry=dict(type='Point',coordinates=[g['position']['lng'],g['position']['lat']])) for g in gates]
(OUT/'concert-zones.geojson').write_text(json.dumps(dict(type='FeatureCollection',name=layout['name'],status=layout['status'],features=features),ensure_ascii=False,indent=2)+'\n')
s=io.StringIO();w=csv.writer(s,lineterminator="\n");w.writerow(['kind','id','name','vertex','longitude','latitude'])
for z in zones:
    for i,xy in enumerate(z['geometry']['coordinates'][0]):w.writerow(['ZONE',z['id'],z['name'],i,*xy])
for g in gates:w.writerow(['GATE',g['id'],g['name'],0,g['position']['lng'],g['position']['lat']])
(OUT/'concert-coordinates.csv').write_text('\ufeff'+s.getvalue())
print(f'Built GLB: {len(nodes)} parts, {len(glb)} bytes; {len(zones)} zones, {len(gates)} gates.')
