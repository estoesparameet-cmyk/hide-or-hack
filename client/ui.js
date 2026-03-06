function formatTime(totalSeconds) {
  if (totalSeconds == null) return "";
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export class UI {
  constructor() {
    this.roleEl = document.getElementById("role");
    this.timerEl = document.getElementById("timer");
    this.hintEl = document.getElementById("hint");
    this.centerEl = document.getElementById("center");

    this.role = null;
    this.timeLeftSeconds = null;
    this.message = "";
  }

  setRole(role) {
    this.role = role;
    if (!this.roleEl) return;
    if (role === "hacker") {
      this.roleEl.textContent = "Role: Hacker";
      this.roleEl.style.background = "rgba(255, 90, 90, 0.18)";
      this.roleEl.style.borderColor = "rgba(255, 90, 90, 0.35)";
    } else if (role === "agent") {
      this.roleEl.textContent = "Role: Agent";
      this.roleEl.style.background = "rgba(90, 170, 255, 0.18)";
      this.roleEl.style.borderColor = "rgba(90, 170, 255, 0.35)";
    } else {
      this.roleEl.textContent = "Connecting…";
      this.roleEl.style.background = "rgba(255, 255, 255, 0.08)";
      this.roleEl.style.borderColor = "rgba(255, 255, 255, 0.12)";
    }
  }

  setTimeLeftSeconds(timeLeftSeconds) {
    this.timeLeftSeconds = timeLeftSeconds;
    if (!this.timerEl) return;
    this.timerEl.textContent = timeLeftSeconds == null ? "" : `Time: ${formatTime(timeLeftSeconds)}`;
  }

  setMessage(message) {
    this.message = message ?? "";
    if (!this.hintEl) return;
    this.hintEl.textContent = this.message;
  }

  setCenterVisible(visible) {
    if (!this.centerEl) return;
    this.centerEl.style.display = visible ? "block" : "none";
  }
}

