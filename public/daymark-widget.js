(function () {
  "use strict";

  var script = document.currentScript;
  if (!script || !script.src) return;

  if (!document.body) {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  function initialize() {
    if (!document.body) return;

    var origin = new URL(script.src).origin;
    var workspace = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])$/.test(script.dataset.workspace || "")
      ? script.dataset.workspace
      : "";
    if (!workspace) {
      showUnavailable();
      return;
    }
    var mode = script.dataset.mode === "inline" ? "inline" : "floating";
    var employee = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/.test(script.dataset.employee || "")
      ? script.dataset.employee
      : "all";
    var service = script.dataset.service || "all";
    if (
      service !== "all" &&
      !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(service)
    ) {
      showUnavailable();
      return;
    }
    var rawLabel = (script.dataset.label || "").trim();
    var label = rawLabel.length >= 1 && rawLabel.length <= 80
      ? rawLabel
      : "Book an appointment";
    var channel = crypto.randomUUID();
    var widgetId = "daymark-widget-" + channel;
    var wrapper = document.createElement("div");
    var frameMount = document.createElement("div");
    var iframe = document.createElement("iframe");
    var launcher = null;
    var closeButton = null;
    var beforeFrame = null;
    var afterFrame = null;
    var frameFocusActive = false;
    var panelOpen = mode === "inline";
    var handshakeComplete = false;

    installStyles();
    wrapper.className = "daymark-widget daymark-widget--" + mode;
    wrapper.id = widgetId;
    frameMount.className = "daymark-widget__frame";
    iframe.title = "Daymark appointment booking";
    iframe.setAttribute("sandbox", "allow-scripts allow-forms allow-same-origin");
    iframe.setAttribute("loading", "eager");
    iframe.src = origin + "/embed?workspace=" + encodeURIComponent(workspace) + "&employee=" + encodeURIComponent(employee) + "&service=" + encodeURIComponent(service) + "&channel=" + encodeURIComponent(channel);
    iframe.style.height = "680px";
    frameMount.appendChild(iframe);

    var loadTimer = window.setTimeout(showFallback, 10000);

    if (mode === "inline") {
      wrapper.appendChild(frameMount);
      if (script.parentElement && script.parentElement.closest("body")) {
        script.insertAdjacentElement("afterend", wrapper);
      } else {
        document.body.appendChild(wrapper);
      }
    } else {
      launcher = document.createElement("button");
      launcher.type = "button";
      launcher.className = "daymark-widget__launcher";
      launcher.id = widgetId + "-launcher";
      launcher.textContent = label;
      launcher.setAttribute("aria-haspopup", "dialog");
      launcher.setAttribute("aria-expanded", "false");
      launcher.setAttribute("aria-controls", widgetId);

      closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "daymark-widget__close";
      closeButton.textContent = "Close";
      closeButton.setAttribute("aria-label", "Close appointment booking");

      beforeFrame = focusSentinel("before");
      afterFrame = focusSentinel("after");
      iframe.addEventListener("focus", function () {
        frameFocusActive = true;
      });
      beforeFrame.addEventListener("focus", function () {
        if (frameFocusActive && closeButton) {
          frameFocusActive = false;
          closeButton.focus();
        } else iframe.focus();
      });
      afterFrame.addEventListener("focus", function () {
        if (frameFocusActive && launcher) {
          frameFocusActive = false;
          launcher.focus();
        } else iframe.focus();
      });
      launcher.addEventListener("focus", function () { frameFocusActive = false; });
      closeButton.addEventListener("focus", function () { frameFocusActive = false; });

      wrapper.className += " daymark-widget__panel";
      wrapper.hidden = true;
      wrapper.setAttribute("role", "dialog");
      wrapper.setAttribute("aria-modal", "true");
      wrapper.setAttribute("aria-labelledby", launcher.id);
      wrapper.appendChild(closeButton);
      wrapper.appendChild(beforeFrame);
      wrapper.appendChild(frameMount);
      wrapper.appendChild(afterFrame);
      document.body.appendChild(launcher);
      document.body.appendChild(wrapper);

      launcher.addEventListener("click", openPanel);
      closeButton.addEventListener("click", closePanel);
      document.addEventListener("daymark:widget-activate", receiveActivation);
      document.addEventListener("keydown", trapKeyboard);
    }

    window.addEventListener("message", receiveMessage);

    function receiveMessage(event) {
      if (event.origin !== origin || event.source !== iframe.contentWindow) return;
      var message = event.data;
      if (!message || typeof message !== "object" || Array.isArray(message)) return;
      if (message.channel !== channel) return;

      if (
        message.type === "daymark:resize" &&
        Object.keys(message).length === 3 &&
        typeof message.height === "number" &&
        Number.isInteger(message.height) &&
        message.height >= 280 &&
        message.height <= 1200
      ) {
        iframe.style.height = message.height + "px";
        if (!handshakeComplete) {
          handshakeComplete = true;
          window.clearTimeout(loadTimer);
        }
        return;
      }

      if (message.type === "daymark:close" && Object.keys(message).length === 2 && mode === "floating") {
        closePanel();
      }
    }

    function openPanel() {
      if (!launcher || !closeButton) return;
      document.dispatchEvent(new CustomEvent("daymark:widget-activate", {
        detail: { channel: channel },
      }));
      panelOpen = true;
      wrapper.hidden = false;
      launcher.setAttribute("aria-expanded", "true");
      window.requestAnimationFrame(function () {
        closeButton.focus();
      });
    }

    function closePanel(restoreFocus) {
      if (!launcher || !panelOpen) return;
      panelOpen = false;
      wrapper.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "daymark:reset", channel: channel }, origin);
      }
      if (restoreFocus !== false) launcher.focus();
    }

    function receiveActivation(event) {
      var detail = event.detail;
      if (
        !panelOpen ||
        !detail ||
        typeof detail !== "object" ||
        Object.keys(detail).length !== 1 ||
        typeof detail.channel !== "string" ||
        detail.channel === channel
      ) return;
      closePanel(false);
    }

    function trapKeyboard(event) {
      if (!panelOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }
      if (event.key !== "Tab") return;

      var controls = [launcher].concat(Array.prototype.slice.call(
        wrapper.querySelectorAll("button, a[href], iframe, [tabindex]:not([tabindex='-1'])"),
      )).filter(function (control) {
        return control && !control.disabled && control.tabIndex !== -1 && !control.hidden;
      });
      if (!controls.length) return;
      var first = controls[0];
      var last = controls[controls.length - 1];
      if (controls.indexOf(document.activeElement) === -1) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function showFallback() {
      if (handshakeComplete) return;
      window.clearTimeout(loadTimer);
      window.removeEventListener("message", receiveMessage);
      frameFocusActive = false;
      if (beforeFrame) beforeFrame.remove();
      if (afterFrame) afterFrame.remove();
      iframe.remove();
      var fallback = document.createElement("div");
      fallback.className = "daymark-widget__fallback";
      var message = document.createElement("p");
      message.textContent = "Booking is taking longer than expected.";
      var link = document.createElement("a");
      link.href = origin + "/book/" + encodeURIComponent(workspace) + (
        service === "all" ? "" : "?service=" + encodeURIComponent(service)
      );
      link.target = "_top";
      link.textContent = "Book directly with Daymark";
      fallback.appendChild(message);
      fallback.appendChild(link);
      frameMount.replaceChildren(fallback);
    }

    function focusSentinel(position) {
      var sentinel = document.createElement("span");
      sentinel.className = "daymark-widget__sentinel";
      sentinel.tabIndex = 0;
      sentinel.dataset.daymarkFocus = position;
      return sentinel;
    }

    function showUnavailable() {
      var unavailable = document.createElement("span");
      unavailable.className = "daymark-widget-unavailable";
      unavailable.textContent = "Booking unavailable.";
      script.insertAdjacentElement("afterend", unavailable);
    }

    function installStyles() {
      var style = document.createElement("style");
      style.textContent = [
        ".daymark-widget{font-family:Arial,sans-serif;color:#172722;box-sizing:border-box}",
        ".daymark-widget *{box-sizing:border-box}",
        ".daymark-widget__frame,.daymark-widget iframe{width:100%}",
        ".daymark-widget iframe{display:block;border:0;min-height:280px;background:#f2eadc}",
        ".daymark-widget--inline{width:100%}",
        ".daymark-widget__launcher{position:fixed;right:24px;bottom:24px;z-index:2147483646;border:1px solid #172722;border-radius:999px;padding:14px 20px;background:#df654b;color:#172722;font:700 15px/1.2 Arial,sans-serif;box-shadow:4px 4px 0 #172722;cursor:pointer}",
        ".daymark-widget__launcher:focus-visible,.daymark-widget__close:focus-visible,.daymark-widget__fallback a:focus-visible{outline:3px solid #df654b;outline-offset:3px}",
        ".daymark-widget__panel{position:fixed;right:24px;bottom:84px;z-index:2147483647;width:min(760px,calc(100vw - 32px));max-height:calc(100vh - 108px);overflow:auto;border:1px solid #172722;background:#fbf7ef;box-shadow:8px 8px 0 #172722}",
        ".daymark-widget__panel[hidden]{display:none}",
        ".daymark-widget__close{display:block;margin:10px 10px 10px auto;border:1px solid #172722;background:#fbf7ef;padding:7px 12px;color:#172722;font:700 13px/1.2 Arial,sans-serif;cursor:pointer}",
        ".daymark-widget__sentinel{position:absolute;width:1px;height:1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
        ".daymark-widget__fallback{min-height:280px;display:grid;place-content:center;gap:12px;padding:32px;text-align:center;background:#fbf7ef}",
        ".daymark-widget__fallback p{margin:0}",
        ".daymark-widget__fallback a{font-weight:700;color:#172722}",
        "@media(max-width:640px){.daymark-widget__launcher{right:12px;bottom:12px}.daymark-widget__panel{inset:0;width:100vw;max-height:100vh;box-shadow:none}.daymark-widget__panel iframe{height:calc(100vh - 52px)!important}}",
        "@media(prefers-reduced-motion:reduce){.daymark-widget *{scroll-behavior:auto!important;transition:none!important}}",
      ].join("");
      document.head.appendChild(style);
    }
  }
})();
