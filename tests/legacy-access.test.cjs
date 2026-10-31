"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLegacyRedirectServer}=require('../server.cjs');
test('El acceso antiguo redirige al servidor actual y no sirve archivos ni reenvía formularios',async()=>{
  const server=createLegacyRedirectServer(4183);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    for(const route of ['/','/index.html','/data/taller.sqlite','/app.js?version=1']) {
      const response=await fetch(base+route,{redirect:'manual'});
      assert.equal(response.status,307);
      assert.equal(response.headers.get('location'),'http://127.0.0.1:4183'+route);
      assert.equal(await response.text(),'');
    }
    const form=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',redirect:'manual'});
    assert.equal(form.status,405);
    assert.equal(form.headers.get('location'),null);
  }finally{await new Promise(r=>server.close(r));}
});
