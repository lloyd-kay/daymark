!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"

; The build wrapper supplies a short subst path so makensis can traverse deeply
; nested Node dependencies without hitting the legacy Windows path limit.
!define DAYMARK_STAGE_ROOT "$%DAYMARK_NSIS_STAGE_ROOT%"

; Tauri's maintenance page normally invokes the installed uninstaller before
; NSIS_HOOK_PREINSTALL. Older Daymark uninstallers can stop the service or wait
; on a hidden passive-mode prompt before the candidate has protected the data.
; Relaunch once with Tauri's supported /UPDATE flag as soon as an existing
; service is found. The child preserves /S or /P, runs the candidate backup and
; controlled service replacement, and returns its real exit code to the caller.
!define MUI_CUSTOMFUNCTION_GUIINIT daymark_on_gui_init
Function daymark_on_gui_init
  ${GetOptions} $CMDLINE "/UPDATE" $0
  ${If} ${Errors}
  ${AndIf} ${FileExists} "$INSTDIR\DaymarkService.exe"
    ${GetParameters} $0
    ExecWait '"$EXEPATH" $0 /UPDATE' $1
    SetErrorLevel $1
    Quit
  ${EndIf}
FunctionEnd

!macro DAYMARK_STAGE_UPGRADE_BACKUP
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\DaymarkUpgrade"
  File /a "/oname=DaymarkRuntime.exe" "${DAYMARK_STAGE_ROOT}\DaymarkRuntime.exe"
  File /a "/oname=package.json" "${DAYMARK_STAGE_ROOT}\package.json"
  File /a "/oname=stop-daymark-processes.ps1" "${DAYMARK_STAGE_ROOT}\stop-daymark-processes.ps1"
  SetOutPath "$PLUGINSDIR\DaymarkUpgrade\node"
  File /a "/oname=node.exe" "${DAYMARK_STAGE_ROOT}\node\node.exe"
  SetOutPath "$PLUGINSDIR\DaymarkUpgrade\node_modules"
  File /a /r "${DAYMARK_STAGE_ROOT}\node_modules\*.*"
  SetOutPath "$PLUGINSDIR\DaymarkUpgrade\runtime"
  File /a /r "${DAYMARK_STAGE_ROOT}\runtime\*.*"
  SetOutPath "$PLUGINSDIR\DaymarkUpgrade\lib"
  File /a /r "${DAYMARK_STAGE_ROOT}\lib\*.*"
  SetOutPath "$PLUGINSDIR\DaymarkUpgrade\drizzle\meta"
  File /a "/oname=_journal.json" "${DAYMARK_STAGE_ROOT}\drizzle\meta\_journal.json"
  SetOutPath "$INSTDIR"
!macroend

!macro DAYMARK_CHECK_COMMAND RESULT_VAR DESCRIPTION
  ${If} ${RESULT_VAR} != 0
    MessageBox MB_OK|MB_ICONSTOP "Daymark could not complete: ${DESCRIPTION}.$\r$\n$\r$\nYour business data has not been deleted. Open Daymark Control for recovery options." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
!macroend

