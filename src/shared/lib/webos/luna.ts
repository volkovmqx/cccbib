export interface LunaReply { returnValue: boolean; errorCode?: number }

const LUNA_TIMEOUT_MS = 5000;

export function callLuna(uri: string, params: unknown): Promise<LunaReply> {
  return new Promise((resolve) => {
    let bridge: InstanceType<NonNullable<Window['PalmServiceBridge']>> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = (reply: LunaReply) => {
      clearTimeout(timer);
      try { if (bridge) bridge.cancel(); } catch (error) { }
      resolve(reply);
    };
    try {
      bridge = new window.PalmServiceBridge!();
      bridge.onservicecallback = (message) => {
        try { done(JSON.parse(message)); } catch (error) { done({ returnValue: false }); }
      };
      timer = setTimeout(() => done({ returnValue: false }), LUNA_TIMEOUT_MS);
      bridge.call(uri, JSON.stringify(params));
    } catch (error) {
      done({ returnValue: false });
    }
  });
}
