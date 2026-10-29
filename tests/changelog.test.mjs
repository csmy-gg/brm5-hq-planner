import test from 'node:test';
import assert from 'node:assert/strict';
import {checkRelease,validateRelease,compareVersions} from '../scripts/check-release.mjs';
const pkg={version:'1.1.0'},lock={version:'1.1.0',packages:{'':{version:'1.1.0'}}};
const notes='# Update log\n\n## [1.1.0] — 2026-10-22\n\n- Added the visible app version.\n\n## [1.0.0] — 2026-10-22\n\n- Recorded the baseline app.\n';

test('release notes, package and lockfile agree on the current app version',()=>{
 assert(compareVersions(checkRelease(),'1.0.0')>=0);assert.equal(validateRelease(pkg,lock,notes),pkg.version);
 assert.throws(()=>validateRelease(pkg,{...lock,version:'1.0.0'},notes),/must match/);
 assert.throws(()=>validateRelease(pkg,{...lock,packages:{'':{version:'1.0.0'}}},notes),/must match/);
 assert.throws(()=>validateRelease(pkg,lock,notes.replace('1.1.0','1.2.0')),/Prepend/);
});

test('release notes require dated descriptive bullets and unique ordered versions',()=>{
 for(const invalid of [notes.replace('2026-10-22','2026-02-30'),notes.replace('- Added the visible app version.','TODO'),notes.replace('- Added the visible app version.','Added the visible app version.'),notes.replace('## [1.0.0]','## [1.1.0]'),notes.replace('## [1.0.0]','## [2.0.0]')])assert.throws(()=>validateRelease(pkg,lock,invalid));
});

test('an app change requires a version increase while documentation-only edits can keep a version',()=>{
 assert.throws(()=>validateRelease(pkg,lock,notes,{baseVersion:'1.1.0',appChanged:true}),/version increase/);
 assert.throws(()=>validateRelease(pkg,lock,notes,{baseVersion:'1.2.0',appChanged:true}),/version increase/);
 assert.equal(validateRelease(pkg,lock,notes,{baseVersion:'1.0.0',appChanged:true}),'1.1.0');
 assert.equal(validateRelease(pkg,lock,notes,{baseVersion:'1.1.0',appChanged:false}),'1.1.0');
});

test('version comparison is numeric across all three update sizes',()=>{
 assert.equal(compareVersions('1.10.0','1.2.9'),1);assert.equal(compareVersions('2.0.0','1.99.99'),1);assert.equal(compareVersions('1.1.1','1.1.0'),1);assert.equal(compareVersions('1.1.0','1.1.0'),0);
 for(const invalid of ['1.1','v1.1.0','01.1.0','1.1.0-beta','<script>'])assert.throws(()=>compareVersions(invalid,'1.1.0'));
});

test('pumpkin-decorated Halloween headings retain release validation',()=>{const decorated=notes.replace('## [1.1.0] — 2026-10-22','## 🎃 [1.1.0] — 2026-10-22 🎃');assert.equal(validateRelease(pkg,lock,decorated),'1.1.0');});
