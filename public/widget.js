(function () {
  if (typeof window === "undefined" || window.__resolvdWidgetMounted) return;

  var script =
    document.currentScript ||
    document.querySelector("script[data-workspace-id]");
  if (!script) return;

  var workspaceId = script.getAttribute("data-workspace-id");
  if (!workspaceId) return;

  window.__resolvdWidgetMounted = true;

  var baseUrl = script.getAttribute("data-base-url");
  if (!baseUrl) {
    try {
      baseUrl = new URL(script.src, window.location.href).origin;
    } catch {
      baseUrl = window.location.origin;
    }
  }

  var state = {
    open: false,
    proactiveDismissed: false,
    proactiveTimer: null,
    config: {
      primaryColor: "#14532d",
      position: "bottom-right",
      marginBottom: 20,
      marginSide: 20,
      borderRadius: 16,
      soundEnabled: true,
      proactiveEnabled: false,
      proactiveDelaySeconds: 8,
      proactiveMessage: "Need a hand? Ask our team or AI assistant.",
      title: "Support",
    },
  };

  var root = document.createElement("div");
  root.id = "resolvd-widget-root";
  root.style.position = "fixed";
  root.style.zIndex = "2147483000";
  root.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  var iframeWrap = document.createElement("div");
  iframeWrap.style.position = "fixed";
  iframeWrap.style.width = "380px";
  iframeWrap.style.maxWidth = "calc(100vw - 24px)";
  iframeWrap.style.height = "600px";
  iframeWrap.style.maxHeight = "calc(100dvh - 104px)";
  iframeWrap.style.boxShadow = "0 18px 48px rgba(0, 0, 0, 0.16)";
  iframeWrap.style.border = "1px solid rgba(0, 0, 0, 0.08)";
  iframeWrap.style.overflow = "hidden";
  iframeWrap.style.background = "#ffffff";
  iframeWrap.style.opacity = "0";
  iframeWrap.style.pointerEvents = "none";
  iframeWrap.style.transform = "translateY(12px) scale(0.98)";
  iframeWrap.style.transition =
    "opacity 180ms ease, transform 180ms ease";

  var iframe = document.createElement("iframe");
  iframe.src = baseUrl.replace(/\/$/, "") + "/embed/" + encodeURIComponent(workspaceId);
  iframe.title = "Resolvd Support Widget";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.setAttribute("allow", "clipboard-write");
  iframeWrap.appendChild(iframe);

  var proactiveBubble = document.createElement("div");
  proactiveBubble.style.position = "fixed";
  proactiveBubble.style.maxWidth = "270px";
  proactiveBubble.style.background = "#ffffff";
  proactiveBubble.style.color = "#111827";
  proactiveBubble.style.border = "1px solid rgba(0, 0, 0, 0.1)";
  proactiveBubble.style.borderRadius = "12px";
  proactiveBubble.style.padding = "10px 32px 10px 12px";
  proactiveBubble.style.boxShadow = "0 10px 28px rgba(0, 0, 0, 0.12)";
  proactiveBubble.style.fontSize = "13px";
  proactiveBubble.style.lineHeight = "1.4";
  proactiveBubble.style.cursor = "pointer";
  proactiveBubble.style.display = "none";

  var proactiveText = document.createElement("span");
  proactiveBubble.appendChild(proactiveText);

  var proactiveClose = document.createElement("button");
  proactiveClose.type = "button";
  proactiveClose.setAttribute("aria-label", "Dismiss message");
  proactiveClose.textContent = "×";
  proactiveClose.style.position = "absolute";
  proactiveClose.style.top = "6px";
  proactiveClose.style.right = "8px";
  proactiveClose.style.border = "0";
  proactiveClose.style.background = "transparent";
  proactiveClose.style.color = "#6b7280";
  proactiveClose.style.fontSize = "16px";
  proactiveClose.style.lineHeight = "1";
  proactiveClose.style.cursor = "pointer";
  proactiveBubble.appendChild(proactiveClose);

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open support chat");
  launcher.style.position = "fixed";
  launcher.style.width = "54px";
  launcher.style.height = "54px";
  launcher.style.borderRadius = "9999px";
  launcher.style.border = "0";
  launcher.style.color = "#ffffff";
  launcher.style.cursor = "pointer";
  launcher.style.display = "flex";
  launcher.style.alignItems = "center";
  launcher.style.justifyContent = "center";
  launcher.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.18)";
  launcher.style.transition = "transform 160ms ease, opacity 160ms ease";

  var chatIconSvg =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var closeIconSvg =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  launcher.innerHTML = chatIconSvg;

  function playChime() {
    if (!state.config.soundEnabled) return;
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var ctx = new AudioCtx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // Ignore audio autoplay restrictions
    }
  }

  function applyLayout() {
    var c = state.config;
    var isLeft = c.position === "bottom-left";
    var side = Math.max(8, Number(c.marginSide) || 20);
    var bottom = Math.max(8, Number(c.marginBottom) || 20);
    var radius = Math.max(4, Number(c.borderRadius) || 16);

    launcher.style.backgroundColor = c.primaryColor || "#14532d";
    launcher.style.bottom = bottom + "px";
    launcher.style.left = isLeft ? side + "px" : "auto";
    launcher.style.right = isLeft ? "auto" : side + "px";

    iframeWrap.style.borderRadius = radius + "px";
    iframeWrap.style.bottom = bottom + 68 + "px";
    iframeWrap.style.left = isLeft ? side + "px" : "auto";
    iframeWrap.style.right = isLeft ? "auto" : side + "px";

    proactiveBubble.style.bottom = bottom + 68 + "px";
    proactiveBubble.style.left = isLeft ? side + "px" : "auto";
    proactiveBubble.style.right = isLeft ? "auto" : side + "px";
    proactiveText.textContent =
      c.proactiveMessage || "Need a hand? Ask our team or AI assistant.";
  }

  function setOpen(nextOpen) {
    state.open = nextOpen;
    if (nextOpen) {
      proactiveBubble.style.display = "none";
      iframeWrap.style.opacity = "1";
      iframeWrap.style.pointerEvents = "auto";
      iframeWrap.style.transform = "translateY(0) scale(1)";
      launcher.innerHTML = closeIconSvg;
      launcher.setAttribute("aria-label", "Close support chat");
    } else {
      iframeWrap.style.opacity = "0";
      iframeWrap.style.pointerEvents = "none";
      iframeWrap.style.transform = "translateY(12px) scale(0.98)";
      launcher.innerHTML = chatIconSvg;
      launcher.setAttribute("aria-label", "Open support chat");
    }
  }

  function scheduleProactive() {
    if (state.proactiveTimer) {
      clearTimeout(state.proactiveTimer);
      state.proactiveTimer = null;
    }
    if (
      !state.config.proactiveEnabled ||
      state.open ||
      state.proactiveDismissed
    ) {
      return;
    }
    var delayMs = Math.max(1, Number(state.config.proactiveDelaySeconds) || 8) * 1000;
    state.proactiveTimer = setTimeout(function () {
      if (state.open || state.proactiveDismissed) return;
      proactiveBubble.style.display = "block";
      playChime();
    }, delayMs);
  }

  launcher.addEventListener("click", function () {
    setOpen(!state.open);
  });

  proactiveClose.addEventListener("click", function (e) {
    e.stopPropagation();
    state.proactiveDismissed = true;
    proactiveBubble.style.display = "none";
  });

  proactiveBubble.addEventListener("click", function () {
    setOpen(true);
  });

  window.addEventListener("message", function (event) {
    if (event.source !== iframe.contentWindow) return;
    var data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "resolvd:close") {
      setOpen(false);
    } else if (data.type === "resolvd:config" && data.config) {
      state.config = Object.assign({}, state.config, data.config);
      applyLayout();
      scheduleProactive();
    }
  });

  applyLayout();
  root.appendChild(proactiveBubble);
  root.appendChild(iframeWrap);
  root.appendChild(launcher);

  function mount() {
    if (!document.getElementById("resolvd-widget-root")) {
      document.body.appendChild(root);
    }
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener("DOMContentLoaded", mount);
  }
})();
