import { WebSocketProvider as EthersWebSocketProvider } from "@ethersproject/providers";
let NextId = 1;
let delay = 0; 
const delayIncrement = 7000;
export class WebSocketProvider extends EthersWebSocketProvider {
  get isReady() {
    return (this._websocket as WebSocket).readyState === WebSocket.OPEN;
  }

  set onClose(closeListener: ((closeEvent: CloseEvent) => void) | null) {
    (this._websocket as WebSocket).onclose = closeListener;
  }

  close(code?: number) {
    (this._websocket as WebSocket).close(code);
  }

  async detectNetwork() {
    return this.network;
  }

  
  send(method: string, params?: Array<any>): Promise<any> {
    const rid = NextId++;
    delay += delayIncrement
    return new Promise((resolve, reject) => { 
      return new Promise((resolve) => setTimeout(resolve, delay)).then(() => {
        function callback(error: Error, result: any) {
          if (error) {
            return reject(error);
          }
          return resolve(result);
        }
  
        const payload = JSON.stringify({
          method: method,
          params: params,
          id: rid,
          jsonrpc: "2.0"
        });
  
        this.emit("debug", {
          action: "request",
          request: JSON.parse(payload),
          provider: this
        });
  
        this._requests[String(rid)] = { callback, payload };
  
        if (this._wsReady) {
          this._websocket.send(payload);
        }
      })
      
    });
  }
}
