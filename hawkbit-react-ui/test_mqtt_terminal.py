#!/usr/bin/env python3
"""
MQTT终端设备端测试脚本
用于测试Web终端的MQTT通信功能
支持真实的shell命令执行
"""

import paho.mqtt.client as mqtt
import json
import time
import subprocess
import os
import sys
import pty
import select
import termios
import struct
import fcntl
import signal

class TerminalDevice:
    def __init__(self, broker_host='192.168.1.200', broker_port=1883, controller_id='device_102'):
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.controller_id = controller_id
        self.client = None
        self.connected = False
        
        # PTY相关
        self.master_fd = None
        self.slave_fd = None
        self.shell_process = None
        
        # MQTT主题
        self.input_topic = f'hawkbit/terminal/{controller_id}/input'
        self.output_topic = f'hawkbit/terminal/{controller_id}/output'
        self.resize_topic = f'hawkbit/terminal/{controller_id}/resize'
        
    def on_connect(self, client, userdata, flags, rc):
        """MQTT连接回调"""
        if rc == 0:
            self.connected = True
            print(f'✓ 成功连接到MQTT Broker: {self.broker_host}:{self.broker_port}')
            print(f'✓ 设备ID: {self.controller_id}')
            
            # 订阅主题
            client.subscribe(self.input_topic)
            client.subscribe(self.resize_topic)
            print(f'✓ 已订阅主题:')
            print(f'  - {self.input_topic}')
            print(f'  - {self.resize_topic}')
            print(f'✓ 发布主题:')
            print(f'  - {self.output_topic}')
            print()
            
            # 启动shell
            self.start_shell()
            
            # 发送连接成功消息
            self.send_connected()
            
        else:
            print(f'✗ 连接失败，错误代码: {rc}')
            
    def on_message(self, client, userdata, msg):
        """MQTT消息回调"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            
            # 尝试解析JSON
            try:
                message = json.loads(payload)
                message_type = message.get('type')
                
                if message_type == 'input':
                    data = message.get('data', '')
                    self.handle_input(data)
                    
                elif message_type == 'resize':
                    cols = message.get('cols', 80)
                    rows = message.get('rows', 24)
                    self.handle_resize(cols, rows)
                    
            except json.JSONDecodeError:
                # 如果不是JSON，当作原始数据处理
                self.handle_input(payload)
                
        except Exception as e:
            print(f'✗ 处理消息时出错: {e}')
            import traceback
            traceback.print_exc()
            
    def start_shell(self):
        """启动shell进程"""
        try:
            # 创建伪终端
            self.master_fd, self.slave_fd = pty.openpty()
            
            # 设置终端大小
            winsize = struct.pack('HHHH', 24, 80, 0, 0)
            fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
            
            # 启动shell
            self.shell_process = subprocess.Popen(
                ['/bin/bash'],
                stdin=self.slave_fd,
                stdout=self.slave_fd,
                stderr=self.slave_fd,
                preexec_fn=os.setsid,
                env={**os.environ, 'TERM': 'xterm-256color'}
            )
            
            # 关闭slave端，只保留master端
            os.close(self.slave_fd)
            self.slave_fd = None
            
            print(f'✓ Shell进程已启动 (PID: {self.shell_process.pid})')
            
            # 启动输出读取线程
            import threading
            output_thread = threading.Thread(target=self.read_shell_output, daemon=True)
            output_thread.start()
            
        except Exception as e:
            print(f'✗ 启动shell失败: {e}')
            import traceback
            traceback.print_exc()
            
    def read_shell_output(self):
        """读取shell输出并发送到MQTT"""
        try:
            while self.shell_process and self.shell_process.poll() is None:
                # 使用select检查是否有数据可读
                r, _, _ = select.select([self.master_fd], [], [], 0.1)
                if r:
                    try:
                        output = os.read(self.master_fd, 4096)
                        if output:
                            self.send_output(output.decode('utf-8', errors='replace'))
                    except OSError:
                        break
                time.sleep(0.01)
        except Exception as e:
            print(f'✗ 读取shell输出时出错: {e}')
            
    def handle_input(self, data):
        """处理终端输入"""
        try:
            if self.master_fd is not None:
                os.write(self.master_fd, data.encode('utf-8'))
        except Exception as e:
            print(f'✗ 处理输入时出错: {e}')
            
    def handle_resize(self, cols, rows):
        """处理终端大小调整"""
        try:
            if self.master_fd is not None:
                winsize = struct.pack('HHHH', rows, cols, 0, 0)
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
                print(f'[终端大小] 调整为 {cols}x{rows}')
        except Exception as e:
            print(f'✗ 调整终端大小时出错: {e}')
            
    def send_connected(self):
        """发送连接成功消息"""
        message = {
            'type': 'connected',
            'data': 'Device connected'
        }
        self.client.publish(self.output_topic, json.dumps(message))
        print('[发送] 连接成功消息')
        
    def send_disconnected(self):
        """发送断开连接消息"""
        message = {
            'type': 'disconnected',
            'data': 'Device disconnected'
        }
        self.client.publish(self.output_topic, json.dumps(message))
        print('[发送] 断开连接消息')
        
    def send_output(self, data):
        """发送终端输出"""
        message = {
            'type': 'output',
            'data': data
        }
        self.client.publish(self.output_topic, json.dumps(message))
        
    def cleanup(self):
        """清理资源"""
        print('\n正在清理资源...')
        
        # 发送断开连接消息
        if self.connected:
            self.send_disconnected()
        
        # 关闭shell进程
        if self.shell_process:
            try:
                self.shell_process.terminate()
                self.shell_process.wait(timeout=2)
            except:
                self.shell_process.kill()
            print('✓ Shell进程已终止')
            
        # 关闭PTY
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except:
                pass
        if self.slave_fd is not None:
            try:
                os.close(self.slave_fd)
            except:
                pass
                
        # 断开MQTT连接
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            print('✓ MQTT已断开')
            
    def start(self):
        """启动设备"""
        print(f'=== MQTT终端设备端测试程序 ===')
        print(f'Broker: {self.broker_host}:{self.broker_port}')
        print(f'设备ID: {self.controller_id}')
        print()
        
        # 创建MQTT客户端
        self.client = mqtt.Client(client_id=f'device-{self.controller_id}')
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        
        try:
            # 连接到MQTT broker
            print(f'正在连接到MQTT Broker: {self.broker_host}:{self.broker_port}...')
            self.client.connect(self.broker_host, self.broker_port, 60)
            
            # 启动网络循环
            self.client.loop_start()
            
            print()
            print('等待Web终端连接...')
            print('按 Ctrl+C 退出')
            print()
            
            # 保持运行
            while True:
                time.sleep(1)
                # 检查shell进程是否还在运行
                if self.shell_process and self.shell_process.poll() is not None:
                    print('Shell进程已退出，重新启动...')
                    self.start_shell()
                    
        except KeyboardInterrupt:
            print('\n正在退出...')
        finally:
            self.cleanup()
            print('已退出')

def main():
    # 创建并启动设备
    device = TerminalDevice(
        broker_host='192.168.1.200',
        broker_port=1883,
        controller_id='device_102'
    )
    device.start()

if __name__ == '__main__':
    main()
