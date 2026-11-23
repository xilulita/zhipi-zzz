; 紫微星 安装约定：
;  · 安装目录用拼音 ziweixing（目录名不影响用户感知，也避开中文路径风险）；
;  · 可执行文件安装完成后重命名为「紫微星.exe」；
;  · 桌面 / 开始菜单 / 应用和功能里的名称与图标一律为中文「紫微星」。
;  · 图标随包分发为 resources\app-brand.ico（ASCII 名，中文名写盘会失败）。
!macro customInit
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  StrCmp $R0 "" freshInstall done
  Goto done
  freshInstall:
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\ziweixing"
  done:
!macroend

!macro customInstall
  ; ① 可执行文件改名成中文
  Delete "$INSTDIR\紫微星.exe"
  IfFileExists "$INSTDIR\ziweixing.exe" 0 +2
    Rename "$INSTDIR\ziweixing.exe" "$INSTDIR\紫微星.exe"

  ; ② 快捷方式图标（随包分发的 resources\app-brand.ico）
  StrCpy $2 "$INSTDIR\resources\app-brand.ico"

  ; ③ 删掉 electron-builder 自动建的英文快捷方式，避免桌面出现两个图标
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}.lnk"

  ; ④ 桌面 + 开始菜单：中文名、中文图标、目标为中文 exe
  CreateShortCut "$DESKTOP\紫微星.lnk" "$INSTDIR\紫微星.exe" "" "$2" 0 SW_SHOWNORMAL "" "紫微星 · AI 批改工作台"
  CreateShortCut "$SMPROGRAMS\紫微星.lnk" "$INSTDIR\紫微星.exe" "" "$2" 0 SW_SHOWNORMAL "" "紫微星 · AI 批改工作台"

  ; ⑤ 卸载信息
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayName" "紫微星"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayIcon" "$2"
!macroend

!macro customUnInstall
  Delete "$DESKTOP\紫微星.lnk"
  Delete "$SMPROGRAMS\紫微星.lnk"
!macroend
