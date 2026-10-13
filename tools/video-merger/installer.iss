#define AppName "Video Batch Merger"
#define AppVersion "0.2.0"
[Setup]
AppId={{4E0D70C6-9404-4DF5-90FD-143CC2580732}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\VideoBatchMerger
DefaultGroupName={#AppName}
PrivilegesRequired=lowest
OutputDir=dist
OutputBaseFilename=VideoBatchMerger-Setup
SetupIconFile=app.ico
UninstallDisplayIcon={app}\VideoBatchMerger.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"
[Files]
Source: "dist\VideoBatchMerger.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion
[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\VideoBatchMerger.exe"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\VideoBatchMerger.exe"; Tasks: desktopicon
[Run]
Filename: "{app}\VideoBatchMerger.exe"; Description: "Launch Video Batch Merger"; Flags: nowait postinstall skipifsilent
