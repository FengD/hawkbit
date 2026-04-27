import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { env } from '../config/env';

export interface TerminalMessage {
  type: 'input' | 'output' | 'resize' | 'connected' | 'disconnected' | 'error';
  data?: string;
  cols?: number;
  rows?: number;
}

export interface MqttConnectionOptions {
  clientId: string;
  username?: string;
  password?: string;
  clean?: boolean;
  reconnectPeriod?: number;
}

class MqttService {
  private client: MqttClient | null = null;
  private connected = false;
  private messageHandlers: Map<string, (message: TerminalMessage) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  isConnected(): boolean {
    return this.connected && this.client?.connected === true;
  }

  async connect(options: MqttConnectionOptions): Promise<void> {
    if (this.client?.connected) {
      await this.disconnect();
    }

    return new Promise((resolve, reject) => {
      const mqttOptions: IClientOptions = {
        clientId: options.clientId,
        username: options.username,
        password: options.password,
        clean: options.clean ?? true,
        reconnectPeriod: 0, // We handle reconnection manually
        connectTimeout: 10000,
        keepalive: 60,
      };

      try {
        this.client = mqtt.connect(env.mqttUrl, mqttOptions);

        this.client.on('connect', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          console.log('[MQTT] Connected to broker');
          resolve();
        });

        this.client.on('message', (topic: string, payload: Buffer) => {
          const handler = this.messageHandlers.get(topic);
          if (handler) {
            try {
              const message = JSON.parse(payload.toString()) as TerminalMessage;
              handler(message);
            } catch (error) {
              console.error('[MQTT] Failed to parse message:', error);
              // Try to handle as raw string
              handler({ type: 'output', data: payload.toString() });
            }
          }
        });

        this.client.on('error', (error: Error) => {
          console.error('[MQTT] Connection error:', error);
          if (!this.connected) {
            reject(error);
          }
          this.notifyHandlers({ type: 'error', data: error.message });
        });

        this.client.on('close', () => {
          this.connected = false;
          console.log('[MQTT] Connection closed');
          this.notifyHandlers({ type: 'disconnected' });
        });

        this.client.on('disconnect', () => {
          this.connected = false;
          console.log('[MQTT] Disconnected from broker');
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        // Unsubscribe from all topics
        this.messageHandlers.forEach((_, topic) => {
          this.client?.unsubscribe(topic);
        });
        this.messageHandlers.clear();

        this.client.end(false, () => {
          this.client = null;
          this.connected = false;
          console.log('[MQTT] Disconnected');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  subscribe(topic: string, handler: (message: TerminalMessage) => void): void {
    if (!this.client || !this.connected) {
      console.error('[MQTT] Not connected, cannot subscribe');
      return;
    }

    this.client.subscribe(topic, (error?: Error) => {
      if (error) {
        console.error(`[MQTT] Failed to subscribe to ${topic}:`, error);
        return;
      }
      console.log(`[MQTT] Subscribed to ${topic}`);
      this.messageHandlers.set(topic, handler);
    });
  }

  unsubscribe(topic: string): void {
    if (!this.client) return;

    this.client.unsubscribe(topic, (error?: Error) => {
      if (error) {
        console.error(`[MQTT] Failed to unsubscribe from ${topic}:`, error);
        return;
      }
      console.log(`[MQTT] Unsubscribed from ${topic}`);
      this.messageHandlers.delete(topic);
    });
  }

  publish(topic: string, message: TerminalMessage): void {
    if (!this.client || !this.connected) {
      console.error('[MQTT] Not connected, cannot publish');
      return;
    }

    this.client.publish(topic, JSON.stringify(message), { qos: 1 }, (error?: Error) => {
      if (error) {
        console.error(`[MQTT] Failed to publish to ${topic}:`, error);
      }
    });
  }

  sendInput(controllerId: string, data: string): void {
    const topic = `hawkbit/terminal/${controllerId}/input`;
    this.publish(topic, { type: 'input', data });
  }

  sendResize(controllerId: string, cols: number, rows: number): void {
    const topic = `hawkbit/terminal/${controllerId}/resize`;
    this.publish(topic, { type: 'resize', cols, rows });
  }

  subscribeToTerminal(controllerId: string, handler: (message: TerminalMessage) => void): void {
    const outputTopic = `hawkbit/terminal/${controllerId}/output`;
    this.subscribe(outputTopic, handler);
  }

  unsubscribeFromTerminal(controllerId: string): void {
    const outputTopic = `hawkbit/terminal/${controllerId}/output`;
    this.unsubscribe(outputTopic);
  }

  private notifyHandlers(message: TerminalMessage): void {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error('[MQTT] Handler error:', error);
      }
    });
  }

  async reconnect(options: MqttConnectionOptions): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[MQTT] Max reconnect attempts reached');
      throw new Error('Max reconnect attempts reached');
    }

    this.reconnectAttempts++;
    console.log(`[MQTT] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    await new Promise(resolve => setTimeout(resolve, 2000 * this.reconnectAttempts));
    return this.connect(options);
  }
}

export const mqttService = new MqttService();
