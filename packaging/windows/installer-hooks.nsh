!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"

!macro DAYMARK_CHECK_COMMAND RESULT_VAR DESCRIPTION
  ${If} ${RESULT_VAR} != 0
    MessageBox MB_OK|MB_ICONSTOP "Daymark could not complete: ${DESCRIPTION}.$\r$\n$\r$\nYour business data has not been deleted. Open Daymark Control for recovery options."
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
    MessageBox MB_OK|MB_ICONSTOP "Daymark could not install the required Microsoft Visual C++ runtime (error $0).$\r$\n$\r$\nYour business data has not been deleted. Restart Windows, then run the Daymark installer again."
    Abort
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Daymark requires 64-bit Windows 10 or Windows 11."
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "Daymark requires Windows 10 or Windows 11."
    Abort
  ${EndIf}

  MessageBox MB_OK|MB_ICONINFORMATION "Unsigned preview$\r$\n$\r$\nThis Daymark preview is not yet code-signed, so Windows may show an unrecognised-publisher warning. Daymark installs application files under Program Files and keeps calendars, appointments, backups and protected access details under ProgramData."

  ${If} ${FileExists} "$INSTDIR\DaymarkService.exe"
    nsExec::ExecToLog '"$INSTDIR\DaymarkService.exe" stop'
    Pop $0
    nsExec::ExecToLog '"$INSTDIR\DaymarkRuntime.exe" --backup'
    Pop $1
    ${If} $1 != 0
      MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "Daymark could not create the pre-upgrade backup. Continue only if you already have a verified backup." IDYES +2
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
  MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "Preserve Daymark data is the recommended choice.$\r$\n$\r$\nChoose No to keep calendars, appointments, protected access details and backups in $COMMONAPPDATA\Daymark.$\r$\n$\r$\nChoose Yes only to permanently delete all Daymark business data from this computer. This cannot be undone." IDNO preserve_daymark_data
  RMDir /r "$COMMONAPPDATA\Daymark"
  Goto daymark_uninstall_complete

  preserve_daymark_data:
    DetailPrint "Preserve Daymark data: $COMMONAPPDATA\Daymark"

  daymark_uninstall_complete:
!macroend
