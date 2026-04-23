# ProxyBridge GUI - Windows 本地编译手册

## 环境要求

- Windows 10/11 (amd64)
- Go 1.21+ （建议 1.23）
- Node.js 18+ （wails CLI 需要）
- MSYS2 (MINGW64 环境) — [下载地址](https://www.msys2.org/)
- WinDivert 2.2.2 运行时文件

---

## 第一步：安装编译工具链

### 1.1 安装 MSYS2

下载并安装 https://www.msys2.org/，默认装到 `C:\msys64`。

安装完成后，打开 **MINGW64 终端**（不是 MSYS 终端），后续所有命令都在这个窗口里执行。

### 1.2 安装 MinGW-w64 和 Go

```powershell
# 在 MINGW64 终端里执行
pacman -Syu
pacman -S mingw-w64-x86_64-gcc mingw-w64-x86_64-go
```

### 1.3 安装 Node.js

去 https://nodejs.org 下载 LTS 版（推荐 20.x），安装时选择"Add to PATH"。

### 1.4 安装 Wails CLI

```powershell
# 在 MINGW64 终端里执行
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# 验证
wails version
```

### 1.5 安装 Wails 前端依赖

```powershell
# 在项目根目录（proxybridge-gui/）执行
cd gui-wails/proxybridge-gui/frontend
npm install
cd ..
```

---

## 第二步：下载 WinDivert 运行时

ProxyBridgeCore.dll 依赖 WinDivert，需要把 WinDivert 的头文件和 import library 放到 proxybridge 包里。

```powershell
# 在 MINGW64 终端里执行
# 下载 WinDivert
curl -L "https://github.com/basil00/Divert/releases/download/v2.2.2/WinDivert-2.2.2-A.zip" -o WinDivert.zip
tar -xf WinDivert.zip        # Windows 上用 7-Zip 或 PowerShell 解压
# 解压后得到 WinDivert-2.2.2-A/ 目录

# 创建 WinDivert include 目录
mkdir -p proxybridge/WinDivert/include

# 复制头文件
cp WinDivert-2.2.2-A/include/windivert.h proxybridge/WinDivert/include/
```

---

## 第三步：准备 DLL 文件

proxybridge 包目录下需要有以下文件：

```
proxybridge/
├── cgo_bindings.go        # 已有
├── proxybridge.go          # 已有
├── proxybridge_windows.go  # 已有
├── types.go                # 已有
├── WinDivert.dll           # 从 WinDivert-2.2.2-A/x64/ 复制
├── WinDivert64.sys         # 从 WinDivert-2.2.2-A/x64/ 复制
├── libWinDivert.a          # MinGW import library（需手动生成，或从 CI artifact 下载）
└── WinDivert/include/
    └── windivert.h         # 已在第二步复制
```

### 如果没有 libWinDivert.a（import library）

有两种方式获取：

**方式 A：从 CI artifact 下载（推荐）**

直接在 CI 完成后从 GitHub Actions 下载 `proxybridge-dll-win` artifact，里面有所有需要的文件：

https://github.com/Roscript/ProxyBridge/actions → Build Windows Wails → 最新 run → Artifacts → proxybridge-dll-win

**方式 B：自己用 dlltool 生成**

```bash
# 在 MINGW64 终端执行，WinDivert-2.2.2-A 目录已解压
cd WinDivert-2.2.2-A

# 生成 .def 文件（直接用头文件里的导出列表）
cat > windivert.def << 'DEOF'
LIBRARY WinDivert.dll
EXPORTS
WinDivertOpen
WinDivertClose
WinDivertShutdown
WinDivertRecv
WinDivertRecvEx
WinDivertSend
WinDivertSendEx
WinDivertSetParam
WinDivertGetParam
WinDivertHelperHashPacket
WinDivertHelperParsePacket
WinDivertHelperCalcChecksums
WinDivertHelperDecrementTTL
WinDivertHelperCompileFilter
WinDivertHelperEvalFilter
WinDivertHelperFormatFilter
WinDivertHelperParseIPv4Address
WinDivertHelperParseIPv6Address
WinDivertHelperFormatIPv4Address
WinDivertHelperFormatIPv6Address
WinDivertHelperNtohs
WinDivertHelperHtons
WinDivertHelperNtohl
WinDivertHelperHtonl
WinDivertHelperNtohll
WinDivertHelperHtonll
WinDivertHelperNtohIPv6Address
WinDivertHelperHtonIPv6Address
WinDivertHelperNtohIpv6Address
WinDivertHelperHtonIpv6Address
DEOF

# 用 dlltool 生成 import library
x86_64-w64-mingw32-dlltool \
  -d windivert.def \
  -l libWinDivert.a \
  -D WinDivert.dll

# 复制到 proxybridge/ 目录
cp libWinDivert.a /path/to/proxybridge/
```

### 复制 WinDivert 运行时文件

```powershell
# 在 MINGW64 终端执行
# 假设你的项目在 D:\projects\ProxyBridge
PROJ=D:/projects/ProxyBridge/gui-wails/proxybridge-gui/proxybridge
WINROOT=WinDivert-2.2.2-A

cp $WINROOT/x64/WinDivert.dll $PROJ/
cp $WINROOT/x64/WinDivert64.sys $PROJ/
```

---

## 第四步：编译 ProxyBridgeCore.dll（如需重编）

ProxyBridgeCore.dll 是 C 语言写的 WinDivert 封装 DLL。如果 artifact 里有现成的，跳过这一步。

```bash
# 在 MINGW64 终端执行
# 假设项目在 D:/projects/ProxyBridge
cd D:/projects/ProxyBridge

WINROOT=WinDivert-2.2.2-A

x86_64-w64-mingw32-gcc -shared -O2 -s -Wall \
  -D_WIN32_WINNT=0x0601 -DPROXYBRIDGE_EXPORTS \
  -I"$WINROOT/include" \
  Windows/src/ProxyBridge.c \
  -L/usr/x86_64-w64-mingw32/lib -L. \
  -lws2_32 -liphlpapi -lWinDivert \
  -o proxybridge/ProxyBridgeCore.dll
```

---

## 第五步：编译 Wails GUI

```powershell
# 在 MINGW64 终端执行
# 确认 Go 在 PATH 中
go version

# 进入 wails 项目目录
cd D:/projects/ProxyBridge/gui-wails/proxybridge-gui

# 编译（会先 build 前端，再编译 Go + 打包）
wails build
```

输出文件在 `build/bin/proxybridge-gui.exe`。

---

## 第六步：运行

把以下文件放到同一个目录：

```
proxybridge-gui.exe   # 编译产物
ProxyBridgeCore.dll   # 来自 proxybridge/ 目录
WinDivert.dll         # WinDivert 运行时
WinDivert64.sys       # WinDivert 驱动（需管理员权限加载）
```

然后以**管理员身份**运行 `proxybridge-gui.exe`。

---

## 常见问题

### `wails: command not found`

```powershell
# Go 安装到了 GOPATH/bin，确认路径
go env GOPATH
# 输出类似 C:/Users/你的用户名/go

# 把 GOPATH/bin 加入 PATH
export PATH="$PATH:$(go env GOPATH)/bin"
```

### `ld: cannot find -lproxybridge`

proxybridge 包里有 cgo 指令但找不到库文件。确认 `libProxyBridgeCore.a` 和 `WinDivert.dll` 都在 `proxybridge/` 目录里，且 cgo LDFLAGS 指向正确路径。

### `WinDivertOpen failed: The requested operation requires elevation`

正常提示。WinDivert 需要管理员权限加载驱动。用管理员身份运行 PowerShell/MINGW64 终端，再启动 exe。

### 想跳过前端单独编译 Go 部分

```powershell
wails build -s
```

---

## 快速检查清单

编译前确认 proxybridge/ 目录包含：

- [ ] `ProxyBridgeCore.dll`
- [ ] `libProxyBridgeCore.a`
- [ ] `WinDivert.dll`
- [ ] `WinDivert64.sys`
- [ ] `libWinDivert.a`
- [ ] `WinDivert/include/windivert.h`

全部就绪后，在 MINGW64 终端运行 `wails build` 即可。