!macro DAYMARK_INSTALL_VC_RUNTIME
  DetailPrint "Installing Microsoft Visual C++ runtime"
  nsExec::ExecToLog '"$INSTDIR\vc_redist.x64.exe" /install /quiet /norestart'
  Pop $0
  ${If} $0 != 0
  ${AndIf} $0 != 1638
  ${AndIf} $0 != 3010
    MessageBox MB_OK|MB_ICONSTOP "Daymark could not install the required Microsoft Visual C++ runtime (error $0).$\r$\n$\r$\nYour business data has not been deleted. Restart Windows, then run the Daymark installer again." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Daymark requires 64-bit Windows 10 or Windows 11." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "Daymark requires Windows 10 or Windows 11." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}

  ${If} $PassiveMode <> 1
    MessageBox MB_OK|MB_ICONINFORMATION "Unsigned preview$\r$\n$\r$\nThis Daymark preview is not yet code-signed, so Windows may show an unrecognised-publisher warning. Daymark installs application files under Program Files and keeps calendars, appointments, backups and protected access details under ProgramData." /SD IDOK
  ${EndIf}

  ${If} ${FileExists} "$INSTDIR\DaymarkService.exe"
    !insertmacro DAYMARK_STAGE_UPGRADE_BACKUP
    nsExec::ExecToLog '"$PLUGINSDIR\DaymarkUpgrade\DaymarkRuntime.exe" --backup'
    Pop $1
    ${If} $1 != 0
      ${If} $PassiveMode = 1
        SetErrorLevel 1
        Abort
      ${EndIf}
      MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "Daymark could not create the pre-upgrade backup. Continue only if you already have a verified backup." /SD IDNO IDYES daymark_continue_without_backup
      SetErrorLevel 1
      Abort
      daymark_continue_without_backup:
    ${EndIf}
    nsExec::ExecToLog '"$INSTDIR\DaymarkService.exe" stop'
    Pop $0
    ${If} $0 != 0
      nsExec::ExecToLog '"$INSTDIR\DaymarkService.exe" start'
      Pop $1
      MessageBox MB_OK|MB_ICONSTOP "Daymark could not stop the previous Windows service.$\r$\n$\r$\nYour business data has not been deleted. Restart Windows, then run the Daymark installer again." /SD IDOK
      SetErrorLevel 1
      Abort
    ${EndIf}
    ; A crashed wrapper can report the service stopped while leaving its bundled
    ; runtime children alive. Stop only executables resolved inside $INSTDIR so
    ; unrelated Node and Cloudflare processes remain untouched.
    nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\DaymarkUpgrade\stop-daymark-processes.ps1" -InstallDir "$INSTDIR"'
    Pop $1
    ${If} $1 != 0
      MessageBox MB_OK|MB_ICONSTOP "Daymark could not close the previous runtime processes.$\r$\n$\r$\nYour business data has not been deleted. Restart Windows, then run the Daymark installer again." /SD IDOK
      SetErrorLevel 1
      Abort
    ${EndIf}
    nsExec::ExecToLog '"$INSTDIR\DaymarkService.exe" uninstall'
    Pop $0
    ${If} $0 != 0
      nsExec::ExecToLog '"$INSTDIR\DaymarkService.exe" start'
      Pop $1
      MessageBox MB_OK|MB_ICONSTOP "Daymark could not replace the previous Windows service.$\r$\n$\r$\nYour business data has not been deleted. Restart Windows, then run the Daymark installer again." /SD IDOK
      SetErrorLevel 1
      Abort
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro DAYMARK_INSTALL_VC_RUNTIME
  DetailPrint "Preparing protected Daymark data folders"
  nsExec::ExecToLog '"$INSTDIR\DaymarkRuntime.exe" --prepare-install'
  Pop $0
  !insertmacro DAYMARK_CHECK_COMMAND $0 "protected local setup"

  ; Compatibility marker used by older repair tools: DaymarkRuntime.exe --ensure-setup-code
  nsExec::ExecToLog '"$INSTDIR\DaymarkRuntime.exe" --migrate'
  Pop $0
  !insertmacro DAYMARK_CHECK_COMMAND $0 "database migration"

  nsExec::ExecToLog '"$INSTDIR\DaymarkService.exe" install'
  Pop $0
  !insertmacro DAYMARK_CHECK_COMMAND $0 "Windows service installation"

  nsExec::ExecToLog '"$INSTDIR\DaymarkService.exe" start'
  Pop $0
  !insertmacro DAYMARK_CHECK_COMMAND $0 "Daymark service startup"

  nsExec::ExecToLog '"$INSTDIR\DaymarkRuntime.exe" --wait-for-health'
  Pop $0
  !insertmacro DAYMARK_CHECK_COMMAND $0 "the 60-second health check"

  CreateShortCut "$DESKTOP\Daymark Control.lnk" "$INSTDIR\Daymark Control.exe"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ${If} ${FileExists} "$INSTDIR\DaymarkService.exe"
    nsExec::ExecToLog '"$INSTDIR\DaymarkService.exe" stop'
    Pop $0
    nsExec::ExecToLog '"$INSTDIR\DaymarkService.exe" uninstall'
    Pop $0
  ${EndIf}
  Delete "$DESKTOP\Daymark Control.lnk"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ${If} ${Silent}
    Goto preserve_daymark_data
  ${EndIf}
  ${If} $PassiveMode = 1
    Goto preserve_daymark_data
  ${EndIf}
  MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "Preserve Daymark data is the recommended choice.$\r$\n$\r$\nChoose No to keep calendars, appointments, protected access details and backups in $COMMONAPPDATA\Daymark.$\r$\n$\r$\nChoose Yes only to permanently delete all Daymark business data from this computer. This cannot be undone." /SD IDNO IDNO preserve_daymark_data
  RMDir /r "$COMMONAPPDATA\Daymark"
  Goto daymark_uninstall_complete

  preserve_daymark_data:
    DetailPrint "Preserve Daymark data: $COMMONAPPDATA\Daymark"

  daymark_uninstall_complete:
!macroend
