' Запускає smsclub-proxy.js у фоні, без видимого чорного вікна.
' Працює незалежно від того, в яку папку покладені файли —
' сам визначає свою папку і шукає smsclub-proxy.js поруч із собою.

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir
WshShell.Run "node smsclub-proxy.js", 0, False
