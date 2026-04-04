import React, { useState, useEffect, useMemo } from 'react';
import { EventBus } from '../EventBus.ts';
import { fromRosterId } from '@theater/shared';
import type { TaskEventPayload, WorldSnapshotPayload, TaskData } from '@theater/shared';

// Module-level components for stable references across renders
function TaskCard({ task, color }: { task: TaskData; color: string }) {
  return (
    <div style={{
      padding: '5px 8px',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: '5px',
      marginBottom: '3px',
      fontSize: '11px',
      borderLeft: `2px solid ${color}`,
    }}>
      <div style={{ color: '#ccc', fontWeight: 500, lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.subject}
      </div>
      {task.ownerName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
          <span style={{
            background: task.ownerColor || '#444',
            color: '#fff',
            borderRadius: '2px',
            padding: '0px 5px',
            fontSize: '9px',
            fontWeight: 700,
            lineHeight: '14px',
          }}>
            {task.ownerName}
          </span>
        </div>
      )}
      {!task.ownerName && task.ownerId && (
        <div style={{ color: '#555', fontSize: '9px', marginTop: '2px' }}>
          {fromRosterId(task.ownerId)}
        </div>
      )}
    </div>
  );
}

function Column({ title, items, color, icon }: { title: string; items: TaskData[]; color: string; icon: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        fontSize: '10px', color, fontWeight: 700, marginBottom: '6px',
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        <span style={{ fontSize: '10px' }}>{icon}</span>
        {title} ({items.length})
      </div>
      {items.map(task => (
        <TaskCard key={task.id} task={task} color={color} />
      ))}
    </div>
  );
}

export function TaskBoard() {
  const [tasks, setTasks] = useState<TaskData[]>([]);

  useEffect(() => {
    const onTaskEvent = (payload: TaskEventPayload) => {
      setTasks(prev => {
        const next = prev.filter(t => t.id !== payload.task.id);
        // Keep completed tasks visible
        next.push(payload.task);
        return next;
      });
    };

    const onSnapshot = (payload: WorldSnapshotPayload) => {
      setTasks(payload.tasks);
    };

    EventBus.on('ws:task:event', onTaskEvent);
    EventBus.on('ws:world:snapshot', onSnapshot);

    return () => {
      EventBus.off('ws:task:event', onTaskEvent);
      EventBus.off('ws:world:snapshot', onSnapshot);
    };
  }, []);

  // Memoized — only recomputes when tasks array reference changes
  const { pending, inProgress, completed } = useMemo(() => ({
    pending: tasks.filter(t => t.status === 'pending'),
    inProgress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  }), [tasks]);

  return (
    <div style={{
      padding: '12px 14px',
      borderTop: '1px solid #1a1a3e',
    }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, color: '#e94560',
        textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Task Board</span>
        {tasks.length > 0 && (
          <span style={{
            background: '#e94560', color: '#fff', borderRadius: '10px',
            padding: '1px 8px', fontSize: '10px', fontWeight: 700,
          }}>{tasks.length}</span>
        )}
      </div>
      {tasks.length === 0 ? (
        <div style={{ color: '#444', fontSize: '11px', textAlign: 'center', padding: '16px 4px' }}>
          <div style={{ fontSize: '16px', marginBottom: '6px' }}>☕</div>
          <div style={{ color: '#555' }}>팀이 대기 중이에요</div>
          <div style={{ color: '#3a3a3a', fontSize: '10px', marginTop: '4px' }}>아래에서 태스크를 입력하면 작업이 시작됩니다</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Column title="Todo" items={pending} color="#b0b8c0" icon="○" />
          <Column title="Doing" items={inProgress} color="#f39c12" icon="◉" />
          <Column title="Done" items={completed} color="#2ecc71" icon="●" />
        </div>
      )}
    </div>
  );
}
