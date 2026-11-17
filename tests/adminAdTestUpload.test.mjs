import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {signAdminAdTestUpload,confirmAdminAdTestUpload} from '../server/adminAdTestUpload.ts';
import gateway from '../api/gateway.ts';
const cfg={cloudName:'testcloud',apiKey:'testkey',apiSecret:'secret',uploadPreset:'signed_test'};
const id='00000000-0000-4000-8000-000000000001';
const uid='admin_uid';
const sign=(kind='image')=>signAdminAdTestUpload(uid,{resourceType:kind,bytes:1024},cfg,1700000000000,id);

test('signs a protected owner-scoped test upload without revealing the secret',()=>{
 const result=sign();
 assert.equal(result.publicId,`mybucket/ads/test/${uid}/${id}`);
 assert.equal(result.deliveryType,'authenticated');
 assert.equal(result.signature,createHash('sha1').update(`overwrite=false&public_id=${result.publicId}&timestamp=1700000000&type=authenticated&upload_preset=signed_testsecret`).digest('hex'));
 assert.equal(JSON.stringify(result).includes(cfg.apiSecret),false);
 assert.throws(()=>signAdminAdTestUpload(uid,{resourceType:'raw',bytes:1},cfg,1700000000000,id));
 assert.throws(()=>signAdminAdTestUpload(uid,{resourceType:'image',bytes:6*1024*1024},cfg,1700000000000,id));
});

test('verifies response signature and trusted Cloudinary metadata',async()=>{
 const info=sign(),version=42;
 const signature=createHash('sha1').update(`public_id=${info.publicId}&version=${version}secret`).digest('hex');
 const body={resourceType:'image',publicId:info.publicId,version,responseSignature:signature};
 let called=0;
 const resource={public_id:info.publicId,resource_type:'image',type:'authenticated',version,bytes:1024,format:'jpg',asset_id:'asset1',secure_url:'https://res.cloudinary.com/testcloud/image/authenticated/v42/test.jpg'};
 const fetcher=async (url,options)=>{called++;assert.match(url,/\/resources\/image\/authenticated\//);assert.equal(new URL(url).searchParams.has('media_metadata'),false);assert.ok(options.headers.Authorization.startsWith('Basic '));return {ok:true,json:async()=>resource}};
 const result=await confirmAdminAdTestUpload(uid,body,cfg,fetcher);
 assert.equal(result.publicId,info.publicId);assert.equal(result.assetId,'asset1');assert.equal(called,1);
 await assert.rejects(()=>confirmAdminAdTestUpload('another',body,cfg,fetcher));
 await assert.rejects(()=>confirmAdminAdTestUpload(uid,{...body,responseSignature:'a'.repeat(40)},cfg,fetcher));
 assert.equal(called,1);
});

test('rejects video exceeding one minute after provider verification',async()=>{
 const info=sign('video'),version=5;
 const signature=createHash('sha1').update(`public_id=${info.publicId}&version=${version}secret`).digest('hex');
 const body={resourceType:'video',publicId:info.publicId,version,responseSignature:signature};
 const resource={public_id:info.publicId,resource_type:'video',type:'authenticated',version,bytes:1024,format:'mp4',asset_id:'asset1',secure_url:'https://res.cloudinary.com/testcloud/video/authenticated/v5/test.mp4',video_duration:61};
 await assert.rejects(()=>confirmAdminAdTestUpload(uid,body,cfg,async()=>({ok:true,json:async()=>resource})),e=>e.code==='invalid_video_duration');
});

test('verifies a 30-second video using Cloudinary video_duration metadata',async()=>{
 const info=sign('video'),version=6;
 const signature=createHash('sha1').update(`public_id=${info.publicId}&version=${version}secret`).digest('hex');
 const body={resourceType:'video',publicId:info.publicId,version,responseSignature:signature};
 const resource={public_id:info.publicId,resource_type:'video',type:'authenticated',version,bytes:1024,format:'mp4',asset_id:'asset-video',secure_url:'https://res.cloudinary.com/testcloud/video/authenticated/v6/test.mp4',video_duration:30.03};
 const fetcher=async (url,options)=>{
   assert.match(url,/\/resources\/video\/authenticated\//);
   assert.equal(new URL(url).searchParams.get('media_metadata'),'true');
   assert.ok(options.headers.Authorization.startsWith('Basic '));
   return {ok:true,json:async()=>resource};
 };
 const result=await confirmAdminAdTestUpload(uid,body,cfg,fetcher);
 assert.equal(result.assetId,'asset-video');assert.equal(result.publicId,info.publicId);
});

test('accepts duration fallback if Cloudinary supplies the older duration field',async()=>{
 const info=sign('video'),version=7;
 const signature=createHash('sha1').update(`public_id=${info.publicId}&version=${version}secret`).digest('hex');
 const body={resourceType:'video',publicId:info.publicId,version,responseSignature:signature};
 const resource={public_id:info.publicId,resource_type:'video',type:'authenticated',version,bytes:1024,format:'webm',asset_id:'asset-video',secure_url:'https://res.cloudinary.com/testcloud/video/authenticated/v7/test.webm',duration:60};
 const result=await confirmAdminAdTestUpload(uid,body,cfg,async()=>({ok:true,json:async()=>resource}));
 assert.equal(result.format,'webm');
});

test('does not accept a video without a positive finite Cloudinary duration',async()=>{
 const info=sign('video'),version=8;
 const signature=createHash('sha1').update(`public_id=${info.publicId}&version=${version}secret`).digest('hex');
 const body={resourceType:'video',publicId:info.publicId,version,responseSignature:signature};
 const base={public_id:info.publicId,resource_type:'video',type:'authenticated',version,bytes:1024,format:'mp4',asset_id:'asset-video',secure_url:'https://res.cloudinary.com/testcloud/video/authenticated/v8/test.mp4'};
 for(const candidate of [{},{video_duration:0},{video_duration:'30'},{video_duration:Infinity},{video_duration:-1}]){
   await assert.rejects(()=>confirmAdminAdTestUpload(uid,body,cfg,async()=>({ok:true,json:async()=>({...base,...candidate})})),e=>e.code==='ad_video_duration_unavailable' && e.statusCode===422);
 }
});

test('gateway rejects an unauthenticated upload without contacting Firebase',async()=>{
 let status, body;const res={status(s){status=s;return this},json(b){body=b}};
 await gateway({method:'POST',headers:{},body:{action:'admin.ads.testUploadSign',payload:{resourceType:'image',bytes:100}}},res);
 assert.equal(status,401);assert.equal(body.error,'authentication_required');
});
