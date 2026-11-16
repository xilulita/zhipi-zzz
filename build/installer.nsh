; 紫微星：统一安装目录名为「紫微星」
; customInit 在 electron-builder 设置默认目录之后执行，可安全覆写；
; 升级安装（已有安装记录）沿用用户旧目录，不强制迁移。
!macro customInit
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  StrCmp $R0 "" freshInstall done
  Goto done
  freshInstall:
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\紫微星"
  done:
!macroend
