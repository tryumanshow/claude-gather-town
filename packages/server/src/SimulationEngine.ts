import { EventEmitter } from 'events';
import { WorldState } from './WorldState.js';
import type { ParsedCommand } from './CommandParser.js';
import type { ServerMessage, WorldSnapshotPayload, AgentType, ZoneName, AgentPermissionPayload } from '@theater/shared';
import { TIMING, TILE_SIZE, ZONES, AGENT_ROSTER } from '@theater/shared';
import type { RosterInitPayload } from '@theater/shared';
import { RealExecutionEngine, type RealExecutionConfig } from './RealExecutionEngine.js';

export class SimulationEngine extends EventEmitter {
  world: WorldState = new WorldState();
  private realEngine: RealExecutionEngine | null = null;

  /** Configure the real execution engine (requires Claude CLI auth) */
  setRealEngine(config: RealExecutionConfig): void {
    this.realEngine = new RealExecutionEngine(config);
  }

  /** Update the working directory of the real execution engine */
  updateRealEngineWorkingDirectory(path: string): void {
    if (this.realEngine) {
      this.realEngine.updateWorkingDirectory(path);
    }
  }

  /** Trigger codebase awareness scan for all roster agents */
  triggerCodebaseScan(): void {
    if (!this.realEngine) return;
    this.realEngine.runCodebaseScan(this).catch(err => {
      this.log('error', 'SimulationEngine', `Codebase scan failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  // clearChatAgent removed — no persistent chat agent state

  /** Set or clear the permission handler for the real execution engine */
  setPermissionHandler(handler: ((req: AgentPermissionPayload) => Promise<boolean>) | undefined): void {
    if (this.realEngine) {
      this.realEngine.setPermissionHandler(handler);
    }
  }

  getSnapshot(): ServerMessage {
    return {
      type: 'world:snapshot',
      payload: {
        ...this.world.toSnapshot(),
      } as WorldSnapshotPayload,
    };
  }

  /** Generate roster:init message for new client connections */
  getRosterInit(): ServerMessage {
    const agents = AGENT_ROSTER.map(ra => ({
      id: `roster-${ra.id}`,
      name: ra.name,
      role: ra.role,
      agentType: ra.agentType,
      color: ra.color,
      homeZone: ra.homeZone,
      state: 'idle' as const,
    }));
    return {
      type: 'roster:init',
      payload: { agents } as RosterInitPayload,
    };
  }

  private playerPos: { x: number; y: number } = { x: 640, y: 640 };

  setPlayerPos(x: number, y: number): void {
    this.playerPos = { x, y };
  }

  async execute(command: ParsedCommand): Promise<void> {
    // Stop active sessions but preserve conversation state (history, lastChatAgentId)
    this.softReset();
    this.world.mode = command.mode;
    this.emitStatus();

    if (this.realEngine) {
      this.log('info', 'SimulationEngine', `Execution (${command.mode}): ${command.description}`);
      try {
        await this.realEngine.execute(command, this, this.playerPos);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg === 'Cancelled') {
          this.log('info', 'SimulationEngine', 'Execution cancelled');
        } else {
          this.log('error', 'SimulationEngine', `Execution failed: ${errMsg}`);
        }
      } finally {
        this.emitStatus();
      }
    }
  }

  /** Apply a server event to the world state (used by RealExecutionEngine) */
  applyEvent(event: ServerMessage): void {
    switch (event.type) {
      case 'agent:spawn': {
        const p = event.payload;
        this.world.createAgent(p.agentType, {
          role: p.role,
          parentId: p.parentId,
          teamId: p.teamId,
          x: p.x,
          y: p.y,
        });
        const agents = Array.from(this.world.agents.values());
        const last = agents[agents.length - 1];
        if (last) {
          this.world.agents.delete(last.id);
          last.id = p.agentId;
          last.displayName = p.displayName;
          last.color = p.color;
          this.world.agents.set(p.agentId, last);
        }
        break;
      }
      case 'agent:state': {
        this.world.updateAgent(event.payload.agentId, { state: event.payload.state });
        break;
      }
      case 'agent:move': {
        const p = event.payload;
        this.world.updateAgent(p.agentId, {
          x: p.targetX,
          y: p.targetY,
          currentZone: p.targetZone,
        });
        break;
      }
      case 'agent:tool': {
        this.world.updateAgent(event.payload.agentId, {
          state: 'acting',
          currentTool: event.payload.tool,
        });
        break;
      }
      case 'agent:despawn': {
        this.world.removeAgent(event.payload.agentId);
        break;
      }
      case 'task:event': {
        const p = event.payload;
        if (p.action === 'create') {
          this.world.tasks.set(p.task.id, p.task);
        } else {
          this.world.updateTask(p.task.id, p.task);
        }
        break;
      }
      case 'message:send': {
        const p = event.payload;
        this.world.addMessage(p.fromId, p.toId, p.content, p.summary);
        break;
      }
    }
    this.world.tick++;
  }

  /** Soft reset: stop active sessions but preserve conversation state */
  private softReset(): void {
    if (this.realEngine) {
      this.realEngine.stopSessions();
    }
    this.world.reset();
    this.emit('event', this.getSnapshot());
  }

  /** Hard reset: clear everything including conversation history (New Session / Cancel) */
  reset(): void {
    if (this.realEngine) {
      this.realEngine.stopAll();
    }
    this.world.reset();
    this.emit('event', this.getSnapshot());
    this.log('info', 'SimulationEngine', 'Reset');
  }

  setSpeed(speed: number): void {
    this.world.speed = Math.max(0.25, Math.min(5, speed));
    this.log('info', 'SimulationEngine', `Speed set to ${this.world.speed}x`);
    this.emitStatus();
  }

  log(level: 'info' | 'warn' | 'error' | 'debug', source: string, message: string, agentInfo?: { agentId?: string; agentName?: string; agentColor?: string }): void {
    this.emit('event', {
      type: 'sim:log',
      payload: { timestamp: Date.now(), level, source, message, ...agentInfo },
    } as ServerMessage);
  }

  private emitStatus(): void {
    this.emit('event', {
      type: 'sim:status',
      payload: {
        mode: this.world.mode,
        speed: this.world.speed,
        agentCount: this.world.agents.size,
        taskCount: this.world.tasks.size,
      },
    } as ServerMessage);
  }
}
