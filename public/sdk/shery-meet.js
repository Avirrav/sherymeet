"use strict";
var SheryMeetSDK = (() => {
  var m = Object.defineProperty;
  var v = Object.getOwnPropertyDescriptor;
  var f = Object.getOwnPropertyNames;
  var g = Object.prototype.hasOwnProperty;
  var p = (i, e) => {
      for (var t in e) m(i, t, { get: e[t], enumerable: !0 });
    },
    y = (i, e, t, n) => {
      if ((e && typeof e == "object") || typeof e == "function")
        for (let s of f(e))
          !g.call(i, s) &&
            s !== t &&
            m(i, s, { get: () => e[s], enumerable: !(n = v(e, s)) || n.enumerable });
      return i;
    };
  var E = (i) => y(m({}, "__esModule", { value: !0 }), i);
  var w = {};
  p(w, { SheryMeet: () => a, default: () => h });
  var b = "sherymeet-sdk",
    M = "sherymeet";
  var l = class l {
    constructor(e) {
      this.iframe = null;
      this.listeners = new Map();
      this.isReady = !1;
      this.readyResolve = null;
      this.currentRoomId = null;
      this.state = null;
      if (typeof e.container == "string") {
        let t = document.querySelector(e.container);
        if (!t) throw new Error(`[SheryMeet] Container not found: ${e.container}`);
        this.container = t;
      } else this.container = e.container;
      ((this.baseUrl = e.baseUrl || this.detectBaseUrl()),
        (this.debug = e.debug || !1),
        (this.readyPromise = new Promise((t) => {
          this.readyResolve = t;
        })),
        (this.boundMessageHandler = this.handleMessage.bind(this)),
        window.addEventListener("message", this.boundMessageHandler),
        this.log("SDK initialized", { baseUrl: this.baseUrl, version: l.VERSION }));
    }
    detectBaseUrl() {
      if (typeof document < "u") {
        let e = document.querySelectorAll('script[src*="shery-meet"]');
        for (let t of e) {
          let n = t.getAttribute("src");
          if (n)
            try {
              return new URL(n, window.location.href).origin;
            } catch {}
        }
      }
      return typeof window < "u" ? window.location.origin : "https://sherymeet.pugly.in";
    }
    log(...e) {
      this.debug && console.log("[SheryMeet SDK]", ...e);
    }
    handleMessage(e) {
      if (!this.iframe || e.source !== this.iframe.contentWindow) return;
      let t = e.data;
      if (!t || t.source !== M) return;
      this.log("Received event:", t.type, t.payload);
      let n = t.type;
      (n === "ready" &&
        (this.sendMessage({ type: "init" }), (this.isReady = !0), this.readyResolve?.()),
        n === "state-changed" && (this.state = t.payload),
        this.emit(n, t.payload));
    }
    sendMessage(e) {
      if (!this.iframe?.contentWindow) {
        this.log("Cannot send message: iframe not ready");
        return;
      }
      let t = { source: b, v: 1, ...e };
      (this.log("Sending:", e), this.iframe.contentWindow.postMessage(t, this.baseUrl));
    }
    sendCommand(e, t) {
      this.sendMessage({ type: "command", command: e, payload: t });
    }
    emit(e, t) {
      let n = this.listeners.get(e);
      n &&
        n.forEach((s) => {
          try {
            s(t);
          } catch (r) {
            console.error(`[SheryMeet] Error in ${e} handler:`, r);
          }
        });
    }
    createIframe(e, t) {
      this.iframe &&
        (this.iframe.remove(),
        (this.isReady = !1),
        (this.readyPromise = new Promise((s) => {
          this.readyResolve = s;
        })));
      let n = document.createElement("iframe");
      return (
        (n.src = `${this.baseUrl}/meet/${e}?${t.toString()}`),
        (n.style.cssText = "width:100%;height:100%;border:none;"),
        (n.allow = "camera;microphone;display-capture;autoplay;clipboard-write;fullscreen"),
        n.setAttribute("allowfullscreen", "true"),
        this.container.appendChild(n),
        (this.iframe = n),
        n
      );
    }
    async join(e, t) {
      (this.log("Joining room:", e), (this.currentRoomId = e));
      let n = new URLSearchParams();
      return (
        n.set("embed", "1"),
        n.set("token", t.token),
        n.set("username", t.username),
        t.email && n.set("email", t.email),
        t.audioEnabled !== void 0 && n.set("audio", t.audioEnabled ? "1" : "0"),
        t.videoEnabled !== void 0 && n.set("video", t.videoEnabled ? "1" : "0"),
        this.createIframe(e, n),
        await this.readyPromise,
        new Promise((s, r) => {
          let c = setTimeout(() => {
              (this.off("joined", o),
                this.off("error", d),
                r(new Error("Join timeout - meeting may not be active")));
            }, 3e4),
            o = () => {
              (clearTimeout(c), this.off("joined", o), this.off("error", d), s());
            },
            d = (u) => {
              (clearTimeout(c),
                this.off("joined", o),
                this.off("error", d),
                r(new Error(u.message)));
            };
          (this.on("joined", o), this.on("error", d));
        })
      );
    }
    leave() {
      (this.log("Leaving meeting"), this.sendCommand("leave"));
    }
    endMeeting() {
      (this.log("Ending meeting"), this.sendCommand("end"));
    }
    destroy() {
      (this.log("Destroying SDK"),
        window.removeEventListener("message", this.boundMessageHandler),
        this.listeners.clear(),
        this.iframe && (this.iframe.remove(), (this.iframe = null)),
        (this.isReady = !1),
        (this.currentRoomId = null),
        (this.state = null));
    }
    toggleCamera(e) {
      this.sendCommand("toggle-camera", e !== void 0 ? { enabled: e } : void 0);
    }
    toggleMic(e) {
      this.sendCommand("toggle-mic", e !== void 0 ? { enabled: e } : void 0);
    }
    toggleScreenShare(e) {
      this.sendCommand("toggle-screen-share", e !== void 0 ? { enabled: e } : void 0);
    }
    sendChat(e, t = "everyone") {
      this.sendCommand("send-chat", { message: e, recipient: t });
    }
    raiseHand(e) {
      this.sendCommand("raise-hand", e !== void 0 ? { raised: e } : void 0);
    }
    setLayout(e) {
      this.sendCommand("set-layout", { mode: e });
    }
    requestState() {
      this.sendCommand("get-state");
    }
    fullscreen(e) {
      this.sendCommand("fullscreen", e !== void 0 ? { enabled: e } : void 0);
    }
    enterFullscreen() {
      this.fullscreen(!0);
    }
    exitFullscreen() {
      this.fullscreen(!1);
    }
    getState() {
      return this.state;
    }
    getRoomId() {
      return this.currentRoomId;
    }
    getIsReady() {
      return this.isReady;
    }
    on(e, t) {
      (this.listeners.has(e) || this.listeners.set(e, new Set()), this.listeners.get(e).add(t));
    }
    off(e, t) {
      let n = this.listeners.get(e);
      n && n.delete(t);
    }
    once(e, t) {
      let n = (s) => {
        (this.off(e, n), t(s));
      };
      this.on(e, n);
    }
  };
  l.VERSION = "1.0.0";
  var a = l,
    h = a;
  return E(w);
})();
window.SheryMeet = SheryMeetSDK.SheryMeet;
//# sourceMappingURL=index.global.js.map
