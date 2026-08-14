!macro customHeader
  !include "LogicLib.nsh"
  !include "WinVer.nsh"
!macroend

!macro customInit
  ; Clean installer: no dependency warning popups.
  ; Advance Terminal V4 bundles its SSH engine and native app modules.
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_ICONSTOP|MB_OK "Advance Terminal V4 requires Windows 10 or Windows 11. Setup cannot continue on this Windows version."
    Abort
  ${EndIf}
!macroend
