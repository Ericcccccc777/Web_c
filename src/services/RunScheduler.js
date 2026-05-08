class RunScheduler {
  constructor({ service, settingsStore }) {
    this.service = service;
    this.settingsStore = settingsStore;
    this.timer = null;
  }

  async start() {
    await this.scheduleNext();
  }

  async refresh() {
    this.stop();
    await this.scheduleNext();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async scheduleNext() {
    const settings = await this.settingsStore.load();
    const nextRun = this.nextRunAt(settings.scheduleTimes);
    const delay = Math.max(nextRun.getTime() - Date.now(), 1000);

    this.timer = setTimeout(async () => {
      try {
        await this.service.run(undefined, { source: "auto" });
      } catch (error) {
        console.error("Scheduled run failed:", error);
      } finally {
        await this.scheduleNext();
      }
    }, delay);

    this.timer.unref?.();
  }

  nextRunAt(times) {
    const now = new Date();
    const candidates = times.map((time) => this.dateForTime(now, time));
    const todayRun = candidates.find((candidate) => candidate > now);

    if (todayRun) {
      return todayRun;
    }

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.dateForTime(tomorrow, times[0]);
  }

  dateForTime(baseDate, time) {
    const [hour, minute] = time.split(":").map(Number);
    const value = new Date(baseDate);
    value.setHours(hour, minute, 0, 0);
    return value;
  }
}

module.exports = { RunScheduler };
