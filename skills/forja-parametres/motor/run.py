import sys, importlib
import forja_parametres as F
from plantilles import T
def run(opc, verbose=False):
    F.OPC.update(opc); res=[]
    for nom,c,d,l,prm,o in T:
        cost,dd,ll,rows,adj=F.calcula(prm,dif_decl=d,lat_decl=l,permanent=o.get('permanent',False))
        res.append((nom,c,cost,dd,ll))
    return res
base=run({})
ok=[r for r in base if r[1]==r[2]]
print(f'Quadren {len(ok)}/{len(base)}')
for nom,c,cost,dd,ll in base:
    if c!=cost: print(f'  {nom:34} declarat {c:3}  calculat {cost:3}  ({cost-c:+d})')
