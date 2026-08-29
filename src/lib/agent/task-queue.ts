/**
 * Cloud Tasks Client for Da-Costa Svalinn
 * Provides task queue operations for the autonomous agent loop.
 */

import { CloudTasksClient, protos } from '@google-cloud/tasks';
import { v4 as uuidv4 } from 'uuid';

// Types
export type TaskType = 
  | 'PERCEIVE' 
  | 'PLAN' 
  | 'ACT' 
  | 'VERIFY' 
  | 'LEARN'
  | 'SCHEDULED_SCAN'
  | 'IOC_PROCESSING'
  | 'PLAYBOOK_EXECUTION'
  | 'NOTIFICATION_DISPATCH'
  | 'CASE_SLA_CHECK';

export interface TaskPayload {
  taskId: string;
  type: TaskType;
  payload: Record<string, unknown>;
  priority: number; // 1-10, higher = more urgent
  maxRetries: number;
  idempotencyKey: string;
  createdAt: string;
  scheduledFor?: string; // ISO timestamp for future execution
}

export interface QueueConfig {
  name: string;
  location: string;
  projectId: string;
}

class TaskQueueClient {
  private client: CloudTasksClient;
  private projectId: string;
  private location: string;

  constructor(config: QueueConfig) {
    this.client = new CloudTasksClient();
    this.projectId = config.projectId;
    this.location = config.location;
  }

  private getQueuePath(queueName: string): string {
    return this.client.queuePath(this.projectId, this.location, queueName);
  }

