import { Button, Card, Modal, Space, Spin, Tag, Typography, message } from 'antd';
import { DisconnectOutlined, FullscreenOutlined, FullscreenExitOutlined, LoadingOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { mqttService, TerminalMessage } from '../../services/mqttService';
import { env } from '../../config/env';
import 'xterm/css/xterm.css';

interface WebTerminalProps {
  open: boolean;
  onClose: () => void;
  target: {
    controllerId: string;
    name: string;
  };
}

export const WebTerminal = ({ open, onClose, target }: WebTerminalProps) => {
  const { t } = useTranslation();
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const cleanupRef = useRef(false);
  
  // 使用ref存储连接状态，避免闭包问题
  const mqttConnectedRef = useRef(false);
  const deviceConnectedRef = useRef(false);

  useEffect(() => {
    console.log('[WebTerminal] useEffect triggered', {
      open,
      mqttEnabled: env.mqttEnabled,
      mqttUrl: env.mqttUrl,
      controllerId: target.controllerId,
      initialized: initializedRef.current,
      cleanup: cleanupRef.current
    });
    
    if (!open || !env.mqttEnabled) {
      console.log('[WebTerminal] Skipping initialization', { open, mqttEnabled: env.mqttEnabled });
      return;
    }

    // 防止重复初始化（包括React StrictMode的重复执行）
    if (initializedRef.current) {
      console.log('[WebTerminal] Already initialized, skipping');
      return;
    }
    
    // 标记为已初始化
    initializedRef.current = true;
    cleanupRef.current = false;

    const initTerminal = async () => {
      console.log('[WebTerminal] initTerminal called, terminalRef.current:', terminalRef.current);
      
      if (!terminalRef.current) {
        console.log('[WebTerminal] terminalRef.current is null, waiting for DOM...');
        // 等待DOM渲染完成
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!terminalRef.current) {
          console.error('[WebTerminal] terminalRef.current still null after wait');
          return;
        }
      }

      console.log('[WebTerminal] Starting terminal initialization...');
      setConnecting(true);
      setError(null);
      setMqttConnected(false);
      setDeviceConnected(false);

      try {
        // Initialize xterm.js
        const terminal = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Consolas, "Courier New", monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#ffffff',
            selectionBackground: '#264f78',
          },
          allowProposedApi: true,
        });

        const fit = new FitAddon();
        const webLinks = new WebLinksAddon();
        terminal.loadAddon(fit);
        terminal.loadAddon(webLinks);

        terminal.open(terminalRef.current);
        fit.fit();

        terminalInstance.current = terminal;
        fitAddon.current = fit;

        // Handle terminal input
        terminal.onData((data: string) => {
          console.log('[WebTerminal] Terminal input:', data, 'mqttConnected:', mqttConnectedRef.current, 'deviceConnected:', deviceConnectedRef.current);
          if (mqttConnectedRef.current && deviceConnectedRef.current) {
            mqttService.sendInput(target.controllerId, data);
          } else {
            console.log('[WebTerminal] Cannot send input, not connected to device');
          }
        });

        // Handle terminal resize
        terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
          console.log('[WebTerminal] Terminal resize:', { cols, rows });
          if (mqttConnectedRef.current && deviceConnectedRef.current) {
            mqttService.sendResize(target.controllerId, cols, rows);
          }
        });

        // Connect to MQTT
        const clientId = `hawkbit-terminal-${target.controllerId}-${Date.now()}`;
        console.log('[WebTerminal] Connecting to MQTT with clientId:', clientId);
        await mqttService.connect({ clientId });
        setMqttConnected(true);
        mqttConnectedRef.current = true; // 更新ref
        console.log('[WebTerminal] MQTT connected');

        // Subscribe to terminal output BEFORE sending any messages
        mqttService.subscribeToTerminal(target.controllerId, (message: TerminalMessage) => {
          console.log('[WebTerminal] Received message:', message);
          
          if (message.type === 'output' && message.data) {
            terminal.write(message.data);
          } else if (message.type === 'connected') {
            setDeviceConnected(true);
            deviceConnectedRef.current = true; // 更新ref
            terminal.writeln('\r\n\x1b[32m✓ Connected to device terminal\x1b[0m\r\n');
            console.log('[WebTerminal] Device connected');
          } else if (message.type === 'disconnected') {
            setDeviceConnected(false);
            deviceConnectedRef.current = false; // 更新ref
            terminal.writeln('\r\n\x1b[31m✗ Disconnected from device\x1b[0m\r\n');
            console.log('[WebTerminal] Device disconnected');
          } else if (message.type === 'error') {
            setError(message.data || 'Connection error');
            terminal.writeln(`\r\n\x1b[31mError: ${message.data}\x1b[0m\r\n`);
            console.error('[WebTerminal] Device error:', message.data);
          }
        });

        // Send initial resize AFTER subscribing
        const { cols, rows } = terminal;
        console.log('[WebTerminal] Sending initial resize:', { cols, rows });
        mqttService.sendResize(target.controllerId, cols, rows);

        terminal.writeln('\r\n\x1b[36mConnecting to device terminal...\x1b[0m\r\n');
        
        // 如果设备已经连接（设备端在Web端连接前就已经启动），发送一个ping消息
        // 设备端收到ping后会回复connected消息
        setTimeout(() => {
          if (!deviceConnectedRef.current && mqttConnectedRef.current) {
            console.log('[WebTerminal] Device not connected yet, sending ping...');
            mqttService.sendInput(target.controllerId, '\x05'); // ENQ character
          }
        }, 1000);

      } catch (err) {
        console.error('Failed to initialize terminal:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect to terminal');
        message.error(t('terminal.connectionFailed'));
      } finally {
        setConnecting(false);
      }
    };

    initTerminal();

    return () => {
      console.log('[WebTerminal] Cleanup triggered');
      if (!cleanupRef.current) {
        cleanupRef.current = true;
        cleanup();
      }
    };
  }, [open, target.controllerId, t]);

  const cleanup = async () => {
    console.log('[WebTerminal] Cleaning up...');
    if (terminalInstance.current) {
      terminalInstance.current.dispose();
      terminalInstance.current = null;
    }
    fitAddon.current = null;
    
    if (mqttConnected) {
      mqttService.unsubscribeFromTerminal(target.controllerId);
      await mqttService.disconnect();
    }
    setMqttConnected(false);
    setDeviceConnected(false);
    mqttConnectedRef.current = false; // 重置ref
    deviceConnectedRef.current = false; // 重置ref
    setError(null);
    // 不要重置initializedRef，防止React StrictMode的重复执行
  };

  const handleDisconnect = async () => {
    await cleanup();
    onClose();
  };

  const handleFullscreen = () => {
    setFullscreen(!fullscreen);
    setTimeout(() => {
      fitAddon.current?.fit();
    }, 100);
  };

  const handleResize = () => {
    setTimeout(() => {
      fitAddon.current?.fit();
    }, 100);
  };

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!env.mqttEnabled) {
    return (
      <Modal
        title={`${t('terminal.title')} - ${target.name}`}
        open={open}
        onCancel={onClose}
        footer={null}
        width={800}
      >
        <Card>
          <Typography.Text type="warning">
            {t('terminal.notEnabled')}
          </Typography.Text>
        </Card>
      </Modal>
    );
  }

  return (
    <Modal
      title={
        <Space>
          <span>{t('terminal.title')} - {target.name}</span>
          <Tag color={mqttConnected ? 'success' : 'default'}>
            {mqttConnected ? t('terminal.connected') : t('terminal.disconnected')}
          </Tag>
          {mqttConnected && (
            <Tag color={deviceConnected ? 'success' : 'processing'}>
              {deviceConnected ? 'Device Ready' : 'Connecting...'}
            </Tag>
          )}
        </Space>
      }
      open={open}
      onCancel={handleDisconnect}
      footer={
        <Space>
          <Button
            icon={<FullscreenOutlined />}
            onClick={handleFullscreen}
            disabled={!mqttConnected}
          >
            {fullscreen ? t('terminal.exitFullscreen') : t('terminal.fullscreen')}
          </Button>
          <Button
            danger
            icon={<DisconnectOutlined />}
            onClick={handleDisconnect}
          >
            {t('terminal.disconnect')}
          </Button>
        </Space>
      }
      width={fullscreen ? '100vw' : 900}
      style={fullscreen ? { top: 0, maxWidth: '100vw', paddingBottom: 0 } : {}}
      styles={{ body: fullscreen ? { height: 'calc(100vh - 55px)', padding: 0 } : { height: 500 } }}
      destroyOnClose
    >
      {connecting && (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          zIndex: 1000 
        }}>
          <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
        </div>
      )}
      
      {error && (
        <Card style={{ marginBottom: 16 }} type="inner">
          <Typography.Text type="danger">{error}</Typography.Text>
        </Card>
      )}
      
      <div 
        ref={terminalRef} 
        style={{ 
          height: '100%', 
          width: '100%',
          backgroundColor: '#1e1e1e',
          padding: '8px',
          borderRadius: '4px'
        }} 
      />
    </Modal>
  );
};
