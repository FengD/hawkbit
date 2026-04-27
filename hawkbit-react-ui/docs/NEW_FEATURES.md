# hawkbit-react-ui 新功能说明

本文档描述了 hawkbit-react-ui 新增的两个主要功能。

## 1. 设备类型管理 (Target Types Management)

### 功能概述
在配置页面(ConfigPage)添加了设备类型管理功能，允许用户通过图形界面管理设备类型(Target Types)。

### 功能特性
- **查看设备类型列表**: 显示所有设备类型及其详细信息
- **创建设备类型**: 支持创建新的设备类型，包括名称、Key、描述和颜色
- **编辑设备类型**: 修改现有设备类型的信息
- **删除设备类型**: 删除不需要的设备类型
- **管理兼容的分发集类型**: 为设备类型配置兼容的分发集类型

### 使用方法
1. 导航到 **配置(Config)** 页面
2. 点击 **管理设备类型(Manage Target Types)** 按钮
3. 在弹出的对话框中进行设备类型的管理操作

### API 接口
新增的 API 方法位于 [`managementApi.ts`](../src/api/managementApi.ts):
- `listTargetTypes()` - 获取设备类型列表
- `getTargetType(id)` - 获取单个设备类型
- `createTargetType(payload)` - 创建设备类型
- `updateTargetType(id, payload)` - 更新设备类型
- `deleteTargetType(id)` - 删除设备类型
- `getCompatibleDistributionSetTypes(targetTypeId)` - 获取兼容的分发集类型
- `addCompatibleDistributionSetTypes(targetTypeId, distributionSetTypeIds)` - 添加兼容的分发集类型
- `removeCompatibleDistributionSetType(targetTypeId, distributionSetTypeId)` - 移除兼容的分发集类型

### 组件
- [`TargetTypesModal.tsx`](../src/components/shared/TargetTypesModal.tsx) - 设备类型管理弹窗组件

---

## 2. MQTT Web Terminal

### 功能概述
为每个设备提供基于 MQTT 的 Web Terminal 功能，允许用户通过 Web 界面远程访问设备的终端。

### 功能特性
- **实时终端**: 基于 xterm.js 的全功能终端模拟器
- **MQTT 通信**: 通过 MQTT 协议与设备进行通信
- **连接状态显示**: 实时显示连接状态
- **全屏模式**: 支持全屏终端显示
- **自动重连**: 支持连接断开后的自动重连
- **终端自适应**: 自动调整终端大小以适应窗口

### 配置要求
在 `.env` 文件中配置以下环境变量：

```bash
# 启用 MQTT Terminal 功能
VITE_MQTT_ENABLED=true

# MQTT Broker WebSocket URL
VITE_MQTT_URL=ws://localhost:9001/mqtt
```

### 使用方法
1. 确保 MQTT Broker 已启动并正确配置
2. 在环境变量中启用 MQTT 功能
3. 导航到 **设备目标(Targets)** 页面
4. 在设备列表的操作列中点击 **终端图标**
5. 在弹出的终端窗口中进行操作

### MQTT 主题设计
终端通信使用以下 MQTT 主题：

| 主题 | 方向 | 说明 |
|------|------|------|
| `hawkbit/terminal/{controllerId}/input` | UI → Device | 终端输入 |
| `hawkbit/terminal/{controllerId}/output` | Device → UI | 终端输出 |
| `hawkbit/terminal/{controllerId}/resize` | UI → Device | 终端大小调整 |

### 消息格式
所有消息使用 JSON 格式：

```typescript
interface TerminalMessage {
  type: 'input' | 'output' | 'resize' | 'connected' | 'disconnected' | 'error';
  data?: string;      // 终端数据
  cols?: number;      // 终端列数
  rows?: number;      // 终端行数
}
```

### 设备端实现要求
设备端需要实现 MQTT 客户端来处理终端消息：

```python
# Python 示例伪代码
import paho.mqtt.client as mqtt
import subprocess

def on_message(client, userdata, msg):
    topic = msg.topic
    payload = json.loads(msg.payload)
    controller_id = topic.split('/')[2]
    
    if payload['type'] == 'input':
        # 处理终端输入
        process_input(payload['data'])
    elif payload['type'] == 'resize':
        # 调整终端大小
        resize_terminal(payload['cols'], payload['rows'])

def publish_output(controller_id, output):
    topic = f"hawkbit/terminal/{controller_id}/output"
    message = {'type': 'output', 'data': output}
    client.publish(topic, json.dumps(message))
```

### 组件和服务
- [`WebTerminal.tsx`](../src/components/shared/WebTerminal.tsx) - Web Terminal 组件
- [`mqttService.ts`](../src/services/mqttService.ts) - MQTT 服务封装

### 依赖项
新增的 npm 依赖：
- `mqtt` - MQTT 客户端库
- `xterm` - 终端模拟器
- `xterm-addon-fit` - 终端自适应插件
- `xterm-addon-web-links` - Web 链接支持插件

---

## 国际化支持
所有新增功能均支持中英文国际化：
- 英文翻译: [`en.json`](../src/i18n/en.json)
- 中文翻译: [`zh.json`](../src/i18n/zh.json)

新增翻译键：
- `targetTypes.*` - 设备类型管理相关
- `terminal.*` - Web Terminal 相关

---

## 安全注意事项

### MQTT 安全
1. 建议使用 TLS 加密连接 (wss://)
2. 配置 MQTT Broker 的认证机制
3. 限制终端主题的访问权限
4. 在生产环境中使用 ACL 控制主题订阅/发布权限

### 设备端安全
1. 验证终端命令的合法性
2. 限制可执行的命令范围
3. 记录终端操作日志
4. 实现命令超时机制

---

## 故障排除

### MQTT 连接失败
1. 检查 MQTT Broker 是否运行
2. 验证 WebSocket URL 是否正确
3. 检查网络连接和防火墙设置
4. 查看浏览器控制台的错误信息

### 终端无响应
1. 确认设备端 MQTT 客户端正常运行
2. 检查设备是否订阅了正确的主题
3. 验证消息格式是否正确
4. 检查 MQTT Broker 的日志

---

## 后续改进计划
- [ ] 支持 SSH 密钥认证
- [ ] 添加终端会话录制功能
- [ ] 支持多终端会话管理
- [ ] 添加终端主题自定义
- [ ] 实现命令历史记录
- [ ] 支持文件上传/下载
