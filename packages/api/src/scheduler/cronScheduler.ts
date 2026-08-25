import cron from "node-cron";
import { prisma } from "../config/database.js";
import { logger } from "../config/logger.js";
import { eventBus } from "../events/eventBus.js";

function matchesCronField(value: number, field: string): boolean {
  if (field === "*") return true;
  if (field.includes(",")) return field.split(",").some(f => matchesCronField(value, f.trim()));
  if (field.includes("/")) {
    const [, step] = field.split("/");
    return value % parseInt(step) === 0;
  }
  if (field.includes("-")) {
    const [start, end] = field.split("-").map(Number);
    return value >= start && value <= end;
  }
  return parseInt(field) === value;
}

function getNextRunDate(expression: string, from: Date = new Date()): Date {
  try {
    if (!cron.validate(expression)) throw new Error("Invalid cron expression");
    const [minute, hour, dom, month, dow] = expression.trim().split(/\s+/);
    let candidate = new Date(from.getTime() + 60_000);
    candidate.setSeconds(0, 0);
    const end = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    while (candidate < end) {
      if (
        matchesCronField(candidate.getMonth() + 1, month) &&
        matchesCronField(candidate.getDate(), dom) &&
        matchesCronField(candidate.getDay(), dow) &&
        matchesCronField(candidate.getHours(), hour) &&
        matchesCronField(candidate.getMinutes(), minute)
      ) {
        return candidate;
      }
      candidate = new Date(candidate.getTime() + 60_000);
    }
    return new Date(from.getTime() + 24 * 60 * 60 * 1000);
  } catch {
    return new Date(from.getTime() + 60_000);
  }
}

async function fireDueScheduledJobs() {
  try {
    const now = new Date();
    const dueJobs = await prisma.scheduledJob.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
      include: { job: { include: { queue: true } } }
    });
    if (dueJobs.length === 0) return;
    logger.info({ count: dueJobs.length }, "Cron scheduler: firing due jobs");
    for (const scheduledJob of dueJobs) {
      try {
        const newJob = await prisma.job.create({
          data: {
            queueId: scheduledJob.job.queueId,
            type: scheduledJob.job.type,
            payload: scheduledJob.job.payload as any,
            priority: scheduledJob.job.priority,
            cronExpression: scheduledJob.cronExpression,
            status: "QUEUED",
          }
        });
        const nextRunAt = getNextRunDate(scheduledJob.cronExpression, now);
        await prisma.scheduledJob.update({
          where: { id: scheduledJob.id },
          data: { lastRunAt: now, nextRunAt }
        });
        eventBus.emit("job.created", { ...newJob, projectId: scheduledJob.job.queue.projectId });
        logger.info({ scheduledJobId: scheduledJob.id, newJobId: newJob.id, nextRunAt }, "Cron job fired");
      } catch (err) {
        logger.error({ err, scheduledJobId: scheduledJob.id }, "Failed to fire cron job");
      }
    }
  } catch (err) {
    logger.error({ err }, "Cron scheduler tick error");
  }
}

export function startCronScheduler(): void {
  cron.schedule("* * * * *", fireDueScheduledJobs);
  logger.info("Cron scheduler started (ticking every minute)");
}
