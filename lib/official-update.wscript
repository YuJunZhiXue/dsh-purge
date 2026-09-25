// 占位符由 official-update.js 填上。退出当前官方客户端，运行已下载的安装包，成功后再打开。
var exe = __EXE_JSON__;
var installer = __INSTALLER_JSON__;
var resources = __RESOURCES_JSON__;
var installDir = __INSTALL_DIR_JSON__;
if (installDir.length > 3) installDir = installDir.replace(/[\\\/]+$/, '');
var logPath = __LOG_JSON__;
var fso = new ActiveXObject('Scripting.FileSystemObject');
var sh = new ActiveXObject('WScript.Shell');
var wmi = GetObject('winmgmts:\\\\.\\root\\cimv2');
function z(n) { return (n < 10 ? '0' : '') + n; }
function stamp() { var d = new Date(); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()); }
function log(m) { var f = fso.OpenTextFile(logPath, 8, true); f.WriteLine(stamp() + ' ' + m); f.Close(); }
function samePath(a, b) { return String(a || '').replace(/\//g, '\\').toLowerCase() === String(b || '').replace(/\//g, '\\').toLowerCase(); }
function pids() { var out = []; var e = new Enumerator(wmi.ExecQuery("SELECT ProcessId, ExecutablePath FROM Win32_Process WHERE Name = 'DeepSeek Harness.exe'")); for (; !e.atEnd(); e.moveNext()) { var p = e.item(); if (samePath(p.ExecutablePath, exe)) out.push(p.ProcessId); } return out; }
function fileSize(fp) { if (!fso.FileExists(fp)) return -1; return fso.GetFile(fp).Size; }
function fileStamp(fp) { if (!fso.FileExists(fp)) return ''; return String(fso.GetFile(fp).DateLastModified); }
log('update-begin');
WScript.Sleep(800);
var list = pids();
log('pids ' + list.join(','));
for (var i = 0; i < list.length; i++) sh.Run('taskkill.exe /F /PID ' + list[i], 0, true);
var deadline = new Date().getTime() + 20000;
var left = list;
while (new Date().getTime() < deadline) { left = pids(); if (left.length === 0) break; WScript.Sleep(200); }
log('left ' + left.length);
var asar = resources + '\\app.asar';
var bak = asar + '.bak';
var appDir = resources + '\\app';
var movedApp = false;
var prev = '';
if (fso.FolderExists(appDir)) {
  prev = appDir + '.dshpurge-prev';
  if (fso.FolderExists(prev)) prev = appDir + '.dshpurge-prev-' + (new Date().getTime());
  for (var n = 0; n < 40; n++) {
    try { fso.MoveFolder(appDir, prev); movedApp = true; log('moved-app'); break; }
    catch (moveErr) { log('move-app ' + (moveErr && moveErr.message ? moveErr.message : moveErr)); WScript.Sleep(250); }
  }
}
var copiedAsar = false;
if (!fso.FileExists(asar) && fso.FileExists(bak)) {
  try { fso.CopyFile(bak, asar, true); copiedAsar = true; log('restored-asar'); }
  catch (restoreErr) { log('restore-asar ' + (restoreErr && restoreErr.message ? restoreErr.message : restoreErr)); }
}
var exeBeforeSize = fileSize(exe);
var exeBeforeStamp = fileStamp(exe);
var asarBeforeSize = fileSize(asar);
function runInstaller(updated) {
  var args = updated ? ' --updated /S /D=' : ' /S /D=';
  return sh.Run('"' + installer + '"' + args + installDir, 0, true);
}
var code = runInstaller(true);
log('installer ' + code);
var exeChanged = fileSize(exe) !== exeBeforeSize || fileStamp(exe) !== exeBeforeStamp;
var asarChanged = fileSize(asar) !== asarBeforeSize;
var ok = exeChanged || asarChanged;
log('changed exe=' + exeChanged + ' asar=' + asarChanged);
if (!ok) {
  code = runInstaller(false);
  log('installer-plain ' + code);
  exeChanged = fileSize(exe) !== exeBeforeSize || fileStamp(exe) !== exeBeforeStamp;
  asarChanged = fileSize(asar) !== asarBeforeSize;
  ok = exeChanged || asarChanged;
  log('changed-plain exe=' + exeChanged + ' asar=' + asarChanged);
}
if (!ok) {
  if (copiedAsar && fso.FileExists(asar)) {
    try { fso.DeleteFile(asar, true); log('rehid-asar'); } catch (hideErr) { log('rehid-asar ' + hideErr); }
  }
  if (movedApp && prev && fso.FolderExists(prev) && !fso.FolderExists(appDir)) {
    try { fso.MoveFolder(prev, appDir); log('restored-app'); } catch (backErr) { log('restored-app ' + backErr); }
  }
  try { sh.Environment('PROCESS').Remove('ELECTRON_RUN_AS_NODE'); } catch (ignore) {}
  sh.Run('"' + exe + '"', 1, false);
  log('started-old');
} else {
  if (!movedApp && fso.FolderExists(appDir)) log('move-app-failed');
  try {
    var marker = fso.CreateTextFile(resources + '\\dsh-purge-reapply-asar', true);
    marker.WriteLine('1');
    marker.Close();
    log('marker');
  } catch (markerErr) { log('marker ' + markerErr); }
  try { sh.Environment('PROCESS').Remove('ELECTRON_RUN_AS_NODE'); } catch (ignore2) {}
  sh.Run('"' + exe + '"', 1, false);
  log('started');
}