  /**
   * Create a task in the specified queue.
   */
  async createTask(
    queueName: string,
    payload: Omit<TaskPayload, 'taskId' | 'idempotencyKey' | 'createdAt'> & { taskId?: string; idempotencyKey?: string }
  ): Promise<string> {
    const taskId = payload.taskId || uuidv4();
    const idempotencyKey = payload.idempotencyKey || `${queueName}:${taskId}`;
    const createdAt = new Date().toISOString();

    const fullPayload: TaskPayload = {
      taskId,
      idempotencyKey,
      createdAt,
      type: payload.type,
      payload: payload.payload,
      priority: payload.priority ?? 5,
      maxRetries: payload.maxRetries ?? 3,
      scheduledFor: payload.scheduledFor,
    };

    const queuePath = this.getQueuePath(queueName);

    // Determine target URL based on queue
    const targetUrl = this.getTargetUrl(queueName);

    const task: protos.google.cloud.tasks.v2.ITask = {
      name: `${queuePath}/tasks/${taskId}`,
      httpRequest: {
        httpMethod: 'POST' as const,
        url: targetUrl,
        headers: {
          'Content-Type': 'application/json',
          'X-CloudTasks-TaskId': taskId,
          'X-CloudTasks-QueueName': queueName,
        },
        body: Buffer.from(JSON.stringify(fullPayload)).toString('base64'),
      },
      scheduleTime: payload.scheduledFor 
        ? { seconds: Math.floor(new Date(payload.scheduledFor).getTime() / 1000) }
        : undefined,
      dispatchDeadline: { seconds: 300 }, // 5 minutes
    };

    try {
      const [response] = await this.client.createTask({
        parent: queuePath,
        task,
        // Idempotency: if task with same name exists, this will fail
        // We handle that by checking if it's a duplicate
      });
      console.log(`[TaskQueue] Created task ${taskId} in queue ${queueName}`);
      return response.name;
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 6) { // ALREADY_EXISTS
        console.log(`[TaskQueue] Task ${taskId} already exists (idempotent)`);
        return `${queuePath}/tasks/${taskId}`;
      }
      console.error(`[TaskQueue] Failed to create task in ${queueName}:`, err);
      throw error;
    }
  }

  /**
   * Get the target Cloud Run service URL for a queue.
   */
  private getTargetUrl(queueName: string): string {
    const baseUrl = process.env.CLOUD_RUN_BASE_URL || 'https://europe-west1-da-costa-unisoc23v1-6386-61f95.cloudfunctions.net';
    
    const queueTargets: Record<string, string> = {
      'analyst-agent-loop': `${baseUrl}/api/agent/task-worker`,
      'scheduled-scan-callback': `${baseUrl}/api/orchestrator/scan-callback`,
      'notification-dispatch': `${baseUrl}/api/notifications/dispatch`,
      'ioc-processing': `${baseUrl}/api/ioc/process`,
      'playbook-execution': `${baseUrl}/api/playbooks/execute`,
    };

    return queueTargets[queueName] || `${baseUrl}/api/tasks/generic`;
  }

  /**
   * Enqueue a task for the agent loop (perceive → plan → act → verify → learn).
   */
  async enqueueAgentLoopStep(
    step: TaskType,
    payload: Record<string, unknown>,
    options: { priority?: number; retries?: number; idempotencyKey?: string } = {}
  ): Promise<string> {
    return this.createTask('analyst-agent-loop', {
      type: step,
      payload,
      priority: options.priority ?? 5,
      maxRetries: options.retries ?? 3,
      idempotencyKey: options.idempotencyKey,
    });
  }

  /**
   * Enqueue a scheduled scan callback.
   */
  async enqueueScanCallback(scanId: string, results: unknown): Promise<string> {
    return this.createTask('scheduled-scan-callback', {
      type: 'SCHEDULED_SCAN',
      payload: { scanId, results },
      priority: 5,
      maxRetries: 2,
    });
  }

  /**
   * Enqueue a notification dispatch.
   */
  async enqueueNotification(
    userId: string,
    channels: string[],
    template: string,
    data: Record<string, unknown>
  ): Promise<string> {
    return this.createTask('notification-dispatch', {
      type: 'NOTIFICATION_DISPATCH',
      payload: { userId, channels, template, data },
      priority: 8,
      maxRetries: 3,
    });
  }

  /**
   * Enqueue IOC processing.
   */
  async enqueueIocProcessing(iocIds: string[], source: string): Promise<string> {
    return this.createTask('ioc-processing', {
      type: 'IOC_PROCESSING',
      payload: { iocIds, source },
      priority: 6,
      maxRetries: 3,
    });
  }

  /**
   * Enqueue playbook execution.
   */
  async enqueuePlaybookExecution(
    playbookId: string,
    incidentId: string,
    context: Record<string, unknown>
  ): Promise<string> {
    return this.createTask('playbook-execution', {
      type: 'PLAYBOOK_EXECUTION',
      payload: { playbookId, incidentId, context },
      priority: 7,
      maxRetries: 2,
      idempotencyKey: `playbook:${playbookId}:incident:${incidentId}`,
    });
  }

  /**
   * Enqueue case SLA check.
   */
  async enqueueCaseSlaCheck(caseId: string): Promise<string> {
    return this.createTask('case-sla-check', {
      type: 'CASE_SLA_CHECK',
      payload: { caseId },
      priority: 4,
      maxRetries: 1,
      scheduledFor: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min from now
    });
  }

  /**
   * Get queue statistics.
   */
  async getQueueStats(queueName: string): Promise<{ pending: number; oldestTaskAge?: string }> {
    try {
      const queuePath = this.getQueuePath(queueName);
      // This would require Cloud Tasks API to list tasks
      // For now, return placeholder
      return { pending: 0 };
    } catch {
      return { pending: 0 };
    }
  }

  /**
   * Purge a queue (use with caution).
   */
  async purgeQueue(queueName: string): Promise<void> {
    const queuePath = this.getQueuePath(queueName);
    await this.client.purgeQueue({ name: queuePath });
    console.log(`[TaskQueue] Purged queue ${queueName}`);
  }
}

// Singleton instance
let taskQueueInstance: TaskQueueClient | null = null;

export function getTaskQueue(): TaskQueueClient {
  if (!taskQueueInstance) {
    taskQueueInstance = new TaskQueueClient({
      projectId: process.env.GCP_PROJECT_ID || 'da-costa-unisoc23v1-6386-61f95',
      location: process.env.CLOUD_TASKS_LOCATION || 'europe-west1',
    });
  }
  return taskQueueInstance;
}

// Convenience functions
export async function enqueueTask(
  queueName: string,
  payload: Omit<TaskPayload, 'taskId' | 'idempotencyKey' | 'createdAt'> & { taskId?: string }
): Promise<string> {
  return getTaskQueue().createTask(queueName, payload);
}

export async function enqueueAgentLoop(
  step: TaskType,
  payload: Record<string, unknown>,
  options?: { priority?: number; retries?: number; idempotencyKey?: string }
): Promise<string> {
  return getTaskQueue().enqueueAgentLoopStep(step, payload, options);
}