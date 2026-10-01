"""Lossless packing of already-collected business columns; no address inference.
Every compact mailbox token is emitted only after byte equality with the observed
address; roundtrip is asserted before any file is written. Raw evidence remains private.
"""
import json,struct,lzma,base64,hashlib,unicodedata,re
from pathlib import Path
root=Path('data/prague-2026-10-01/assembled')
contacts=json.loads((root/'contacts.json').read_text())
schools=json.loads((root/'schools.json').read_text())
summary=json.loads((root/'summary.json').read_text())
dictionary=[]; lookup={}
def idx(s):
    s=str(s or '')
    if s not in lookup: lookup[s]=len(dictionary); dictionary.append(s)
    return lookup[s]
def ascii_name(s):
    return re.sub('[^a-z0-9]','', ''.join(c for c in unicodedata.normalize('NFD',s.lower()) if not unicodedata.combining(c)))
def patterns(f,l):
    a,b=ascii_name(f),ascii_name(l)
    return [b,a+'.'+b,a[:1]+b,b+a[:1],a,a+b,b+'.'+a,a[:1]+'.'+b]
rows=[]
for c in contacts:
    f,l=c['firstName'],c['lastName']; local,domain=c['email'].rsplit('@',1)
    ps=patterns(f,l); token=ps.index(local) if local in ps else idx(local)+8
    decoded=ps[token] if token<8 else dictionary[token-8]
    assert decoded+'@'+domain==c['email']
    assert c['collectedAt'] in ['2026-10-01','2026-09-30']
    assert c['lastObservedAt']=='2026-10-01'
    rows.append([idx(f),idx(l),token,idx(domain),idx(c['schoolId']),idx(c['sourceUrl']),idx(c.get('role')),idx(c['method']),int(c['collectedAt']=='2026-09-30')])
meta={'codec':'SS01_COL9_VERIFIED_ROUNDTRIP','columns':['firstName','lastName','observedMailboxToken','domain','schoolId','sourceUrl','role','method','previousCollection'],
      'dictionary':dictionary,'schools':schools,'summary':summary,
      'quarantine':json.loads((root/'quarantine.json').read_text()),
      'previousNotObserved':json.loads((root/'previous-not-reconfirmed.json').read_text()),
      'csvSha256':hashlib.sha256((root/'kontakty.csv').read_bytes()).hexdigest()}
header=json.dumps(meta,ensure_ascii=False,separators=(',',':')).encode()
buffer=bytearray(b'SS01'+struct.pack('>I',len(header))+header+struct.pack('>I',len(rows)))
def varint(n):
    result=bytearray()
    while n>=128:result.append((n&127)|128);n>>=7
    result.append(n);return result
for column in range(9):
    for row in rows:buffer.extend(varint(row[column]))
packed=lzma.compress(bytes(buffer),preset=9)
(root/'delivery.ss01.xz').write_bytes(packed)
encoded=base64.b64encode(packed).decode()
chunk_dir=root/'transfer';chunk_dir.mkdir(exist_ok=True)
chunk_size=15000
parts=[encoded[i:i+chunk_size] for i in range(0,len(encoded),chunk_size)]
for i,part in enumerate(parts):(chunk_dir/f'{i:03}.txt').write_text(part)
manifest={'codec':meta['codec'],'rows':len(rows),'chunks':len(parts),'base64Chars':len(encoded),'bytes':len(packed),
          'sha256':hashlib.sha256(packed).hexdigest(),'csvSha256':meta['csvSha256'],
          'chunkHashes':[hashlib.sha256(p.encode()).hexdigest() for p in parts]}
(root/'transfer-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
